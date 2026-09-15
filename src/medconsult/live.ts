import { store } from "@/legacy/lib/store";
import { getAllMkb10 } from "@/legacy/data/mkb10";
import { COMPLAINTS, DRUGS, ICD, complaintsForCode, guidelineForCode } from "./data/catalog";
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
  const learned = (() => {
    try {
      return store.getComplaintSuggestions("").map((s) => s.text);
    } catch {
      return [];
    }
  })();
  return Array.from(new Set([...learned, ...COMPLAINTS.map((c) => c.text)]));
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
