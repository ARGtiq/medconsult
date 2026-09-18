import { useState } from "react";
import { interpretScore, liveScales } from "./data/studies";
import { applyItem, domainLine, scaleRange, type ScaleDef, type ScaleItem } from "./data/questionnaires";

export function QuestionnaireForm({
  scale,
  fields,
  previous,
  prevDate,
  onChange,
}: {
  scale?: ScaleDef | null;
  fields: Record<string, string>;
  previous?: Record<string, string> | null;
  prevDate?: string;
  onChange: (next: Record<string, string>) => void;
}) {
  const list = scale ? [scale] : liveScales();
  const [open, setOpen] = useState<string | null>(scale ? scale.totalKey : null);
  const other = fields.other || "";
  const wasOther = previous ? (previous.other || "").trim() : "";
  const bundled = !scale;

  return (
    <div className="space-y-1.5">
      {list.map((s) => (
        <ScaleBlock
          key={s.totalKey}
          scale={s}
          fields={fields}
          previous={previous}
          prevDate={prevDate}
          open={open === s.totalKey}
          onToggle={() => setOpen((v) => (v === s.totalKey ? null : s.totalKey))}
          onChange={onChange}
        />
      ))}
      {bundled ? (
        <label className="block rounded-md bg-paper px-1.5 py-1">
          <span className="block text-[10px] text-mute">Другая</span>
          <input
            value={other}
            onChange={(e) => onChange({ ...fields, other: e.target.value })}
            placeholder="название и балл"
            className="w-full bg-transparent text-sm font-semibold outline-none"
          />
          {wasOther ? (
            <span className="mt-0.5 block text-[10px] text-mute">
              было: {wasOther}
              {prevDate ? ` · ${prevDate}` : ""}
            </span>
          ) : null}
        </label>
      ) : null}
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
  const interp = value ? interpretScore(scale.totalKey, value) : "";
  const filled = scale.items.filter((it) => (fields[it.key] || "") !== "").length;
  const was = previous ? (previous[scale.totalKey] || "").trim() : "";
  const domains = domainLine(fields, scale);

  return (
    <div className="rounded-md border border-line bg-paper px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-sm font-medium">{scale.title}</span>
            {interp && interp !== value ? (
              <span className="text-[11px] font-medium text-teal">{interp}</span>
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
        <input
          value={value}
          onChange={(e) => onChange({ ...fields, [scale.totalKey]: e.target.value })}
          placeholder="балл"
          className="w-14 rounded-md border border-line bg-surface px-1.5 py-0.5 text-sm font-semibold tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            open ? "bg-teal-soft text-teal" : "border border-line text-ink-soft"
          }`}
        >
          {open ? "скрыть" : filled ? `вопросы ${filled}/${scale.items.length}` : "вопросы"}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 space-y-1.5 border-t border-line pt-1.5">
          {scale.items.map((it, i) => (
            <div key={it.key}>
              {it.group && it.group !== scale.items[i - 1]?.group ? (
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
  const choices = item.binary
    ? [
        { n: 0, text: "нет" },
        { n: 1, text: "да" },
      ]
    : scaleRange(item).map((n) => ({ n, text: String(n) }));
  return (
    <div>
      <div className="text-[11px] text-ink-soft">{item.label}</div>
      <div className="mt-0.5 flex flex-wrap gap-0.5">
        {choices.map((c) => {
          const on = value === String(c.n);
          return (
            <button
              key={c.n}
              type="button"
              onClick={() => onPick(on ? "" : String(c.n))}
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
