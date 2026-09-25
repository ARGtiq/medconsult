import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { interpretScore, liveScales } from "./data/studies";
import {
  applyItem,
  domainLine,
  itemKind,
  scaleRange,
  scoreCaption,
  studyKeyForScale,
  verdictFor,
  type ScaleDef,
  type ScaleItem,
} from "./data/questionnaires";

const MODE_KEY = "medconsult.qMode";
type QMode = "nums" | "full";

function readMode(): QMode {
  try {
    return localStorage.getItem(MODE_KEY) === "full" ? "full" : "nums";
  } catch {
    return "nums";
  }
}

export function QuestionnaireForm({
  scale,
  fields,
  previous,
  prevDate,
  onChange,
  onAddScale,
  takenKeys,
  showPrevious = false,
  onTogglePrevious,
}: {
  scale?: ScaleDef | null;
  fields: Record<string, string>;
  previous?: Record<string, string> | null;
  prevDate?: string;
  onChange: (next: Record<string, string>) => void;
  onAddScale?: (scale: ScaleDef) => void;
  takenKeys?: string[];
  showPrevious?: boolean;
  onTogglePrevious?: () => void;
}) {
  const taken = new Set(takenKeys || []);
  const [open, setOpen] = useState<string | null>(scale?.totalKey || null);
  const [mode, setMode] = useState<QMode>("nums");
  useEffect(() => {
    setMode(readMode());
  }, []);
  function pickMode(next: QMode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* */
    }
  }
  if (!scale) {
    const list = liveScales();
    return (
      <div>
        <p className="text-xs text-ink-soft">На приём — одна-две анкеты. Уже добавленную можно открыть ещё раз как контроль.</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {list.map((s) => {
            const key = studyKeyForScale(s.totalKey);
            const on = taken.has(key);
            return (
              <button
                key={s.totalKey}
                type="button"
                disabled={!onAddScale}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  on ? "bg-teal-soft text-teal" : "border border-line bg-surface"
                }`}
                onClick={() => onAddScale?.(s)}
              >
                {s.title}
                {on ? " · контроль" : ""}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <ScaleBlock
        scale={scale}
        fields={fields}
        previous={previous}
        prevDate={prevDate}
        showPrevious={showPrevious}
        onTogglePrevious={onTogglePrevious}
        mode={mode}
        onMode={pickMode}
        open={open === scale.totalKey}
        onToggle={() => setOpen((v) => (v === scale.totalKey ? null : scale.totalKey))}
        onChange={onChange}
      />
    </div>
  );
}

function ScaleBlock({
  scale,
  fields,
  previous,
  prevDate,
  showPrevious,
  onTogglePrevious,
  mode,
  onMode,
  open,
  onToggle,
  onChange,
}: {
  scale: ScaleDef;
  fields: Record<string, string>;
  previous?: Record<string, string> | null;
  prevDate?: string;
  showPrevious?: boolean;
  onTogglePrevious?: () => void;
  mode: QMode;
  onMode: (m: QMode) => void;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Record<string, string>) => void;
}) {
  const [modal, setModal] = useState(false);
  const value = fields[scale.totalKey] || "";
  const shown = value ? interpretScore(scale.totalKey, value, scale) : "";
  const n = parseFloat(String(value).replace(",", "."));
  const verdict = Number.isFinite(n) ? verdictFor(scale, n) : undefined;
  const filled = scale.items.filter((it) => itemKind(it) !== "heading" && (fields[it.key] || "") !== "").length;
  const askable = scale.items.filter((it) => itemKind(it) !== "heading").length;
  const was = previous ? (previous[scale.totalKey] || "").trim() : "";
  const domains = domainLine(fields, scale);
  const showSum = scale.sum !== false;
  const hasPrev = !!previous && Object.values(previous).some((v) => String(v || "").trim());

  useEffect(() => {
    if (!modal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModal(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const list = (
    <QuestionList
      scale={scale}
      fields={fields}
      previous={previous}
      showPrevious={showPrevious}
      verbose={mode === "full"}
      onChange={onChange}
    />
  );

  return (
    <div className="rounded-md border border-line bg-paper px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-sm font-medium">{scale.title}</span>
            {verdict ? (
              <span className={`text-[11px] font-medium ${verdict.flag ? "text-danger" : "text-teal"}`}>
                {shown}
              </span>
            ) : shown && shown !== value ? (
              <span className="text-[11px] font-medium text-teal">{shown}</span>
            ) : (
              <span className="text-[10px] text-mute">{scale.hint}</span>
            )}
          </div>
          {domains ? <div className="text-[10px] text-ink-soft">{domains}</div> : null}
          {showPrevious && was ? (
            <div className="text-[10px] text-mute">
              было: {was}
              {prevDate ? ` · ${prevDate}` : ""}
            </div>
          ) : null}
        </div>
        {showSum ? (
          <input
            value={value}
            onChange={(e) => onChange({ ...fields, [scale.totalKey]: e.target.value })}
            placeholder="балл"
            className="w-14 rounded-md border border-line bg-surface px-1.5 py-0.5 text-sm font-semibold tabular-nums outline-none"
          />
        ) : null}
        {hasPrev && onTogglePrevious ? (
          <button
            type="button"
            onClick={onTogglePrevious}
            title="Прошлые ответы рядом с вопросами. Выключи, пока анкету заполняет пациент"
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
              showPrevious ? "bg-warn text-ink" : "border border-line text-mute"
            }`}
          >
            {showPrevious ? "прошлые видны" : "прошлые скрыты"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            open ? "bg-teal-soft text-teal" : "border border-line text-ink-soft"
          }`}
        >
          {open ? "скрыть" : filled ? `вопросы ${filled}/${askable}` : "вопросы"}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <div className="inline-flex rounded-md border border-line p-0.5">
          <button
            type="button"
            onClick={() => onMode("nums")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              mode === "nums" ? "bg-teal text-paper" : "text-ink-soft"
            }`}
          >
            цифры
          </button>
          <button
            type="button"
            onClick={() => onMode("full")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              mode === "full" ? "bg-teal text-paper" : "text-ink-soft"
            }`}
          >
            расшифровка
          </button>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          title="Крупная анкета с расшифровкой — удобно отдать пациенту"
          className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-ink-soft"
        >
          окно
        </button>
      </div>
      {open && <div className="mt-1.5 border-t border-line pt-1.5">{list}</div>}
      {modal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
              onClick={() => setModal(false)}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="q-modal-title"
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <h3 id="q-modal-title" className="text-base font-semibold">
                      {scale.title}
                    </h3>
                    <div className={`text-xs ${verdict?.flag ? "text-danger" : "text-ink-soft"}`}>
                      {shown || scale.hint}
                      {domains ? ` · ${domains}` : ""}
                    </div>
                  </div>
                  {hasPrev && onTogglePrevious ? (
                    <button
                      type="button"
                      onClick={onTogglePrevious}
                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${
                        showPrevious ? "bg-warn text-ink" : "border border-line text-mute"
                      }`}
                    >
                      {showPrevious ? "прошлые видны" : "прошлые скрыты"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setModal(false)}
                    className="flex size-8 items-center justify-center rounded-md text-mute hover:bg-paper"
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>
                <div className="overflow-auto px-3 py-3">
                  <QuestionList
                    scale={scale}
                    fields={fields}
                    previous={previous}
                    showPrevious={showPrevious}
                    verbose
                    roomy
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function QuestionList({
  scale,
  fields,
  previous,
  showPrevious,
  verbose,
  roomy,
  onChange,
}: {
  scale: ScaleDef;
  fields: Record<string, string>;
  previous?: Record<string, string> | null;
  showPrevious?: boolean;
  verbose?: boolean;
  roomy?: boolean;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className={roomy ? "space-y-3" : "space-y-1.5"}>
      {scale.items.map((it, i) => (
        <div key={it.key}>
          {itemKind(it) !== "heading" && it.group && it.group !== scale.items[i - 1]?.group ? (
            <div className="mb-1 text-xs font-semibold text-ink">{it.group}</div>
          ) : null}
          <ItemRow
            item={it}
            value={fields[it.key] || ""}
            prev={showPrevious ? previous?.[it.key] || "" : ""}
            verbose={verbose}
            roomy={roomy}
            onPick={(n) => onChange(applyItem(fields, scale, it.key, n))}
          />
        </div>
      ))}
      {scale.extra && (
        <ItemRow
          item={scale.extra}
          value={fields[scale.extra.key] || ""}
          prev={showPrevious ? previous?.[scale.extra.key] || "" : ""}
          verbose={verbose}
          roomy={roomy}
          onPick={(n) => onChange({ ...fields, [scale.extra!.key]: n })}
        />
      )}
    </div>
  );
}

function prevCaption(item: ScaleItem, raw: string, verbose?: boolean): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const kind = itemKind(item);
  const n = parseFloat(v.replace(",", "."));
  const legend = Number.isFinite(n) ? scoreCaption(item, n) : "";
  if (kind === "yesno") {
    const word = v === "1" ? "да" : v === "0" ? "нет" : v;
    return verbose ? `${v} ${word}` : word;
  }
  if (kind === "choice" && item.options?.length) {
    const hit = item.options.find((o) => String(o.score ?? o.value) === v || o.label === v);
    const label = hit?.label || v;
    return verbose && label !== v ? `${v} ${label}` : label;
  }
  if (verbose && legend) return `${v} ${legend}`;
  return v;
}

type Choice = { n: string; caption: string };

function choicesOf(item: ScaleItem): Choice[] {
  const kind = itemKind(item);
  if (kind === "yesno") {
    return [
      { n: "0", caption: "нет" },
      { n: "1", caption: "да" },
    ];
  }
  if (kind === "choice" && item.options?.length) {
    return item.options.map((o) => ({ n: String(o.score ?? o.value), caption: o.label }));
  }
  return scaleRange(item).map((n) => ({ n: String(n), caption: scoreCaption(item, n) }));
}

function ItemRow({
  item,
  value,
  prev,
  verbose,
  roomy,
  onPick,
}: {
  item: ScaleItem;
  value: string;
  prev?: string;
  verbose?: boolean;
  roomy?: boolean;
  onPick: (n: string) => void;
}) {
  const kind = itemKind(item);
  const was = prevCaption(item, prev || "", verbose);
  if (kind === "heading") {
    return <div className="mt-2 border-b border-teal/40 pb-0.5 text-[13px] font-semibold text-ink">{item.label}</div>;
  }
  if (kind === "text") {
    return (
      <label className="block">
        <span className="text-[11px] text-ink-soft">
          {item.label}
          {was ? <span className="ml-1 text-mute">· было {was}</span> : null}
        </span>
        <input
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="mt-0.5 w-full rounded-md border border-line bg-surface px-1.5 py-0.5 text-sm outline-none"
        />
      </label>
    );
  }
  const choices = choicesOf(item);
  const decoded = !!verbose && (kind === "yesno" || kind === "choice" || choices.some((c) => c.caption));
  return (
    <div>
      <div className={roomy ? "text-sm text-ink" : "text-[11px] text-ink-soft"}>
        {item.label}
        {was ? <span className="ml-1 text-mute">· было {was}</span> : null}
      </div>
      <div className={decoded ? `mt-1 grid gap-1 ${roomy ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}` : "mt-0.5 flex flex-wrap gap-0.5"}>
        {choices.map((c) => {
          const on = value === c.n;
          const showWord = decoded ? c.caption : kind === "yesno" || kind === "choice" ? c.caption : "";
          return (
            <button
              key={c.n + c.caption}
              type="button"
              onClick={() => onPick(on ? "" : c.n)}
              className={`rounded text-left tabular-nums ${
                decoded ? "px-2 py-1.5" : "min-w-7 px-1.5 py-0.5 text-xs"
              } ${on ? "bg-teal font-semibold text-paper" : "border border-line bg-surface"}`}
            >
              {decoded ? (
                <>
                  <span className={roomy ? "text-base" : "text-xs"}>{c.n}</span>
                  {showWord ? (
                    <span className={`mt-0.5 block font-normal leading-snug ${roomy ? "text-xs" : "text-[10px]"} ${on ? "text-paper/90" : "text-ink-soft"}`}>
                      {showWord}
                    </span>
                  ) : null}
                </>
              ) : (
                showWord || c.n
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
