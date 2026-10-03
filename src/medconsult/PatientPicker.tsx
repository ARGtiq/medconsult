import { ListPlus, Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Typeahead, type TypeaheadItem } from "./Typeahead";
import { formatPatient, useAppStore } from "./store";
import type { Patient } from "./types";

function dobBits(dob?: string) {
  if (!dob) return { pretty: "", forms: [] as string[] };
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { pretty: dob, forms: [dob] };
  const [, y, mo, d] = m;
  const pretty = `${d}.${mo}.${y}`;
  return { pretty, forms: [dob, y, pretty, `${d}.${mo}.${y.slice(2)}`] };
}

function haystack(p: Patient) {
  const bits = dobBits(p.dob);
  return [p.lastName, p.firstName, p.name, p.age, p.note, ...bits.forms].filter(Boolean).join(" ").toLowerCase();
}

export function PatientPicker() {
  const { patients, session, setSession, addPatient, addRecorded } = useAppStore();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(false);
  const [queue, setQueue] = useState(false);
  const [queueText, setQueueText] = useState("");
  const [fullName, setFullName] = useState("");
  const [splitName, setSplitName] = useState(false);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [year, setYear] = useState("");
  const plusRef = useRef<HTMLButtonElement>(null);
  const queueRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formPos, setFormPos] = useState({ top: 48, left: 12 });
  const selected = patients.find((p) => p.id === session.patientId);

  const items: TypeaheadItem[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const ordered = [...patients].sort((a, b) => {
      const ar = a.recorded ? 0 : 1;
      const br = b.recorded ? 0 : 1;
      if (ar !== br) return ar - br;
      if (a.recorded && b.recorded) return (b.recordedAt || 0) - (a.recordedAt || 0);
      return (a.lastName || "").localeCompare(b.lastName || "", "ru");
    });
    const list = s ? ordered.filter((p) => haystack(p).includes(s)) : ordered;
    const recorded = list.filter((p) => p.recorded).slice(0, 40);
    const rest = list.filter((p) => !p.recorded).slice(0, 12);
    const row = (p: Patient): TypeaheadItem => ({
      id: p.id,
      label: `${formatPatient(p)}${p.age ? `, ${p.age}` : ""}${dobBits(p.dob).pretty ? ` (${dobBits(p.dob).pretty})` : ""}`,
      tone: p.recorded ? (p.id === session.patientId ? "ok" : "wait") : undefined,
    });
    const none: TypeaheadItem = { id: "__none__", label: "без пациента" };
    const head = recorded.map(row);
    const tail = rest.map(row);
    if (!s || "без пациента".includes(s) || "без".startsWith(s) || s.startsWith("без")) return [...head, none, ...tail];
    return [...head, ...tail];
  }, [patients, q, session.patientId]);

  useLayoutEffect(() => {
    const anchor = queue ? queueRef.current : plusRef.current;
    if ((!form && !queue) || !anchor) return;
    function place() {
      const node = queue ? queueRef.current : plusRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const width = queue ? 340 : 280;
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
  }, [form, queue]);

  function create(e: FormEvent) {
    e.preventDefault();
    const parsed = splitName
      ? { lastName, firstName, patronymic }
      : (() => {
          const parts = fullName.trim().split(/\s+/).filter(Boolean);
          return { lastName: parts[0] || "", firstName: parts[1] || "", patronymic: parts.slice(2).join(" ") };
        })();
    if (!parsed.lastName.trim()) return;
    addPatient(parsed);
    setFullName("");
    setLastName("");
    setFirstName("");
    setPatronymic("");
    setYear("");
    setForm(false);
    setQ("");
  }

  function pinQueue(e: FormEvent) {
    e.preventDefault();
    const n = addRecorded(queueText);
    if (!n) return;
    setQueueText("");
    setQueue(false);
    setQ("");
  }

  return (
    <div className="flex min-w-0 max-w-[380px] flex-1 items-center gap-1">
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
            selected ? (
              <>
                {formatPatient(selected)}
                {selected.age ? `, ${selected.age}` : ""}
                {dobBits(selected.dob).pretty ? (
                  <span className="text-[11px] font-normal text-mute"> ({dobBits(selected.dob).pretty})</span>
                ) : null}
              </>
            ) : (
              "без пациента"
            )
          }
          placeholder="Фамилия или дата рождения"
          emptyHint={q.trim() ? "Никого не нашлось. «+» — завести карточку. Или выбери «без пациента»" : "без пациента — черновик без карточки"}
        />
      </div>
      <button
        ref={queueRef}
        type="button"
        title="Записанные пациенты"
        onClick={() => {
          setQueue((v) => !v);
          setForm(false);
        }}
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-teal ${
          queue ? "border-teal bg-teal-soft" : "border-line bg-paper"
        }`}
      >
        <ListPlus className="size-4" />
      </button>
      <button
        ref={plusRef}
        type="button"
        title="Новый пациент"
        onClick={() => {
          setForm((v) => !v);
          setQueue(false);
        }}
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
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold tracking-wide text-mute uppercase">
              <span>Новый пациент</span>
              <button type="button" className="normal-case text-teal" onClick={() => setSplitName((v) => !v)}>
                {splitName ? "одной строкой" : "по отдельности"}
              </button>
            </div>
            {splitName ? (
              <>
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
              </>
            ) : (
              <input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Фамилия Имя Отчество"
                className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
              />
            )}
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
      {queue &&
        typeof document !== "undefined" &&
        createPortal(
          <form
            onSubmit={pinQueue}
            style={{ top: formPos.top, left: formPos.left, width: 340 }}
            className="fixed z-[80] rounded-xl border border-line bg-surface p-2.5 shadow-lg"
          >
            <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-mute uppercase">Записанные</div>
            <textarea
              autoFocus
              value={queueText}
              onChange={(e) => setQueueText(e.target.value)}
              rows={5}
              placeholder={"Иванов Иван Иванович, 22.03.1990, Петрова Анна Сергеевна, 01.05.1988"}
              className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <p className="mb-2 text-[11px] leading-snug text-mute">
              ФИО и полная дата рождения через запятую. Закрепятся сверху списка: принятый зелёный, остальные красные.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs text-mute" onClick={() => setQueue(false)}>
                отмена
              </button>
              <button type="submit" className="rounded-md bg-teal px-2 py-1 text-xs font-semibold text-paper">
                закрепить
              </button>
            </div>
          </form>,
          document.body,
        )}
    </div>
  );
}
