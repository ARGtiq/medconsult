import { formatPatient, modeLabel, shortName, visitKindLabel } from "./store";
import { fillStudyTemplate, getStudy } from "./data/studies";
import type { Patient, SessionState } from "./types";

export type PreviewBlock = {
  id: string;
  n: number;
  title: string;
  text: string;
};

export function composeHeader(session: SessionState, patient: Patient | undefined) {
  if (session.headerOverride.trim()) return session.headerOverride.trim();
  const who = patient ? `${patient.lastName} ${patient.firstName}, ${patient.age} года` : "Пациент не выбран";
  const kind = visitKindLabel(session.visitKind);
  const what = modeLabel(session.mode, session.studies);
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

export function composeBlocks(session: SessionState): PreviewBlock[] {
  const out: PreviewBlock[] = [];
  const push = (id: string, title: string, text: string) => {
    if (hidden(session, id)) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    out.push({ id, n: 0, title, text: trimmed });
  };

  push("complaints", "Жалобы", session.complaints.join(", "));
  push("anamnesis", "Анамнез заболевания", session.anamnesis);
  push("anamnesisVitae", "Анамнез жизни", session.anamnesisVitae);
  const status = [session.objective, session.localStatus.join("; ")].filter((x) => x.trim()).join(" ");
  push("status", "Объективный + локальный статус", status);

  const studyParts = session.studies
    .map((entry) => {
      const def = getStudy(entry.key);
      if (!def) return "";
      return entry.instances.map((inst) => fillStudyTemplate(def, inst)).join(" ");
    })
    .filter(Boolean);
  push("studies", "Обследования", studyParts.join("\n"));

  const dx = [session.diagnosisCode, session.diagnosisTitle].filter(Boolean).join(" ");
  push("diagnosis", "Диагноз", dx);
  push("recommendations", "Рекомендации", session.recommendations.join(". "));
  push("notes", "Примечания", session.notes);

  return out.map((b, i) => ({ ...b, n: i + 1 }));
}

export function composeAll(session: SessionState, patient: Patient | undefined, includeHeader: boolean) {
  const blocks = composeBlocks(session);
  const body = blocks.map((b) => `${b.title}. ${b.text}`).join("\n\n");
  if (!includeHeader) return body;
  return `${composeHeader(session, patient)}\n\n${body}`;
}

export { formatPatient };
