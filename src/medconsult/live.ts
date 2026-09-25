import { store } from "@/legacy/lib/store";
import { explicitChips } from "@/legacy/lib/guidelineChips";
import { DRUG_GROUPS } from "@/legacy/data/drugSafety";
import { getAllMkb10 } from "@/legacy/data/mkb10";
import { COMPLAINTS, DRUGS, ICD, complaintsForCode, guidelineForCode } from "./data/catalog";
import { getComplaintPresets, getComplaintTemplates, type ComplaintTemplate } from "./data/templates";
import { STUDIES, getStudy as seedStudy, studiesFromScales, fieldAbnormal } from "./data/studies";
import type { StudyDef, StudyEntry, StudyField } from "./types";

export function liveIcd(): { code: string; title: string }[] {
  try {
    return getAllMkb10().map((x: { code: string; label: string }) => ({ code: x.code, title: x.label }));
  } catch {
    return [];
  }
}

export function liveIcdMerged(): { code: string; title: string }[] {
  const live = liveIcd();
  if (!live.length) return ICD;
  const codes = new Set(live.map((i) => i.code));
  return [...live, ...ICD.filter((i) => !codes.has(i.code))];
}

function compactIcd(s: string) {
  return s.toLowerCase().replace(/[.\s]/g, "");
}

