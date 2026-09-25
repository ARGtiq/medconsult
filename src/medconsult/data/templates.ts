import { COMPLAINTS, LOCAL_PACKS } from "./catalog";
import type { LocalPack, WorkKind } from "../types";
import { useEffect, useState } from "react";
import { cloneScales, QUESTION_SCALES, type ScaleDef } from "./questionnaires";

const KEY = "medconsult_v2_templates";

export type VitaePreset = {
  id: string;
  label: string;
  needsDate?: boolean;
  emptyDateText?: string;
};

export type DocKind = {
  id: string;
  title: string;
  copyPrevious?: boolean;
};

/** Document/visit template = named set of block-templates. */
export type VisitPack = {
  id: string;
  name: string;
  codes: string[];
  kind: WorkKind;
  stdBlocks: string[];
  extraKinds: string[];
  localPackIds: string[];
};

/** Dictionary item: main complaint + optional qualifiers (side, type…). */
export type ComplaintTemplate = {
  text: string;
  options?: string[];
};

/** Named paragraph for the objective-status block. */
export type ObjectiveTemplate = {
  id: string;
  label: string;
  text: string;
  codes?: string[];
};

export type TemplatesState = {
  localPacks: LocalPack[];
  chronic: VitaePreset[];
  surgeries: VitaePreset[];
  docKinds: DocKind[];
  complaints: ComplaintTemplate[];
  visitPacks: VisitPack[];
  questionnaires: ScaleDef[];
  objective: ObjectiveTemplate[];
};

export const SEED_CHRONIC: VitaePreset[] = [
  { id: "asthma", label: "бронхиальная астма" },
  { id: "gastritis", label: "гастрит" },
  { id: "htn", label: "гипертоническая болезнь" },
  { id: "bph", label: "ДГПЖ" },
  { id: "ihd", label: "ИБС" },
  { id: "mi", label: "инфаркт миокарда", needsDate: true },
  { id: "urolith", label: "мочекаменная болезнь" },
  { id: "cva", label: "ОНМК", needsDate: true },
  { id: "pancreatitis", label: "панкреатит" },
  { id: "dm1", label: "сахарный диабет 1 типа" },
  { id: "dm2", label: "сахарный диабет 2 типа" },
  { id: "cholecystitis", label: "холецистит" },
  { id: "copd", label: "ХОБЛ" },
  { id: "prostatitis", label: "хронический простатит" },
];

export const SEED_SURGERIES: VitaePreset[] = [
  { id: "appendectomy", label: "аппендэктомия", needsDate: true, emptyDateText: "давно" },
  { id: "varicocele", label: "варикоцелэктомия", needsDate: true },
  { id: "hernia_inguinal", label: "герниопластика по поводу паховой грыжи", needsDate: true },
  { id: "hernia_umbilical", label: "герниопластика по поводу пупочной грыжи", needsDate: true },
  { id: "nephrectomy", label: "нефрэктомия", needsDate: true },
  { id: "orchiectomy", label: "орхиэктомия", needsDate: true },
  { id: "prostatectomy", label: "простатэктомия", needsDate: true },
  { id: "turp", label: "ТУР простаты", needsDate: true },
  { id: "cholecystectomy", label: "холецистэктомия", needsDate: true },
];

export const SEED_DOC_KINDS: DocKind[] = [
  { id: "op_protocol", title: "Протокол операции" },
  { id: "diary", title: "Дневник", copyPrevious: true },
  { id: "given_meds", title: "Проведённые назначения", copyPrevious: true },
  { id: "epicrisis", title: "Эпикриз" },
  { id: "direction", title: "Направление" },
  { id: "certificate", title: "Справка" },
];

const SIDE = ["справа", "слева", "с обеих сторон"];

const SEED_COMPLAINT_OPTIONS: Record<string, string[]> = {
  "боль в пояснице": SIDE,
  "боль внизу живота": ["справа", "слева", "по центру", "с обеих сторон"],
  "боль в мошонке": SIDE,
};

export const SEED_COMPLAINTS: ComplaintTemplate[] = COMPLAINTS.map((c) => {
  const options = SEED_COMPLAINT_OPTIONS[c.text];
  return options ? { text: c.text, options: [...options] } : { text: c.text };
});

export const STD_DOC_BLOCKS = [
  { id: "complaints", title: "Жалобы" },
  { id: "anamnesis", title: "Анамнез заболевания" },
  { id: "anamnesisVitae", title: "Анамнез жизни" },
  { id: "status", title: "Статус" },
  { id: "diagnosis", title: "Диагноз" },
  { id: "recommendations", title: "Назначения" },
] as const;

const ALL_STD = STD_DOC_BLOCKS.map((b) => b.id);

