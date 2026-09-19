import { Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Typeahead, type TypeaheadItem } from "./Typeahead";
import { formatPatient, useAppStore } from "./store";
import type { Patient } from "./types";

function haystack(p: Patient) {
  const year = (p.dob || "").slice(0, 4);
  return [p.lastName, p.firstName, p.name, p.dob, p.age, year].filter(Boolean).join(" ").toLowerCase();
}

export function PatientPicker() {
  const { patients, session, setSession, addPatient } = useAppStore();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(false);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [year, setYear] = useState("");
  const plusRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formPos, setFormPos] = useState({ top: 48, left: 12 });
  const selected = patients.find((p) => p.id === session.patientId);

  const items: TypeaheadItem[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? patients.filter((p) => haystack(p).includes(s)) : patients;
    const mapped = list.slice(0, 12).map((p) => ({
      id: p.id,
      label: `${formatPatient(p)}${p.age ? `, ${p.age}` : ""}${p.dob ? ` · ${(p.dob || "").slice(0, 4)}` : ""}`,
    }));
    const none = { id: "__none__", label: "без пациента" };
    if (!s || "без пациента".includes(s) || "без".startsWith(s) || s.startsWith("без")) return [none, ...mapped];
    return mapped;
  }, [patients, q]);

  useLayoutEffect(() => {
    if (!form || !plusRef.current) return;
    function place() {
      if (!plusRef.current) return;
      const r = plusRef.current.getBoundingClientRect();
      const width = 280;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      const top = r.bottom + 6;
      setFormPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [form]);

  function create(e: FormEvent) {
    e.preventDefault();
    if (!lastName.trim()) return;
    addPatient({ lastName, firstName, patronymic, year });
    setLastName("");
    setFirstName("");
    setPatronymic("");
    setYear("");
    setForm(false);
    setQ("");
  }

  return (
    <div className="flex min-w-0 max-w-[340px] flex-1 items-center gap-1">
      <div className="min-w-0 flex-1">
        <Typeahead
          value={q}
          onChange={setQ}
          items={items}
          onPick={(it) => {
            setSession({ patientId: it.id === "__none__" ? "" : it.id });
            setQ("");
          }}
          idleLabel={
            selected
              ? `${formatPatient(selected)}${selected.age ? `, ${selected.age}` : ""}${selected.dob ? ` · ${(selected.dob || "").slice(0, 4)}` : ""}`
              : "без пациента"
          }
          placeholder="Пациент: фамилия, имя — или без карточки"
          emptyHint={q.trim() ? "Никого не нашлось. «+» — завести карточку. Или выбери «без пациента»" : "без пациента — черновик без карточки"}
        />
      </div>
      <button
        ref={plusRef}
        type="button"
        title="Новый пациент"
        onClick={() => setForm((v) => !v)}
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-teal ${
          form ? "border-teal bg-teal-soft" : "border-line bg-paper"
        }`}
      >
        <Plus className="size-4" />
      </button>
      {form &&
        typeof document !== "undefined" &&
        createPortal(
          <form
            ref={formRef}
            onSubmit={create}
            style={{ top: formPos.top, left: formPos.left, width: 280 }}
            className="fixed z-[80] rounded-xl border border-line bg-surface p-2.5 shadow-lg"
          >
            <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-mute uppercase">Новый пациент</div>
            <input
              autoFocus
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Фамилия"
              className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Имя"
              className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <input
              value={patronymic}
              onChange={(e) => setPatronymic(e.target.value)}
              placeholder="Отчество"
              className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Год рождения"
              inputMode="numeric"
              className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs text-mute" onClick={() => setForm(false)}>
                отмена
              </button>
              <button type="submit" className="rounded-md bg-teal px-2 py-1 text-xs font-semibold text-paper">
                добавить
              </button>
            </div>
          </form>,
          document.body,
        )}
    </div>
  );
}
