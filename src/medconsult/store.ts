import { create } from "zustand";
import { GUIDELINES } from "./data/catalog";
import { applyComputed, getStudy } from "./data/studies";
import type {
  Patient,
  SessionState,
  SettingsState,
  StudyEntry,
  VisitKind,
  VisitRecord,
} from "./types";

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
  openRouterKey: "",
  aiModel: "openai/gpt-4o-mini",
});

export const demoPatient = (): Patient => ({
  id: "p_ivanov",
  lastName: "Иванов",
  firstName: "Алексей Петрович",
  age: "42",
});

export function blankSession(partial?: Partial<SessionState>): SessionState {
  return {
    visitKind: "followup",
    mode: "consult",
    patientId: "p_ivanov",
    diagnosisCode: "N40.1",
    diagnosisTitle: "Гиперплазия предстательной железы. Умеренные симптомы нижних мочевых путей",
    guidelineId: "bph",
    scenario: "умеренные",
    openSection: "complaints",
    hiddenBlocks: [],
    complaints: ["никтурия ×2", "слабая струя"],
    anamnesis: "Беспокоит около года, ухудшение 2 месяца.",
    anamnesisVitae: "Аллергоанамнез не отягощён. Постоянно лекарства не принимает.",
    objective: "Состояние удовлетворительное.",
    localStatus: ["простата увеличена, эластичная", "срединная борозда сглажена"],
    studies: [],
    recommendations: ["тамсулозин 0,4 мг вечером длительно"],
    notes: "",
    headerOverride: "",
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

type AppStore = {
  hydrated: boolean;
  session: SessionState;
  settings: SettingsState;
  patients: Patient[];
  visits: VisitRecord[];
  recentChips: string[];
  toast: string | null;
  aiUndo: { section: string; before: string } | null;
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
  addRecommendation: (text: string) => void;
  saveVisit: () => void;
  loadVisit: (id: string) => void;
  loadLastForPatient: () => void;
  setAiUndo: (u: { section: string; before: string } | null) => void;
  undoAi: () => void;
  exportData: () => string;
  importData: (raw: string) => boolean;
};

function persistSession(session: SessionState) {
  writeJson(SESSION_KEY, session);
}

export const useAppStore = create<AppStore>((set, get) => ({
  hydrated: false,
  session: blankSession(),
  settings: defaultSettings(),
  patients: [demoPatient()],
  visits: [],
  recentChips: ["никтурия", "слабая струя", "боль в пояснице"],
  toast: null,
  aiUndo: null,

  hydrate() {
    const patients = readJson<Patient[]>(PATIENTS_KEY, [demoPatient()]);
    if (!patients.find((p) => p.id === "p_ivanov")) patients.unshift(demoPatient());
    set({
      hydrated: true,
      session: readJson(SESSION_KEY, blankSession()),
      settings: { ...defaultSettings(), ...readJson(SETTINGS_KEY, {}) },
      patients,
      visits: readJson(VISITS_KEY, []),
      recentChips: readJson(CHIPS_KEY, ["никтурия", "слабая струя", "боль в пояснице"]),
    });
  },

  setSession(patch) {
    const session = { ...get().session, ...patch };
    persistSession(session);
    set({ session });
  },

  setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    writeJson(SETTINGS_KEY, settings);
    set({ settings });
  },

  setToast(msg) {
    set({ toast: msg });
    if (msg) setTimeout(() => set({ toast: null }), 2200);
  },

  addStudy(key) {
    const session = get().session;
    if (session.studies.some((s) => s.key === key)) return;
    const entry: StudyEntry = {
      key,
      instances: [{ id: uid("i"), date: todayISO(), fields: {} }],
    };
    const studies = [...session.studies, entry];
    const mode: SessionState["mode"] =
      session.mode === "consult" || session.mode === "consult_study" ? "consult_study" : "study";
    const next = { ...session, studies, mode, openSection: key };
    persistSession(next);
    set({ session: next });
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
    const def = getStudy(key);
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
    persistSession(next);
    set({ session: next });
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
  },

  toggleLocal(text) {
    const session = get().session;
    const has = session.localStatus.includes(text);
    const localStatus = has ? session.localStatus.filter((c) => c !== text) : [...session.localStatus, text];
    get().setSession({ localStatus });
  },

  addRecommendation(text) {
    const session = get().session;
    if (session.recommendations.includes(text)) return;
    get().setSession({ recommendations: [...session.recommendations, text] });
  },

  saveVisit() {
    const { session, patients, visits } = get();
    const patient = patients.find((p) => p.id === session.patientId);
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
    get().setToast("Визит сохранён в историю");
  },

  loadVisit(id) {
    const rec = get().visits.find((v) => v.id === id);
    if (!rec) return;
    persistSession(rec.session);
    set({ session: rec.session });
    get().setToast("Сеанс загружен");
  },

  loadLastForPatient() {
    const { session, visits } = get();
    const last = visits.find((v) => v.patientId === session.patientId);
    if (!last) {
      get().setToast("Нет прошлого сеанса у этого пациента");
      return;
    }
    persistSession(last.session);
    set({ session: last.session });
    get().setToast("Повторил прошлый сеанс");
  },

  setAiUndo(u) {
    set({ aiUndo: u });
  },

  undoAi() {
    const u = get().aiUndo;
    if (!u) return;
    const session = get().session;
    if (u.section === "complaints") get().setSession({ complaints: JSON.parse(u.before) });
    else get().setSession({ [u.section]: u.before } as Partial<SessionState>);
    set({ aiUndo: null });
    get().setToast("AI отменён");
    void session;
  },

  exportData() {
    const { session, settings, patients, visits, recentChips } = get();
    return JSON.stringify({ session, settings, patients, visits, recentChips, guidelines: GUIDELINES }, null, 2);
  },

  importData(raw) {
    try {
      const data = JSON.parse(raw);
      if (data.session) persistSession(data.session);
      if (data.settings) writeJson(SETTINGS_KEY, data.settings);
      if (data.patients) writeJson(PATIENTS_KEY, data.patients);
      if (data.visits) writeJson(VISITS_KEY, data.visits);
      if (data.recentChips) writeJson(CHIPS_KEY, data.recentChips);
      get().hydrate();
      get().setToast("Импорт выполнен");
      return true;
    } catch {
      get().setToast("Файл не прочитался");
      return false;
    }
  },
}));

export function shortName(p: Patient) {
  return `${formatPatient(p)}, ${p.age}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts.map((p, i) => (i === 0 ? `${p[0]}.` : p === parts[1] ? `${p[0]}.` : "")).join(" ").replace(/\s+/g, " ").trim()
    ? `${parts[0][0]}. ${parts[1] ? parts[1][0] + "." : ""}`.replace(" .", "")
    : name;
}

// prettier display: Иванов А. П.
export function formatPatient(p: Patient) {
  const parts = p.firstName.trim().split(/\s+/);
  const ini = parts.map((x) => (x ? `${x[0]}.` : "")).join(" ");
  return `${p.lastName} ${ini}`.trim();
}

export function visitKindLabel(k: VisitKind) {
  return k === "primary" ? "первичный" : "повторный";
}

export function modeLabel(mode: SessionState["mode"], studies: StudyEntry[]) {
  const studyNames = studies.map((s) => getStudy(s.key)?.label).filter(Boolean);
  if (mode === "study") return studyNames.join(" + ") || "Исследование";
  if (studyNames.length) return `Консультация + ${studyNames.join(", ")}`;
  return "Консультация уролога";
}
