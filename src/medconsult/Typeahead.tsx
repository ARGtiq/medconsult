import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InfoDot, drugMarked } from "./DrugInfo";

export type TypeaheadItem = {
  id: string;
  label: string;
  hint?: string;
  name?: string;
};

export function Typeahead({
  value,
  onChange,
  items,
  onPick,
  onSubmitCustom,
  placeholder,
  idleLabel,
  disabled,
  emptyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  items: TypeaheadItem[];
  onPick: (item: TypeaheadItem) => void;
  onSubmitCustom?: (raw: string) => void;
  placeholder?: string;
  idleLabel?: string;
  disabled?: boolean;
  emptyHint?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240, maxH: 240 });

  useEffect(() => {
    setIdx(0);
  }, [items, value]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
      const maxH = Math.max(96, Math.min(280, openUp ? spaceAbove : spaceBelow));
      setPos({
        top: openUp ? Math.max(8, r.top - maxH - 4) : r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8)),
        width: Math.max(r.width, 220),
        maxH,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, items.length, value]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx, open]);

  function pick(item: TypeaheadItem) {
    onPick(item);
    onChange("");
    setOpen(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setIdx((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && items[idx]) pick(items[idx]);
      else if (value.trim() && onSubmitCustom) {
        onSubmitCustom(value.trim());
        onChange("");
        setOpen(false);
      } else if (items[idx]) {
        setOpen(true);
        pick(items[idx]);
      }
      return;
    }
    if (e.key === "Escape") setOpen(false);
  }

  const showList = open && (items.length > 0 || (!!value.trim() && !!emptyHint));
  const showIdle = !value && !!idleLabel && !focused;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setOpen(false), 180);
        }}
        onKeyDown={onKey}
        placeholder={showIdle ? "" : placeholder}
        className={`w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm ${showIdle ? "text-transparent caret-ink" : ""}`}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-activedescendant={showList ? `ta-opt-${idx}` : undefined}
      />
      {showIdle && (
        <span className="pointer-events-none absolute inset-0 flex items-center truncate px-2 text-sm font-medium text-ink">
          {idleLabel}
        </span>
      )}
      {showList &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
            className="fixed z-[80] overflow-auto rounded-md border border-line bg-surface shadow-lg"
          >
            {items.length === 0 && emptyHint ? (
              <div className="px-2 py-1.5 text-xs text-mute">{emptyHint}</div>
            ) : (
              <ul role="listbox">
                {items.map((it, i) => {
                  const marked = drugMarked(it.name || it.label);
                  return (
                    <li key={it.id} role="presentation">
                      <div
                        data-idx={i}
                        className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-sm ${
                          i === idx ? "bg-teal-soft text-teal" : "hover:bg-paper"
                        } ${marked ? "border-l-2 border-l-teal" : ""}`}
                      >
                        <button
                          type="button"
                          id={`ta-opt-${i}`}
                          role="option"
                          aria-selected={i === idx}
                          onMouseEnter={() => setIdx(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pick(it)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate">{it.label}</span>
                          {it.hint && (
                            <span className="shrink-0 rounded bg-teal-soft px-1.5 text-[10px] font-semibold text-teal">
                              {it.hint}
                            </span>
                          )}
                        </button>
                        {marked ? <InfoDot query={it.name || it.label} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
