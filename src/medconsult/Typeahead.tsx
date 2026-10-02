import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InfoDot, drugMarked } from "./DrugInfo";

export type TypeaheadItem = {
  id: string;
  label: string;
  hint?: string;
  /** Вторая строка мельче: кратность и схема. */
  detail?: string;
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
  inputClassName,
  clearOnPick = true,
  autoFocus,
  inline,
  focusNonce = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  items: TypeaheadItem[];
  onPick: (item: TypeaheadItem) => void;
  onSubmitCustom?: (raw: string) => void;
  placeholder?: string;
  idleLabel?: ReactNode;
  disabled?: boolean;
  emptyHint?: ReactNode;
  inputClassName?: string;
  /** Жалобы и лекарства очищают строку после выбора. Код МКБ остаётся в поле. */
  clearOnPick?: boolean;
  autoFocus?: boolean;
  /** Список под полем, а не поверх страницы. Для окна Ctrl+K. */
  inline?: boolean;
  /** Увеличьте число, чтобы вернуть курсор в поле. */
  focusNonce?: number;
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

  useEffect(() => {
    if (!focusNonce) return;
    inputRef.current?.focus();
  }, [focusNonce]);

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
    if (clearOnPick) onChange("");
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
        if (clearOnPick) onChange("");
        setOpen(false);
      } else if (items[idx]) {
        setOpen(true);
        pick(items[idx]);
      }
      return;
    }
    if (e.key === "Tab" && open && items[idx]) {
      e.preventDefault();
      pick(items[idx]);
      return;
    }
    if (e.key === "Escape") setOpen(false);
  }

  const showList = open && (items.length > 0 || (!!value.trim() && !!emptyHint));
  const showIdle = !value && !!idleLabel && !focused;

  const list = (
    <div
      ref={listRef}
      style={inline ? { maxHeight: 320 } : { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
      className={
        inline
          ? "mt-1 overflow-auto rounded-md border border-line bg-surface shadow-lg"
          : "fixed z-[80] overflow-auto rounded-md border border-line bg-surface shadow-lg"
      }
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
                  className={`flex w-full items-start gap-1.5 px-2 py-1.5 text-sm ${
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
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="w-full truncate">{it.label}</span>
                    {it.detail && (
                      <span className="w-full truncate text-[11px] leading-tight font-normal !text-mute">{it.detail}</span>
                    )}
                  </button>
                    {it.hint && (
                      <span className="mt-0.5 shrink-0 rounded bg-teal-soft px-1.5 text-[10px] font-semibold text-teal">
                        {it.hint}
                      </span>
                    )}
                  {marked ? <InfoDot query={it.name || it.label} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

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
        className={inputClassName || `w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm ${showIdle ? "text-transparent caret-ink" : ""}`}
        autoComplete="off"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-activedescendant={showList ? `ta-opt-${idx}` : undefined}
      />
      {showIdle && (
        <span className="pointer-events-none absolute inset-0 flex items-center truncate px-2 text-sm font-medium text-ink">
          {idleLabel}
        </span>
      )}
      {showList && (inline || typeof document === "undefined" ? list : createPortal(list, document.body))}
    </div>
  );
}
