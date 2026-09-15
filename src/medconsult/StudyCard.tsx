import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { applyComputed } from "./data/studies";
import { allStudiesLive, getStudyLive } from "./live";
import { useAppStore } from "./store";

export function StudyCard({ studyKey }: { studyKey: string }) {
  const def = getStudyLive(studyKey);
  const { session, updateInstance, addStudyInstance, removeInstance, removeStudy, setSession } = useAppStore();
  const entry = session.studies.find((s) => s.key === studyKey);
  if (!def || !entry) return null;
  const open = session.openSection === studyKey;

  return (
    <section
      className={`relative rounded-[10px] border bg-surface py-2 pr-8 pl-2.5 ${
        open ? "border-teal/40 shadow-[0_0_0_3px_var(--color-teal-soft)]" : "border-line"
      }`}
    >
      <button
        type="button"
        className="absolute top-1.5 right-1.5 flex size-[18px] items-center justify-center rounded bg-danger-soft text-xs font-bold text-danger"
        onClick={() => removeStudy(studyKey)}
        aria-label="Убрать обследование"
      >
        ×
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setSession({ openSection: open ? null : studyKey })}
      >
        <h4 className="text-sm font-medium">{def.label}</h4>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {entry.instances.map((inst, idx) => (
            <div key={inst.id} className="rounded-lg border border-dashed border-line p-2">
              <div className="mb-1.5 flex items-center justify-between text-xs text-ink-soft">
                <label className="flex items-center gap-2">
                  {idx === 0 ? "сегодня" : "предыдущее"}
                  <input
                    type="date"
                    value={inst.date}
                    onChange={(e) => updateInstance(studyKey, inst.id, inst.fields, e.target.value)}
                    className="rounded border border-line bg-paper px-1 py-0.5 text-xs"
                  />
                </label>
                {entry.instances.length > 1 && (
                  <button type="button" className="text-danger" onClick={() => removeInstance(studyKey, inst.id)}>
                    убрать
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {def.fields.map((f) => {
                  const fields = applyComputed(def, inst.fields);
                  const value = fields[f.key] || "";
                  return (
                    <label
                      key={f.key}
                      className={`rounded-md px-1.5 py-1 ${f.computed ? "bg-teal-soft" : "bg-paper"}`}
                    >
                      <span className="block text-[10px] text-mute">{f.label}</span>
                      {f.computed ? (
                        <span className="block text-sm font-semibold tabular-nums">
                          {value || "—"} {f.unit}
                        </span>
                      ) : (
                        <input
                          value={inst.fields[f.key] || ""}
                          onChange={(e) =>
                            updateInstance(studyKey, inst.id, { ...inst.fields, [f.key]: e.target.value })
                          }
                          className="w-full bg-transparent text-sm font-semibold outline-none tabular-nums"
                        />
                      )}
                      {f.normal && <span className="block text-[10px] text-teal">{f.normal}</span>}
                    </label>
                  );
                })}
              </div>
              {def.referenceNotes && (
                <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{def.referenceNotes}</p>
              )}
            </div>
          ))}
          <button type="button" className="text-xs font-medium text-teal" onClick={() => addStudyInstance(studyKey)}>
            + предыдущее / ещё результат
          </button>
        </div>
      )}
      {!open && (
        <p className="mt-1 text-xs text-ink-soft">
          {entry.instances.length} {entry.instances.length === 1 ? "результат" : "результата"}
        </p>
      )}
    </section>
  );
}

export function PlusStudyButton() {
  const [open, setOpen] = useState(false);
  const { session, addStudy } = useAppStore();
  const studies = useMemo(() => allStudiesLive(), []);
  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-lg bg-teal px-3 py-1.5 text-sm font-bold text-paper"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1">
          <Plus className="size-3.5" /> обследование
        </span>
      </button>
      {open && (
        <div className="absolute top-10 right-0 z-20 flex max-h-80 w-64 flex-col gap-1 overflow-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
          {studies.map((s) => {
            const on = session.studies.some((e) => e.key === s.key);
            return (
              <button
                key={s.key}
                type="button"
                disabled={on}
                onClick={() => {
                  addStudy(s.key);
                  setOpen(false);
                }}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                  on ? "border-teal/30 bg-teal-soft text-teal" : "border-line bg-paper text-ink"
                }`}
              >
                {s.label}
                {on ? " · добавлен" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
