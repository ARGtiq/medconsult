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
  const [form, setForm] = useState<Disease | null>(null);

  useEffect(() => {
    const sync = () => setItems(listDiseases());
    window.addEventListener("medconsult-diseases", sync);
    return () => window.removeEventListener("medconsult-diseases", sync);
  }, []);

  function set<K extends keyof Disease>(key: K, value: Disease[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <div>
      <p className="settings-note-inline">
        Список болезней. Редактирование в окне. Сюда сами попадают названия из перенесённых. «i» на приёме есть, только если кроме названия что-то заполнено.
      </p>
      <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
        + болезнь
      </button>
      <div className="drug-db-list">
        {items.length === 0 && <p className="empty-hint">Пока пусто.</p>}
        {items.map((d) => (
          <button type="button" key={d.name} className="home-draft-item" onClick={() => setForm({ ...d })}>
            <strong>{d.name}</strong>
          </button>
        ))}
      </div>
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.name.trim() ? form.name : "Болезнь"}</h3>
              <button type="button" className="modal-close" onClick={() => setForm(null)}>
                ×
              </button>
            </div>
            <div className="drug-form">
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="название" />
              <textarea value={form.classification} onChange={(e) => set("classification", e.target.value)} placeholder="классификация" rows={2} />
              <textarea value={form.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="диагностика" rows={2} />
              <textarea value={form.treatment} onChange={(e) => set("treatment", e.target.value)} placeholder="лечение" rows={2} />
              <textarea value={form.prevention} onChange={(e) => set("prevention", e.target.value)} placeholder="профилактика" rows={2} />
              <textarea value={form.extra} onChange={(e) => set("extra", e.target.value)} placeholder="дополнительная информация" rows={2} />
              <div className="drug-form-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    saveDisease(form);
                    setForm(null);
                  }}
                >
                  Сохранить
                </button>
                {form.name && (
                  <button
                    type="button"
                    className="btn-secondary btn-danger"
                    onClick={() => {
                      deleteDisease(form.name);
                      setForm(null);
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
