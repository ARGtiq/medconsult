import { store as legacy } from "@/legacy/lib/store";

export type BackupSection = {
  id: string;
  label: string;
  hint: string;
  keys?: string[];
  prefixes?: string[];
};

/** Every piece of MedConsult kept in this browser, split so a transfer can be partial. */
export const BACKUP_SECTIONS: BackupSection[] = [
  {
    id: "protocol",
    label: "Текущий протокол",
    hint: "Открытый приём и настройки станка",
    keys: ["medconsult_v2_session", "medconsult_v2_settings"],
  },
  {
    id: "patients",
    label: "Пациенты и визиты",
    hint: "Карточки и история приёмов станка",
    keys: ["medconsult_v2_patients", "medconsult_v2_visits"],
  },
  {
    id: "templates",
    label: "Шаблоны приёма",
    hint: "Блоки, чипы, наборы документов",
    keys: ["medconsult_v2_templates"],
  },
  {
    id: "chips",
    label: "Недавние чипы",
    hint: "Что чаще вставлялось на приёме",
    keys: ["medconsult_v2_recent_chips"],
  },
  {
    id: "clinical",
    label: "Пациенты справочника",
    hint: "Старая база пациентов и визитов",
    keys: ["medconsult_ns_clinical"],
  },
  {
    id: "reference",
    label: "Справочники",
    hint: "Исследования, лекарства, клинреки, группы, шаблоны",
    keys: ["medconsult_ns_reference"],
  },
  {
    id: "workspace",
    label: "Пресеты визитов",
    hint: "Заготовки приёма",
    keys: ["medconsult_ns_workspace"],
  },
  {
    id: "system",
    label: "Печать и отчёты",
    hint: "Шаблоны печати и багрепорты",
    keys: ["medconsult_ns_system"],
  },
  {
    id: "mkb",
    label: "МКБ",
    hint: "Свои коды и заметки к диагнозам",
    keys: ["medconsult_mkb10_custom", "medconsult_mkb10_notes"],
  },
  {
    id: "drafts",
    label: "Черновики",
    hint: "Несохранённые визиты",
    prefixes: ["medconsult_draft_"],
  },
  {
    id: "look",
    label: "Оформление",
    hint: "Тема, режим анкет, панель клинрека",
    keys: ["medconsult_theme", "medconsult_guideline_hub_mode", "medconsult_wizard_button_hidden", "medconsult_study_template_side", "medconsult.qMode"],
  },
  {
    id: "secrets",
    label: "Ключи и синхронизация",
    hint: "AI, Supabase, замок. В полном архиве тоже есть",
    keys: [
      "medconsult_ai_provider",
      "medconsult_openrouter_key",
      "medconsult_google_key",
      "medconsult_supabase_url",
      "medconsult_supabase_anon_key",
      "medconsult_auto_sync_enabled",
      "medconsult_clinical_lock_enabled",
      "medconsult_clinical_pin_wrap",
      "medconsult_last_sync",
      "medconsult_last_visit_push_at",
      "medconsult_last_visit_pull_at",
      "medconsult_last_patient_push_at",
      "medconsult_last_patient_pull_at",
    ],
  },
];

const REST_ID = "rest";

export const REST_SECTION: BackupSection = {
  id: REST_ID,
  label: "Остальное",
  hint: "Всё прочее с пометкой medconsult, что не вошло в разделы выше",
};

const NS_PREFIX = "medconsult_ns_";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function allStorageKeys(): string[] {
  const ls = storage();
  if (!ls) return [];
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

function sectionOwns(section: BackupSection, key: string): boolean {
  if (section.keys?.includes(key)) return true;
  return !!section.prefixes?.some((p) => key.startsWith(p));
}

function claimed(key: string): boolean {
  if (!key.startsWith("medconsult")) return false;
  return BACKUP_SECTIONS.some((s) => sectionOwns(s, key));
}

export function restKeys(): string[] {
  return allStorageKeys().filter((k) => k.startsWith("medconsult") && !claimed(k) && k !== "medconsult_last_backup");
}

function readKey(key: string): string | null {
  if (key.startsWith(NS_PREFIX)) {
    try {
      return legacy.exportNamespace(key.slice(NS_PREFIX.length));
    } catch {
      return storage()?.getItem(key) ?? null;
    }
  }
  return storage()?.getItem(key) ?? null;
}

function writeKey(key: string, raw: string) {
  if (key.startsWith(NS_PREFIX)) {
    legacy.importNamespace(key.slice(NS_PREFIX.length), raw);
    return;
  }
  storage()?.setItem(key, raw);
}

function keysFor(section: BackupSection): string[] {
  if (section.id === REST_ID) return restKeys();
  const fixed = section.keys || [];
  const prefixed = (section.prefixes || []).flatMap((p) => allStorageKeys().filter((k) => k.startsWith(p)));
  return [...fixed, ...prefixed];
}

function isEmptyRaw(raw: string | null): boolean {
  if (!raw) return true;
  const t = raw.trim();
  if (!t || t === "null" || t === '""') return true;
  try {
    const v = JSON.parse(t);
    if (v == null || v === "") return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.keys(v).length === 0;
  } catch {
    return false;
  }
  return false;
}

export function sectionHasData(section: BackupSection): boolean {
  return keysFor(section).some((k) => !isEmptyRaw(readKey(k)));
}

export function exportBackup(ids: string[]): string {
  const wanted = new Set(ids);
  const entries: Record<string, string> = {};
  const take = (section: BackupSection) => {
    if (!wanted.has(section.id)) return;
    for (const key of keysFor(section)) {
      const raw = readKey(key);
      if (!isEmptyRaw(raw) && raw != null) entries[key] = raw;
    }
  };
  BACKUP_SECTIONS.forEach(take);
  if (wanted.has(REST_ID)) take(REST_SECTION);
  return JSON.stringify(
    {
      app: "medconsult",
      backupVersion: 3,
      exportedAt: new Date().toISOString(),
      sectionIds: ids,
      entries,
    },
    null,
    2,
  );
}

export function exportAllBackup(): string {
  return exportBackup([...BACKUP_SECTIONS.map((s) => s.id), REST_ID]);
}

type AnyRec = Record<string, unknown>;

function asRecord(v: unknown): AnyRec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AnyRec) : null;
}

