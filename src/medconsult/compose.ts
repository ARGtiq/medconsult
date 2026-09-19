import { formatPatient, modeLabel, shortName, visitKindLabel } from "./store";
import { fillStudyTemplate } from "./data/studies";
import { getStudyLive } from "./live";
import type { Patient, SessionState } from "./types";

export type PreviewBlock = {
  id: string;
  n: number;
  title: string;
  text: string;
};

export function composeHeader(session: SessionState, patient: Patient | undefined) {
  if (session.headerOverride.trim()) return session.headerOverride.trim();
  const who = patient ? `${patient.lastName} ${patient.firstName}, ${patient.age} года` : "Без пациента";
  const kind = visitKindLabel(session.visitKind);
  const what = modeLabel(session.mode, session.studies);
  if (session.mode === "document") {
    return `${who}.\nДругой документ.`;
  }
  if (session.mode === "study") {
    return `${who}.\n${what}.`;
  }
  return `${who}.\n${kind[0].toUpperCase()}${kind.slice(1)} приём. ${what}.`;
}

export function composeHeaderLine(session: SessionState, patient: Patient | undefined) {
  const who = patient ? shortName(patient) : "без пациента";
  return `${modeLabel(session.mode, session.studies)}  ${who}`;
}

function hidden(session: SessionState, id: string) {
  return session.hiddenBlocks.includes(id);
}

function includeStd(session: SessionState, id: string) {
  if (hidden(session, id)) return false;
  if (session.mode === "document") return (session.docStd || []).includes(id);
  if (session.mode === "study") return false;
  return true;
}

export function composeBlocks(session: SessionState, patient?: Patient): PreviewBlock[] {
  const out: PreviewBlock[] = [];
  const push = (id: string, title: string, text: string) => {
    if (hidden(session, id)) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    out.push({ id, n: 0, title, text: trimmed });
  };

  if (patient) {
    const bits: string[] = [];
    if (patient.allergies?.length) bits.push(`Аллергия: ${patient.allergies.join(", ")}`);
    if (patient.currentMedications?.length) bits.push(`Постоянно принимает: ${patient.currentMedications.join(", ")}`);
    if (bits.length) push("card", "Карточка пациента", `${bits.join(". ")}.`);
  }

  if (includeStd(session, "complaints")) {
    push("complaints", "Жалобы", (session.complaints || []).join(", "));
  }
  if (includeStd(session, "anamnesis")) {
    push("anamnesis", "Анамнез заболевания", session.anamnesis);
  }
  if (includeStd(session, "anamnesisVitae")) {
    push("anamnesisVitae", "Предварительный анамнез жизни", session.anamnesisVitae);
  }
  if (includeStd(session, "status")) {
    const status = [session.objective, (session.localStatus || []).join("; ")].filter((x) => x.trim()).join(" ");
    push("status", "Объективный + локальный статус", status);
  }

  const studyParts = (session.studies || [])
    .map((entry) => {
      const def = getStudyLive(entry.key);
      if (!def) return "";
      return entry.instances
        .map((inst, idx) => fillStudyTemplate(def, inst, idx === 0 ? entry.previous : undefined))
        .join(" ");
    })
    .filter(Boolean);
  if (studyParts.length) push("studies", "Обследования", studyParts.join("\n"));

  if (includeStd(session, "diagnosis")) {
    const dx = [session.diagnosisCode, session.diagnosisTitle].filter(Boolean).join(" ");
    push("diagnosis", "Диагноз", dx);
  }
  if (includeStd(session, "recommendations")) {
    push("recommendations", "Рекомендации", (session.recommendations || []).join(". "));
  }

  if (session.mode === "document" || session.notes.trim()) {
    push("notes", session.mode === "document" ? "Текст документа" : "Примечания", session.notes);
  }

  (session.extraBlocks || []).forEach((b) => {
    push(b.id, b.title, b.text);
  });

  return out.map((b, i) => ({ ...b, n: i + 1 }));
}

export function composeAll(session: SessionState, patient: Patient | undefined, includeHeader: boolean) {
  const blocks = composeBlocks(session, patient);
  const body = blocks.map((b) => `${b.title}. ${b.text}`).join("\n\n");
  if (!includeHeader) return body;
  return `${composeHeader(session, patient)}\n\n${body}`;
}

export { formatPatient };
