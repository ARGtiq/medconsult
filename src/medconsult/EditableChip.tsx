import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { InfoDot, drugMarked } from "./DrugInfo";
import {
  complaintOptionsSelected,
  findComplaintVariant,
  liveComplaintTemplates,
  optionsForComplaint,
} from "./live";

function chipClass(on: boolean, dashed?: boolean, marked?: boolean) {
  if (on) {
    return marked
      ? "rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal ring-1 ring-teal/70"
      : "rounded-full bg-teal-soft px-2 py-0.5 text-xs text-teal";
  }
  if (marked) {
    return dashed
      ? "rounded-full border border-dashed border-teal bg-teal-soft/40 px-2 py-0.5 text-xs font-medium text-teal"
      : "rounded-full border border-teal/50 bg-teal-soft/40 px-2 py-0.5 text-xs font-medium text-teal";
  }
  return dashed
    ? "rounded-full border border-dashed border-teal/40 bg-surface px-2 py-0.5 text-xs text-teal"
    : "rounded-full border border-line bg-paper px-2 py-0.5 text-xs";
}

export function EditableChips({
  items,
  onChange,
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (edit !== null) ref.current?.focus();
  }, [edit]);

  function commit() {
    if (edit === null) return;
    const next = draft.trim();
    const copy = [...items];
    if (!next) copy.splice(edit, 1);
    else copy[edit] = next;
    onChange(copy);
    setEdit(null);
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((t, i) =>
        edit === i ? (
          <input
            key={`e-${i}`}
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setEdit(null);
            }}
            className="min-w-[8rem] rounded-full border border-teal bg-paper px-2 py-0.5 text-xs"
          />
        ) : (
          <span key={`${t}-${i}`} className={`inline-flex items-center gap-0.5 ${chipClass(true, false, drugMarked(t))}`}>
            <button
              type="button"
              title="Нажми — править как текст"
              onClick={() => {
                setEdit(i);
                setDraft(t);
              }}
            >
              {t}
            </button>
            <InfoDot query={t} />
          </span>
        ),
      )}
    </div>
  );
}

export function ToggleChips({
  texts,
  selected,
  onToggle,
  onRename,
  dashed,
}: {
  texts: string[];
  selected: string[];
  onToggle: (t: string) => void;
  onRename?: (from: string, to: string) => void;
  dashed?: boolean;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (edit) ref.current?.focus();
  }, [edit]);

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {texts.map((t) => {
        const on = selected.includes(t);
        const marked = drugMarked(t);
        if (on && onRename && edit === t) {
          return (
            <input
              key={t}
              ref={ref}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const next = draft.trim();
                if (!next) onToggle(t);
                else if (next !== t) onRename(t, next);
                setEdit(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") setEdit(null);
              }}
              className="min-w-[8rem] rounded-full border border-teal bg-paper px-2 py-0.5 text-xs"
            />
          );
        }
        return (
          <span key={t} className={`inline-flex items-center gap-0.5 ${chipClass(on, dashed, marked)}`}>
            <button
              type="button"
              title={on && onRename ? "Нажми — править как текст" : undefined}
              onClick={() => {
                if (on && onRename) {
                  setEdit(t);
                  setDraft(t);
                  return;
                }
                onToggle(t);
              }}
            >
              {t}
            </button>
            {marked ? <InfoDot query={t} /> : null}
          </span>
        );
      })}
    </div>
  );
}

export type OptionMenuState = { base: string; rect: { top: number; left: number; bottom: number; width: number } };

