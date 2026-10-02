import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { store as legacy } from "@/legacy/lib/store";
import { DRUG_GROUPS } from "@/legacy/data/drugSafety";
import {
  composeAnamnesis,
  composeVitae,
  emptyAnamnesis,
  emptyVitae,
  normalizeAnamnesis,
  normalizeVitae,
  DEV_PRESETS,
  OCC_PRESETS,
  INFECTION_PRESETS,
  HERITAGE_PRESETS,
  TRANSFUSION_PRESETS,
  RELATED_PRESETS,
  type AnamnesisDraft,
  type VitaeDraft,
  type VitaeItem,
} from "./anamnesisChips";
import { useTemplates, addSurgeryPreset, type VitaePreset } from "./data/templates";
import { diseaseHasBody, findDisease, rememberDisease, type Disease } from "./diseases";
import { DRUGS } from "./data/catalog";
import { InfoDot, drugMarked } from "./DrugInfo";
import { searchAllergy, searchDrugs } from "./live";
import { useAppStore } from "./store";
import { Typeahead } from "./Typeahead";
import { FieldControl } from "./StudyCard";
import { EditableChips } from "./EditableChip";
import {
  fillVitaeTemplate,
  templateDefaults,
  vitaeDefaultKey,
  vitaeDraftTouched,
  vitaeTemplates,
  visibleVitaeFields,
  type VitaeTemplate,
} from "./vitaeTemplates";

