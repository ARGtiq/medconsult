import type { AnamnesisDraft, VitaeDraft } from "./anamnesisChips";

export type VisitKind = "primary" | "followup";
export type SessionMode = "consult" | "study" | "consult_study" | "document";
export type GuidelineDisplay = "block" | "modal";
export type AiButtonMode = "always" | "temporary" | "off";
export type RefFilter = "all" | "schemes" | "complaints" | "guidelines" | "treatment";
export type WorkKind = "primary" | "followup" | "study" | "document";

export type StudyField = {
  key: string;
  label: string;
  unit?: string;
  normal?: string;
  defaultValue?: string;
  kind?: "text" | "number" | "select" | "multi" | "groups" | "heading";
  options?: string[];
  /** Mutually exclusive sets. One pick from each row, e.g. ровные/неровные and четкие/нечеткие. */
  optionGroups?: string[][];
  /** Show this field only when `field` matches a value and/or a numeric comparison. */
  showIf?: {
    field: string;
    values: string[];
    op?: "lt" | "lte" | "gt" | "gte" | "eq" | "range";
    num?: number;
    numMax?: number;
  };
  computed?: boolean;
  /** Серый, пока не включили кликом по названию. */
  optional?: boolean;
  /** Если false — в тексте исследования нет названия пункта, только значение. */
  showHeading?: boolean;
  /** Широкое многострочное поле, не короткая строка. */
  long?: boolean;
  /** Фраза тега. `{value}` — введённое значение. */
  phrase?: string;
  /** Текст перед введённым значением в протоколе. */
  before?: string;
  /** Текст после введённого значения в протоколе. */
  after?: string;
  formula?: string;
  refOp?: "lt" | "lte" | "gt" | "gte" | "range" | "eq";
  refMin?: number;
  refMax?: number;
  refOf?: string;
  refOfMode?: "percent" | "value";
};

export type StudyDef = {
  key: string;
  label: string;
  category: "instrumental" | "lab" | "questionnaire";
  template: string;
  fields: StudyField[];
  referenceNotes: string;
  hint?: string;
  sparse?: boolean;
  /** Protocol date: iso `2026-09-25` (default) or short `25.09.26`. */
  dateFormat?: "iso" | "short";
  /** Lab/sparse studies use `template` in the protocol only after the user edits it. */
  templateEdited?: boolean;
};

export type StudyInstance = {
  id: string;
  date: string;
  fields: Record<string, string>;
  omit?: string[];
};

export type StudyEntry = {
  key: string;
  instances: StudyInstance[];
  previous?: StudyInstance;
  /** When set, the protocol uses this text instead of the filled template. */
  textMode?: boolean;
  text?: string;
};

export type ExtraBlock = {
  id: string;
  kindId: string;
  title: string;
  text: string;
};

export type PatientGlobals = {
  vitaeDraft?: VitaeDraft;
  anamnesisVitae?: string;
  vitaeTemplateId?: string;
  vitaeFields?: Record<string, string>;
  extraLast?: Record<string, string>;
  studyLast?: Record<string, StudyInstance>;
  allergies?: string[];
  currentMedications?: string[];
};

export type Patient = {
  id: string;
  lastName: string;
  firstName: string;
  age: string;
  name?: string;
  dob?: string;
  /** Закреплён в списке записанных на приём. */
  recorded?: boolean;
  recordedAt?: number;
  note?: string;
  allergies?: string[];
  currentMedications?: string[];
  anamnesisVitae?: string;
  globals?: PatientGlobals;
};

export type VisitRecord = {
  id: string;
  patientId: string;
  savedAt: string;
  visitKind: VisitKind;
  mode: SessionMode;
  diagnosisCode: string;
  diagnosisTitle: string;
  preview: string;
  anonId?: string;
  session: SessionState;
};

export type SessionState = {
  visitKind: VisitKind;
  mode: SessionMode;
  patientId: string;
  diagnosisCode: string;
  diagnosisTitle: string;
  guidelineId: string | null;
  scenario: string | null;
  openSection: string | null;
  hiddenBlocks: string[];
  complaints: string[];
  /** Свободный текст жалоб. Пока не задан — в протоколе склейка чипов. */
  complaintsText?: string;
  /** Чипы выбранных жалоб вместо одного текстового поля. */
  complaintsChipMode?: boolean;
  anamnesis: string;
  anamnesisVitae: string;
  anamnesisDraft?: AnamnesisDraft;
  anamnesisChipMode?: boolean;
  vitaeDraft?: VitaeDraft;
  vitaeChipMode?: boolean;
  vitaeTemplateId?: string;
  vitaeFields?: Record<string, string>;
  objective: string;
  localStatus: string[];
  localStatusAutoFor?: string;
  activeLocalPacks?: string[];
  localPicks?: LocalPick[];
  studies: StudyEntry[];
  recommendations: string[];
  /** Общие рекомендации без полей лекарства. Идут перед назначениями. */
  generalRecs?: string;
  notes: string;
  headerOverride: string;
  docStd: string[];
  extraBlocks: ExtraBlock[];
  templateId?: string;
  globalTemplateId?: string;
  allergies: string[];
  currentMedications: string[];
};

export type SettingsState = {
  aiButton: AiButtonMode;
  wizardEnabled: boolean;
  openOnProtocol: boolean;
  guidelineDisplay: GuidelineDisplay;
  railCollapsed: boolean;
  blocksAsSpoiler: boolean;
  splitPct: number;
  studyDeviations: boolean;
  /** Поле диагноза над колонкой «В Медлок», а не в сборке. */
  diagnosisAbovePreview: boolean;
  /** Всплывашка по наведению на «i», клик всё равно открывает карточку. */
  infoOnHover: boolean;
  openRouterKey: string;
  aiModel: string;
};

export type ComplaintChip = {
  text: string;
  codes: string[];
  category: string;
};

export type LocalItem = {
  id: string;
  label: string;
  options: string[];
  /** Подпункты как у жалобы: в каждой группе выбирается один вариант. */
  subs?: string[][];
};

export type LocalPick = {
  packId: string;
  itemId: string;
  value: string;
  subs?: string[];
};

export type LocalPack = {
  id: string;
  codes: string[];
  label: string;
  chips: string[];
  items?: LocalItem[];
  /** Между пунктами внутри шаблона. По умолчанию «, ». */
  itemSep?: string;
  /** После шаблона. По умолчанию «.». Шаблоны и так с новой строки. */
  packSep?: string;
};

export type Guideline = {
  id: string;
  title: string;
  codes: string[];
  scenarios: string[];
  complaints: string[];
  investigations: string[];
  recs: string[];
};

export type Drug = {
  name: string;
  dose: string;
  note?: string;
  codes: string[];
};

export type Scheme = {
  id: string;
  name: string;
  phases: string[];
};
