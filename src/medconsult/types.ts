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
  computed?: boolean;
  formula?: "prostate_volume";
};

export type StudyDef = {
  key: string;
  label: string;
  category: "instrumental" | "lab";
  template: string;
  fields: StudyField[];
  referenceNotes: string;
};

export type StudyInstance = {
  id: string;
  date: string;
  fields: Record<string, string>;
};

export type StudyEntry = {
  key: string;
  instances: StudyInstance[];
};

export type Patient = {
  id: string;
  lastName: string;
  firstName: string;
  age: string;
  name?: string;
  dob?: string;
  allergies?: string[];
  currentMedications?: string[];
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
  anamnesis: string;
  anamnesisVitae: string;
  anamnesisDraft?: AnamnesisDraft;
  anamnesisChipMode?: boolean;
  vitaeDraft?: VitaeDraft;
  vitaeChipMode?: boolean;
  objective: string;
  localStatus: string[];
  studies: StudyEntry[];
  recommendations: string[];
  notes: string;
  headerOverride: string;
};

export type SettingsState = {
  aiButton: AiButtonMode;
  wizardEnabled: boolean;
  openOnProtocol: boolean;
  guidelineDisplay: GuidelineDisplay;
  railCollapsed: boolean;
  blocksAsSpoiler: boolean;
  openRouterKey: string;
  aiModel: string;
};

export type ComplaintChip = {
  text: string;
  codes: string[];
  category: string;
};

export type LocalPack = {
  id: string;
  codes: string[];
  label: string;
  chips: string[];
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
