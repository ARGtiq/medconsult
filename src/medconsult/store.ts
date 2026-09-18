import { create } from "zustand";
import { store as legacy } from "@/legacy/lib/store";
import { checkAllergyLocal } from "@/legacy/data/drugSafety";
import { showToast } from "@/legacy/lib/toast";
import { applyComputed } from "./data/studies";
import { addLocalChipToCode, addComplaintTemplate, getDocKinds, packsForCodeLive } from "./data/templates";
import { composeVitae, emptyVitae } from "./anamnesisChips";
import { getStudyLive } from "./live";
import type { ExtraBlock, Patient, SessionState, SettingsState, StudyEntry, StudyInstance, VisitKind, VisitRecord } from "./types";

const SESSION_KEY = "medconsult_v2_session";
const SETTINGS_KEY = "medconsult_v2_settings";
const PATIENTS_KEY = "medconsult_v2_patients";
const VISITS_KEY = "medconsult_v2_visits";
const CHIPS_KEY = "medconsult_v2_recent_chips";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const defaultSettings = (): SettingsState => ({
  aiButton: "temporary",
  wizardEnabled: false,
  openOnProtocol: true,
  guidelineDisplay: "block",
  railCollapsed: true,
  blocksAsSpoiler: true,
  openRouterKey: "",
  aiModel: "openai/gpt-4o-mini",
});

export const demoPatient = (): Patient => ({
  id: "p_ivanov",
  lastName: "Иванов",
  firstName: "Алексей Петрович",
  age: "42",
  name: "Иванов Алексей Петрович",
  allergies: [],
  currentMedications: [],
});

export function blankSession(partial?: Partial<SessionState>): SessionState {
  return {
    visitKind: "followup",
    mode: "consult",
    patientId: "",
    diagnosisCode: "",
    diagnosisTitle: "",
    guidelineId: null,
    scenario: null,
    openSection: "complaints",
    hiddenBlocks: [],
    complaints: [],
    anamnesis: "",
    anamnesisVitae: "",
    objective: "Состояние удовлетворительное.",
    localStatus: [],
    studies: [],
    recommendations: [],
    notes: "",
    headerOverride: "",
    docStd: [],
    extraBlocks: [],
    ...partial,
  };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function calcAge(dob?: string) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return String(years);
}

export function adaptPatient(p: Record<string, unknown>): Patient {
  const name = String(p.name || "");
  const parts = name.trim().split(/\s+/);
  const globals = (p.globals && typeof p.globals === "object" ? p.globals : {}) as Patient["globals"];
  return {
    id: String(p.id || uid("p")),
    lastName: String(p.lastName || parts[0] || ""),
    firstName: String(p.firstName || parts.slice(1).join(" ") || ""),
    age: String(p.age || calcAge(p.dob as string) || ""),
    name: name || `${p.lastName || ""} ${p.firstName || ""}`.trim(),
    dob: p.dob as string | undefined,
    allergies: Array.isArray(p.allergies)
      ? (p.allergies as string[])
      : Array.isArray(globals?.allergies)
        ? globals.allergies
        : [],
    currentMedications: Array.isArray(p.currentMedications)
      ? (p.currentMedications as string[])
      : Array.isArray(globals?.currentMedications)
        ? globals.currentMedications
        : [],
    anamnesisVitae: typeof p.anamnesisVitae === "string" ? p.anamnesisVitae : globals?.anamnesisVitae,
    globals,
  };
}

function mergePatients(v2: Patient[], legacyList: Patient[]): Patient[] {
  const byId: Record<string, Patient> = {};
  [...v2, ...legacyList].forEach((p) => {
    byId[p.id] = { ...byId[p.id], ...p };
  });
  const list = Object.values(byId);
  return list.length ? list : [demoPatient()];
}

let subscribed = false;

function refreshPatientsFromLegacy(current: Patient[]): Patient[] {
  try {
    const legacyPatients = legacy.getPatients().map((p: Record<string, unknown>) => adaptPatient(p));
    return mergePatients(current, legacyPatients);
  } catch {
    return current.length ? current : [demoPatient()];
  }
}

function writePatient(p: Patient) {
  try {
    legacy.savePatient({
      id: p.id,
      name: p.name,
      dob: p.dob || "",
      allergies: p.allergies || [],
      currentMedications: p.currentMedications || [],
      anamnesisVitae: p.anamnesisVitae || "",
      globals: p.globals || {},
    });
  } catch {
    /* */
  }
}

