import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  VITAE_LINES,
  type AnamnesisDraft,
  type VitaeDraft,
  type VitaeItem,
} from "./anamnesisChips";
import { useTemplates, type VitaePreset } from "./data/templates";
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
      <div className="text-xs font-semibold text-ink">{label}</div>
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

function PresetPicker({
  presets,
  selected,
  onChange,
}: {
  presets: VitaePreset[];
  selected: VitaeItem[];
  onChange: (next: VitaeItem[]) => void;
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
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p)}
              className={`rounded-full px-2 py-0.5 text-xs ${
                on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {selected.map((s) => {
        const preset = presets.find((p) => p.id === s.id);
        const showDate = preset?.needsDate || Boolean(s.date);
        if (!showDate) return null;
        return (
          <label key={s.id} className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-ink-soft">{s.label}</span>
            <input
              value={s.date || ""}
              onChange={(e) => setDate(s.id, e.target.value)}
              placeholder={preset?.emptyDateText ? `пусто = ${preset.emptyDateText}` : "год или дата, можно пусто"}
              className="w-44 rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs"
            />
          </label>
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
  omitted,
  onOmit,
  children,
}: {
  id: string;
  omitted: boolean;
  onOmit: (id: string, hide: boolean) => void;
  children: ReactNode;
}) {
  if (omitted) return null;
  return (
    <div className="group relative pr-5">
      <button
        type="button"
        title="убрать пункт"
        aria-label="убрать пункт"
        onClick={() => onOmit(id, true)}
        className="absolute top-1.5 right-0 z-[1] flex size-[16px] items-center justify-center rounded bg-danger-soft text-[10px] font-bold text-danger opacity-70 md:opacity-0 md:group-hover:opacity-100"
      >
        ×
      </button>
      {children}
    </div>
  );
}

function BlockLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mt-1.5">
      <div className="text-xs font-semibold text-ink">{label}</div>
      {hint ? <div className="text-[10px] text-ink-soft">{hint}</div> : null}
    </div>
  );
}

function VitaeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-1.5 rounded-md border border-line bg-paper px-2 py-1">
      <div className="text-xs leading-none font-medium text-ink-soft">{label}</div>
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
  const open = items.length > 0 || adding;
  const hits = useMemo(() => {
    if (q.trim().length < 2) return [] as { id: string; label: string; hint?: string; name?: string }[];
    if (allergy) return searchAllergy(q);
    return searchDrugs(q)
      .slice(0, 10)
      .map((h) => ({ id: h.name + h.via, label: h.name, hint: h.via, name: h.name }));
  }, [allergy, q]);
  const chip = (on: boolean) =>
    `rounded-full px-2 py-0.5 text-xs ${on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"}`;
  return (
    <div className="mt-1">
      <div className="text-xs font-semibold text-ink">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
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
                <button
                  key={t}
                  type="button"
                  title="Нажми, чтобы убрать"
                  className="rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal"
                  onClick={() => onChange(items.filter((x) => x !== t))}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-1">
            <Typeahead
              value={q}
              onChange={setQ}
              items={hits}
              onPick={(it) => {
                const name = it.name || it.label;
                if (!items.includes(name)) onChange([...items, name]);
              }}
              onSubmitCustom={(raw) => {
                if (!items.includes(raw)) onChange([...items, raw]);
              }}
              placeholder={placeholder}
              emptyHint={q.trim().length >= 2 ? "Enter — как есть" : undefined}
              inputClassName="w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
            />
          </div>
        </div>
      ) : null}
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
  const hits = useMemo(() => {
    if (q.trim().length < 2) return [] as { id: string; label: string; hint?: string; name?: string }[];
    if (allergy) return searchAllergy(q);
    return searchDrugs(q)
      .slice(0, 10)
      .map((h) => ({ id: h.name + h.via, label: h.name, hint: h.via, name: h.name }));
  }, [allergy, q]);
  return (
    <VitaeField label={label}>
      <EditableChips items={items} onChange={onChange} />
      <Typeahead
        value={q}
        onChange={setQ}
        items={hits}
        onPick={(it) => {
          const name = it.name || it.label;
          if (!items.includes(name)) onChange([...items, name]);
        }}
        onSubmitCustom={(raw) => {
          if (!items.includes(raw)) onChange([...items, raw]);
        }}
        placeholder={placeholder}
        emptyHint={q.trim().length >= 2 ? "Enter — как есть" : undefined}
      />
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
          onChange={(e) => patch({ amount: e.target.value.replace(/\D/g, "").slice(0, 3), onset: "" })}
          placeholder="N"
          className="w-12 rounded-md border border-line bg-paper px-1.5 py-0.5 text-sm tabular-nums"
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
      </div>
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
  const hiddenLines = VITAE_LINES.filter((l) => omitted(l.id));

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
    return (
      <div>
        {picker}
        {shown.map((f) =>
          f.kind === "heading" ? (
            <div key={f.key} className="mt-2 text-xs font-medium text-ink-soft">
              {f.label}
            </div>
          ) : (
            <VitaeField key={f.key} label={f.label}>
              <FieldControl boxed f={f} value={fields[f.key] || ""} onChange={(v) => writeField(f.key, v)} />
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
      <VitaeSection id="development" omitted={omitted("development")} onOmit={setOmit}>
      <ChipRow
        label="развитие"
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
      <VitaeSection id="occupation" omitted={omitted("occupation")} onOmit={setOmit}>
      <ChipRow
        label="профвредности"
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
      <VitaeSection id="habits" omitted={omitted("habits")} onOmit={setOmit}>
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
      <VitaeSection id="past" omitted={omitted("past")} onOmit={setOmit}>
      <ChipRow
        label="перенесённые заболевания"
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
          onChange={(pastItems) => patch({ pastItems, pastIllness: pastItems.length ? "other" : "typical" })}
        />
      )}
      </VitaeSection>
      <VitaeSection id="infections" omitted={omitted("infections")} onOmit={setOmit}>
      <ChipRow
        label="туберкулёз, гепатиты, вен. заб."
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
      <VitaeSection id="heritage" omitted={omitted("heritage")} onOmit={setOmit}>
      <ChipRow
        label="наследственность"
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
      <VitaeSection id="allergy" omitted={omitted("allergy")} onOmit={setOmit}>
      <ChipList
        label="аллергия"
        items={session.allergies || []}
        allergy
        placeholder="аллерген + Enter"
        onChange={(allergies) => setCard({ allergies })}
      />
      </VitaeSection>
      <VitaeSection id="meds" omitted={omitted("meds")} onOmit={setOmit}>
      <ChipList
        label="принимает постоянно"
        items={session.currentMedications || []}
        placeholder="препарат + Enter"
        onChange={(currentMedications) => setCard({ currentMedications })}
      />
      </VitaeSection>
      <VitaeSection id="surgery" omitted={omitted("surgery")} onOmit={setOmit}>
      <ChipRow
        label="операции"
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
        />
      )}
      </VitaeSection>
      <VitaeSection id="transfusion" omitted={omitted("transfusion")} onOmit={setOmit}>
      <ChipRow
        label="гемотрансфузии"
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
      {hiddenLines.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] tracking-wide text-mute uppercase">убранные пункты</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {hiddenLines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setOmit(l.id, false)}
                className="rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-xs text-teal"
              >
                + {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <DoneBar sentence={composeVitae(d, ctx)} onDone={() => onMode(false)} preview={false} />
    </div>
  );
}

export { emptyAnamnesis, emptyVitae, composeAnamnesis, composeVitae };