export function searchIcd(query: string, limit = 12): { code: string; title: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const compact = compactIcd(q);
  const scored: { code: string; title: string; score: number }[] = [];
  for (const i of liveIcdMerged()) {
    const code = i.code.toLowerCase();
    const cc = compactIcd(i.code);
    const title = i.title.toLowerCase();
    let score = 0;
    if (code === q || cc === compact) score = 100;
    else if (code.startsWith(q) || cc.startsWith(compact)) score = 90;
    else if (cc.includes(compact) || code.includes(q)) score = 70;
    else if (title.startsWith(q)) score = 55;
    else if (title.split(/[\s,;:()]+/).some((w) => w.startsWith(q))) score = 45;
    else if (title.includes(q)) score = 30;
    if (score) scored.push({ code: i.code, title: i.title, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code, "ru"));
  return scored.slice(0, limit).map(({ code, title }) => ({ code, title }));
}

export function icdMatches(codes: string[] | undefined, diagnosis: string) {
  if (!codes?.length || !diagnosis) return false;
  const d = compactIcd(diagnosis);
  if (!d) return false;
  return codes.some((c) => {
    const u = compactIcd(c);
    if (!u) return false;
    return d === u || d.startsWith(u) || u.startsWith(d);
  });
}

export function liveDrugs(): { name: string; dose: string }[] {
  try {
    return Object.values(store.getDrugInfoAll() || {})
      .map((d) => ({
        name: d.name || "",
        dose: [d.dosage, d.frequency].filter(Boolean).join(" "),
      }))
      .filter((d) => d.name);
  } catch {
    return [];
  }
}

export function liveDrugsMerged(): { name: string; dose: string }[] {
  const live = liveDrugs();
  const seed = DRUGS.map((d) => ({ name: d.name, dose: d.dose }));
  if (!live.length) return seed;
  const names = new Set(live.map((d) => d.name.toLowerCase()));
  return [...live, ...seed.filter((d) => !names.has(d.name.toLowerCase()))];
}

export function liveGuidelines(): Record<string, unknown>[] {
  try {
    const g = store.getGuidelines();
    if (Array.isArray(g)) return g as Record<string, unknown>[];
    return Object.values(g || {}) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

export function liveGuidelinesForCode(code: string) {
  if (!code) return [] as Record<string, unknown>[];
  try {
    const stem = code.split(".")[0];
    return store.getGuidelinesForCodes([stem, code].map((c) => c.toUpperCase())) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

export type CompactGuideline = {
  id: string;
  title: string;
  scenarios: string[];
  recs: string[];
  complaints: string[];
};

export function compactGuideline(code: string): CompactGuideline | null {
  const live = liveGuidelinesForCode(code);
  if (live[0]) {
    const g = live[0];
    const scenarios = Array.isArray(g.scenarios) ? (g.scenarios as { name?: string; drugs?: { name?: string; dosage?: string; dose?: string; frequency?: string; duration?: string }[] }[]) : [];
    const recs = scenarios.flatMap((s) =>
      (s.drugs || []).map((d) => [d.name, d.dosage || d.dose, d.frequency, d.duration].filter(Boolean).join(" ")),
    );
    const pictureNote =
      (typeof g.clinicalPictureNotes === "string" && g.clinicalPictureNotes.trim()) ||
      (typeof g.clinicalPicture === "string" ? g.clinicalPicture : "");
    const stored = (g.clinicalPictureChips || g.clinicalPicture) as unknown;
    const joined = Array.isArray(stored)
      ? stored
          .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "text" in x ? String((x as { text?: string }).text || "") : ""))
          .filter(Boolean)
          .join("\n")
      : "";
    const picture = (explicitChips(stored, pictureNote || joined) as { text?: string }[])
      .map((c) => (c?.text || "").trim())
      .filter(Boolean);
    return {
      id: String(g.id || "live"),
      title: String(g.title || "клинрек"),
      scenarios: scenarios.map((s) => s.name || "").filter(Boolean),
      recs,
      complaints: picture,
    };
  }
  const seed = guidelineForCode(code);
  if (!seed) return null;
  return {
    id: seed.id,
    title: seed.title,
    scenarios: seed.scenarios,
    recs: seed.recs,
    complaints: seed.complaints,
  };
}

export function liveComplaints(): string[] {
  const fromTemplates = (() => {
    try {
      return getComplaintPresets();
    } catch {
      return [] as string[];
    }
  })();
  const learned = (() => {
    try {
      return store.getComplaintSuggestions("").map((s) => s.text);
    } catch {
      return [] as string[];
    }
  })();
  return Array.from(new Set([...fromTemplates, ...learned, ...COMPLAINTS.map((c) => c.text)]));
}

export function liveComplaintTemplates(): ComplaintTemplate[] {
  try {
    return getComplaintTemplates();
  } catch {
    return [];
  }
}

export function composeComplaint(base: string, option?: string) {
  const b = base.trim();
  const o = (option || "").trim();
  return o ? `${b} ${o}` : b;
}

/** Several qualifiers on one complaint: «боль в пояснице справа, слева». */
export function composeComplaintOptions(base: string, options: string[]) {
  const b = base.trim();
  const opts = options.map((s) => s.trim()).filter(Boolean);
  return opts.length ? `${b} ${opts.join(", ")}` : b;
}

export function complaintOptionsSelected(variant: string | undefined, base: string, options: string[]): string[] {
  if (!variant) return [];
  const b = base.trim();
  if (!variant.startsWith(b + " ")) return [];
  const rest = variant.slice(b.length + 1).trim();
  if (!rest) return [];
  return rest
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => options.find((o) => o.toLowerCase() === part.toLowerCase()) || part);
}

/** Longest dictionary item that `text` equals or extends with a space + qualifier. */
export function complaintBaseOf(text: string, templates?: ComplaintTemplate[]): string {
  const t = text.trim();
  const list = (templates || liveComplaintTemplates())
    .slice()
    .sort((a, b) => b.text.length - a.text.length);
  const hit = list.find((c) => t === c.text || t.startsWith(c.text + " "));
  return hit?.text || t;
}

export function optionsForComplaint(text: string, templates?: ComplaintTemplate[]): string[] {
  const list = templates || liveComplaintTemplates();
  const key = text.trim().toLowerCase();
  const hit = list.find((c) => c.text.toLowerCase() === key);
  return hit?.options?.filter(Boolean) || [];
}

export function findComplaintVariant(selected: string[], base: string, templates?: ComplaintTemplate[]): string | undefined {
  const list = templates || liveComplaintTemplates();
  const b = base.trim();
  const longer = list.filter((c) => c.text !== b && c.text.startsWith(b + " "));
  return selected.find((s) => {
    if (s === b) return true;
    if (!s.startsWith(b + " ")) return false;
    if (longer.some((c) => s === c.text || s.startsWith(c.text + " "))) return false;
    return true;
  });
}

const WORD_SPLIT = /[^a-zа-яё0-9+]+/i;

export function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SPLIT)
    .filter((w) => w.length >= 2);
}