function pickFilledInstance(instances?: StudyInstance[]): StudyInstance | undefined {
  const filled = (instances || []).filter((i) =>
    Object.values(i.fields || {}).some((x) => String(x || "").trim()),
  );
  if (!filled.length) return undefined;
  return [...filled].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
}

function persistGlobals(session: SessionState, patients: Patient[]): Patient[] {
  if (!session.patientId) return patients;
  const idx = patients.findIndex((p) => p.id === session.patientId);
  if (idx < 0) return patients;
  const prev = patients[idx];
  const extraLast = { ...(prev.globals?.extraLast || {}) };
  (session.extraBlocks || []).forEach((b) => {
    if (b.text.trim()) extraLast[b.kindId] = b.text;
  });
  const studyLast = { ...(prev.globals?.studyLast || {}) };
  (session.studies || []).forEach((s) => {
    const inst = pickFilledInstance(s.instances);
    if (inst) studyLast[s.key] = { ...inst, fields: { ...inst.fields } };
  });
  const next: Patient = {
    ...prev,
    anamnesisVitae: session.anamnesisVitae || prev.anamnesisVitae,
    globals: {
      ...(prev.globals || {}),
      vitaeDraft: session.vitaeDraft || prev.globals?.vitaeDraft,
      anamnesisVitae: session.anamnesisVitae || prev.globals?.anamnesisVitae,
      extraLast,
      studyLast,
      allergies: prev.allergies || [],
      currentMedications: prev.currentMedications || [],
    },
  };
  const list = patients.map((p, i) => (i === idx ? next : p));
  writeJson(PATIENTS_KEY, list);
  writePatient(next);
  return list;
}

function applyGlobals(session: SessionState, patient: Patient | undefined): SessionState {
  if (!patient) return session;
  const draft = patient.globals?.vitaeDraft;
  const vitaeText = patient.anamnesisVitae || patient.globals?.anamnesisVitae || "";
  const composed = composeVitae(draft || emptyVitae(), {
    medications: patient.currentMedications,
    allergies: patient.allergies,
  });
  return {
    ...session,
    anamnesisVitae: composed || vitaeText,
    vitaeDraft: draft,
    vitaeChipMode: vitaeText ? false : true,
  };
}

function findPreviousStudy(
  visits: VisitRecord[],
  patientId: string,
  key: string,
  patients: Patient[],
): StudyInstance | undefined {
  if (!patientId) return undefined;
  for (const v of visits) {
    if (v.patientId !== patientId) continue;
    const e = v.session?.studies?.find((s) => s.key === key);
    const inst = pickFilledInstance(e?.instances) || (e?.previous && pickFilledInstance([e.previous]));
    if (inst) return inst;
  }
  const p = patients.find((x) => x.id === patientId);
  return p?.globals?.studyLast?.[key];
}

function findPreviousExtra(visits: VisitRecord[], patientId: string, kindId: string, patients: Patient[]): string {
  if (!patientId) return "";
  for (const v of visits) {
    if (v.patientId !== patientId) continue;
    const hit = (v.session?.extraBlocks || []).find((b) => b.kindId === kindId && b.text.trim());
    if (hit) return hit.text;
  }
  const p = patients.find((x) => x.id === patientId);
  return p?.globals?.extraLast?.[kindId] || "";
}

type AppStore = {
  hydrated: boolean;
  session: SessionState;
  settings: SettingsState;
  patients: Patient[];
  visits: VisitRecord[];
  recentChips: string[];
  toast: string | null;
  aiUndo: { section: string; before: string } | null;
  drugInfoQuery: string | null;
  hydrate: () => void;
  setSession: (patch: Partial<SessionState>) => void;
  setSettings: (patch: Partial<SettingsState>) => void;
  setToast: (msg: string | null) => void;
  addStudy: (key: string) => void;
  removeStudy: (key: string) => void;
  addStudyInstance: (key: string) => void;
  updateInstance: (key: string, instanceId: string, fields: Record<string, string>, date?: string) => void;
  removeInstance: (key: string, instanceId: string) => void;
  toggleBlock: (id: string) => void;
  toggleComplaint: (text: string) => void;
  toggleLocal: (text: string) => void;
  addLocalPhrase: (text: string) => void;
  addRecommendation: (text: string) => void;
  renameList: (field: "complaints" | "localStatus" | "recommendations", next: string[]) => void;
  addPatient: (input: { lastName: string; firstName: string; patronymic?: string; year?: string }) => Patient;
  updatePatient: (id: string, patch: Partial<Patient>) => void;
  addExtraBlock: (kindId: string, title?: string) => void;
  updateExtraBlock: (id: string, patch: Partial<ExtraBlock>) => void;
  removeExtraBlock: (id: string) => void;
  toggleDocStd: (id: string) => void;
  applyLocalFromIcd: (code: string) => void;
  ensureGlobals: () => void;
  saveVisit: () => void;
  loadVisit: (id: string) => void;
  loadLastForPatient: () => void;
  setAiUndo: (u: { section: string; before: string } | null) => void;
  undoAi: () => void;
  exportData: () => string;
  importData: (raw: string) => boolean;
  openDrugInfo: (query: string) => void;
  closeDrugInfo: () => void;
};

