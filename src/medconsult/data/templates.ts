import { LOCAL_PACKS } from "./catalog";
import type { LocalPack } from "../types";

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

export type TemplatesState = {
  localPacks: LocalPack[];
  chronic: VitaePreset[];
  surgeries: VitaePreset[];
  docKinds: DocKind[];
};

export const SEED_CHRONIC: VitaePreset[] = [
  { id: "htn", label: "гипертоническая болезнь" },
  { id: "dm1", label: "сахарный диабет 1 типа" },
  { id: "dm2", label: "сахарный диабет 2 типа" },
  { id: "cholecystitis", label: "холецистит" },
  { id: "pancreatitis", label: "панкреатит" },
  { id: "gastritis", label: "гастрит" },
  { id: "ihd", label: "ИБС" },
  { id: "mi", label: "инфаркт миокарда", needsDate: true },
  { id: "cva", label: "ОНМК", needsDate: true },
  { id: "urolith", label: "мочекаменная болезнь" },
  { id: "bph", label: "ДГПЖ" },
  { id: "prostatitis", label: "хронический простатит" },
  { id: "asthma", label: "бронхиальная астма" },
  { id: "copd", label: "ХОБЛ" },
];

export const SEED_SURGERIES: VitaePreset[] = [
  { id: "appendectomy", label: "аппендэктомия", needsDate: true, emptyDateText: "давно" },
  { id: "cholecystectomy", label: "холецистэктомия", needsDate: true },
  { id: "hernia_inguinal", label: "герниопластика по поводу паховой грыжи", needsDate: true },
  { id: "hernia_umbilical", label: "герниопластика по поводу пупочной грыжи", needsDate: true },
  { id: "turp", label: "ТУР простаты", needsDate: true },
  { id: "prostatectomy", label: "простатэктомия", needsDate: true },
  { id: "varicocele", label: "варикоцелэктомия", needsDate: true },
  { id: "nephrectomy", label: "нефрэктомия", needsDate: true },
  { id: "orchiectomy", label: "орхиэктомия", needsDate: true },
];

export const SEED_DOC_KINDS: DocKind[] = [
  { id: "op_protocol", title: "Протокол операции" },
  { id: "diary", title: "Дневник", copyPrevious: true },
  { id: "given_meds", title: "Проведённые назначения", copyPrevious: true },
  { id: "epicrisis", title: "Эпикриз" },
  { id: "direction", title: "Направление" },
  { id: "certificate", title: "Справка" },
];

export const STD_DOC_BLOCKS = [
  { id: "complaints", title: "Жалобы" },
  { id: "anamnesis", title: "Анамнез заболевания" },
  { id: "anamnesisVitae", title: "Анамнез жизни" },
  { id: "status", title: "Статус" },
  { id: "diagnosis", title: "Диагноз" },
  { id: "recommendations", title: "Назначения" },
] as const;

export const seedTemplates = (): TemplatesState => ({
  localPacks: LOCAL_PACKS.map((p) => ({ ...p, chips: [...p.chips] })),
  chronic: SEED_CHRONIC.map((x) => ({ ...x })),
  surgeries: SEED_SURGERIES.map((x) => ({ ...x })),
  docKinds: SEED_DOC_KINDS.map((x) => ({ ...x })),
});

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

export function packsForCodeLive(code: string) {
  if (!code) return [] as LocalPack[];
  const prefix = code.split(".")[0];
  return getLocalPacks().filter((p) => p.codes.includes(code) || p.codes.includes(prefix));
}

export function resetTemplates() {
  write(seedTemplates());
}