export function ComplaintOptionMenu({
  state,
  selected,
  onPick,
  onClose,
}: {
  state: OptionMenuState;
  selected: string[];
  onPick: (option: string) => void;
  onClose: () => void;
}) {
  const options = optionsForComplaint(state.base);
  const items = ["", ...options];
  const picked = complaintOptionsSelected(findComplaintVariant(selected, state.base), state.base, options);
  const startIdx = Math.max(0, items.indexOf(picked[0] || ""));
  const [idx, setIdx] = useState(startIdx);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220, maxH: 220 });

  useLayoutEffect(() => {
    const r = state.rect;
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxH = Math.max(96, Math.min(240, openUp ? spaceAbove : spaceBelow));
    setPos({
      top: openUp ? Math.max(8, r.top - maxH - 4) : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 228)),
      width: Math.max(r.width, 200),
      maxH,
    });
  }, [state]);

  useEffect(() => {
    box.current?.focus();
  }, []);

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onPick(items[idx] ?? "");
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!options.length) return null;

  return createPortal(
    <div
      ref={box}
      tabIndex={0}
      role="listbox"
      aria-label="Уточнение жалобы"
      onKeyDown={onKey}
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
      className="fixed z-[85] overflow-auto rounded-md border border-line bg-surface shadow-lg outline-none"
    >
      <div className="border-b border-line px-2 py-1 text-[10px] tracking-wide text-mute uppercase">
        {state.base} · можно несколько
      </div>
      <ul>
        {items.map((opt, i) => {
          const on = !!opt && picked.some((p) => p.toLowerCase() === opt.toLowerCase());
          return (
          <li key={opt || "empty"} role="presentation">
            <button
              type="button"
              data-idx={i}
              role="option"
              aria-selected={on || i === idx}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(opt)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
                i === idx || on ? "bg-teal-soft text-teal" : "hover:bg-paper"
              } ${!opt ? "text-mute" : ""}`}
            >
              <span className="w-3 text-xs">{on ? "✓" : ""}</span>
              {opt || "без уточнения"}
            </button>
          </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-1">
        <button type="button" className="w-full rounded-md bg-teal px-2 py-1 text-xs font-medium text-paper" onClick={onClose}>
          готово
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function ComplaintChips({
  texts,
  selected,
  onToggle,
  onApplyOption,
  setOptionMenu,
  dashed,
}: {
  texts: string[];
  selected: string[];
  onToggle: (t: string) => void;
  onApplyOption: (base: string, option: string) => void;
  setOptionMenu: (s: OptionMenuState | null) => void;
  dashed?: boolean;
}) {
  const templates = liveComplaintTemplates();

  return (
    <div className="mt-1 flex flex-wrap items-start gap-1">
      {texts.map((t) => {
        const opts = optionsForComplaint(t, templates);
        const variant = findComplaintVariant(selected, t, templates);
        const on = !!variant;
        const picked = complaintOptionsSelected(variant, t, opts);
        return (
          <div key={t} className="flex max-w-full flex-col items-start gap-0.5">
            <span className={`inline-flex items-center gap-0.5 ${chipClass(on, dashed)}`}>
              <button
                type="button"
                onClick={(e) => {
                  if (on) {
                    onToggle(t);
                    setOptionMenu(null);
                    return;
                  }
                  onToggle(t);
                  if (opts.length) {
                    const host = (e.currentTarget.parentElement as HTMLElement) || e.currentTarget;
                    const r = host.getBoundingClientRect();
                    setOptionMenu({
                      base: t,
                      rect: { top: r.top, left: r.left, bottom: r.bottom, width: r.width },
                    });
                  } else {
                    setOptionMenu(null);
                  }
                }}
              >
                {t}
              </button>
              {opts.length ? (
                <button
                  type="button"
                  title="уточнение · стрелки"
                  className="text-[9px] leading-none text-mute"
                  onClick={(e) => {
                    if (!on) onToggle(t);
                    const host = (e.currentTarget.parentElement as HTMLElement) || e.currentTarget;
                    const r = host.getBoundingClientRect();
                    setOptionMenu({
                      base: t,
                      rect: { top: r.top, left: r.left, bottom: r.bottom, width: r.width },
                    });
                  }}
                >
                  ▾
                </button>
              ) : null}
            </span>
            {on && opts.length ? (
              <div className="ml-3 flex flex-wrap gap-0.5">
                {opts.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={chipClass(picked.some((p) => p.toLowerCase() === o.toLowerCase()), true)}
                    onClick={() => onApplyOption(t, o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}