function persistSession(session: SessionState) {
  writeJson(SESSION_KEY, session);
}

export const useAppStore = create<AppStore>((set, get) => ({
  hydrated: false,
  session: blankSession(),
  settings: defaultSettings(),
  patients: [],
  visits: [],
  recentChips: [],
  toast: null,
  aiUndo: null,
  drugInfoQuery: null,

  hydrate() {
    const v2Patients = readJson<Patient[]>(PATIENTS_KEY, []);
    const patients = refreshPatientsFromLegacy(v2Patients);
    const v2Visits = readJson<VisitRecord[]>(VISITS_KEY, []);
    const raw = readJson(SESSION_KEY, blankSession({ patientId: patients[0]?.id || "" }));
    let session = blankSession(raw);
    const p = patients.find((x) => x.id === session.patientId);
    if (p && !session.anamnesisVitae && !session.vitaeDraft) {
      session = applyGlobals(session, p);
    }
    set({
      hydrated: true,
      session,
      settings: { ...defaultSettings(), ...readJson(SETTINGS_KEY, {}) },
      patients,
      visits: v2Visits,
      recentChips: readJson(CHIPS_KEY, []),
    });
    if (!subscribed) {
      subscribed = true;
      try {
        legacy.on("patients", () => {
          set({ patients: refreshPatientsFromLegacy(get().patients) });
        });
      } catch {
        /* */
      }
    }
  },

  setSession(patch) {
    const prev = get().session;
    let patients = get().patients;
    if (patch.patientId && patch.patientId !== prev.patientId) {
      patients = persistGlobals(prev, patients);
    }
    let session = { ...prev, ...patch };
    if (patch.patientId && patch.patientId !== prev.patientId) {
      session = applyGlobals(session, patients.find((p) => p.id === patch.patientId));
    }
    const vitaeTouched =
      "vitaeDraft" in patch || "anamnesisVitae" in patch || "extraBlocks" in patch || "studies" in patch;
    if (vitaeTouched) patients = persistGlobals(session, patients);
    persistSession(session);
    set({ session, patients });
  },

  setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    writeJson(SETTINGS_KEY, settings);
    set({ settings });
  },

  setToast(msg) {
    set({ toast: msg });
    if (msg) {
      try {
        showToast(msg, { type: "info", duration: 2200 });
      } catch {
        /* */
      }
      setTimeout(() => set({ toast: null }), 2200);
    }
  },

  addStudy(key) {
    const session = get().session;
    if (session.studies.some((s) => s.key === key)) return;
    const prevInst = findPreviousStudy(get().visits, session.patientId, key, get().patients);
    const entry: StudyEntry = {
      key,
      instances: [{ id: uid("i"), date: todayISO(), fields: {} }],
      previous: prevInst ? { ...prevInst, fields: { ...prevInst.fields } } : undefined,
    };
    const studies = [...session.studies, entry];
    const mode: SessionState["mode"] =
      session.mode === "consult" || session.mode === "consult_study"
        ? "consult_study"
        : session.mode === "document"
          ? "document"
          : "study";
    const next = { ...session, studies, mode, openSection: key };
    persistSession(next);
    set({ session: next });
    if (prevInst) get().setToast("Подставил прошлый результат под поля");
  },

  removeStudy(key) {
    const session = get().session;
    const studies = session.studies.filter((s) => s.key !== key);
    const mode: SessionState["mode"] =
      studies.length === 0 ? (session.mode === "study" ? "study" : "consult") : session.mode;
    const next = { ...session, studies, mode };
    persistSession(next);
    set({ session: next });
  },

  addStudyInstance(key) {
    const session = get().session;
    const studies = session.studies.map((s) =>
      s.key === key
        ? { ...s, instances: [...s.instances, { id: uid("i"), date: todayISO(), fields: {} }] }
        : s,
    );
    const next = { ...session, studies };
    persistSession(next);
    set({ session: next });
  },

  updateInstance(key, instanceId, fields, date) {
    const def = getStudyLive(key);
    const computed = def ? applyComputed(def, fields) : fields;
    const session = get().session;
    const studies = session.studies.map((s) =>
      s.key !== key
        ? s
        : {
            ...s,
            instances: s.instances.map((i) =>
              i.id === instanceId ? { ...i, fields: computed, date: date ?? i.date } : i,
            ),
          },
    );
    const next = { ...session, studies };
    const patients = persistGlobals(next, get().patients);
    persistSession(next);
    set({ session: next, patients });
  },

  removeInstance(key, instanceId) {
    const session = get().session;
    let studies = session.studies.map((s) =>
      s.key !== key ? s : { ...s, instances: s.instances.filter((i) => i.id !== instanceId) },
    );
    studies = studies.filter((s) => s.instances.length > 0);
    const next = { ...session, studies };
    persistSession(next);
    set({ session: next });
  },

  toggleBlock(id) {
    const hidden = new Set(get().session.hiddenBlocks);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    get().setSession({ hiddenBlocks: [...hidden] });
  },

  toggleComplaint(text) {
    const session = get().session;
    const has = session.complaints.includes(text);
    const complaints = has ? session.complaints.filter((c) => c !== text) : [...session.complaints, text];
    const recent = Array.from(new Set([text.replace(/ ×\d+$/, ""), ...get().recentChips])).slice(0, 8);
    writeJson(CHIPS_KEY, recent);
    persistSession({ ...session, complaints });
    set({ session: { ...session, complaints }, recentChips: recent });
    try {
      if (!has) {
        legacy.recordComplaint(text);
        addComplaintTemplate(text);
      }
    } catch {
      /* */
    }
  },

  toggleLocal(text) {
    const session = get().session;
    const has = session.localStatus.includes(text);
    const localStatus = has ? session.localStatus.filter((c) => c !== text) : [...session.localStatus, text];
    get().setSession({ localStatus });
  },

  addLocalPhrase(text) {
    const t = text.trim();
    if (!t) return;
    const session = get().session;
    const localStatus = session.localStatus.includes(t) ? session.localStatus : [...session.localStatus, t];
    get().setSession({ localStatus });
    addLocalChipToCode(session.diagnosisCode, t);
    get().setToast("В блок и в шаблоны");
  },

  renameList(field, next) {
    get().setSession({ [field]: next } as Partial<SessionState>);
    if (field === "complaints") {
      next.forEach((t) => {
        try {
          addComplaintTemplate(t);
        } catch {
          /* */
        }
      });
    }
  },

  addRecommendation(text) {
    const session = get().session;
    if (session.recommendations.includes(text)) return;
    const patient = get().patients.find((p) => p.id === session.patientId);
    const allergies = patient?.allergies || [];
    if (allergies.length) {
      try {
        const raw = checkAllergyLocal(
          text,
          allergies,
          legacy.getCustomGroups(),
          undefined,
          legacy.getCrossReactivity(),
        );
        const warnings = Array.isArray(raw) ? raw : raw ? [raw] : [];
        if (warnings.length) {
          const msg = warnings
            .map((w) => (typeof w === "string" ? w : w.message || "совпадение с карточкой"))
            .join("\n");
          const ok = window.confirm(`${msg}\n\nВсё равно добавить «${text}»?`);
          if (!ok) {
            get().setToast("Не добавил — аллергия");
            return;
          }
        }
      } catch {
        /* */
      }
    }
    get().setSession({ recommendations: [...session.recommendations, text] });
    try {
      if (session.diagnosisCode) legacy.recordDiagnosisDrug(session.diagnosisCode, text.split(" ")[0]);
      session.complaints.forEach((c) => legacy.recordComplaintDrug(c, text.split(" ")[0]));
    } catch {
      /* */
    }
  },

  addPatient(input) {
    const first = [input.firstName, input.patronymic].filter(Boolean).join(" ").trim();
    const year = (input.year || "").trim();
    const dob = /^\d{4}$/.test(year) ? `${year}-01-01` : undefined;
    const p: Patient = {
      id: uid("p"),
      lastName: input.lastName.trim(),
      firstName: first,
      age: calcAge(dob),
      name: `${input.lastName.trim()} ${first}`.trim(),
      dob,
      allergies: [],
      currentMedications: [],
    };
    const patients = [...get().patients, p];
    const unique = Object.values(Object.fromEntries(patients.map((x) => [x.id, x]))) as Patient[];
    writeJson(PATIENTS_KEY, unique);
    set({ patients: unique });
    writePatient(p);
    get().setSession({ patientId: p.id });
    get().setToast(`Пациент: ${p.name}`);
    return p;
  },

  updatePatient(id, patch) {
    const patients = get().patients.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      next.globals = {
        ...(p.globals || {}),
        allergies: next.allergies,
        currentMedications: next.currentMedications,
      };
      return next;
    });
    writeJson(PATIENTS_KEY, patients);
    set({ patients });
    const p = patients.find((x) => x.id === id);
    if (p) writePatient(p);
  },

  addExtraBlock(kindId, title) {
    const session = get().session;
    const kinds = getDocKinds();
    const kind = kinds.find((k) => k.id === kindId);
    const label = title || kind?.title || "Блок";
    const copy = kind?.copyPrevious;
    const patient = get().patients.find((p) => p.id === session.patientId);
    let text = "";
    if (copy) {
      text =
        findPreviousExtra(get().visits, session.patientId, kindId, get().patients) ||
        patient?.globals?.extraLast?.[kindId] ||
        "";
    }
    const block: ExtraBlock = { id: uid("xb"), kindId, title: label, text };
    get().setSession({ extraBlocks: [...(session.extraBlocks || []), block], openSection: block.id });
    if (text) get().setToast("Подставил прошлый текст");
  },

  updateExtraBlock(id, patch) {
    const session = get().session;
    get().setSession({
      extraBlocks: (session.extraBlocks || []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  },

  removeExtraBlock(id) {
    const session = get().session;
    get().setSession({ extraBlocks: (session.extraBlocks || []).filter((b) => b.id !== id) });
  },

  toggleDocStd(id) {
    const session = get().session;
    const setIds = new Set(session.docStd || []);
    if (setIds.has(id)) setIds.delete(id);
    else setIds.add(id);
    const hidden = session.hiddenBlocks.filter((h) => h !== id);
    get().setSession({ docStd: [...setIds], hiddenBlocks: hidden, openSection: id });
  },

  applyLocalFromIcd(code) {
    const session = get().session;
    if (!code || session.localStatusAutoFor === code) return;
    const auto = packsForCodeLive(code).flatMap((p) => (p.id === "custom_free" ? [] : p.chips));
    if (!auto.length) {
      get().setSession({ localStatusAutoFor: code });
      return;
    }
    const localStatus = [...session.localStatus];
    auto.forEach((c) => {
      if (!localStatus.includes(c)) localStatus.push(c);
    });
    get().setSession({ localStatus, localStatusAutoFor: code });
  },

  ensureGlobals() {
    const { session, patients } = get();
    const p = patients.find((x) => x.id === session.patientId);
    if (!p) return;
    if (session.anamnesisVitae || session.vitaeDraft) return;
    const next = applyGlobals(session, p);
    persistSession(next);
    set({ session: next });
  },

  saveVisit() {
    const { session, patients, visits } = get();
    const synced = persistGlobals(session, patients);
    set({ patients: synced });
    const patient = synced.find((p) => p.id === session.patientId);
    const rec: VisitRecord = {
      id: uid("v"),
      patientId: session.patientId,
      savedAt: new Date().toISOString(),
      visitKind: session.visitKind,
      mode: session.mode,
      diagnosisCode: session.diagnosisCode,
      diagnosisTitle: session.diagnosisTitle,
      preview: `${patient ? shortName(patient) : "без пациента"} · ${session.diagnosisCode || "без кода"}`,
      session: { ...session },
    };
    const next = [rec, ...visits].slice(0, 80);
    writeJson(VISITS_KEY, next);
    set({ visits: next });
    try {
      legacy.saveVisit({
        id: rec.id,
        patientId: rec.patientId,
        patientDisplayName: patient ? formatPatient(patient) : "без пациента",
        visitDate: todayISO(),
        templateId: "protocol-v2",
        templateName: rec.preview,
        diagnosisCode: rec.diagnosisCode,
        sectionValues: {
          diagnosis: rec.diagnosisTitle,
          complaints: session.complaints,
          anamnesis: session.anamnesis,
          recommendations: session.recommendations.map((name) => ({ name })),
        },
        session,
      });
    } catch {
      /* */
    }
    get().setToast("Визит сохранён в историю");
  },

  loadVisit(id) {
    const rec = get().visits.find((v) => v.id === id);
    if (!rec) return;
    const session = blankSession(rec.session);
    persistSession(session);
    set({ session });
    get().setToast("Сеанс загружен");
  },

  loadLastForPatient() {
    const { session, visits } = get();
    const last = visits.find((v) => v.patientId === session.patientId);
    if (!last) {
      get().setToast("Нет прошлого сеанса у этого пациента");
      return;
    }
    const next = blankSession(last.session);
    persistSession(next);
    set({ session: next });
    get().setToast("Повторил прошлый сеанс");
  },

  setAiUndo(u) {
    set({ aiUndo: u });
  },

  undoAi() {
    const u = get().aiUndo;
    if (!u) return;
    if (u.section === "complaints" || u.section === "recommendations") {
      get().setSession({ [u.section]: JSON.parse(u.before) } as Partial<SessionState>);
    } else {
      get().setSession({ [u.section]: u.before } as Partial<SessionState>);
    }
    set({ aiUndo: null });
    get().setToast("AI отменён");
  },

  exportData() {
    const { session, settings, patients, visits, recentChips } = get();
    let legacyBlob = {};
    try {
      legacyBlob = JSON.parse(legacy.exportAll());
    } catch {
      /* */
    }
    let templates = {};
    try {
      templates = JSON.parse(localStorage.getItem("medconsult_v2_templates") || "{}");
    } catch {
      /* */
    }
    return JSON.stringify({ session, settings, patients, visits, recentChips, templates, legacy: legacyBlob }, null, 2);
  },

  importData(raw) {
    try {
      const data = JSON.parse(raw);
      if (data.legacy) {
        try {
          legacy.importAll(JSON.stringify(data.legacy));
        } catch {
          /* */
        }
      } else if (data.patients && data.visits && data.drugDatabase) {
        try {
          legacy.importAll(raw);
        } catch {
          /* */
        }
      }
      if (data.session) persistSession(data.session);
      if (data.settings) writeJson(SETTINGS_KEY, data.settings);
      if (data.patients) writeJson(PATIENTS_KEY, data.patients);
      if (data.visits) writeJson(VISITS_KEY, data.visits);
      if (data.recentChips) writeJson(CHIPS_KEY, data.recentChips);
      if (data.templates) writeJson("medconsult_v2_templates", data.templates);
      get().hydrate();
      get().setToast("Импорт выполнен");
      return true;
    } catch {
      get().setToast("Файл не прочитался");
      return false;
    }
  },

  openDrugInfo(query) {
    set({ drugInfoQuery: query });
  },

  closeDrugInfo() {
    set({ drugInfoQuery: null });
  },
}));

export function shortName(p: Patient) {
  return `${formatPatient(p)}, ${p.age}`;
}

export function formatPatient(p: Patient) {
  if (p.name && !p.lastName) return p.name;
  const parts = (p.firstName || "").trim().split(/\s+/).filter(Boolean);
  const ini = parts.map((x) => (x ? `${x[0]}.` : "")).join(" ");
  return `${p.lastName || p.name || ""} ${ini}`.trim();
}

export function visitKindLabel(k: VisitKind) {
  return k === "primary" ? "первичный" : "повторный";
}

export function modeLabel(mode: SessionState["mode"], studies: StudyEntry[]) {
  const studyNames = studies.map((s) => getStudyLive(s.key)?.label).filter(Boolean);
  if (mode === "document") return "Другой документ";
  if (mode === "study") return studyNames.join(" + ") || "Исследование";
  if (studyNames.length) return `Консультация + ${studyNames.join(", ")}`;
  return "Консультация уролога";
}

export function workKindOf(session: SessionState): "primary" | "followup" | "study" | "document" {
  if (session.mode === "study") return "study";
  if (session.mode === "document") return "document";
  return session.visitKind;
}