export const SEED_VISIT_PACKS: VisitPack[] = [
  {
    id: "pack_primary",
    name: "Первичный осмотр",
    kind: "primary",
    codes: [],
    stdBlocks: [...ALL_STD],
    extraKinds: [],
    localPackIds: [],
  },
  {
    id: "pack_followup",
    name: "Повторный осмотр",
    kind: "followup",
    codes: [],
    stdBlocks: ["complaints", "anamnesis", "status", "diagnosis", "recommendations"],
    extraKinds: [],
    localPackIds: [],
  },
  {
    id: "pack_epicrisis",
    name: "Эпикриз",
    kind: "document",
    codes: [],
    stdBlocks: ["diagnosis", "recommendations"],
    extraKinds: ["epicrisis"],
    localPackIds: [],
  },
  {
    id: "pack_op",
    name: "Протокол операции",
    kind: "document",
    codes: [],
    stdBlocks: [],
    extraKinds: ["op_protocol"],
    localPackIds: [],
  },
];

export const SEED_OBJECTIVE: ObjectiveTemplate[] = [
  { id: "obj_sat", label: "удовлетворительное", text: "Состояние удовлетворительное." },
  {
    id: "obj_exam",
    label: "осмотр",
    text: "Состояние удовлетворительное. Кожные покровы обычной окраски. Живот мягкий, безболезненный. Симптом поколачивания отрицательный с обеих сторон. Наружные половые органы без особенностей.",
  },
];

export const seedTemplates = (): TemplatesState => ({
  localPacks: LOCAL_PACKS.map((p) => ({ ...p, chips: [...p.chips] })),
  chronic: SEED_CHRONIC.map((x) => ({ ...x })),
  surgeries: SEED_SURGERIES.map((x) => ({ ...x })),
  docKinds: SEED_DOC_KINDS.map((x) => ({ ...x })),
  complaints: SEED_COMPLAINTS.map((c) => ({ text: c.text, options: c.options ? [...c.options] : undefined })),
  visitPacks: SEED_VISIT_PACKS.map((p) => ({ ...p, codes: [...p.codes], stdBlocks: [...p.stdBlocks], extraKinds: [...p.extraKinds], localPackIds: [...p.localPackIds] })),
  questionnaires: cloneScales(QUESTION_SCALES),
  objective: SEED_OBJECTIVE.map((x) => ({ ...x, codes: x.codes ? [...x.codes] : [] })),
});

export function normalizeComplaint(raw: unknown): ComplaintTemplate | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? { text } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { text?: unknown; options?: unknown };
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!text) return null;
  if (Array.isArray(o.options)) {
    const options = o.options.map((x) => String(x).trim()).filter(Boolean);
    return { text, options };
  }
  return { text };
}

function mergeComplaints(saved: unknown, seed: ComplaintTemplate[]): ComplaintTemplate[] {
  const list = Array.isArray(saved)
    ? (saved.map(normalizeComplaint).filter(Boolean) as ComplaintTemplate[])
    : [];
  if (!list.length) return seed.map((c) => ({ text: c.text, options: c.options ? [...c.options] : undefined }));
  const seedBy = Object.fromEntries(seed.map((s) => [s.text.toLowerCase(), s]));
  return list.map((s) => {
    const base = seedBy[s.text.toLowerCase()];
    if (!base) return s;
    if (Array.isArray(s.options)) return s;
    return { text: s.text, options: base.options ? [...base.options] : undefined };
  });
}

function mergeQuestionnaires(saved: ScaleDef[], seed: ScaleDef[]): ScaleDef[] {
  const seedBy = Object.fromEntries(seed.map((s) => [s.totalKey, s]));
  return saved.map((s) => {
    const base = seedBy[s.totalKey];
    if (!base) return s;
    return {
      ...s,
      codes: s.codes?.length ? s.codes : base.codes,
      verdicts: s.verdicts?.length ? s.verdicts : base.verdicts,
      sum: s.sum ?? base.sum,
    };
  });
}

function normalizeObjective(raw: unknown): ObjectiveTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { id?: unknown; label?: unknown; text?: unknown; codes?: unknown };
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!text) return null;
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : text.slice(0, 42);
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `obj_${label}`;
  const codes = Array.isArray(o.codes) ? o.codes.map((c) => String(c).trim()).filter(Boolean) : [];
  return { id, label, text, codes };
}

