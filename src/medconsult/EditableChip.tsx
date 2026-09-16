import { useEffect, useRef, useState } from "react";

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
          <button
            key={`${t}-${i}`}
            type="button"
            title="Нажми — править как текст"
            onClick={() => {
              setEdit(i);
              setDraft(t);
            }}
            className="rounded-full bg-teal-soft px-2 py-0.5 text-xs text-teal"
          >
            {t}
          </button>
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
          <button
            key={t}
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
            className={`rounded-full px-2 py-0.5 text-xs ${
              on
                ? "bg-teal-soft text-teal"
                : dashed
                  ? "border border-dashed border-teal/40 bg-surface text-teal"
                  : "border border-line bg-paper"
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
