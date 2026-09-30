import { useEffect, useState } from "react";
import { deleteDisease, listDiseases, saveDisease, type Disease } from "./diseases";

const EMPTY: Disease = {
  name: "",
  classification: "",
  diagnosis: "",
  treatment: "",
  prevention: "",
  extra: "",
};

export function DiseasesPage() {
  const [items, setItems] = useState<Disease[]>(() => listDiseases());
  const [form, setForm] = useState<Disease>(EMPTY);

  useEffect(() => {
    const sync = () => setItems(listDiseases());
    window.addEventListener("medconsult-diseases", sync);
    return () => window.removeEventListener("medconsult-diseases", sync);
  }, []);

  function set<K extends keyof Disease>(key: K, value: Disease[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        Сюда сами попадают болезни из «перенесённых». «i» в протоколе есть только если заполнено что-то кроме названия.
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((d) => (
          <button
            key={d.name}
            type="button"
            className={`rounded-full px-2 py-0.5 text-xs ${form.name === d.name ? "bg-teal text-paper" : "border border-line bg-paper"}`}
            onClick={() => setForm(d)}
          >
            {d.name}
          </button>
        ))}
        <button type="button" className="rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-xs text-teal" onClick={() => setForm(EMPTY)}>
          + болезнь
        </button>
      </div>
      <div className="space-y-1 rounded-lg border border-line bg-paper p-2">
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="название" className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        <textarea value={form.classification} onChange={(e) => set("classification", e.target.value)} placeholder="классификация" rows={2} className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        <textarea value={form.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="диагностика" rows={2} className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        <textarea value={form.treatment} onChange={(e) => set("treatment", e.target.value)} placeholder="лечение" rows={2} className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        <textarea value={form.prevention} onChange={(e) => set("prevention", e.target.value)} placeholder="профилактика" rows={2} className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        <textarea value={form.extra} onChange={(e) => set("extra", e.target.value)} placeholder="дополнительная информация" rows={2} className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md bg-teal px-2 py-1 text-xs font-semibold text-paper"
            onClick={() => {
              saveDisease(form);
              setForm(EMPTY);
            }}
          >
            сохранить
          </button>
          {form.name && (
            <button
              type="button"
              className="text-xs text-danger"
              onClick={() => {
                deleteDisease(form.name);
                setForm(EMPTY);
              }}
            >
              удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