function read(): TemplatesState {
  const seed = seedTemplates();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<TemplatesState>;
    return {
      localPacks: Array.isArray(parsed.localPacks) && parsed.localPacks.length ? parsed.localPacks : seed.localPacks,
      chronic: Array.isArray(parsed.chronic) && parsed.chronic.length ? parsed.chronic : seed.chronic,
      surgeries: Array.isArray(parsed.surgeries) && parsed.surgeries.length ? parsed.surgeries : seed.surgeries,
      docKinds: Array.isArray(parsed.docKinds) && parsed.docKinds.length ? parsed.docKinds : seed.docKinds,
      complaints: mergeComplaints(parsed.complaints, seed.complaints),
      visitPacks: Array.isArray(parsed.visitPacks) ? parsed.visitPacks : seed.visitPacks,
      questionnaires:
        Array.isArray(parsed.questionnaires) && parsed.questionnaires.length
          ? mergeQuestionnaires(parsed.questionnaires, seed.questionnaires)
          : seed.questionnaires,
      objective: Array.isArray(parsed.objective)
        ? (parsed.objective.map(normalizeObjective).filter(Boolean) as ObjectiveTemplate[])
        : seed.objective,
    };
  } catch {
    return seed;
  }
}

function write(next: TemplatesState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("medconsult-templates"));
}

export function getTemplates(): TemplatesState {
  return read();
}

export function saveTemplates(patch: Partial<TemplatesState>) {
  write({ ...read(), ...patch });
}

export function getLocalPacks(): LocalPack[] {
  return read().localPacks;
}

export function getChronicPresets(): VitaePreset[] {
  return read().chronic;
}

export function getSurgeryPresets(): VitaePreset[] {
  return read().surgeries;
}

export function getDocKinds(): DocKind[] {
  return read().docKinds;
}

export function getComplaintPresets(): string[] {
  return read().complaints.map((c) => c.text);
}

export function getComplaintTemplates(): ComplaintTemplate[] {
  return read().complaints;
}

export function getVisitPacks(): VisitPack[] {
  return read().visitPacks;
}

export function getQuestionScales(): ScaleDef[] {
  return read().questionnaires;
}

export function packsMatchingCode(code: string): VisitPack[] {
  const all = getVisitPacks();
  if (!code) return [];
  const prefix = code.split(".")[0];
  return all.filter((p) => p.codes.includes(code) || (prefix && p.codes.includes(prefix)));
}

export function addComplaintTemplate(text: string) {
  const t = text.trim();
  if (!t) return;
  const state = read();
  const key = t.toLowerCase();
  if (state.complaints.some((c) => c.text.toLowerCase() === key)) return;
  if (state.complaints.some((c) => key.startsWith(c.text.toLowerCase() + " "))) return;
  write({ ...state, complaints: [...state.complaints, { text: t }] });
}

export function packsForCodeLive(code: string) {
  const all = getLocalPacks();
  if (!code) return all.filter((p) => p.id === "custom_free" || p.codes.length === 0);
  const prefix = code.split(".")[0];
  return all.filter(
    (p) => p.codes.includes(code) || p.codes.includes(prefix) || p.id === "custom_free" || p.codes.length === 0,
  );
}

/** Save a custom local-status phrase as a reusable template for this ICD. */
export function addLocalChipToCode(code: string, chip: string) {
  const text = chip.trim();
  if (!text) return;
  const t = read();
  const packs = t.localPacks.map((p) => ({ ...p, chips: [...p.chips] }));
  const prefix = code ? code.split(".")[0] : "";
  let hit = code
    ? packs.find((p) => p.codes.includes(code) || (prefix && p.codes.includes(prefix)))
    : packs.find((p) => p.id === "custom_free");
  if (!hit) {
    hit = {
      id: code ? `custom_${code}` : "custom_free",
      codes: code ? [code] : [],
      label: code ? `свои · ${code}` : "свои",
      chips: [],
    };
    packs.push(hit);
  }
  if (!hit.chips.includes(text)) hit.chips.push(text);
  write({ ...t, localPacks: packs });
}

export function addObjectiveTemplate(label: string, text: string): "added" | "exists" | "empty" {
  const body = text.trim();
  if (!body) return "empty";
  const state = read();
  if (state.objective.some((x) => x.text.trim() === body)) return "exists";
  const name = label.trim() || body.slice(0, 42);
  write({
    ...state,
    objective: [
      ...state.objective,
      { id: `obj_${Date.now().toString(36)}`, label: name, text: body, codes: [] },
    ],
  });
  return "added";
}

export function resetTemplates() {
  write(seedTemplates());
}

export function useTemplates(): TemplatesState {
  const [data, setData] = useState<TemplatesState>(() => getTemplates());
  useEffect(() => {
    const reload = () => setData(getTemplates());
    window.addEventListener("medconsult-templates", reload);
    return () => window.removeEventListener("medconsult-templates", reload);
  }, []);
  return data;
}
