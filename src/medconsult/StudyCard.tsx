import { Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyComputed,
  applyConditionalDefaults,
  collectDeviations,
  fieldAbnormal,
  fieldShown,
  fillStudyTemplate,
  formatRefHint,
  groupDeviations,
  referenceInsertValue,
  relativeShare,
  STUDY_GROUP_LABEL,
  STUDY_GROUP_ORDER,
  liveScales,
  studyMatchesQuery,
} from "./data/studies";
import type { StudyDef, StudyEntry, StudyField } from "./types";
import { useTemplates } from "./data/templates";
import { allStudiesLive, getStudyLive, icdMatches } from "./live";
import { scaleFromStudyKey, studyKeyForScale } from "./data/questionnaires";
import { QuestionnaireForm } from "./QuestionnaireForm";
import { useAppStore } from "./store";

function splitMulti(value: string) {
  return (value || "")
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function FieldControl({
  f,
  value,
  onChange,
}: {
  f: StudyField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (f.computed) {
    return (
      <span className="block text-sm font-semibold tabular-nums">
        {value || "—"} {f.unit}
      </span>
    );
  }
  if ((f.kind === "groups" && f.optionGroups?.length) || ((f.kind === "select" || f.kind === "multi") && f.options?.length)) {
    if (f.kind === "groups" && f.optionGroups?.length) {
      const picked = splitMulti(value);
      return (
        <div className="mt-0.5 space-y-1">
          {f.optionGroups.map((group, gi) => (
            <div key={gi} className="flex flex-wrap gap-1">
              {group.map((opt) => {
                const on = picked.some((p) => p.toLowerCase() === opt.toLowerCase());
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      on ? "bg-teal text-paper" : "border border-line bg-surface text-ink"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      const rest = picked.filter((p) => !group.some((g) => g.toLowerCase() === p.toLowerCase()));
                      const next = on ? rest : [...rest, opt];
                      const ordered = (f.optionGroups || []).flatMap((g) =>
                        g.filter((o) => next.some((n) => n.toLowerCase() === o.toLowerCase())),
                      );
                      onChange(ordered.join(", "));
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    const picked = f.kind === "multi" ? splitMulti(value) : value ? [value] : [];
    return (
      <div className="mt-0.5 flex flex-wrap gap-1">
        {(f.options || []).map((opt) => {
          const on = picked.some((p) => p.toLowerCase() === opt.toLowerCase());
          return (
            <button
              key={opt}
              type="button"
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                on ? "bg-teal text-paper" : "border border-line bg-surface text-ink"
              }`}
              onClick={(e) => {
                e.preventDefault();
                if (f.kind === "multi") {
                  const next = on ? picked.filter((p) => p.toLowerCase() !== opt.toLowerCase()) : [...picked, opt];
                  onChange(next.join(", "));
                } else {
                  onChange(on ? "" : opt);
                }
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={f.kind === "number" || f.unit ? "decimal" : "text"}
      className="w-full bg-transparent text-sm font-semibold outline-none tabular-nums"
    />
  );
}

function shortDate(iso?: string) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

function QuestionnaireControls({
  studyKey,
  def,
  entry,
}: {
  studyKey: string;
  def: StudyDef;
  entry: StudyEntry;
}) {
  const { session, updateInstance, addStudyInstance, removeInstance, addStudy } = useAppStore();
  const [pick, setPick] = useState<string | null>(null);
  const [showPrev, setShowPrev] = useState(false);
  const count = entry.instances.length;
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) {
      setPick(entry.instances[count - 1]?.id || null);
      setShowPrev(false);
    }
    prevCount.current = count;
  }, [count, entry.instances]);
  const active = entry.instances.find((i) => i.id === pick) || entry.instances[count - 1];
  if (!active) return null;
  const idx = entry.instances.findIndex((i) => i.id === active.id);
  const prior = idx > 0 ? entry.instances[idx - 1] : entry.previous;
  const prevFields = prior ? applyComputed(def, prior.fields) : null;
  const hasPrev = !!prevFields && Object.values(prevFields).some((v) => String(v || "").trim());

  return (
    <div className="rounded-lg border border-dashed border-line p-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px]">
        {entry.instances.map((inst, i) => (
          <button
            key={inst.id}
            type="button"
            onClick={() => {
              setPick(inst.id);
              setShowPrev(false);
            }}
            className={`rounded-full px-2 py-0.5 ${
              inst.id === active.id ? "bg-teal font-medium text-paper" : "border border-line text-ink-soft"
            }`}
          >
            {count === 1 ? "заполнение" : i === count - 1 ? "сейчас" : `контроль ${i + 1}`}
            {inst.date ? ` · ${shortDate(inst.date)}` : ""}
          </button>
        ))}
        <input
          type="date"
          value={active.date}
          onChange={(e) => updateInstance(studyKey, active.id, active.fields, e.target.value)}
          className="rounded border border-line bg-paper px-1 py-0.5 text-xs"
        />
        {count > 1 && (
          <button type="button" className="text-danger" onClick={() => removeInstance(studyKey, active.id)}>
            убрать
          </button>
        )}
      </div>
      <QuestionnaireForm
        scale={scaleFromStudyKey(studyKey, liveScales()) || null}
        fields={active.fields}
        previous={hasPrev ? prevFields : null}
        prevDate={prior?.date ? shortDate(prior.date) : undefined}
        showPrevious={showPrev}
        onTogglePrevious={hasPrev ? () => setShowPrev((v) => !v) : undefined}
        takenKeys={session.studies.map((s) => s.key)}
        onAddScale={(scale) => addStudy(studyKeyForScale(scale.totalKey))}
        onChange={(next) => updateInstance(studyKey, active.id, next, active.date)}
      />
      <button type="button" className="mt-1.5 text-xs font-medium text-teal" onClick={() => addStudyInstance(studyKey)}>
        + контроль
      </button>
    </div>
  );
}

export function StudyCard({ studyKey }: { studyKey: string }) {
  const def = getStudyLive(studyKey);
  const { session, settings, updateInstance, addStudyInstance, removeInstance, removeStudy, setSession, toggleStudyOmit, addStudy } = useAppStore();
  const entry = session.studies.find((s) => s.key === studyKey);
  if (!def || !entry) return null;
  const selected = session.openSection === studyKey;
  const open = !settings.blocksAsSpoiler || selected;
  const previous = entry.previous;
  const prevFields = previous ? applyComputed(def, applyConditionalDefaults(def, previous.fields)) : null;
  const patchStudy = (patch: Partial<StudyEntry>) => {
    setSession({
      studies: session.studies.map((s) => (s.key === studyKey ? { ...s, ...patch } : s)),
    });
  };
  const asText = () => {
    const text = entry.instances
      .map((inst, idx) => fillStudyTemplate(def, inst, idx === 0 ? entry.previous : entry.instances[idx - 1]))
      .filter(Boolean)
      .join("\n");
    patchStudy({ textMode: true, text: text || entry.text || "" });
  };

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
      {open && entry.textMode ? (
        <div className="mt-2">
          <textarea
            value={entry.text || ""}
            onChange={(e) => patchStudy({ text: e.target.value })}
            rows={4}
            className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
          />
          <button type="button" className="mt-1 text-[11px] font-medium text-teal" onClick={() => patchStudy({ textMode: false })}>
            вернуть пункты
          </button>
        </div>
      ) : null}
      {open && !entry.textMode && (
        <div className="mt-2 space-y-2">
          {def.category === "questionnaire" ? (
            <>
              <QuestionnaireControls studyKey={studyKey} def={def} entry={entry} />
              <button type="button" className="text-[11px] font-medium text-teal" onClick={asText}>
                как текст
              </button>
            </>
          ) : (
          <>
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
              {def.category === "questionnaire" ? (
                <QuestionnaireForm
                  scale={scaleFromStudyKey(studyKey, liveScales()) || null}
                  fields={inst.fields}
                  previous={idx === 0 ? prevFields : null}
                  prevDate={previous?.date}
                  takenKeys={session.studies.map((s) => s.key)}
                  onAddScale={(scale) => addStudy(studyKeyForScale(scale.totalKey))}
                  onChange={(next) => updateInstance(studyKey, inst.id, next, inst.date)}
                />
              ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {def.fields.filter((f) => fieldShown(f, applyConditionalDefaults(def, inst.fields))).map((f) => {
                  const fields = applyComputed(def, applyConditionalDefaults(def, inst.fields));
                  const value = fields[f.key] || "";
                  const was = idx === 0 && prevFields ? (prevFields[f.key] || "").trim() : "";
                  const bad = fieldAbnormal(value, f.normal, f, fields);
                  const omitted = (inst.omit || []).includes(f.key);
                  const pickable = (def.category === "lab" || def.sparse) && !f.computed;
                  const wide = f.kind === "select" || f.kind === "multi" || f.kind === "groups" || !!f.showIf;
                  const share =
                    f.refOf && f.refOfMode !== "value" && !f.computed
                      ? relativeShare(inst.fields[f.key] || value, fields[f.refOf] || "")
                      : null;
                  const hint = formatRefHint(f);
                  const insert = f.computed ? "" : referenceInsertValue(f);
                  return (
                    <div
                      key={f.key}
                      className={`rounded-md px-1.5 py-1 ${wide ? "col-span-2 sm:col-span-3" : ""} ${
                        f.showIf ? "ml-3 border-l-2 border-line" : ""
                      } ${f.computed ? "bg-teal-soft" : omitted ? "bg-paper opacity-50" : bad ? "bg-danger-soft" : "bg-paper"}`}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          className={`block text-[10px] ${pickable ? "text-teal" : "text-mute"}`}
                          title={pickable ? (omitted ? "не пойдёт в протокол — нажми, чтобы вставить" : "в протоколе · нажми, чтобы убрать") : undefined}
                          onClick={(e) => {
                            if (!pickable) return;
                            e.preventDefault();
                            toggleStudyOmit(studyKey, inst.id, f.key);
                          }}
                        >
                          {f.label}
                          {pickable ? (omitted ? " · нет" : " · в текст") : f.computed ? " · формула" : ""}
                        </button>
                      </span>
                      <FieldControl
                        f={f}
                        value={fields[f.key] || ""}
                        onChange={(v) => updateInstance(studyKey, inst.id, { ...inst.fields, [f.key]: v }, inst.date)}
                      />
                      {hint ? (
                        <button
                          type="button"
                          disabled={!insert}
                          title={insert ? `подставить «${insert}»` : "значение по умолчанию задаётся в шаблоне исследования"}
                          className={`block text-left text-[10px] underline decoration-dotted underline-offset-2 ${
                            bad ? "text-danger" : "text-teal"
                          } ${insert ? "" : "cursor-default no-underline"}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!insert) return;
                            updateInstance(studyKey, inst.id, { ...inst.fields, [f.key]: insert }, inst.date);
                          }}
                        >
                          {hint}
                          {share != null ? ` · ${Math.round(share * 10) / 10}% объёма` : ""}
                        </button>
                      ) : null}
                      {was && (
                        <span className="mt-0.5 block text-[10px] text-mute">
                          было: {was}
                          {previous?.date ? ` · ${previous.date}` : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
              {def.category === "lab" && (
                <p className="mt-1 text-[10px] text-mute">В протокол — только заполненные. Клик по названию пункта — не вставлять.</p>
              )}
              {def.referenceNotes && (
                <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{def.referenceNotes}</p>
              )}
            </div>
          ))}
          <button type="button" className="text-xs font-medium text-teal" onClick={() => addStudyInstance(studyKey)}>
            + предыдущее / ещё результат
          </button>
          <button type="button" className="ml-3 text-[11px] font-medium text-teal" onClick={asText}>
            как текст
          </button>
          </>
          )}
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
  const [tab, setTab] = useState<(typeof STUDY_GROUP_ORDER)[number]>("lab");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 280, width: 280 });
  const { session, addStudy } = useAppStore();
  const templates = useTemplates();
  const studies = useMemo(() => allStudiesLive(), [templates.questionnaires]);
  const dx = session.diagnosisCode;
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const cat of STUDY_GROUP_ORDER) out[cat] = studies.filter((s) => s.category === cat).length;
    return out;
  }, [studies]);
  const filtered = useMemo(() => {
    let list = studies.filter((s) => s.category === tab && studyMatchesQuery(s, q));
    if (tab === "questionnaire" && dx) {
      const scales = liveScales();
      list = [...list].sort((a, b) => {
        const am = icdMatches(scaleFromStudyKey(a.key, scales)?.codes, dx) ? 0 : 1;
        const bm = icdMatches(scaleFromStudyKey(b.key, scales)?.codes, dx) ? 0 : 1;
        return am - bm;
      });
    }
    return list;
  }, [studies, tab, q, dx]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 340;
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

  useEffect(() => setIdx(0), [q, open, tab]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx, open]);

  function choose(i: number) {
    const s = filtered[i];
    if (!s) return;
    const exists = session.studies.some((e) => e.key === s.key);
    if (exists && s.category !== "questionnaire") return;
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
            <div className="flex shrink-0 gap-0.5 border-b border-line bg-paper px-1 pt-1">
              {STUDY_GROUP_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTab(cat)}
                  className={`flex-1 rounded-t-md px-1 py-1.5 text-[10px] font-semibold tracking-wide uppercase ${
                    tab === cat ? "bg-surface text-teal" : "text-mute"
                  }`}
                >
                  {STUDY_GROUP_LABEL[cat]}
                  <span className="ml-0.5 font-normal opacity-70">{counts[cat] || 0}</span>
                </button>
              ))}
            </div>
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
              placeholder={`Найти · ${STUDY_GROUP_LABEL[tab]}  ↑↓ Enter`}
              className="shrink-0 border-b border-line bg-paper px-2.5 py-2 text-sm outline-none"
            />
            <div className="min-h-0 flex-1 overflow-auto p-1.5">
              {filtered.length === 0 && <p className="px-2 py-3 text-xs text-mute">Ничего не нашлось</p>}
              {filtered.map((s, i) => {
                const on = session.studies.some((e) => e.key === s.key);
                const byIcd =
                  tab === "questionnaire" && dx
                    ? icdMatches(scaleFromStudyKey(s.key, liveScales())?.codes, dx)
                    : false;
                return (
                  <button
                    key={s.key}
                    type="button"
                    data-idx={i}
                    disabled={on && s.category !== "questionnaire"}
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
                    {byIcd ? (
                      <span className="ml-1 rounded bg-teal-soft px-1 text-[10px] font-semibold text-teal">по МКБ</span>
                    ) : null}
                    {s.hint ? (
                      <span className="mt-0.5 block text-[10px] font-normal opacity-80">{s.hint}</span>
                    ) : null}
                    {on ? (
                      <span className="font-normal opacity-80">
                        {s.category === "questionnaire" ? " · контроль" : " · добавлен"}
                      </span>
                    ) : (
                      ""
                    )}
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

export function DeviationsSpoiler() {
  const { session, settings } = useAppStore();
  const templates = useTemplates();
  const list = useMemo(
    () => collectDeviations(session.studies, getStudyLive),
    [session.studies, templates.questionnaires],
  );
  const groups = useMemo(() => groupDeviations(list), [list]);
  const [open, setOpen] = useState(false);
  if (settings.studyDeviations === false || !list.length || typeof document === "undefined") return null;
  return createPortal(
    <section
      className="fixed inset-x-0 bottom-16 z-40 border-t border-warn-line bg-warn shadow-[0_-6px_20px_rgba(0,0,0,0.08)] md:bottom-0"
      aria-label="Отклонения"
    >
      <button type="button" className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen((v) => !v)}>
        <h4 className="text-sm font-medium">Отклонения</h4>
        <span className="rounded bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">{list.length}</span>
        {!open && groups[0] ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">
            {groups[0].study}
            {groups[0].date ? ` · ${groups[0].date}` : ""}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="text-[10px] text-mute">{open ? "свернуть" : "показать"}</span>
      </button>
      {open && (
        <div className="mx-auto max-h-[min(50vh,22rem)] w-full max-w-3xl space-y-2 overflow-auto border-t border-warn-line px-3 py-2">
          {groups.map((g) => (
            <div key={`${g.studyKey}-${g.date || ""}`}>
              <div className="text-[11px] font-semibold">
                {g.study}
                {g.date ? <span className="font-normal text-ink-soft"> · {g.date}</span> : null}
              </div>
              <ul className="mt-0.5 space-y-0.5 text-xs leading-snug">
                {g.items.map((d, i) => (
                  <li key={`${d.label}-${i}`}>
                    {d.label}: {d.value}
                    {d.normal ? <span className="text-ink-soft"> · норма {d.normal}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>,
    document.body,
  );
}
