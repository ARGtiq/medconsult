import { Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applyComputed } from "./data/studies";
import { allStudiesLive, getStudyLive } from "./live";
import { useAppStore } from "./store";

export function StudyCard({ studyKey }: { studyKey: string }) {
  const def = getStudyLive(studyKey);
  const { session, settings, updateInstance, addStudyInstance, removeInstance, removeStudy, setSession } = useAppStore();
  const entry = session.studies.find((s) => s.key === studyKey);
  if (!def || !entry) return null;
  const selected = session.openSection === studyKey;
  const open = !settings.blocksAsSpoiler || selected;
  const previous = entry.previous;
  const prevFields = previous ? applyComputed(def, previous.fields) : null;

  return (
    <section
      className={`relative rounded-[10px] border bg-surface py-2 pr-8 pl-2.5 ${
        selected ? "border-teal/40 shadow-[0_0_0_3px_var(--color-teal-soft)]" : "border-line"
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
        onClick={() => setSession({ openSection: selected ? null : studyKey })}
      >
        <h4 className="text-sm font-medium">{def.label}</h4>
        {previous?.date && (
          <span className="rounded bg-teal-soft px-1.5 text-[10px] font-semibold text-teal">было {previous.date}</span>
        )}
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
                  const was = idx === 0 && prevFields ? (prevFields[f.key] || "").trim() : "";
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
                      {was && (
                        <span className="mt-0.5 block text-[10px] text-mute">
                          было: {was}
                          {previous?.date ? ` · ${previous.date}` : ""}
                        </span>
                      )}
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
          {previous?.date ? ` · прошлый ${previous.date}` : ""}
        </p>
      )}
    </section>
  );
}

export function PlusStudyButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 280, width: 280 });
  const { session, addStudy } = useAppStore();
  const studies = useMemo(() => allStudiesLive(), []);
  const filtered = studies.filter((s) => !q.trim() || s.label.toLowerCase().includes(q.trim().toLowerCase()));

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 280;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxH = Math.max(180, Math.min(440, openUp ? spaceAbove : spaceBelow));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = openUp ? Math.max(8, r.top - maxH - 4) : Math.min(r.bottom + 4, window.innerHeight - maxH - 8);
      setPos({ top, left, maxH, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setIdx(0), [q, open]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx, open]);

  function choose(i: number) {
    const s = filtered[i];
    if (!s) return;
    if (session.studies.some((e) => e.key === s.key)) return;
    addStudy(s.key);
    setOpen(false);
    setQ("");
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="rounded-lg bg-teal px-2.5 py-1.5 text-sm font-bold text-paper"
        onClick={() => setOpen((v) => !v)}
        title="Добавить обследование"
        aria-label="Добавить обследование"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1">
          <Plus className="size-3.5" /> обследование
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.maxH }}
            className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(idx);
                }
              }}
              placeholder="Найти обследование…  ↑↓ Enter"
              className="shrink-0 border-b border-line bg-paper px-2.5 py-2 text-sm outline-none"
            />
            <div className="min-h-0 flex-1 overflow-auto p-1.5">
              {filtered.length === 0 && <p className="px-2 py-3 text-xs text-mute">Ничего не нашлось</p>}
              {filtered.map((s, i) => {
                const on = session.studies.some((e) => e.key === s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    data-idx={i}
                    disabled={on}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => choose(i)}
                    className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium last:mb-0 ${
                      on
                        ? "border-teal/30 bg-teal-soft text-teal"
                        : i === idx
                          ? "border-teal bg-teal-soft text-teal"
                          : "border-line bg-paper text-ink"
                    }`}
                  >
                    {s.label}
                    {on ? " · добавлен" : ""}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
