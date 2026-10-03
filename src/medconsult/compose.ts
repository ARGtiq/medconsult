import { formatPatient, modeLabel, shortName, visitKindLabel } from "./store";
import { fillStudyTemplate, collectDeviations, formatDeviations } from "./data/studies";
import { formatLocalStatus, getLocalPacks, localStatusLines, protocolBlockOrder } from "./data/templates";
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

export function complaintsTextOf(session: SessionState): string {
  if (session.complaintsChipMode) return (session.complaints || []).join(", ");
  if (typeof session.complaintsText === "string") return session.complaintsText;
  return (session.complaints || []).join(", ");
}

export function recommendationsTextOf(session: SessionState): string {
  const general = (session.generalRecs || "").trim();
  const lines = (session.recommendations || []).map((s) => s.trim()).filter(Boolean).join("\n");
  return [general, lines].filter(Boolean).join("\n");
}

export function composeBlocks(
  session: SessionState,
  _patient?: Patient,
  opts?: { deviations?: boolean },
): PreviewBlock[] {
  const out: PreviewBlock[] = [];
  const push = (id: string, title: string, text: string) => {
    if (hidden(session, id)) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    out.push({ id, n: 0, title, text: trimmed });
  };

  const legacyOrder = ["complaints", "anamnesis", "anamnesisVitae", "objective", "status", "diagnosis", "recommendations"];
  const order = session.templateId ? protocolBlockOrder(session.templateId, session.docStd) : legacyOrder;
  let statusSent = false;
  const emitStatus = () => {
    if (statusSent) return;
    statusSent = true;
    const showObj = includeStd(session, "objective") || (session.mode === "document" && includeStd(session, "status") && !hidden(session, "objective"));
    const showLoc = includeStd(session, "status");
    if (!showObj && !showLoc) return;
    const obj = showObj ? (session.objective || "").trim() : "";
    const packs = getLocalPacks();
    const generated = new Set(localStatusLines(session.localPicks || [], packs, []));
    const free = (session.localStatus || []).filter((x) => !generated.has(x));
    const loc = showLoc
      ? formatLocalStatus(session.localPicks || [], packs, session.activeLocalPacks || [], free)
      : "";
    const title = obj && loc ? "Объективный + локальный статус" : obj ? "Объективный статус" : "Локальный статус";
    push(obj && !loc ? "objective" : "status", title, [obj, loc].filter(Boolean).join("\n"));
  };
  const emitStudies = () => {
    const studyParts = (session.studies || [])
      .map((entry) => {
        const def = getStudyLive(entry.key);
        if (entry.textMode && (entry.text || "").trim()) return entry.text.trim();
        if (!def) return "";
        return entry.instances
          .map((inst, idx) =>
            fillStudyTemplate(def, inst, idx === 0 ? entry.previous : entry.instances[idx - 1]),
          )
          .join(" ");
      })
      .filter(Boolean);
    if (studyParts.length) push("studies", "Обследования", studyParts.join("\n"));
    if (opts?.deviations) {
      const dev = collectDeviations(session.studies || [], getStudyLive);
      const text = formatDeviations(dev);
      if (text) push("deviations", "Отклонения", `${text}.`);
    }
  };
  let studiesSent = false;
  for (const id of order) {
    if (!studiesSent && id === "recommendations") {
      emitStudies();
      studiesSent = true;
    }
    if (id === "complaints" && includeStd(session, "complaints")) {
      push("complaints", "Жалобы", complaintsTextOf(session));
    } else if (id === "anamnesis" && includeStd(session, "anamnesis")) {
      push("anamnesis", "Анамнез заболевания", session.anamnesis);
    } else if (id === "anamnesisVitae" && includeStd(session, "anamnesisVitae")) {
      push("anamnesisVitae", "Предварительный анамнез жизни", session.anamnesisVitae);
    } else if (id === "objective" || id === "status") {
      emitStatus();
    } else if (id === "diagnosis" && includeStd(session, "diagnosis")) {
      const dx = [session.diagnosisCode, session.diagnosisTitle].filter(Boolean).join(" ");
      push("diagnosis", "Диагноз", dx);
    } else if (id === "recommendations" && includeStd(session, "recommendations")) {
      push("recommendations", "Рекомендации", recommendationsTextOf(session));
    }
  }
  if (!studiesSent) emitStudies();

  if (session.mode === "document" || session.notes.trim()) {
    push("notes", session.mode === "document" ? "Текст документа" : "Примечания", session.notes);
  }

  (session.extraBlocks || []).forEach((b) => {
    push(b.id, b.title, b.text);
  });

  return out.map((b, i) => ({ ...b, n: i + 1 }));
}

export function composeAll(
  session: SessionState,
  patient: Patient | undefined,
  includeHeader: boolean,
  opts?: { deviations?: boolean },
) {
  const blocks = composeBlocks(session, patient, opts);
  const body = blocks.map((b) => `${b.title}. ${b.text}`).join("\n\n");
  if (!includeHeader) return body;
  return `${composeHeader(session, patient)}\n\n${body}`;
}

export { formatPatient };