export function lastQueryToken(query: string): string {
  const parts = query.trim().toLowerCase().split(/\s+/);
  return parts[parts.length - 1] || "";
}

/** Whole phrase contains the query, or any token starts with the last typed word. */
export function matchPhraseOrWord(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  const hay = text.toLowerCase();
  if (hay.includes(q)) return true;
  const last = lastQueryToken(query);
  if (last.length < 2) return false;
  return tokensOf(text).some((w) => w.startsWith(last));
}

export type SuggestHit = { id: string; label: string; hint?: string };

/** Words from the dictionary plus matching phrases (словосочетания). */
export function suggestFromPhrases(query: string, phrases: string[], limit = 12): SuggestHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const last = lastQueryToken(query);
  const seen = new Set<string>();
  const words: SuggestHit[] = [];
  const combo: SuggestHit[] = [];

  if (last.length >= 2) {
    for (const t of phrases) {
      for (const w of tokensOf(t)) {
        if (!w.startsWith(last) || seen.has(w)) continue;
        seen.add(w);
        words.push({
          id: "w-" + w,
          label: w,
          hint: optionsForComplaint(w).length ? "опции" : "слово",
        });
      }
    }
  }

  for (const t of phrases) {
    const low = t.toLowerCase();
    if (seen.has(low)) continue;
    if (!matchPhraseOrWord(t, query)) continue;
    seen.add(low);
    const multi = tokensOf(t).length > 1;
    const hasOpts = optionsForComplaint(t).length > 0;
    combo.push({
      id: "p-" + t,
      label: t,
      hint: hasOpts ? "опции" : multi ? "фраза" : undefined,
    });
  }

  words.sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label, "ru"));
  combo.sort((a, b) => {
    const as = a.label.toLowerCase().startsWith(q) ? 0 : 1;
    const bs = b.label.toLowerCase().startsWith(q) ? 0 : 1;
    if (as !== bs) return as - bs;
    return a.label.localeCompare(b.label, "ru");
  });

  return [...words, ...combo].slice(0, limit);
}

export function suggestComplaints(query: string, limit = 12): SuggestHit[] {
  return suggestFromPhrases(query, liveComplaints(), limit);
}

export function complaintsForSession(code: string) {
  const fromCode = [
    ...complaintsForCode(code).map((c) => c.text),
    ...(compactGuideline(code)?.complaints || []),
  ];
  const uniqueCode = Array.from(new Set(fromCode));
  const rest = liveComplaints().filter((t) => !uniqueCode.includes(t));
  return { fromCode: uniqueCode, rest };
}

export function allStudiesLive(): StudyDef[] {
  const qStudies = studiesFromScales();
  const qKeys = new Set(qStudies.map((s) => s.key));
  let hidden = new Set<string>();
  try {
    hidden = new Set((store.getHiddenStudies?.() as string[]) || []);
  } catch {
    hidden = new Set();
  }
  let base: StudyDef[] = [];
  try {
    const live = store.getAllStudies() as StudyDef[];
    if (live?.length) {
      const keys = new Set(live.map((s) => s.key));
      base = [...live.map((s) => overlayComputed(s)), ...STUDIES.filter((s) => !keys.has(s.key))];
    }
  } catch {
    /* seed */
  }
  if (!base.length) base = STUDIES;
  const rest = base.filter((s) => s.category !== "questionnaire" && s.key !== "questionnaires" && !qKeys.has(s.key));
  return [...rest, ...qStudies].filter((s) => !hidden.has(s.key));
}

