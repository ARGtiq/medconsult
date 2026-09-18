import { store } from "@/legacy/lib/store";
import { DRUG_GROUPS } from "@/legacy/data/drugSafety";
import { getAllMkb10 } from "@/legacy/data/mkb10";
import { COMPLAINTS, DRUGS, ICD, complaintsForCode, guidelineForCode } from "./data/catalog";
import { getComplaintPresets } from "./data/templates";
import { STUDIES, getStudy as seedStudy } from "./data/studies";
import type { StudyDef } from "./types";

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
    const picture = Array.isArray(g.clinicalPicture) ? (g.clinicalPicture as string[]) : [];
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
        words.push({ id: "w-" + w, label: w, hint: "слово" });
      }
    }
  }

  for (const t of phrases) {
    const low = t.toLowerCase();
    if (seen.has(low)) continue;
    if (!matchPhraseOrWord(t, query)) continue;
    seen.add(low);
    const multi = tokensOf(t).length > 1;
    combo.push({ id: "p-" + t, label: t, hint: multi ? "фраза" : undefined });
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
  try {
    const live = store.getAllStudies() as StudyDef[];
    if (live?.length) {
      const keys = new Set(live.map((s) => s.key));
      return [...live.map((s) => overlayComputed(s)), ...STUDIES.filter((s) => !keys.has(s.key))];
    }
  } catch {
    /* seed */
  }
  return STUDIES;
}

export function getStudyLive(key: string): StudyDef | null {
  const fromLive = allStudiesLive().find((s) => s.key === key);
  return fromLive || seedStudy(key);
}

function overlayComputed(def: StudyDef): StudyDef {
  const seed = STUDIES.find((s) => s.key === def.key);
  if (!seed) return def;
  const byKey = new Map((def.fields || []).map((f) => [f.key, f]));
  for (const s of seed.fields) {
    const cur = byKey.get(s.key);
    if (!cur) byKey.set(s.key, s);
    else if (s.computed) byKey.set(s.key, { ...cur, computed: true, formula: s.formula });
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
