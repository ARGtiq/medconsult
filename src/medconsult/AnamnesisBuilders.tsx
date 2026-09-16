import { useMemo, useState } from "react";
import {
  composeAnamnesis,
  composeVitae,
  emptyAnamnesis,
  emptyVitae,
  normalizeVitae,
  type AnamnesisDraft,
  type VitaeDraft,
  type VitaeItem,
} from "./anamnesisChips";
import { useTemplates, type VitaePreset } from "./data/templates";
import { searchDrugs } from "./live";
import { Typeahead } from "./Typeahead";

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; text: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-1">
      <div className="text-[10px] tracking-wide text-mute uppercase">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(value === o.id ? "" : o.id)}
            className={`rounded-full px-2 py-0.5 text-xs ${
              value === o.id ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function DoneBar({ sentence, onDone }: { sentence: string; onDone: () => void }) {
  return (
    <div className="mt-2">
      {sentence ? (
        <p className="text-sm leading-relaxed text-ink-soft">{sentence}</p>
      ) : (
        <p className="text-xs text-mute">Собери фразу чипами — потом станет обычным текстом.</p>
      )}
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
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1">
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
  const d = draft;
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
      <ChipRow
        label="начало"
        value={d.onset}
        onChange={(id) => patch({ onset: id as AnamnesisDraft["onset"] })}
        options={[
          { id: "first", text: "заболел впервые" },
          { id: "chronic", text: "болеет давно" },
        ]}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <input
          value={d.amount}
          onChange={(e) => patch({ amount: e.target.value.replace(/\D/g, "").slice(0, 3) })}
          placeholder="N"
          className="w-12 rounded-md border border-line bg-paper px-1.5 py-0.5 text-sm tabular-nums"
        />
        {(
          [
            ["days", "дней"],
            ["weeks", "недель"],
            ["months", "месяцев"],
            ["years", "лет"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => patch({ unit: d.unit === id ? "" : id })}
            className={`rounded-full px-2 py-0.5 text-xs ${
              d.unit === id ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
            }`}
          >
            {text} назад
          </button>
        ))}
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
            items={hits.map((h) => ({ id: h.name, label: h.name, hint: h.via }))}
            onPick={(it) => {
              if (!d.drugs.includes(it.id)) patch({ drugs: [...d.drugs, it.id] });
            }}
            onSubmitCustom={(raw) => {
              if (!d.drugs.includes(raw)) patch({ drugs: [...d.drugs, raw] });
            }}
            placeholder="препарат из базы…  ↑↓ Enter"
            emptyHint="Enter — вписать как есть"
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
                  <button
                    key={name}
                    type="button"
                    className="rounded-full bg-teal-soft px-2 py-0.5 text-xs text-teal"
                    onClick={() => {
                      setEditDrug(i);
                      setDrugDraft(name);
                    }}
                  >
                    {name}
                  </button>
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
      <ChipRow
        label="хронические"
        value={d.chronic}
        onChange={(id) =>
          patch({
            chronic: id as VitaeDraft["chronic"],
            chronicItems: id === "denies" ? [] : d.chronicItems,
          })
        }
        options={[
          { id: "denies", text: "отрицает" },
          { id: "has", text: "есть" },
        ]}
      />
      {d.chronic === "has" && (
        <PresetPicker
          presets={chronicPresets}
          selected={d.chronicItems}
          onChange={(chronicItems) => patch({ chronicItems })}
        />
      )}
      <ChipRow
        label="операции"
        value={d.surgery}
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
      <ChipRow
        label="аллергия"
        value={d.allergy}
        onChange={(id) => patch({ allergy: id as VitaeDraft["allergy"] })}
        options={[
          { id: "denies", text: "отрицает" },
          { id: "has", text: "есть" },
        ]}
      />
      {d.allergy === "has" && (
        <input
          value={d.allergyText}
          onChange={(e) => patch({ allergyText: e.target.value })}
          placeholder="на что"
          className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
      )}
      <ChipRow
        label="курение"
        value={d.smoke}
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
        onChange={(id) => patch({ alcohol: id as VitaeDraft["alcohol"] })}
        options={[
          { id: "no", text: "отрицает" },
          { id: "yes", text: "употребляет" },
        ]}
      />
      <ChipRow
        label="наследственность"
        value={d.heritage}
        onChange={(id) => patch({ heritage: id as VitaeDraft["heritage"] })}
        options={[
          { id: "clear", text: "не отягощена" },
          { id: "burdened", text: "отягощена" },
        ]}
      />
      {d.heritage === "burdened" && (
        <input
          value={d.heritageText}
          onChange={(e) => patch({ heritageText: e.target.value })}
          placeholder="какое заболевание"
          className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
      )}
      <DoneBar sentence={composeVitae(d)} onDone={() => onMode(false)} />
    </div>
  );
}

export { emptyAnamnesis, emptyVitae, composeAnamnesis, composeVitae };
