import { useState } from "react";
import { interpretScore, liveScales } from "./data/studies";
import {
  applyItem,
  domainLine,
  itemKind,
  scaleRange,
  studyKeyForScale,
  verdictFor,
  type ScaleDef,
  type ScaleItem,
} from "./data/questionnaires";

export function QuestionnaireForm({
  scale,
  fields,
  previous,
  prevDate,
  onChange,
  onAddScale,
  takenKeys,
}: {
  scale?: ScaleDef | null;
  fields: Record<string, string>;
  previous?: Record<string, string> | null;
  prevDate?: string;
  onChange: (next: Record<string, string>) => void;
  onAddScale?: (scale: ScaleDef) => void;
  takenKeys?: string[];
}) {
  const taken = new Set(takenKeys || []);
  const [open, setOpen] = useState<string | null>(scale?.totalKey || null);
  if (!scale) {
    const list = liveScales();
    return (
      <div>
        <p className="text-xs text-ink-soft">На приём — одна-две анкеты, не весь набор.</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {list.map((s) => {
            const key = studyKeyForScale(s.totalKey);
            const on = taken.has(key);
            return (
              <button
                key={s.totalKey}
                type="button"
                disabled={on || !onAddScale}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  on ? "bg-teal-soft text-teal" : "border border-line bg-surface"
                }`}
                onClick={() => onAddScale?.(s)}
              >
                {s.title}
                {on ? " · есть" : ""}
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
  open,
  onToggle,
  onChange,
}: {
  scale: ScaleDef;
  fields: Record<string, string>;
  previous?: Record<string, string> | null;
  prevDate?: string;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Record<string, string>) => void;
}) {
  const value = fields[scale.totalKey] || "";
  const shown = value ? interpretScore(scale.totalKey, value, scale) : "";
  const n = parseFloat(String(value).replace(",", "."));
  const verdict = Number.isFinite(n) ? verdictFor(scale, n) : undefined;
  const filled = scale.items.filter((it) => itemKind(it) !== "heading" && (fields[it.key] || "") !== "").length;
  const askable = scale.items.filter((it) => itemKind(it) !== "heading").length;
  const was = previous ? (previous[scale.totalKey] || "").trim() : "";
  const domains = domainLine(fields, scale);
  const showSum = scale.sum !== false;

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
          {was ? (
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
      {open && (
        <div className="mt-1.5 space-y-1.5 border-t border-line pt-1.5">
          {scale.items.map((it, i) => (
            <div key={it.key}>
              {itemKind(it) !== "heading" && it.group && it.group !== scale.items[i - 1]?.group ? (
                <div className="mb-1 text-[10px] font-semibold tracking-wide text-mute uppercase">{it.group}</div>
              ) : null}
              <ItemRow item={it} value={fields[it.key] || ""} onPick={(n) => onChange(applyItem(fields, scale, it.key, n))} />
            </div>
          ))}
          {scale.extra && (
            <ItemRow
              item={scale.extra}
              value={fields[scale.extra.key] || ""}
              onPick={(n) => onChange({ ...fields, [scale.extra!.key]: n })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  value,
  onPick,
}: {
  item: ScaleItem;
  value: string;
  onPick: (n: string) => void;
}) {
  const kind = itemKind(item);
  if (kind === "heading") {
    return <div className="pt-1 text-[10px] font-semibold tracking-wide text-mute uppercase">{item.label}</div>;
  }
  if (kind === "text") {
    return (
      <label className="block">
        <span className="text-[11px] text-ink-soft">{item.label}</span>
        <input
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="mt-0.5 w-full rounded-md border border-line bg-surface px-1.5 py-0.5 text-sm outline-none"
        />
      </label>
    );
  }
  const choices =
    kind === "yesno"
      ? [
          { n: "0", text: "нет" },
          { n: "1", text: "да" },
        ]
      : kind === "choice" && item.options?.length
        ? item.options.map((o) => ({ n: String(o.score ?? o.value), text: o.label }))
        : scaleRange(item).map((n) => ({ n: String(n), text: String(n) }));
  return (
    <div>
      <div className="text-[11px] text-ink-soft">{item.label}</div>
      <div className="mt-0.5 flex flex-wrap gap-0.5">
        {choices.map((c) => {
          const on = value === c.n;
          return (
            <button
              key={c.n + c.text}
              type="button"
              onClick={() => onPick(on ? "" : c.n)}
              className={`min-w-7 rounded px-1.5 py-0.5 text-xs tabular-nums ${
                on ? "bg-teal font-semibold text-paper" : "border border-line bg-surface"
              }`}
            >
              {c.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}