import LegacyPatients from "@/legacy/components/PatientsPage";
import { store as legacy } from "@/legacy/lib/store";
import "@/legacy/legacy.css";
import { AppShell } from "./AppShell";
import { useNav } from "./NavContext";
import { useAppStore, blankSession } from "./store";

export function PatientsPage() {
  const { navigate } = useNav();
  const app = useAppStore();

  function onLoadVisit(v: Record<string, unknown>) {
    if (v.session && typeof v.session === "object") {
      app.loadVisit(String(v.id));
      const rec = app.visits.find((x) => x.id === v.id);
      if (rec) {
        navigate("/");
        return;
      }
      app.setSession(v.session as never);
      navigate("/");
      return;
    }
    const sv = (v.sectionValues || {}) as Record<string, unknown>;
    const recsRaw = sv.recommendations;
    const recs = Array.isArray(recsRaw)
      ? recsRaw.map((d) =>
          typeof d === "string"
            ? d
            : `${(d as { name?: string }).name || ""} ${(d as { dosage?: string; dose?: string; frequency?: string }).dosage || (d as { dose?: string }).dose || ""} ${(d as { frequency?: string }).frequency || ""}`.trim(),
        )
      : [];
    const complaints = Array.isArray(sv.complaints) ? (sv.complaints as string[]) : [];
    app.setSession({
      ...blankSession(),
      patientId: String(v.patientId || ""),
      diagnosisTitle: typeof sv.diagnosis === "string" ? sv.diagnosis : app.session.diagnosisTitle,
      diagnosisCode: String(v.diagnosisCode || app.session.diagnosisCode),
      complaints,
      anamnesis: typeof sv.anamnesis === "string" ? sv.anamnesis : "",
      recommendations: recs,
    });
    app.setToast("Старый визит открыт в протоколе");
    navigate("/");
  }

  return (
    <AppShell>
      <div className="legacy-surface min-h-[calc(100dvh-3rem)] p-3 pb-24 md:p-6">
        <LegacyPatients onLoadVisit={onLoadVisit} />
        <p className="settings-note-inline mt-4">
          Пациентов в архиве: {legacy.getPatients().length}. Визитов: {legacy.getVisits().length}.
        </p>
      </div>
    </AppShell>
  );
}
