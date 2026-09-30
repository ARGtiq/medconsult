import { COMPLAINTS, LOCAL_PACKS } from "./catalog";
import type { LocalItem, LocalPack, LocalPick, WorkKind } from "../types";
import { useEffect, useState } from "react";
import { cloneScales, QUESTION_SCALES, type ScaleDef } from "./questionnaires";

const KEY = "medconsult_v2_templates";

export type VitaePreset = {
  id: string;
  label: string;
  needsDate?: boolean;
  emptyDateText?: string;
  about?: string;
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

/** Named set of protocol blocks plus text already filled in. */
export type GlobalTemplate = {
  id: string;
  name: string;
  codes: string[];
  kind: WorkKind;
  stdBlocks: string[];
  extraKinds: string[];
  complaints: string[];
  anamnesis: string;
  anamnesisVitae: string;
  objective: string;
  localStatus: string[];
  diagnosisCode: string;
  diagnosisTitle: string;
  recommendations: string[];
  notes: string;
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
  globalTemplates: GlobalTemplate[];
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
  { id: "objective", title: "Объективный статус" },
  { id: "status", title: "Локальный статус" },
  { id: "diagnosis", title: "Диагноз" },
  { id: "recommendations", title: "Назначения" },
] as const;

/** Порядок блоков на протоколе, если набор свой порядок не задал. */
export const DEFAULT_BLOCK_ORDER = [
  "diagnosis",
  "complaints",
  "anamnesis",
  "anamnesisVitae",
  "objective",
  "status",
  "recommendations",
] as const;

const ALL_STD = STD_DOC_BLOCKS.map((b) => b.id);

export function protocolBlockOrder(templateId: string | undefined, docStd: string[] | undefined): string[] {
  if (!templateId) return [...DEFAULT_BLOCK_ORDER];
  const known = new Set<string>(DEFAULT_BLOCK_ORDER);
  const custom = (docStd || []).filter((id) => known.has(id));
  return custom.length ? custom : [...DEFAULT_BLOCK_ORDER];
}

export const SEED_VISIT_PACKS: VisitPack[] = [
  {
    id: "pack_primary",
    name: "Первичный осмотр",
    kind: "primary",
    codes: [],
    stdBlocks: ["diagnosis", "complaints", "anamnesis", "anamnesisVitae", "objective", "status", "recommendations"],
    extraKinds: [],
    localPackIds: [],
  },
  {
    id: "pack_followup",
    name: "Повторный осмотр",
    kind: "followup",
    codes: [],
    stdBlocks: ["diagnosis", "complaints", "anamnesis", "objective", "status", "recommendations"],
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
  localPacks: LOCAL_PACKS.map((p) => ({
    ...p,
    chips: [...p.chips],
    items: p.items?.map((it) => ({ ...it, options: [...it.options] })),
  })),
  chronic: SEED_CHRONIC.map((x) => ({ ...x })),
  surgeries: SEED_SURGERIES.map((x) => ({ ...x })),
  docKinds: SEED_DOC_KINDS.map((x) => ({ ...x })),
  complaints: SEED_COMPLAINTS.map((c) => ({ text: c.text, options: c.options ? [...c.options] : undefined })),
  visitPacks: SEED_VISIT_PACKS.map((p) => ({ ...p, codes: [...p.codes], stdBlocks: [...p.stdBlocks], extraKinds: [...p.extraKinds], localPackIds: [...p.localPackIds] })),
  questionnaires: cloneScales(QUESTION_SCALES),
  objective: SEED_OBJECTIVE.map((x) => ({ ...x, codes: x.codes ? [...x.codes] : [] })),
  globalTemplates: [],
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

function asLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x));
}

export function normalizeGlobal(raw: unknown): GlobalTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<GlobalTemplate>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id && !name) return null;
  const kind =
    o.kind === "followup" || o.kind === "study" || o.kind === "document" || o.kind === "primary" ? o.kind : "primary";
  return {
    id: id || `gtpl_${Date.now().toString(36)}`,
    name: name || "шаблон",
    codes: Array.isArray(o.codes) ? o.codes.map((c) => String(c).trim()).filter(Boolean) : [],
    kind,
    stdBlocks: Array.isArray(o.stdBlocks) ? o.stdBlocks.map(String) : [...ALL_STD],
    extraKinds: Array.isArray(o.extraKinds) ? o.extraKinds.map(String) : [],
    complaints: asLines(o.complaints),
    anamnesis: typeof o.anamnesis === "string" ? o.anamnesis : "",
    anamnesisVitae: typeof o.anamnesisVitae === "string" ? o.anamnesisVitae : "",
    objective: typeof o.objective === "string" ? o.objective : "",
    localStatus: asLines(o.localStatus),
    diagnosisCode: typeof o.diagnosisCode === "string" ? o.diagnosisCode : "",
    diagnosisTitle: typeof o.diagnosisTitle === "string" ? o.diagnosisTitle : "",
    recommendations: asLines(o.recommendations),
    notes: typeof o.notes === "string" ? o.notes : "",
  };
}