export function getStudyLive(key: string): StudyDef | null {
  const fromLive = allStudiesLive().find((s) => s.key === key);
  return fromLive || seedStudy(key);
}

export function findStudyByChip(text: string): StudyDef | null {
  const q = (text || "").trim().toLowerCase();
  if (!q) return null;
  const studies = allStudiesLive();
  const exact = studies.find((s) => s.label.toLowerCase() === q || s.key.toLowerCase() === q);
  if (exact) return exact;
  const starts = studies.filter((s) => {
    const lab = s.label.toLowerCase();
    return lab.startsWith(q) || (q.length >= 3 && q.startsWith(lab));
  });
  if (starts.length === 1) return starts[0];
  if (q.length < 3) return null;
  const includes = studies.filter((s) => s.label.toLowerCase().includes(q));
  return includes.length === 1 ? includes[0] : null;
}

/** Qualitative result that means "found", when the field has no reference of its own. */
function valueLooksFound(value: string): boolean {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return false;
  if (/^(не(\s|$)|отриц|отсут|нет(\s|$)|норма\b|негат|neg(ative)?(\s|$)|[-—–.]+|0+)$/.test(v)) return false;
  return true;
}

function indicatorHit(value: string, field: StudyField, all: Record<string, string>): boolean {
  const v = value.trim();
  if (!v) return false;
  const hasRef = !!(field.normal?.trim() || field.refOp);
  if (hasRef) return fieldAbnormal(v, field.normal, field, all);
  return valueLooksFound(v);
}

export type StudyDrugHint = {
  id: string;
  name: string;
  line: string;
  why: string;
};

/** Drug cards whose selected indicators came back positive on this visit. */
export function studyDrugHints(entries: StudyEntry[]): StudyDrugHint[] {
  let drugs: {
    name?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    studyTriggers?: {
      studyKeys?: string[];
      fieldKeys?: string[];
      timesPerDay?: string;
      days?: string;
      note?: string;
    }[];
  }[] = [];
  try {
    drugs = Object.values(store.getDrugInfoAll() || {});
  } catch {
    return [];
  }
  const out: StudyDrugHint[] = [];
  for (const drug of drugs) {
    if (!drug?.name) continue;
    for (const trigger of drug.studyTriggers || []) {
      const studyKeys = new Set((trigger.studyKeys || []).map(String));
      const fieldKeys = new Set((trigger.fieldKeys || []).map(String));
      if (!studyKeys.size || !fieldKeys.size) continue;
      const hits: string[] = [];
      for (const entry of entries || []) {
        if (!studyKeys.has(entry.key)) continue;
        const def = getStudyLive(entry.key);
        const inst = entry.instances?.[entry.instances.length - 1];
        if (!def || !inst) continue;
        for (const field of def.fields || []) {
          if (!fieldKeys.has(field.key)) continue;
          const val = inst.fields?.[field.key] || "";
          if (!indicatorHit(val, field, inst.fields || {})) continue;
          hits.push(`${def.label}: ${field.label} ${val.trim()}`);
        }
      }
      if (!hits.length) continue;
      const scheme = [
        trigger.timesPerDay ? `${trigger.timesPerDay} р/сут` : "",
        trigger.days ? `${trigger.days} дн` : "",
        trigger.note || "",
      ]
        .filter(Boolean)
        .join(", ");
      const line = scheme
        ? [drug.name, drug.dosage, scheme].filter(Boolean).join(" ")
        : drugLine({
            name: drug.name,
            dosage: drug.dosage,
            frequency: drug.frequency,
            duration: drug.duration,
          });
      out.push({ id: `${drug.name}|${hits.join("|")}`, name: drug.name, line, why: hits.join("; ") });
    }
  }
  return out;
}