const V2_FIELDS: Record<string, Record<string, string>> = {
  protocol: { session: "medconsult_v2_session", settings: "medconsult_v2_settings" },
  patients: { patients: "medconsult_v2_patients", visits: "medconsult_v2_visits" },
  templates: { templates: "medconsult_v2_templates" },
  chips: { recentChips: "medconsult_v2_recent_chips" },
};

function putJson(entries: Record<string, string>, key: string, value: unknown) {
  if (value == null) return;
  entries[key] = typeof value === "string" ? value : JSON.stringify(value);
}

const LEGACY_GROUPS: Record<string, string[]> = {
  clinical: ["patients", "visits"],
  reference: [
    "templates",
    "templatesSeedVersion",
    "drugDatabase",
    "drugGroupMeta",
    "customDrugGroups",
    "crossReactivityCustom",
    "clinicalGuidelines",
    "complaintSuggestions",
    "complaintDrugLinks",
    "diagnosisDrugLinks",
    "customStudies",
    "hiddenStudies",
    "treatmentSchemes",
  ],
  workspace: ["templatePresets"],
  system: ["bugReports", "defaultTemplateId", "printTemplates", "defaultPrintTemplateId"],
};

/** Turn older export files into the same key → raw map. */
function entriesFromUnknown(data: AnyRec): Record<string, string> | null {
  if (data.backupVersion === 3 && asRecord(data.entries)) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.entries as AnyRec)) {
      if (typeof value === "string") out[key] = value;
      else if (value != null) out[key] = JSON.stringify(value);
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const fields of Object.values(V2_FIELDS)) {
    for (const [field, key] of Object.entries(fields)) {
      if (data[field] != null) putJson(out, key, data[field]);
    }
  }
  const nested = asRecord(data.legacy);
  const state =
    nested || (!data.session && !data.entries && (data.patients || data.drugDatabase || data.templates) ? data : null);
  if (state) {
    for (const [ns, keys] of Object.entries(LEGACY_GROUPS)) {
      const slice: AnyRec = {};
      let any = false;
      for (const k of keys) {
        if (state[k] !== undefined) {
          slice[k] = state[k];
          any = true;
        }
      }
      if (any) putJson(out, `${NS_PREFIX}${ns}`, slice);
    }
  }
  return Object.keys(out).length ? out : null;
}

function sectionIdForKey(key: string): string {
  for (const section of BACKUP_SECTIONS) {
    if (sectionOwns(section, key)) return section.id;
  }
  if (key.startsWith("medconsult")) return REST_ID;
  return "";
}

export function sectionsInBackup(raw: string): string[] {
  try {
    const data = asRecord(JSON.parse(raw));
    if (!data) return [];
    const entries = entriesFromUnknown(data);
    if (!entries) return [];
    return [...new Set(Object.keys(entries).map(sectionIdForKey).filter(Boolean))];
  } catch {
    return [];
  }
}

export function importBackup(raw: string, ids?: string[]): boolean {
  const data = asRecord(JSON.parse(raw));
  if (!data) return false;
  const entries = entriesFromUnknown(data);
  if (!entries) return false;
  const wanted = ids ? new Set(ids) : null;
  let n = 0;
  for (const [key, value] of Object.entries(entries)) {
    const section = sectionIdForKey(key);
    if (!section) continue;
    if (wanted && !wanted.has(section)) continue;
    writeKey(key, value);
    n++;
  }
  return n > 0;
}
