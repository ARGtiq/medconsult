import { useMemo, useState, type ReactNode } from "react";
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
import { searchDrugs } from "./live";
import { useAppStore } from "./store";
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
      <div className="text-xs font-semibold text-ink">{label}</div>
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

function FromCard({ label, items }: { label: string; items?: string[] }) {
  const list = (items || []).map((x) => x.trim()).filter(Boolean);
  return (
    <div className="mt-1.5">
      <div className="text-xs font-semibold text-ink">{label} · из карточки</div>
      {list.length ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {list.map((t) => (
            <span
              key={t}
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs ${
                drugMarked(t) ? "bg-teal-soft font-medium text-teal ring-1 ring-teal/70" : "border border-line bg-paper"
              }`}
            >
              {t}
              <InfoDot query={t} />
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-ink-soft">отрицает</div>
      )}
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
  const { session } = useAppStore();
  const ctx = { medications: session.currentMedications, allergies: session.allergies };
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

  return (
    <div>
      <VitaeSection id="development" omitted={omitted("development")} onOmit={setOmit}>
      <ChipRow
        label="развитие"
        value={d.development}
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
      </VitaeSection>
      <VitaeSection id="past" omitted={omitted("past")} onOmit={setOmit}>
      <ChipRow
        label="перенесённые заболевания"
        value={d.pastIllness}
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
      <FromCard label="аллергия" items={session.allergies} />
      </VitaeSection>
      <VitaeSection id="meds" omitted={omitted("meds")} onOmit={setOmit}>
      <FromCard label="принимает постоянно" items={session.currentMedications} />
      </VitaeSection>
      <VitaeSection id="surgery" omitted={omitted("surgery")} onOmit={setOmit}>
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
      </VitaeSection>
      <VitaeSection id="transfusion" omitted={omitted("transfusion")} onOmit={setOmit}>
      <ChipRow
        label="гемотрансфузии"
        value={d.transfusion}
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