function ChipRow({
  label,
  options,
  value,
  onChange,
  fallback = "",
}: {
  label: string;
  options: { id: string; text: string }[];
  value: string;
  onChange: (id: string) => void;
  fallback?: string;
}) {
  const shown = value || fallback;
  return (
    <div className="mt-1">
      {label ? <div className="text-xs font-semibold text-ink">{label}</div> : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(shown === o.id ? "" : o.id)}
            className={`rounded-full px-2 py-0.5 text-xs ${
              shown === o.id ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function DoneBar({ sentence, onDone, preview = true }: { sentence: string; onDone: () => void; preview?: boolean }) {
  return (
    <div className="mt-2">
      {preview ? (
        sentence ? (
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{sentence}</p>
        ) : (
          <p className="text-xs text-mute">Собери фразу чипами — потом станет обычным текстом.</p>
        )
      ) : null}
      <button
        type="button"
        className={`mt-1.5 text-[11px] font-medium ${sentence ? "rounded-md bg-teal px-2 py-1 text-paper" : "text-teal"}`}
        onClick={onDone}
      >
        {sentence ? "готово — как текст" : "править как текст"}
      </button>
    </div>
  );
}

function drugNameOnly(raw: string) {
  const t = raw.trim();
  const cut = t.split(/\s+\d+(?:[.,]\d+)?\s*(?:мг|г|мл|мкг|ме|ед|таб)\b/i)[0] || t;
  return cut.trim() || t;
}

function groupKnown(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  for (const g of Object.values(DRUG_GROUPS) as { label?: string }[]) {
    if ((g.label || "").trim().toLowerCase() === n) return true;
  }
  try {
    return Object.values(legacy.getCustomGroups() || {}).some(
      (g) => String((g as { label?: string }).label || "").trim().toLowerCase() === n,
    );
  } catch {
    return false;
  }
}

function ensureGroup(name: string) {
  const label = name.trim();
  if (!label || groupKnown(label)) return;
  try {
    legacy.saveCustomGroup("", { label, drugs: [] });
  } catch {
    /* */
  }
}

function drugKnown(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (DRUGS.some((d) => d.name.toLowerCase() === n)) return true;
  try {
    return !!legacy.getDrugInfo(name);
  } catch {
    return false;
  }
}

function SaveKind({ name, onPick }: { name: string; onPick: (kind: "drug" | "group" | "text") => void }) {
  return (
    <div className="mt-1 rounded-md border border-line bg-paper px-2 py-1">
      <div className="text-[11px] text-ink-soft">«{name}» нет в базе. Что это?</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <button type="button" className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-teal" onClick={() => onPick("drug")}>
          препарат
        </button>
        <button type="button" className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-teal" onClick={() => onPick("group")}>
          группа
        </button>
        <button type="button" className="rounded-full border border-line px-2 py-0.5 text-[11px]" onClick={() => onPick("text")}>
          только сюда
        </button>
      </div>
    </div>
  );
}

function rememberDrug(raw: string) {
  const name = drugNameOnly(raw);
  if (!name) return;
  try {
    if (!legacy.getDrugInfo(name)) legacy.saveDrugInfo({ name });
  } catch {
    /* */
  }
}

function AboutDot({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const hoverOn = useAppStore((s) => s.settings.infoOnHover);
  const [hover, setHover] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex size-4 items-center justify-center rounded-full bg-teal text-[10px] font-bold text-paper"
        title="описание"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        i
      </button>
      {hoverOn && hover && (
        <span className="max-w-xs rounded-md border border-line bg-surface px-2 py-1 text-[11px] shadow">{text}</span>
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={() => setOpen(false)}>
            <div className="w-full max-w-md rounded-xl border border-line bg-surface p-3" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">{title}</div>
                <button type="button" className="text-sm text-mute" onClick={() => setOpen(false)}>
                  закрыть
                </button>
              </div>
              <div className="text-sm leading-relaxed">{text}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function DiseaseDot({ name }: { name: string }) {
  const info = findDisease(name);
  const hoverOn = useAppStore((s) => s.settings.infoOnHover);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  if (!diseaseHasBody(info) || !info) return null;
  return (
    <>
      <button
        type="button"
        className="inline-flex size-4 items-center justify-center rounded-full bg-teal text-[10px] font-bold text-paper"
        title="карточка болезни"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        i
      </button>
      {hoverOn && hover && (
        <span className="max-w-xs rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink shadow">
          {[info.classification, info.diagnosis, info.treatment, info.prevention, info.extra].filter(Boolean).join(" · ")}
        </span>
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={() => setOpen(false)}>
            <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl border border-line bg-surface p-3" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">{info.name}</div>
                <button type="button" className="text-sm text-mute" onClick={() => setOpen(false)}>
                  закрыть
                </button>
              </div>
              <DiseaseRows info={info} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function DiseaseRows({ info }: { info: Disease }) {
  const rows = [
    ["классификация", info.classification],
    ["диагностика", info.diagnosis],
    ["лечение", info.treatment],
    ["профилактика", info.prevention],
    ["дополнительно", info.extra],
  ];
  return (
    <div className="space-y-1.5">
      {rows.map(([label, value]) =>
        value?.trim() ? (
          <div key={label} className="rounded-md bg-paper px-2 py-1.5">
            <div className="text-[10px] tracking-wide text-mute uppercase">{label}</div>
            <div className="text-sm">{value}</div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function PresetPicker({
  presets,
  selected,
  onChange,
  yearAlways,
  onRemember,
  disease,
}: {
  presets: VitaePreset[];
  selected: VitaeItem[];
  onChange: (next: VitaeItem[]) => void;
  yearAlways?: boolean;
  onRemember?: (label: string) => void;
  disease?: boolean;
}) {
  const [custom, setCustom] = useState("");
  const sorted = useMemo(
    () => [...presets].sort((a, b) => a.label.localeCompare(b.label, "ru", { sensitivity: "base" })),
    [presets],
  );
  function toggle(p: VitaePreset) {
    const has = selected.some((s) => s.id === p.id);
    if (has) onChange(selected.filter((s) => s.id !== p.id));
    else onChange([...selected, { id: p.id, label: p.label, date: "" }]);
  }
  function setDate(id: string, date: string) {
    onChange(selected.map((s) => (s.id === id ? { ...s, date } : s)));
  }
  const customSelected = selected.filter((s) => !presets.some((p) => p.id === s.id));
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1">
        {customSelected.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
            className="rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal"
            title="Свой пункт. Нажми, чтобы убрать"
          >
            {s.label}
          </button>
        ))}
        {sorted.map((p) => {
          const on = selected.some((s) => s.id === p.id);
          return (
            <span key={p.id} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => toggle(p)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
                }`}
              >
                {p.label}
              </button>
              {disease ? <DiseaseDot name={p.label} /> : null}
              {p.about?.trim() ? <AboutDot title={p.label} text={p.about} /> : null}
            </span>
          );
        })}
      </div>
      {selected.map((s) => {
        const preset = presets.find((p) => p.id === s.id);
        const showDate = yearAlways || preset?.needsDate || Boolean(s.date);
        if (!showDate && !yearAlways) return null;
        return (
          <div key={s.id} className="mt-1">
            {showDate && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-ink-soft">{s.label}</span>
                <input
                  value={s.date || ""}
                  onChange={(e) => setDate(s.id, e.target.value)}
                  placeholder={yearAlways ? "год" : preset?.emptyDateText ? `пусто = ${preset.emptyDateText}` : "год или дата, можно пусто"}
                  className="w-44 rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs"
                />
              </label>
            )}
            {yearAlways && (
              <div className={`mt-0.5 ${s.noteOn ? "" : "opacity-50"}`}>
                <button
                  type="button"
                  className="text-[11px] text-teal"
                  onClick={() => onChange(selected.map((x) => (x.id === s.id ? { ...x, noteOn: !x.noteOn } : x)))}
                >
                  + примечание
                </button>
                {s.noteOn && (
                  <input
                    value={s.note || ""}
                    onChange={(e) => onChange(selected.map((x) => (x.id === s.id ? { ...x, note: e.target.value } : x)))}
                    placeholder="примечание к операции"
                    className="mt-0.5 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-1 flex gap-1">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              e.preventDefault();
              onChange([...selected, { id: `c_${Date.now()}`, label: custom.trim() }]);
              onRemember?.(custom.trim());
              setCustom("");
            }
          }}
          placeholder="своё + Enter"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

function VitaeSection({
  id,
  title,
  omitted,
  onOmit,
  children,
}: {
  id: string;
  title: string;
  omitted: boolean;
  onOmit: (id: string, hide: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={omitted ? "opacity-60" : ""}>
      <button
        type="button"
        onClick={() => onOmit(id, !omitted)}
        title={omitted ? "Вернуть в протокол" : "Скрыть в протоколе"}
        className={`mt-1.5 text-left text-xs font-semibold ${omitted ? "text-mute line-through" : "text-ink"}`}
      >
        {title}
        {omitted ? " · нет в протоколе" : ""}
      </button>
      {children}
    </div>
  );
}

function allergyGroups(): string[] {
  const labels: string[] = [];
  for (const g of Object.values(DRUG_GROUPS) as { label?: string }[]) {
    const label = (g.label || "").trim();
    if (label) labels.push(label);
  }
  try {
    Object.values(legacy.getCustomGroups() || {}).forEach((g) => {
      const label = String((g as { label?: string }).label || "").trim();
      if (label && !labels.some((x) => x.toLowerCase() === label.toLowerCase())) labels.push(label);
    });
  } catch {
    /* */
  }
  return labels;
}

function GroupMarks({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
  const groups = useMemo(() => allergyGroups(), []);
  if (!groups.length) return null;
  return (
    <div className="mt-1">
      <div className="text-[10px] tracking-wide text-mute uppercase">группы</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {groups.map((g) => {
          const on = selected.some((s) => s.toLowerCase() === g.toLowerCase());
          return (
            <button
              key={g}
              type="button"
              onClick={() => onToggle(g)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                on ? "bg-teal-soft font-medium text-teal" : "border border-dashed border-line bg-paper text-ink-soft"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggleNamed(items: string[], name: string) {
  const has = items.some((s) => s.toLowerCase() === name.toLowerCase());
  return has ? items.filter((s) => s.toLowerCase() !== name.toLowerCase()) : [...items, name];
}

function BlockLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mt-1.5">
      <div className="text-xs font-semibold text-ink">{label}</div>
      {hint ? <div className="text-[10px] text-ink-soft">{hint}</div> : null}
    </div>
  );
}

function VitaeField({
  label,
  children,
  omitted,
  onToggleOmit,
  dim,
  onLabel,
}: {
  label: string;
  children: ReactNode;
  omitted?: boolean;
  onToggleOmit?: () => void;
  dim?: boolean;
  onLabel?: () => void;
}) {
  return (
    <div className={`mt-1.5 rounded-md border border-line bg-paper px-2 py-1 ${omitted || dim ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`text-left text-xs leading-none font-medium ${omitted ? "text-mute line-through" : "text-ink-soft"}`}
          onClick={onToggleOmit}
          title={omitted ? "Вернуть в протокол" : "Скрыть в протоколе"}
        >
          {label}
          {omitted ? " · нет в протоколе" : ""}
        </button>
        {onLabel ? (
          <button type="button" className="text-[10px] text-teal" onClick={onLabel}>
            {dim ? "в текст" : "в тексте"}
          </button>
        ) : null}
      </div>
      <div className="mt-1 text-sm leading-snug text-ink">{children}</div>
    </div>
  );
}

function ChipList({
  label,
  items,
  onChange,
  allergy,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  allergy?: boolean;
  placeholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const open = items.length > 0 || adding;
  const hits = useMemo(() => {
    if (q.trim().length < 2) return [] as { id: string; label: string; hint?: string; name?: string }[];
    if (allergy) return searchAllergy(q);
    return searchDrugs(q)
      .slice(0, 10)
      .map((h) => ({ id: h.name + h.via, label: h.name, hint: h.via, name: h.name }));
  }, [allergy, q]);
  function commitNamed(name: string, kind?: "drug" | "group" | "text") {
    if (kind === "drug") rememberDrug(name);
    else if (kind === "group") ensureGroup(name);
    else if (kind !== "text") {
      if (groupKnown(name)) ensureGroup(name);
      else if (drugKnown(name)) rememberDrug(name);
    }
    setAdding(true);
    if (!items.includes(name)) onChange([...items, name]);
    setQ("");
    setPending(null);
  }
  const chip = (on: boolean) =>
    `rounded-full px-2 py-0.5 text-xs ${on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"}`;
  return (
    <div className="mt-1">
      {label ? <div className="text-xs font-semibold text-ink">{label}</div> : null}
      <div className={`flex flex-wrap gap-1 ${label ? "mt-1" : ""}`}>
        <button
          type="button"
          className={chip(!open)}
          onClick={() => {
            setAdding(false);
            if (items.length) onChange([]);
          }}
        >
          отрицает
        </button>
        <button type="button" className={chip(open)} onClick={() => setAdding(true)}>
          есть
        </button>
      </div>
      {open ? (
        <div className="mt-1">
          {items.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {items.map((t) => (
                <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal">
                  <button type="button" title="Нажми, чтобы убрать" onClick={() => onChange(items.filter((x) => x !== t))}>
                    {t}
                  </button>
                  <InfoDot query={t} />
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-1">
            <Typeahead
              value={q}
              onChange={setQ}
              items={hits}
              onPick={(it) => commitNamed(it.name || it.label)}
              onSubmitCustom={(raw) => {
                const hit = hits.find((h) => h.label.toLowerCase() === raw.toLowerCase() || (h.name || "").toLowerCase() === raw.toLowerCase());
                if (hit || groupKnown(raw) || drugKnown(raw)) commitNamed(hit?.name || raw);
                else setPending(raw);
              }}
              placeholder={placeholder}
              emptyHint={q.trim().length >= 2 ? "Enter — выбрать, что это" : undefined}
              inputClassName="w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
            />
            {pending ? (
              <SaveKind
                name={pending}
                onPick={(kind) => commitNamed(pending, kind)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {allergy ? <GroupMarks selected={items} onToggle={(name) => { setAdding(true); onChange(toggleNamed(items, name)); }} /> : null}
    </div>
  );
}

function CardFill({
  label,
  items,
  onChange,
  allergy,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  allergy?: boolean;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const hits = useMemo(() => {
    if (q.trim().length < 2) return [] as { id: string; label: string; hint?: string; name?: string }[];
    if (allergy) return searchAllergy(q);
    return searchDrugs(q)
      .slice(0, 10)
      .map((h) => ({ id: h.name + h.via, label: h.name, hint: h.via, name: h.name }));
  }, [allergy, q]);
  function commitNamed(name: string, kind?: "drug" | "group" | "text") {
    if (kind === "drug") rememberDrug(name);
    else if (kind === "group") ensureGroup(name);
    else if (kind !== "text") {
      if (groupKnown(name)) ensureGroup(name);
      else if (drugKnown(name)) rememberDrug(name);
    }
    if (!items.includes(name)) onChange([...items, name]);
    setQ("");
    setPending(null);
  }
  return (
    <VitaeField label={label}>
      <EditableChips items={items} onChange={onChange} />
      <Typeahead
        value={q}
        onChange={setQ}
        items={hits}
        onPick={(it) => commitNamed(it.name || it.label)}
        onSubmitCustom={(raw) => {
          const hit = hits.find((h) => h.label.toLowerCase() === raw.toLowerCase() || (h.name || "").toLowerCase() === raw.toLowerCase());
          if (hit || groupKnown(raw) || drugKnown(raw)) commitNamed(hit?.name || raw);
          else setPending(raw);
        }}
        placeholder={placeholder}
        emptyHint={q.trim().length >= 2 ? "Enter — выбрать, что это" : undefined}
      />
      {pending ? <SaveKind name={pending} onPick={(kind) => commitNamed(pending, kind)} /> : null}
      {allergy ? <GroupMarks selected={items} onToggle={(name) => onChange(toggleNamed(items, name))} /> : null}
    </VitaeField>
  );
}

export function AnamnesisDisease({
  draft,
  text,
  chipMode,
  onDraft,
  onText,
  onMode,
}: {
  draft: AnamnesisDraft;
  text: string;
  chipMode: boolean;
  onDraft: (d: AnamnesisDraft) => void;
  onText: (t: string) => void;
  onMode: (chips: boolean) => void;
}) {
  const [drugQ, setDrugQ] = useState("");
  const [editDrug, setEditDrug] = useState<number | null>(null);
  const [drugDraft, setDrugDraft] = useState("");
  const d = normalizeAnamnesis(draft);
  const patch = (p: Partial<AnamnesisDraft>) => onDraft({ ...d, ...p });
  const hits = searchDrugs(drugQ).slice(0, 8);

  if (!chipMode) {
    return (
      <div>
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
        <button type="button" className="mt-1 text-[11px] font-medium text-teal" onClick={() => onMode(true)}>
          вернуть чипы
        </button>
      </div>
    );
  }

  return (
    <div>
      <BlockLabel label="болеет" />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() =>
            patch({
              onset: d.onset === "chronic" ? "" : "chronic",
              amount: d.onset === "chronic" ? d.amount : "",
              unit: d.onset === "chronic" ? d.unit : "",
            })
          }
          className={`rounded-full px-2 py-0.5 text-xs ${
            d.onset === "chronic" ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
          }`}
        >
          давно
        </button>
        <input
          value={d.amount}
          onChange={(e) => {
            const v = e.target.value.replace(".", ",");
            const clean = v.replace(/[^\d,]/g, "");
            const cut = clean.indexOf(",");
            const amount =
              cut === -1
                ? clean.slice(0, 4)
                : `${clean.slice(0, cut).slice(0, 3)},${clean.slice(cut + 1).replace(/,/g, "").slice(0, 2)}`;
            patch({ amount, onset: "" });
          }}
          placeholder="1,5"
          inputMode="decimal"
          className="w-16 rounded-md border border-line bg-paper px-1.5 py-0.5 text-sm tabular-nums"
        />
        {(
          [
            ["hours", "часов"],
            ["days", "дней"],
            ["weeks", "недель"],
            ["months", "месяцев"],
            ["years", "лет"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => patch({ unit: d.unit === id ? "" : id, onset: "" })}
            className={`rounded-full px-2 py-0.5 text-xs ${
              d.unit === id ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      <BlockLabel label="связывает с" />
      <div className="mt-1 flex flex-wrap gap-1">
        {RELATED_PRESETS.map((p) => {
          const on = d.related.includes(p.label);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                patch({
                  related: on ? d.related.filter((x) => x !== p.label) : [...d.related, p.label],
                })
              }
              className={`rounded-full px-2 py-0.5 text-xs ${
                on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => patch({ relatedOtherOn: !d.relatedOtherOn })}
          className={`rounded-full px-2 py-0.5 text-xs ${
            d.relatedOtherOn ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
          }`}
        >
          другое
        </button>
      </div>
      {d.relatedOtherOn && (
        <input
          value={d.relatedOther}
          onChange={(e) => patch({ relatedOther: e.target.value })}
          placeholder="с чем связывает"
          className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
      )}
      <ChipRow
        label="лечение"
        value={d.treated}
        onChange={(id) => patch({ treated: id as AnamnesisDraft["treated"] })}
        options={[
          { id: "no", text: "не лечился" },
          { id: "yes", text: "лечился" },
        ]}
      />
      {d.treated === "yes" && (
        <div className="mt-1">
          <Typeahead
            value={drugQ}
            onChange={setDrugQ}
            items={hits.map((h) => ({ id: h.name, label: h.name, hint: h.via, name: h.name }))}
            onPick={(it) => {
              if (!d.drugs.includes(it.id)) patch({ drugs: [...d.drugs, it.id] });
            }}
            onSubmitCustom={(raw) => {
              if (!d.drugs.includes(raw)) patch({ drugs: [...d.drugs, raw] });
            }}
            placeholder="препарат из базы…  ↑↓ Enter"
            emptyHint="Enter — вписать как есть. i — карточка, если в базе"
          />
          {d.drugs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {d.drugs.map((name, i) =>
                editDrug === i ? (
                  <input
                    key={name}
                    autoFocus
                    value={drugDraft}
                    onChange={(e) => setDrugDraft(e.target.value)}
                    onBlur={() => {
                      const next = [...d.drugs];
                      if (!drugDraft.trim()) next.splice(i, 1);
                      else next[i] = drugDraft.trim();
                      patch({ drugs: next });
                      setEditDrug(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="w-32 rounded-full border border-teal bg-paper px-2 py-0.5 text-xs"
                  />
                ) : (
                  <span
                    key={name}
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs ${
                      drugMarked(name) ? "bg-teal-soft font-medium text-teal ring-1 ring-teal/70" : "bg-teal-soft text-teal"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditDrug(i);
                        setDrugDraft(name);
                      }}
                    >
                      {name}
                    </button>
                    <InfoDot query={name} />
                  </span>
                ),
              )}
            </div>
          )}
          <ChipRow
            label="эффект"
            value={d.effect}
            onChange={(id) => patch({ effect: id as AnamnesisDraft["effect"] })}
            options={[
              { id: "none", text: "эффекта нет" },
              { id: "temp", text: "эффект временный" },
              { id: "full", text: "эффект полный" },
              { id: "worse", text: "стало хуже" },
            ]}
          />
        </div>
      )}
      <DoneBar sentence={composeAnamnesis(d)} onDone={() => onMode(false)} />
    </div>
  );
}

function useVitaeTemplates() {
  const [list, setList] = useState<VitaeTemplate[]>(() => vitaeTemplates());
  useEffect(() => {
    const sync = () => setList(vitaeTemplates());
    window.addEventListener("medconsult-vitae-templates", sync);
    return () => window.removeEventListener("medconsult-vitae-templates", sync);
  }, []);
  return list;
}

export function AnamnesisVitae({
  draft,
  text,
  chipMode,
  onDraft,
  onText,
  onMode,
}: {
  draft: VitaeDraft;
  text: string;
  chipMode: boolean;
  onDraft: (d: VitaeDraft) => void;
  onText: (t: string) => void;
  onMode: (chips: boolean) => void;
}) {
  const d = useMemo(() => normalizeVitae(draft), [draft]);
  const patch = (p: Partial<VitaeDraft>) => onDraft({ ...d, ...p });
  const templates = useTemplates();
  const chronicPresets = templates.chronic;
  const surgeryPresets = templates.surgeries;
  const { session, setSession } = useAppStore();
  const vitaeTpls = useVitaeTemplates();
  const ctx = { medications: session.currentMedications, allergies: session.allergies };
  const defaultKey = vitaeDefaultKey();
  const mode =
    session.vitaeTemplateId === "chips"
      ? "chips"
      : session.vitaeTemplateId && vitaeTpls.some((t) => t.key === session.vitaeTemplateId)
        ? session.vitaeTemplateId
        : vitaeDraftTouched(d)
          ? "chips"
          : text.trim() && !session.vitaeTemplateId
            ? "text"
            : defaultKey;
  const tpl = vitaeTpls.find((t) => t.key === mode);
  const fields = tpl ? (session.vitaeTemplateId === tpl.key ? session.vitaeFields || templateDefaults(tpl) : templateDefaults(tpl)) : {};

  function choose(id: string) {
    if (id === "chips") {
      setSession({ vitaeTemplateId: "chips", vitaeChipMode: true, anamnesisVitae: composeVitae(d, ctx) });
      return;
    }
    const next = vitaeTpls.find((t) => t.key === id);
    if (!next) return;
    const nextFields = session.vitaeTemplateId === id ? session.vitaeFields || templateDefaults(next) : templateDefaults(next);
    setSession({
      vitaeTemplateId: id,
      vitaeFields: nextFields,
      vitaeChipMode: true,
      anamnesisVitae: fillVitaeTemplate(next, nextFields, ctx),
    });
  }

  function writeField(key: string, value: string) {
    if (!tpl) return;
    const nextFields = { ...(session.vitaeFields || templateDefaults(tpl)), [key]: value };
    setSession({
      vitaeTemplateId: tpl.key,
      vitaeFields: nextFields,
      vitaeChipMode: true,
      anamnesisVitae: fillVitaeTemplate(tpl, nextFields, ctx),
    });
  }

  function setCard(patch: { allergies?: string[]; currentMedications?: string[] }) {
    const allergies = patch.allergies ?? session.allergies ?? [];
    const currentMedications = patch.currentMedications ?? session.currentMedications ?? [];
    const nextCtx = { allergies, medications: currentMedications };
    const usingTpl = !!(tpl && mode !== "chips" && mode !== "text");
    setSession({
      allergies,
      currentMedications,
      anamnesisVitae: usingTpl ? fillVitaeTemplate(tpl, session.vitaeFields || fields, nextCtx) : composeVitae(d, nextCtx),
    });
  }

  const cardFields = (
    <>
      <CardFill
        label="аллергия"
        items={session.allergies || []}
        allergy
        placeholder="аллерген или препарат"
        onChange={(allergies) => setCard({ allergies })}
      />
      <CardFill
        label="принимает постоянно"
        items={session.currentMedications || []}
        placeholder="препарат"
        onChange={(currentMedications) => setCard({ currentMedications })}
      />
    </>
  );

  const picker = (
    <div className="mb-2 flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => choose("chips")}
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
          mode === "chips" ? "bg-teal text-paper" : "border border-line bg-paper text-ink"
        }`}
      >
        чипы{defaultKey === "chips" ? " · умолч." : ""}
      </button>
      {vitaeTpls.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => choose(t.key)}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            mode === t.key ? "bg-teal text-paper" : "border border-line bg-paper text-ink"
          }`}
        >
          {t.label}
          {defaultKey === t.key ? " · умолч." : ""}
        </button>
      ))}
    </div>
  );
  const openDev = d.development === "features" || d.developmentItems.length > 0;
  const openOcc = d.occupation === "has" || d.occupationItems.length > 0;
  const openPast = d.pastIllness === "other" || d.pastItems.length > 0;
  const openInf = d.infections === "has" || d.infectionItems.length > 0;
  const openHer = d.heritage === "burdened" || d.heritageItems.length > 0;
  const openTf = d.transfusion === "has" || d.transfusionItems.length > 0;
  const omitted = (id: string) => (d.omit || []).includes(id);
  const setOmit = (id: string, hide: boolean) => {
    const set = new Set(d.omit || []);
    if (hide) set.add(id);
    else set.delete(id);
    patch({ omit: [...set] });
  };

  if (!chipMode) {
    return (
      <div>
        {picker}
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={11}
          className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm leading-relaxed"
        />
        <button type="button" className="mt-1 text-[11px] font-medium text-teal" onClick={() => onMode(true)}>
          вернуть чипы
        </button>
      </div>
    );
  }

  if (tpl && mode !== "chips" && mode !== "text") {
    const shown = visibleVitaeFields(tpl, fields);
    const omittedField = (key: string) => fields[`__omit_${key}`] === "1";
    return (
      <div>
        {picker}
        {shown.map((f) =>
          f.kind === "heading" ? (
            <div key={f.key} className="mt-2 text-xs font-medium text-ink-soft">
              {f.label}
            </div>
          ) : (
            <VitaeField
              key={f.key}
              label={f.label}
              omitted={omittedField(f.key)}
              onToggleOmit={() => writeField(`__omit_${f.key}`, omittedField(f.key) ? "" : "1")}
              dim={f.optional && fields[`__on_${f.key}`] !== "1"}
              onLabel={f.optional ? () => writeField(`__on_${f.key}`, fields[`__on_${f.key}`] === "1" ? "" : "1") : undefined}
            >
              {(!f.optional || fields[`__on_${f.key}`] === "1") && (
                <FieldControl
                  boxed
                  f={f}
                  value={
                    f.key === "employment"
                      ? fields[f.key] === "не работает"
                        ? "нет"
                        : fields[f.key] === "работает"
                          ? "да"
                          : fields[f.key] || ""
                      : fields[f.key] || ""
                  }
                  onChange={(v) => writeField(f.key, v)}
                />
              )}
            </VitaeField>
          ),
        )}
        {cardFields}
        <DoneBar sentence={fillVitaeTemplate(tpl, fields, ctx)} onDone={() => onMode(false)} preview={false} />
      </div>
    );
  }

  return (
    <div>
      {picker}
      <VitaeSection id="development" title="развитие" omitted={omitted("development")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.development}
        fallback="normal"
        onChange={(id) =>
          patch({
            development: id as VitaeDraft["development"],
            developmentItems: id === "normal" ? [] : d.developmentItems,
          })
        }
        options={[
          { id: "normal", text: "без особенностей" },
          { id: "features", text: "есть" },
        ]}
      />
      {openDev && (
        <PresetPicker
          presets={DEV_PRESETS}
          selected={d.developmentItems}
          onChange={(developmentItems) =>
            patch({ developmentItems, development: developmentItems.length ? "features" : "normal" })
          }
        />
      )}
      </VitaeSection>
      <VitaeSection id="work" title="работает" omitted={omitted("work")} onOmit={setOmit}>
        <ChipRow
          label=""
          value={d.employment}
          fallback="works"
          onChange={(id) => patch({ employment: id as VitaeDraft["employment"] })}
          options={[
            { id: "works", text: "да" },
            { id: "off", text: "нет" },
          ]}
        />
        {(d.employment || "works") !== "off" && (
          <>
            <div className={`mt-1 ${d.workplaceOn ? "" : "opacity-50"}`}>
              <button type="button" className="text-xs text-ink-soft" onClick={() => patch({ workplaceOn: !d.workplaceOn })}>
                место работы
              </button>
              {d.workplaceOn && (
                <input
                  value={d.workplace}
                  onChange={(e) => patch({ workplace: e.target.value })}
                  placeholder="где работает"
                  className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
                />
              )}
            </div>
            <div className={`mt-1 ${d.jobOn ? "" : "opacity-50"}`}>
              <button type="button" className="text-xs text-ink-soft" onClick={() => patch({ jobOn: !d.jobOn })}>
                должность
              </button>
              {d.jobOn && (
                <input
                  value={d.jobTitle}
                  onChange={(e) => patch({ jobTitle: e.target.value })}
                  placeholder="должность"
                  className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
                />
              )}
            </div>
          </>
        )}
        {d.employment === "off" && (
          <>
            <ChipRow
              label="причина"
              value={d.notWorkReason}
              onChange={(id) => patch({ notWorkReason: id })}
              options={[
                { id: "пенсионер", text: "пенсионер" },
                { id: "студент", text: "студент" },
                { id: "декрет", text: "декрет" },
                { id: "безработный", text: "безработный" },
                { id: "ухаживает за ребёнком", text: "ухаживает за ребёнком" },
              ]}
            />
            <input
              value={d.notWorkText}
              onChange={(e) => patch({ notWorkText: e.target.value })}
              placeholder="своя причина"
              className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
          </>
        )}
      </VitaeSection>
      <VitaeSection id="occupation" title="профвредности" omitted={omitted("occupation")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.occupation}
        fallback="denies"
        onChange={(id) =>
          patch({
            occupation: id as VitaeDraft["occupation"],
            occupationItems: id === "denies" ? [] : d.occupationItems,
          })
        }
        options={[
          { id: "denies", text: "отрицает" },
          { id: "has", text: "есть" },
        ]}
      />
      {openOcc && (
        <PresetPicker
          presets={OCC_PRESETS}
          selected={d.occupationItems}
          onChange={(occupationItems) =>
            patch({ occupationItems, occupation: occupationItems.length ? "has" : "denies" })
          }
        />
      )}
      </VitaeSection>
      <VitaeSection id="habits" title="вредные привычки" omitted={omitted("habits")} onOmit={setOmit}>
      <ChipRow
        label="курение"
        value={d.smoke}
        fallback="no"
        onChange={(id) => patch({ smoke: id as VitaeDraft["smoke"] })}
        options={[
          { id: "no", text: "не курит" },
          { id: "yes", text: "курит" },
        ]}
      />
      {d.smoke === "yes" && (
        <input
          value={d.smokePacks}
          onChange={(e) => patch({ smokePacks: e.target.value })}
          placeholder="пачек в сутки"
          className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
      )}
      <ChipRow
        label="алкоголь"
        value={d.alcohol}
        fallback="no"
        onChange={(id) => patch({ alcohol: id as VitaeDraft["alcohol"] })}
        options={[
          { id: "no", text: "отрицает" },
          { id: "yes", text: "употребляет" },
        ]}
      />
      </VitaeSection>
      <VitaeSection id="disability" title="инвалидность" omitted={omitted("disability")} onOmit={setOmit}>
        <ChipRow
          label=""
          value={d.disability}
          fallback="no"
          onChange={(id) => patch({ disability: id as VitaeDraft["disability"] })}
          options={[
            { id: "no", text: "нет" },
            { id: "yes", text: "да" },
          ]}
        />
        {d.disability === "yes" && (
          <>
            <ChipRow
              label="группа"
              value={d.disabilityGroup}
              onChange={(id) => patch({ disabilityGroup: id })}
              options={[
                { id: "I", text: "I" },
                { id: "II", text: "II" },
                { id: "III", text: "III" },
              ]}
            />
            <ChipRow
              label="причина"
              value={d.disabilityCause || "общее заболевание"}
              onChange={(id) => patch({ disabilityCause: id })}
              options={[
                { id: "общее заболевание", text: "общее заболевание" },
                { id: "трудовое увечье", text: "трудовое увечье" },
                { id: "профзаболевание", text: "профзаболевание" },
                { id: "с детства", text: "с детства" },
                { id: "военная травма", text: "военная травма" },
              ]}
            />
            <div className={`mt-1 ${d.disabilityNoteOn ? "" : "opacity-50"}`}>
              <button type="button" className="text-[11px] text-teal" onClick={() => patch({ disabilityNoteOn: !d.disabilityNoteOn })}>
                + примечание
              </button>
              {d.disabilityNoteOn && (
                <input
                  value={d.disabilityNote}
                  onChange={(e) => patch({ disabilityNote: e.target.value })}
                  placeholder="например заболевание"
                  className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
                />
              )}
            </div>
          </>
        )}
      </VitaeSection>
      <VitaeSection id="past" title="перенесённые заболевания" omitted={omitted("past")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.pastIllness}
        fallback="typical"
        onChange={(id) =>
          patch({
            pastIllness: id as VitaeDraft["pastIllness"],
            pastItems: id === "typical" ? [] : d.pastItems,
          })
        }
        options={[
          { id: "typical", text: "типичные" },
          { id: "other", text: "есть" },
        ]}
      />
      {openPast && (
        <PresetPicker
          presets={chronicPresets}
          selected={d.pastItems}
          onChange={(pastItems) => {
            pastItems.forEach((it) => rememberDisease(it.label));
            patch({ pastItems, pastIllness: pastItems.length ? "other" : "typical" });
          }}
          disease
        />
      )}
      </VitaeSection>
      <VitaeSection id="infections" title="туберкулёз, гепатиты, вен. заб." omitted={omitted("infections")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.infections}
        fallback="denies"
        onChange={(id) =>
          patch({
            infections: id as VitaeDraft["infections"],
            infectionItems: id === "denies" ? [] : d.infectionItems,
          })
        }
        options={[
          { id: "denies", text: "отрицает" },
          { id: "has", text: "есть" },
        ]}
      />
      {openInf && (
        <PresetPicker
          presets={INFECTION_PRESETS}
          selected={d.infectionItems}
          onChange={(infectionItems) =>
            patch({ infectionItems, infections: infectionItems.length ? "has" : "denies" })
          }
        />
      )}
      </VitaeSection>
      <VitaeSection id="heritage" title="наследственность" omitted={omitted("heritage")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.heritage}
        fallback="clear"
        onChange={(id) =>
          patch({
            heritage: id as VitaeDraft["heritage"],
            heritageItems: id === "clear" ? [] : d.heritageItems,
          })
        }
        options={[
          { id: "clear", text: "не отягощена" },
          { id: "burdened", text: "есть" },
        ]}
      />
      {openHer && (
        <PresetPicker
          presets={HERITAGE_PRESETS}
          selected={d.heritageItems}
          onChange={(heritageItems) =>
            patch({ heritageItems, heritage: heritageItems.length ? "burdened" : "clear" })
          }
        />
      )}
      </VitaeSection>
      <VitaeSection id="allergy" title="аллергия" omitted={omitted("allergy")} onOmit={setOmit}>
      <ChipList
        label=""
        items={session.allergies || []}
        allergy
        placeholder="аллерген + Enter"
        onChange={(allergies) => setCard({ allergies })}
      />
      </VitaeSection>
      <VitaeSection id="meds" title="принимает постоянно" omitted={omitted("meds")} onOmit={setOmit}>
      <ChipList
        label=""
        items={session.currentMedications || []}
        placeholder="препарат + Enter"
        onChange={(currentMedications) => setCard({ currentMedications })}
      />
      </VitaeSection>
      <VitaeSection id="surgery" title="операции" omitted={omitted("surgery")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.surgery}
        fallback="none"
        onChange={(id) =>
          patch({
            surgery: id as VitaeDraft["surgery"],
            surgeryItems: id === "none" ? [] : d.surgeryItems,
          })
        }
        options={[
          { id: "none", text: "не было" },
          { id: "has", text: "были" },
        ]}
      />
      {d.surgery === "has" && (
        <PresetPicker
          presets={surgeryPresets}
          selected={d.surgeryItems}
          onChange={(surgeryItems) => patch({ surgeryItems })}
          yearAlways
          onRemember={(label) => addSurgeryPreset(label)}
        />
      )}
      </VitaeSection>
      <VitaeSection id="transfusion" title="гемотрансфузии" omitted={omitted("transfusion")} onOmit={setOmit}>
      <ChipRow
        label=""
        value={d.transfusion}
        fallback="denies"
        onChange={(id) =>
          patch({
            transfusion: id as VitaeDraft["transfusion"],
            transfusionItems: id === "denies" ? [] : d.transfusionItems,
          })
        }
        options={[
          { id: "denies", text: "отрицает" },
          { id: "has", text: "есть" },
        ]}
      />
      {openTf && (
        <PresetPicker
          presets={TRANSFUSION_PRESETS}
          selected={d.transfusionItems}
          onChange={(transfusionItems) =>
            patch({ transfusionItems, transfusion: transfusionItems.length ? "has" : "denies" })
          }
        />
      )}
      </VitaeSection>
      <DoneBar sentence={composeVitae(d, ctx)} onDone={() => onMode(false)} preview={false} />
    </div>
  );
}

export { emptyAnamnesis, emptyVitae, composeAnamnesis, composeVitae };
