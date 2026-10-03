import { rxText } from "@/legacy/lib/rx";
import { store } from "@/legacy/lib/store";
import { explicitChips } from "@/legacy/lib/guidelineChips";
import { getAllMkb10 } from "@/legacy/data/mkb10";
import { COMPLAINTS, ICD, complaintsForCode } from "./data/catalog";
import { getComplaintPresets, getComplaintTemplates, type ComplaintTemplate } from "./data/templates";
import { STUDIES, getStudy as seedStudy, studiesFromScales, fieldAbnormal } from "./data/studies";
import type { StudyDef, StudyEntry, StudyField } from "./types";

export const DRUG_FORMS = ["таб.", "капс.", "супп.", "р-р", "амп.", "мазь", "крем", "гель", "капли", "спрей", "порошок", "сироп", "сусп."];
export const DEFAULT_DRUG_FORM = "таб.";

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
  return liveDrugs();
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
  return null;
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
  const hits = suggestFromPhrases(query, liveComplaints(), limit);
  const counts = new Map<string, number>();
  try {
    for (const s of store.getComplaintSuggestions("") as { text: string; count: number }[]) {
      counts.set(s.text.toLowerCase(), s.count || 0);
    }
  } catch {
    /* */
  }
  hits.sort((a, b) => (counts.get(b.label.toLowerCase()) || 0) - (counts.get(a.label.toLowerCase()) || 0));
  return hits;
}

export function complaintsForSession(code: string) {
  const fromCode = [
    ...complaintsForCode(code).map((c) => c.text),
    ...(compactGuideline(code)?.complaints || []),
  ];
  const uniqueCode = Array.from(new Set(fromCode));
  const rest = liveComplaints()
    .filter((t) => !uniqueCode.includes(t))
    .sort((a, b) => (complaintCount(b) || 0) - (complaintCount(a) || 0));
  return { fromCode: uniqueCode, rest };
}