function overlayComputed(def: StudyDef): StudyDef {
  const seed = STUDIES.find((s) => s.key === def.key);
  if (!seed) return def;
  const byKey = new Map((def.fields || []).map((f) => [f.key, f]));
  for (const s of seed.fields) {
    const cur = byKey.get(s.key);
    if (!cur) byKey.set(s.key, s);
    else {
      byKey.set(s.key, {
        ...s,
        ...cur,
        computed: cur.computed ?? s.computed,
        formula: cur.formula || s.formula,
        kind: cur.kind || s.kind,
        options: cur.options?.length ? cur.options : s.options,
        refOp: cur.refOp || s.refOp,
        refMin: cur.refMin ?? s.refMin,
        refMax: cur.refMax ?? s.refMax,
        refOf: cur.refOf || s.refOf,
        refOfMode: cur.refOfMode || s.refOfMode,
      });
    }
  }
  return { ...def, fields: [...byKey.values()] };
}

export function drugLine(d: { name: string; dose?: string; dosage?: string; frequency?: string; duration?: string }) {
  return [d.name, d.dose || [d.dosage, d.frequency, d.duration].filter(Boolean).join(" ")].filter(Boolean).join(" ");
}

export type DrugRecord = {
  name: string;
  dose: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  brandNames?: string;
  group?: string;
  mkb10Codes?: string;
};

export function liveDrugRecords(): DrugRecord[] {
  const fromDb: DrugRecord[] = [];
  try {
    Object.values(store.getDrugInfoAll() || {}).forEach((d) => {
      if (!d?.name) return;
      fromDb.push({
        name: d.name,
        dose: [d.dosage, d.frequency].filter(Boolean).join(" "),
        dosage: d.dosage,
        frequency: d.frequency,
        duration: d.duration,
        brandNames: d.brandNames,
        group: d.group,
        mkb10Codes: d.mkb10Codes,
      });
    });
  } catch {
    /* */
  }
  const names = new Set(fromDb.map((d) => d.name.toLowerCase()));
  for (const d of DRUGS) {
    if (names.has(d.name.toLowerCase())) continue;
    fromDb.push({ name: d.name, dose: d.dose, mkb10Codes: d.codes.join(", ") });
  }
  return fromDb;
}

export type DrugHit = {
  line: string;
  name: string;
  via: "ДВ" | "торговое" | "группа" | "МКБ";
  hint: string;
};

function groupCatalog(): { label: string; drugs: string[] }[] {
  const list: { label: string; drugs: string[] }[] = Object.values(DRUG_GROUPS).map((g) => ({
    label: g.label,
    drugs: g.drugs || [],
  }));
  try {
    Object.values(store.getCustomGroups() || {}).forEach((g) => {
      if (g?.label) list.push({ label: g.label, drugs: g.drugs || [] });
    });
  } catch {
    /* */
  }
  return list;
}