const OBJECTIVE_BLOCK_MIG = "medconsult_mig_objective_block";

/** One-time: primary and follow-up packs gain the objective-status block. Later uncheck sticks. */
function migrateObjectiveBlock(packs: VisitPack[]): { packs: VisitPack[]; changed: boolean } {
  if (typeof window === "undefined") return { packs, changed: false };
  let done = false;
  try {
    done = localStorage.getItem(OBJECTIVE_BLOCK_MIG) === "1";
  } catch {
    return { packs, changed: false };
  }
  if (done) return { packs, changed: false };
  const next = packs.map((p) => {
    if (p.kind !== "primary" && p.kind !== "followup") return p;
    if (p.stdBlocks.includes("objective")) return p;
    const at = p.stdBlocks.indexOf("status");
    const stdBlocks = [...p.stdBlocks];
    if (at >= 0) stdBlocks.splice(at, 0, "objective");
    else stdBlocks.push("objective");
    return { ...p, stdBlocks };
  });
  try {
    localStorage.setItem(OBJECTIVE_BLOCK_MIG, "1");
  } catch {
    /* ignore */
  }
  const changed = next.some((p, i) => p !== packs[i]);
  return { packs: next, changed };
}

const PACK_ORDER_MIG = "medconsult_mig_pack_order";
const OLD_PRIMARY_ORDER = "complaints,anamnesis,anamnesisVitae,objective,status,diagnosis,recommendations";
const OLD_FOLLOW_ORDER = "complaints,anamnesis,objective,status,diagnosis,recommendations";

/** Старые наборы держали диагноз в конце списка. На протоколе он был первым — сохраняем это, пока пользователь сам не сдвинет. */
function migratePackOrder(packs: VisitPack[]): { packs: VisitPack[]; changed: boolean } {
  if (typeof window === "undefined") return { packs, changed: false };
  let done = false;
  try {
    done = localStorage.getItem(PACK_ORDER_MIG) === "1";
  } catch {
    return { packs, changed: false };
  }
  if (done) return { packs, changed: false };
  const next = packs.map((p) => {
    const key = p.stdBlocks.join(",");
    if (key === OLD_PRIMARY_ORDER) {
      return { ...p, stdBlocks: ["diagnosis", "complaints", "anamnesis", "anamnesisVitae", "objective", "status", "recommendations"] };
    }
    if (key === OLD_FOLLOW_ORDER) {
      return { ...p, stdBlocks: ["diagnosis", "complaints", "anamnesis", "objective", "status", "recommendations"] };
    }
    return p;
  });
  try {
    localStorage.setItem(PACK_ORDER_MIG, "1");
  } catch {
    /* ignore */
  }
  const changed = next.some((p, i) => p !== packs[i]);
  return { packs: next, changed };
}

function read(): TemplatesState {
  const seed = seedTemplates();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      try {
        localStorage.setItem(OBJECTIVE_BLOCK_MIG, "1");
      } catch {
        /* ignore */
      }
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<TemplatesState>;
    const visitPacks = Array.isArray(parsed.visitPacks) ? parsed.visitPacks : seed.visitPacks;
    const migrated = migrateObjectiveBlock(visitPacks);
    const ordered = migratePackOrder(migrated.packs);
    const state: TemplatesState = {
      localPacks: (Array.isArray(parsed.localPacks) && parsed.localPacks.length ? parsed.localPacks : seed.localPacks).map(
        normalizeLocalPack,
      ),
      chronic: Array.isArray(parsed.chronic) && parsed.chronic.length ? parsed.chronic : seed.chronic,
      surgeries: Array.isArray(parsed.surgeries) && parsed.surgeries.length ? parsed.surgeries : seed.surgeries,
      docKinds: Array.isArray(parsed.docKinds) && parsed.docKinds.length ? parsed.docKinds : seed.docKinds,
      complaints: mergeComplaints(parsed.complaints, seed.complaints),
      visitPacks: ordered.packs,
      questionnaires:
        Array.isArray(parsed.questionnaires) && parsed.questionnaires.length
          ? mergeQuestionnaires(parsed.questionnaires, seed.questionnaires)
          : seed.questionnaires,
      objective: Array.isArray(parsed.objective)
        ? (parsed.objective.map(normalizeObjective).filter(Boolean) as ObjectiveTemplate[])
        : seed.objective,
      globalTemplates: Array.isArray(parsed.globalTemplates)
        ? (parsed.globalTemplates.map(normalizeGlobal).filter(Boolean) as GlobalTemplate[])
        : [],
    };
    if (migrated.changed || ordered.changed) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }
    return state;
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

export function localItems(pack: { id: string; chips?: string[]; items?: LocalItem[] }): LocalItem[] {
  if (pack.items?.length) return pack.items;
  return (pack.chips || [])
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c, i) => ({ id: `${pack.id}_c${i}`, label: c, options: [] as string[] }));
}