function complaintCount(text: string) {
  try {
    const hit = (store.getComplaintSuggestions(text) as { text: string; count: number }[]).find(
      (s) => s.text.toLowerCase() === text.toLowerCase(),
    );
    return hit?.count || 0;
  } catch {
    return 0;
  }
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

function triggerWhy(
  triggers: { studyKeys?: string[]; fieldKeys?: string[] }[] | undefined,
  entries: StudyEntry[],
): string[] {
  const hits: string[] = [];
  for (const trigger of triggers || []) {
    const studyKeys = new Set((trigger.studyKeys || []).map(String));
    const fieldKeys = new Set((trigger.fieldKeys || []).map(String));
    if (!studyKeys.size || !fieldKeys.size) continue;
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
  }
  return hits;
}

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
      const extra = drug as { form?: string; brandNames?: string; composition?: string };
      const line = formatDrugMention({
        name: drug.name,
        form: extra.form,
        brandNames: extra.brandNames,
        composition: extra.composition,
        dosage: drug.dosage,
        frequency: scheme || drug.frequency,
        duration: scheme ? "" : drug.duration,
      }).text;
      out.push({ id: `${drug.name}|${hits.join("|")}`, name: drug.name, line, why: hits.join("; ") });
    }
  }
  let packs: {
    id?: string;
    name?: string;
    studyTriggers?: { studyKeys?: string[]; fieldKeys?: string[]; timesPerDay?: string; days?: string; note?: string }[];
    items?: { text?: string; name?: string; dosage?: string; frequency?: string; duration?: string; studyTriggers?: { studyKeys?: string[]; fieldKeys?: string[] }[]; subs?: { text?: string; name?: string; dosage?: string; frequency?: string; duration?: string; studyTriggers?: { studyKeys?: string[]; fieldKeys?: string[] }[] }[] }[];
  }[] = [];
  try {
    packs = store.getRecommendationPacks() || [];
  } catch {
    packs = [];
  }
  const lineOf = (raw: { text?: string; name?: string; dosage?: string; frequency?: string; duration?: string; dose?: string } | string) => rxText(raw);
  for (const pack of packs) {
    const packHits = triggerWhy(pack.studyTriggers, entries);
    for (const item of pack.items || []) {
      const itemHits = triggerWhy(item.studyTriggers, entries);
      const why = [...packHits, ...itemHits];
      if (why.length) {
        const subs = (item.subs || []).map(lineOf).filter(Boolean);
        const head = lineOf(item);
        const line = subs.length ? [`* ${head}`, ...subs.map((s) => `  * ${s}`)].join("\n") : head;
        if (line) out.push({ id: `${pack.id}|${line}`, name: pack.name || head, line, why: why.join("; ") });
      }
      for (const sub of item.subs || []) {
        const subHits = triggerWhy(sub.studyTriggers, entries);
        if (!subHits.length) continue;
        const line = lineOf(sub);
        if (!line) continue;
        out.push({ id: `${pack.id}|sub|${line}`, name: pack.name || line, line, why: subHits.join("; ") });
      }
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

export function drugLine(d: { name: string; dose?: string; dosage?: string; frequency?: string; duration?: string; text?: string }) {
  return rxText(d);
}

export type DrugMention = { head: string; paren: string; text: string };

/** Строка назначения: форма и название, в скобках торговые или состав. */
export function formatDrugMention(d: {
  name: string;
  form?: string;
  brandNames?: string;
  composition?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}): DrugMention {
  const name = d.name.trim();
  const form = (d.form || "").trim();
  const parts = (d.composition || "")
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
  const brands = (d.brandNames || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tail = [d.dosage, d.frequency, d.duration].map((s) => (s || "").trim()).filter(Boolean).join(" - ");
  let head = "";
  let paren = "";
  if (parts.length > 1) {
    head = [form, name ? `«${name}»` : ""].filter(Boolean).join(" ");
    paren = parts.join(" + ");
  } else {
    head = [form, name].filter(Boolean).join(" ");
    if (brands.length > 1) paren = `${brands.join(", ")} и др. аналоги`;
    else if (brands.length === 1) paren = brands[0];
    else if (parts.length === 1) paren = parts[0];
  }
  const text = [head, paren ? `(${paren})` : "", tail].filter(Boolean).join(" ");
  return { head: head || name, paren, text: text || name };
}

export function analogsOf(lineOrName: string): { name: string; line: string }[] {
  const raw = lineOrName.trim();
  if (!raw) return [];
  const records = liveDrugRecords();
  const low = raw.toLowerCase();
  const rec =
    records.find((d) => d.name.toLowerCase() === low) ||
    records
      .slice()
      .sort((a, b) => b.name.length - a.name.length)
      .find((d) => d.name && low.includes(d.name.toLowerCase()));
  const key = (rec?.name || raw).toLowerCase();
  const seen = new Set<string>();
  const out: { name: string; line: string }[] = [];
  const push = (n: string) => {
    const k = n.trim().toLowerCase();
    if (!k || k === key || seen.has(k)) return;
    seen.add(k);
    const hit = records.find((d) => d.name.toLowerCase() === k);
    const v = variantsOf(n)[0];
    out.push({
      name: n,
      line: formatDrugMention({
        name: n,
        form: hit?.form,
        brandNames: hit?.brandNames,
        composition: hit?.composition,
        dosage: v?.dosage,
        frequency: v?.frequency,
        duration: v?.duration,
      }).text,
    });
  };
  if (rec?.group) {
    const g = rec.group.toLowerCase();
    records.forEach((d) => {
      if ((d.group || "").toLowerCase() === g) push(d.name);
    });
  }
  for (const g of groupCatalog()) {
    if (!(g.drugs || []).some((n) => n.toLowerCase() === key)) continue;
    g.drugs.forEach(push);
  }
  return out.slice(0, 12);
}

export type DrugRegimen = { label: string; dosage: string; frequency: string; duration: string };

export type DrugRecord = {
  name: string;
  dose: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  brandNames?: string;
  composition?: string;
  form?: string;
  group?: string;
  mkb10Codes?: string;
  extra?: string;
  regimens?: DrugRegimen[];
};

export function liveDrugRecords(): DrugRecord[] {
  const fromDb: DrugRecord[] = [];
  try {
    Object.values(store.getDrugInfoAll() || {}).forEach((d) => {
      if (!d?.name) return;
      const dosage = String(d.dosage || "").trim();
      const frequency = String(d.frequency || "").trim();
      const duration = String(d.duration || "").trim();
      const rawRegs = Array.isArray((d as { regimens?: DrugRegimen[] }).regimens)
        ? (d as { regimens: DrugRegimen[] }).regimens
        : [];
      const regimens = rawRegs
        .map((r) => ({
          label: String(r?.label || "").trim(),
          dosage: String(r?.dosage || "").trim(),
          frequency: String(r?.frequency || "").trim(),
          duration: String(r?.duration || "").trim(),
        }))
        .filter((r) => r.label || r.dosage || r.frequency || r.duration);
      const dose = [dosage, frequency, duration].filter(Boolean).join(" ");
      fromDb.push({
        name: d.name,
        dose,
        dosage,
        frequency,
        duration,
        brandNames: d.brandNames,
        composition: String((d as { composition?: string }).composition || "").trim(),
        form: String((d as { form?: string }).form || "").trim(),
        group: d.group,
        mkb10Codes: d.mkb10Codes,
        extra: String((d as { extra?: string }).extra || "").trim(),
        regimens,
      });
    });
  } catch {
    /* */
  }
  return fromDb;
}

export type DrugHit = {
  line: string;
  name: string;
  via: "ДВ" | "торговое" | "группа" | "МКБ" | "прочее";
  hint: string;
};

function groupCatalog(): { label: string; drugs: string[] }[] {
  const list: { label: string; drugs: string[] }[] = [];
  try {
    Object.values(store.getCustomGroups() || {}).forEach((g) => {
      if (g?.label) list.push({ label: g.label, drugs: g.drugs || [] });
    });
  } catch {
    /* */
  }
  return list;
}

function extraHit(text: string, q: string) {
  if (q.length < 3 || !text.trim()) return false;
  const hay = text.toLowerCase();
  if (hay.includes(q)) return true;
  if (tokensOf(text).some((w) => w.startsWith(q))) return true;
  const compactQ = q.replace(/[^a-zа-яё0-9]+/gi, "");
  if (compactQ.length >= 4 && hay.replace(/[^a-zа-яё0-9]+/gi, "").includes(compactQ)) return true;
  return false;
}

/** Текст «прочее» карточки, если название препарата есть в строке назначения. */
export function extraOfLine(line: string): string {
  const low = line.trim().toLowerCase();
  if (!low) return "";
  const rec = liveDrugRecords()
    .filter((d) => d.name && (d.extra || "").trim() && low.includes(d.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  return (rec?.extra || "").trim();
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
    const scheme = [d.dosage, d.frequency, d.duration].map((s) => (s || "").trim()).filter(Boolean).join(" · ") || (d.dose || "").trim();
    hits.push({ line: drugLine(d), name: d.name, via, hint: scheme || hint });
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
  for (const d of records) {
    if (extraHit(d.extra || "", q)) push(d, "прочее", d.extra || "");
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

export type DrugVariant = {
  dosage: string;
  frequency: string;
  duration: string;
  label: string;
  detail: string;
};

/** Схемы препарата: доза, кратность, курс. Если в карточке их нет — одна строка из старой схемы. */
export function variantsOf(name: string): DrugVariant[] {
  const key = name.trim().toLowerCase();
  if (!key) return [];
  const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === key);
  if (!rec) return [];
  const regs = rec.regimens || [];
  if (regs.length) {
    return regs.map((r) => {
      const scheme = [r.dosage, r.label].filter(Boolean).join(" ");
      return {
        dosage: r.dosage,
        frequency: r.frequency,
        duration: r.duration,
        label: r.label,
        detail: [r.frequency, scheme, r.duration].filter(Boolean).join(" · "),
      };
    });
  }
  if (rec.dosage || rec.frequency || rec.duration) {
    const scheme = [rec.dosage, rec.frequency, rec.duration].filter(Boolean).join(" · ");
    return [{ dosage: rec.dosage || "", frequency: rec.frequency || "", duration: rec.duration || "", label: "", detail: scheme }];
  }
  if (rec.dose) return [{ dosage: rec.dose, frequency: "", duration: "", label: "", detail: rec.dose }];
  return [];
}

export function dosesForDrug(name: string): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const v of variantsOf(name)) {
    const value = v.dosage.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    const extra = [v.frequency, v.label, v.duration].filter(Boolean).join(" · ");
    out.push({ value, label: extra || value });
  }
  return out;
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