export function searchDrugs(query: string, diagnosisCode?: string): DrugHit[] {
  const records = liveDrugRecords();
  const q = query.trim().toLowerCase();
  const hits: DrugHit[] = [];
  const seen = new Set<string>();
  const push = (d: DrugRecord, via: DrugHit["via"], hint: string) => {
    const key = d.name.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    hits.push({ line: drugLine(d), name: d.name, via, hint });
  };

  if (!q) {
    if (!diagnosisCode) return [];
    const code = diagnosisCode.toUpperCase();
    const stem = code.split(".")[0];
    records.forEach((d) => {
      const codes = (d.mkb10Codes || "").toUpperCase();
      if (codes.includes(code) || (stem && codes.split(/[,\s]+/).includes(stem))) {
        push(d, "МКБ", d.mkb10Codes || code);
      }
    });
    try {
      store.getDrugsForMkbCode(code).forEach((d) => {
        if (d.name) push({ name: d.name, dose: [d.dosage, d.frequency].filter(Boolean).join(" "), ...d }, "МКБ", code);
      });
      if (stem !== code) {
        store.getDrugsForMkbCode(stem).forEach((d) => {
          if (d.name) push({ name: d.name, dose: [d.dosage, d.frequency].filter(Boolean).join(" "), ...d }, "МКБ", stem);
        });
      }
    } catch {
      /* */
    }
    return hits.slice(0, 16);
  }

  const wordStart = (s: string) =>
    tokensOf(s).some((w) => w.startsWith(q)) || s.toLowerCase().startsWith(q);

  for (const d of records) {
    if (wordStart(d.name) || d.name.toLowerCase().includes(q)) push(d, "ДВ", d.name);
  }
  for (const d of records) {
    const brands = (d.brandNames || "").toLowerCase();
    if (tokensOf(d.brandNames || "").some((w) => w.startsWith(q)) || brands.includes(q)) {
      push(d, "торговое", d.brandNames || "");
    }
  }
  for (const d of records) {
    if (wordStart(d.group || "") || (d.group || "").toLowerCase().includes(q)) push(d, "группа", d.group || "");
  }
  for (const g of groupCatalog()) {
    if (!wordStart(g.label) && !g.label.toLowerCase().includes(q)) continue;
    for (const n of g.drugs) {
      const rec = records.find((r) => r.name.toLowerCase() === n.toLowerCase()) || { name: n, dose: "" };
      push(rec, "группа", g.label);
    }
  }
  for (const d of records) {
    const codes = (d.mkb10Codes || "").toLowerCase();
    if (codes.includes(q)) push(d, "МКБ", d.mkb10Codes || "");
  }
  if (q.length >= 3) {
    liveIcdMerged()
      .filter((i) => i.code.toLowerCase().includes(q) || matchPhraseOrWord(i.title, q) || i.title.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach((i) => {
        const stem = i.code.split(".")[0].toUpperCase();
        records.forEach((d) => {
          const codes = (d.mkb10Codes || "").toUpperCase();
          if (codes.includes(i.code.toUpperCase()) || codes.split(/[,\s]+/).includes(stem)) {
            push(d, "МКБ", `${i.code} ${i.title}`);
          }
        });
      });
  }
  return hits.slice(0, 24);
}

export type AllergyHit = { id: string; label: string; hint: string; name: string };

export function searchAllergy(query: string): AllergyHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: AllergyHit[] = [];
  const seen = new Set<string>();
  const push = (label: string, hint: string) => {
    const key = label.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ id: key, label, hint, name: label });
  };
  const wordStart = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-zа-яё0-9+]+/i)
      .some((w) => w.startsWith(q));
  for (const g of groupCatalog()) {
    if (wordStart(g.label)) push(g.label, "группа");
  }
  for (const d of liveDrugRecords()) {
    if (d.name && wordStart(d.name)) push(d.name, "ДВ");
  }
  for (const d of liveDrugRecords()) {
    const brands = (d.brandNames || "").split(/[,;]/);
    if (brands.some((b) => wordStart(b.trim()))) push(d.name, "торговое");
  }
  return out.slice(0, 14);
}

export function learnedDrugs(complaints: string[], code: string): string[] {
  const names = new Set<string>();
  try {
    if (complaints.length) {
      store.getDrugsForComplaints(complaints).forEach((d) => names.add(d.drug));
    }
    if (code) {
      store.getDrugsForDiagnosisCodes([code, code.split(".")[0]]).forEach((d) => names.add(d.drug));
    }
  } catch {
    /* */
  }
  const db = liveDrugsMerged();
  return [...names]
    .map((n) => {
      const hit = db.find((d) => d.name.toLowerCase() === n.toLowerCase() || n.toLowerCase().includes(d.name.toLowerCase()));
      return hit ? drugLine(hit) : n;
    })
    .filter(Boolean);
}
