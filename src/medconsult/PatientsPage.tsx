import { AppShell } from "./AppShell";
import { useNav } from "./NavContext";
import { formatPatient, useAppStore, visitKindLabel } from "./store";

export function PatientsPage() {
  const { patients, visits, loadVisit, session, setSession } = useAppStore();
  const { navigate } = useNav();
  const current = patients.find((p) => p.id === session.patientId);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24 md:p-8">
        <h1 className="font-display text-2xl">Пациенты и история</h1>
        <p className="text-sm text-ink-soft">
          Если Медлок лежит — текст всё равно здесь. Для тех, кто пишет в Word, это и есть архив.
        </p>
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">Текущий</h2>
          {current && (
            <p className="mt-2 text-sm">
              {current.lastName} {current.firstName}, {current.age} лет
            </p>
          )}
          <button
            type="button"
            className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm"
            onClick={() => {
              const name = prompt("Фамилия Имя Отчество");
              const age = prompt("Возраст") || "";
              if (!name) return;
              const [lastName, ...rest] = name.trim().split(/\s+/);
              const p = { id: `p_${Date.now()}`, lastName, firstName: rest.join(" ") || lastName, age };
              const next = [p, ...patients];
              useAppStore.setState({ patients: next });
              localStorage.setItem("medconsult_v2_patients", JSON.stringify(next));
              setSession({ patientId: p.id });
            }}
          >
            Новый пациент
          </button>
        </div>
        <ul className="space-y-2">
          {visits.length === 0 && <li className="text-sm text-mute">История пуста — сохраните сеанс с протокола.</li>}
          {visits.map((v) => {
            const p = patients.find((x) => x.id === v.patientId);
            return (
              <li key={v.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
                <div>
                  <div className="text-sm font-medium">
                    {p ? formatPatient(p) : "без пациента"} · {visitKindLabel(v.visitKind)}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {new Date(v.savedAt).toLocaleString("ru-RU")} · {v.diagnosisCode}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-teal"
                  onClick={() => {
                    loadVisit(v.id);
                    navigate("/");
                  }}
                >
                  Открыть
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