export function localLine(item: LocalItem, value: string, subs?: string[]): string {
  const v = value.trim();
  const label = item.label.trim();
  let base = "";
  if (v) {
    if (!item.options.length) base = v;
    else if (v.toLowerCase() === label.toLowerCase()) base = label;
    else if (v.toLowerCase().startsWith(`${label.toLowerCase()} `)) base = v;
    else base = `${label} ${v}`;
  }
  const extra = (subs || []).map((s) => s.trim()).filter(Boolean);
  if (!base) return extra.join(", ");
  if (!extra.length) return base;
  return `${base}, ${extra.join(", ")}`;
}

export function localStatusLines(picks: LocalPick[], packs: LocalPack[], free: string[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    const pack = packs.find((p) => p.id === pick.packId);
    if (!pack) continue;
    const item = localItems(pack).find((it) => it.id === pick.itemId);
    if (!item) continue;
    const line = localLine(item, pick.value, pick.subs);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  for (const raw of free) {
    const t = raw.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      lines.push(t);
    }
  }
  return lines;
}

const KIDNEY_ITEMS: LocalItem[] = [
  {
    id: "tap",
    label: "поколачивание",
    options: ["отрицательно с обеих сторон", "положительно справа", "положительно слева"],
  },
  {
    id: "ureter",
    label: "мочеточниковые точки",
    options: ["безболезненны", "болезненны справа", "болезненны слева"],
  },
];

export function normalizeLocalPack(p: LocalPack): LocalPack {
  if (p.items?.length) return p;
  if (
    p.id === "kidney" &&
    p.chips.join("|") === "поколачивание отрицательно с обеих сторон|мочеточниковые точки безболезненны"
  ) {
    return { ...p, items: KIDNEY_ITEMS.map((it) => ({ ...it, options: [...it.options] })) };
  }
  return { ...p, items: localItems(p) };
}

export function formatLocalStatus(
  picks: LocalPick[],
  packs: LocalPack[],
  activeIds: string[],
  free: string[],
): string {
  if (!activeIds.length) return free.map((s) => s.trim()).filter(Boolean).join("; ");
  const blocks: string[] = [];
  const used = new Set<string>();
  for (const id of activeIds) {
    const pack = packs.find((p) => p.id === id);
    if (!pack) continue;
    const itemSep = pack.itemSep == null || pack.itemSep === "" ? ", " : pack.itemSep;
    const packSep = pack.packSep == null ? "." : pack.packSep;
    const lines: string[] = [];
    for (const it of localItems(pack)) {
      const pick = picks.find((p) => p.packId === id && p.itemId === it.id);
      if (!pick) continue;
      const line = localLine(it, pick.value, pick.subs);
      if (!line || used.has(line)) continue;
      used.add(line);
      lines.push(line);
    }
    if (!lines.length) continue;
    let text = lines.join(itemSep);
    const end = packSep.trim();
    if (end && !text.endsWith(end)) text = `${text}${packSep.startsWith(" ") ? packSep : end === packSep ? packSep : packSep}`;
    blocks.push(text);
  }
  for (const raw of free) {
    const t = raw.trim();
    if (t && !used.has(t)) blocks.push(t);
  }
  return blocks.join("\n");
}

export function addSurgeryPreset(label: string) {
  const text = label.trim();
  if (!text) return;
  const t = read();
  const key = text.toLowerCase();
  if ((t.surgeries || []).some((s) => s.label.toLowerCase() === key)) return;
  write({
    ...t,
    surgeries: [...(t.surgeries || []), { id: `surg_${Date.now().toString(36)}`, label: text }],
  });
}

export function addLocalOption(packId: string, itemId: string, option: string) {
  const text = option.trim();
  if (!text) return;
  const t = read();
  const packs = (t.localPacks || []).map(normalizeLocalPack);
  const next = packs.map((p) => {
    if (p.id !== packId) return p;
    const items = localItems(p).map((it) =>
      it.id === itemId && !it.options.some((o) => o.toLowerCase() === text.toLowerCase())
        ? { ...it, options: [...it.options, text] }
        : it,
    );
    return { ...p, items };
  });
  write({ ...t, localPacks: next });
}

export function getLocalPacks(): LocalPack[] {
  return read().localPacks.map(normalizeLocalPack);
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

export function getGlobalTemplates(): GlobalTemplate[] {
  return read().globalTemplates || [];
}

export function globalsMatchingCode(code: string): GlobalTemplate[] {
  const all = getGlobalTemplates();
  if (!code) return [];
  const prefix = code.split(".")[0];
  return all.filter((p) => p.codes.includes(code) || (prefix && p.codes.includes(prefix)));
}

export function getQuestionScales(): ScaleDef[] {
  return read().questionnaires;
}

export function packsMatchingCode(_code: string): VisitPack[] {
  return getVisitPacks();
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
