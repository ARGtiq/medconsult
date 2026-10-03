import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import RecPackSearch from "@/legacy/components/RecPackSearch";
import VoiceInputButton from "@/legacy/components/VoiceInputButton";
import { EditableChips, ParenText, ToggleChips } from "./EditableChip";
import { analogsOf, DEFAULT_DRUG_FORM, dosesForDrug, extraOfLine, formatDrugMention, liveDrugRecords, liveGeneralRecs, parseDrugLine, searchDrugs, studyDrugHints, variantsOf } from "./live";
import { Typeahead, type TypeaheadItem } from "./Typeahead";
import { useAppStore } from "./store";
import type { SessionState } from "./types";

export function StudyDrugHints({
  studies,
  selected,
  onAdd,
}: {
  studies: SessionState["studies"];
  selected: string[];
  onAdd: (line: string) => void;
}) {
  const hints = useMemo(() => studyDrugHints(studies), [studies]);
  const visible = hints.filter((h) => !selected.some((s) => s === h.line || s.toLowerCase().startsWith(h.name.toLowerCase())));
  if (!visible.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] tracking-wide text-mute uppercase">по результатам</div>
      <div className="mt-1 flex flex-col gap-1">
        {visible.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onAdd(h.line)}
            className="rounded-lg border border-dashed border-teal/40 bg-paper px-2 py-1 text-left text-xs text-teal"
          >
            <span className="font-medium">
              <ParenText text={h.line} />
            </span>
            <span className="mt-0.5 block text-[10px] text-mute">{h.why}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function courseText(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d+$/.test(t)) return `${t} дн`;
  return t;
}

function DrugSearch({
  diagnosisCode,
  diagnosisTitle,
  selected,
  onAdd,
}: {
  diagnosisCode: string;
  diagnosisTitle: string;
  selected: string[];
  onAdd: (line: string) => void;
}) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [brand, setBrand] = useState("");
  const [frequency, setFrequency] = useState("");
  const [days, setDays] = useState("");
  const [focusDose, setFocusDose] = useState(0);
  const [focusName, setFocusName] = useState(0);
  const [genOpen, setGenOpen] = useState(false);
  const doseRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchDrugs(q, diagnosisCode), [q, diagnosisCode]);
  const items = useMemo(() => {
    const out: TypeaheadItem[] = [];
    const qn = q.trim().toLowerCase();
    if (qn.length >= 2) {
      for (const r of liveGeneralRecs()) {
        if (selected.includes(r.text)) continue;
        const blob = `${r.title}\n${r.text}\n${r.note}\n${r.category}`.toLowerCase();
        if (!blob.includes(qn)) continue;
        const head = r.title || r.text;
        out.push({
          id: `gen:${r.id}`,
          label: head,
          hint: r.category || "общая",
          detail: r.title ? r.text.split("\n").map((s) => s.trim()).filter(Boolean)[0] : undefined,
          note: r.note || undefined,
          name: r.text,
        });
      }
    }
    for (const h of hits) {
      const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === h.name.toLowerCase());
      const vars = variantsOf(h.name);
      const mention = formatDrugMention({
        name: h.name,
        form: rec?.form || DEFAULT_DRUG_FORM,
        brandNames: rec?.brandNames,
        composition: rec?.composition,
      });
      const primary = vars[0];
      const one = vars.length <= 1;
      const full = formatDrugMention({
        name: h.name,
        form: rec?.form || DEFAULT_DRUG_FORM,
        brandNames: rec?.brandNames,
        composition: rec?.composition,
        dosage: one ? primary?.dosage : "",
        frequency: one ? primary?.frequency : "",
        duration: one ? primary?.duration : "",
      }).text;
      if (one && selected.includes(full)) continue;
      out.push({
        id: `${h.name}|${h.via}`,
        label: mention.text,
        detail:
          vars.length > 1
            ? "несколько доз"
            : [primary?.dosage, primary?.frequency, primary?.duration].filter(Boolean).join(" · ") || undefined,
        hint: h.via,
        note: (rec?.extra || "").trim() || undefined,
        name: h.name,
      });
    }
    return out;
  }, [hits, selected, q]);
  const doses = useMemo(() => dosesForDrug(name), [name]);
  const brandOptions = useMemo(() => {
    const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
    return (rec?.brandNames || "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [name]);
  const generalGroups = useMemo(() => {
    const code = diagnosisCode.trim().toUpperCase();
    const stem = code.split(".")[0];
    const title = diagnosisTitle.trim().toLowerCase();
    const rows = liveGeneralRecs().filter((r) => {
      if (selected.includes(r.text)) return false;
      const note = r.note.trim();
      const noteL = note.toLowerCase();
      const noteU = note.toUpperCase();
      if (note && code && (noteU.includes(code) || (stem.length >= 3 && noteU.includes(stem)))) return true;
      if (note && title.length >= 4 && (noteL.includes(title) || (noteL.length >= 4 && title.includes(noteL)))) return true;
      if (!r.mkb10Codes.length) return true;
      if (!code) return false;
      return r.mkb10Codes.some((c) => code === c || code.startsWith(`${c}.`) || code.startsWith(c));
    });
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.category || "без категории";
      const list = groups.get(key) || [];
      list.push(r);
      groups.set(key, list);
    }
    return [...groups.keys()]
      .sort((a, b) => (a === "без категории" ? 1 : b === "без категории" ? -1 : a.localeCompare(b, "ru")))
      .map((name) => ({ name, rows: groups.get(name) || [] }));
  }, [diagnosisCode, diagnosisTitle, selected]);
  const loadedExtra = useMemo(() => {
    const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
    return (rec?.extra || "").trim();
  }, [name]);

  useEffect(() => {
    if (!focusDose) return;
    doseRef.current?.focus();
    doseRef.current?.select();
  }, [focusDose]);

  function reset() {
    setQ("");
    setName("");
    setDosage("");
    setBrand("");
    setFrequency("");
    setDays("");
    setFocusName((n) => n + 1);
  }

  function lineFor(drugName: string, extra?: { form?: string; brand?: string; dosage?: string; frequency?: string; duration?: string }) {
    const drug = drugName.trim();
    if (!drug) return "";
    const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === drug.toLowerCase());
    const picked = (extra?.brand ?? "").trim();
    return formatDrugMention({
      name: drug,
      form: (rec?.form || DEFAULT_DRUG_FORM).trim(),
      brandNames: picked || rec?.brandNames,
      composition: rec?.composition,
      dosage: extra?.dosage,
      frequency: extra?.frequency,
      duration: extra?.duration,
    }).text;
  }

  function insertNow(drugName: string) {
    const v = variantsOf(drugName)[0];
    const line = lineFor(drugName, {
      dosage: v?.dosage,
      frequency: v?.frequency,
      duration: v?.duration,
    });
    if (!line) return;
    onAdd(line);
    reset();
  }

  function load(drugName: string) {
    const vars = variantsOf(drugName);
    const only = vars.length === 1 ? vars[0] : undefined;
    setName(drugName);
    setQ(drugName);
    setBrand("");
    setDosage(only?.dosage || "");
    setFrequency(only?.frequency || "");
    setDays(only?.duration || "");
    setFocusDose((n) => n + 1);
  }

  function commit() {
    const drug = (name || q).trim();
    const line = lineFor(drug, {
      brand,
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      duration: courseText(days),
    });
    if (!line) return;
    onAdd(line);
    reset();
  }

  function onDose(v: string) {
    setDosage(v);
    const matches = variantsOf(name).filter((x) => x.dosage === v);
    if (matches.length === 1) {
      if (matches[0].frequency) setFrequency(matches[0].frequency);
      if (matches[0].duration) setDays(matches[0].duration);
    }
  }

  function onFieldKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  const field = "w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm";

  return (
    <div className="mt-1">
      <div className={name ? "grid grid-cols-2 gap-1.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,0.7fr)_minmax(6rem,0.8fr)_minmax(6rem,0.8fr)_4.2rem]" : ""}>
        <Typeahead
          value={q}
          onChange={(v) => {
            setQ(v);
            if (v.trim().toLowerCase() !== name.trim().toLowerCase()) setName("");
          }}
          items={items}
          clearOnPick={false}
          focusNonce={focusName}
          onPick={(it, how) => {
            if (String(it.id).startsWith("gen:")) {
              onAdd(it.name || it.label);
              reset();
              return;
            }
            const drug = it.name || it.label;
            const typed = q.trim().toLowerCase();
            const drugL = drug.toLowerCase();
            const labelL = it.label.toLowerCase();
            const noteL = (it.note || "").toLowerCase();
            const rowMatches = !typed || drugL.includes(typed) || labelL.includes(typed) || noteL.includes(typed);
            if (how === "enter" && !rowMatches) {
              if (typed) onAdd(q.trim());
              reset();
              return;
            }
            if (how === "enter") insertNow(drug);
            else load(drug);
          }}
          onSubmitCustom={(raw) => {
            const drug = raw.trim();
            const known = liveDrugRecords().some((d) => d.name.toLowerCase() === drug.toLowerCase());
            if (known) insertNow(drug);
            else {
              if (drug) onAdd(drug);
              reset();
            }
          }}
          placeholder={name ? "МНН" : "Общая рекомендация или лекарство"}
          emptyHint="Enter — вставить текст"
          wrapLabels
        />
        {name ? (
          <>
        <input
          ref={doseRef}
          value={dosage}
          onChange={(e) => onDose(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="доза"
          aria-label="Доза"
          list={doses.length ? "rx-dose-list" : undefined}
          className={field}
          autoComplete="off"
        />
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="торговое"
          aria-label="Торговое название"
          list={brandOptions.length ? "rx-brand-list" : undefined}
          className={field}
          autoComplete="off"
        />
        <input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="кратность"
          aria-label="Кратность"
          className={field}
          autoComplete="off"
        />
        <input
          value={days}
          onChange={(e) => setDays(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="курс"
          aria-label="Курс"
          className={field}
          autoComplete="off"
        />
          </>
        ) : null}
      </div>
      {name && loadedExtra ? <p className="mt-1 text-[10px] leading-snug text-mute">{loadedExtra}</p> : null}
      {doses.length > 0 && (
        <datalist id="rx-dose-list">
          {doses.map((d) => (
            <option key={d.value} value={d.value} label={d.label} />
          ))}
        </datalist>
      )}
      {brandOptions.length > 0 && (
        <datalist id="rx-brand-list">
          {brandOptions.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      )}
      {name && doses.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {doses.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onDose(d.value)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                dosage === d.value ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
            >
              {d.value}
            </button>
          ))}
        </div>
      )}
      {name && brandOptions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {brandOptions.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(brand === b ? "" : b)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                brand === b ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
      {!name && !q.trim() && generalGroups.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setGenOpen((v) => !v)}
            className="text-[10px] tracking-wide text-mute uppercase"
          >
            {genOpen ? "▾" : "▸"} общие
          </button>
          {genOpen &&
            generalGroups.map((group) => (
              <div key={group.name} className="mt-1">
                <div className="text-[10px] text-mute">{group.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {group.rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={[r.title ? r.text : "", r.note].filter(Boolean).join("\n") || undefined}
                      onClick={() => onAdd(r.text)}
                      className="max-w-full rounded-full border border-dashed border-teal/40 bg-surface px-2 py-0.5 text-left text-xs text-teal"
                    >
                      <span className={r.title ? "" : "line-clamp-4 whitespace-pre-wrap"}>{r.title || r.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      {!name && (
        <p className="mt-1.5 text-xs text-mute">
          Общая фраза — напишите и Enter, поле останется одним. Лекарство из списка: клик или Tab — доза, торговое, кратность и курс. Пустое торговое — все названия в скобках.
        </p>
      )}
      {!q.trim() && !!diagnosisCode && hits.length > 0 && (
        <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">по диагнозу {diagnosisCode} — стрелки и Enter</div>
      )}
    </div>
  );
}

function DrugLineEditor({
  line,
  onSave,
  onCancel,
}: {
  line: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const parsed = parseDrugLine(line);
  const [name] = useState(parsed?.name || "");
  const [dosage, setDosage] = useState(parsed?.dosage || "");
  const [brand, setBrand] = useState(parsed?.brand || "");
  const [frequency, setFrequency] = useState(parsed?.frequency || "");
  const [days, setDays] = useState(parsed?.duration || "");
  const doseRef = useRef<HTMLInputElement>(null);
  const doses = useMemo(() => dosesForDrug(name), [name]);
  const brandOptions = useMemo(() => {
    const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
    return (rec?.brandNames || "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [name]);

  useEffect(() => {
    doseRef.current?.focus();
    doseRef.current?.select();
  }, []);

  if (!parsed) return null;

  function onDose(v: string) {
    setDosage(v);
    const matches = variantsOf(name).filter((x) => x.dosage === v);
    if (matches.length === 1) {
      if (matches[0].frequency) setFrequency(matches[0].frequency);
      if (matches[0].duration) setDays(matches[0].duration);
    }
  }

  function commit() {
    const rec = liveDrugRecords().find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
    const picked = brand.trim();
    const next = formatDrugMention({
      name: name.trim(),
      form: (rec?.form || DEFAULT_DRUG_FORM).trim(),
      brandNames: picked || rec?.brandNames,
      composition: rec?.composition,
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      duration: courseText(days),
    }).text;
    if (next) onSave(next);
  }

  function onFieldKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") onCancel();
  }

  const field = "w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm";

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,0.7fr)_minmax(6rem,0.8fr)_minmax(6rem,0.8fr)_4.2rem]">
        <div className="flex items-center rounded-md border border-line bg-paper px-2 py-1.5 text-sm">{name}</div>
        <input
          ref={doseRef}
          value={dosage}
          onChange={(e) => onDose(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="доза"
          aria-label="Доза"
          list={doses.length ? "rx-line-dose" : undefined}
          className={field}
          autoComplete="off"
        />
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="торговое"
          aria-label="Торговое название"
          list={brandOptions.length ? "rx-line-brand" : undefined}
          className={field}
          autoComplete="off"
        />
        <input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="кратность"
          aria-label="Кратность"
          className={field}
          autoComplete="off"
        />
        <input
          value={days}
          onChange={(e) => setDays(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="курс"
          aria-label="Курс"
          className={field}
          autoComplete="off"
        />
      </div>
      {doses.length > 0 && (
        <datalist id="rx-line-dose">
          {doses.map((d) => (
            <option key={d.value} value={d.value} label={d.label} />
          ))}
        </datalist>
      )}
      {brandOptions.length > 0 && (
        <datalist id="rx-line-brand">
          {brandOptions.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      )}
      {doses.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {doses.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onDose(d.value)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                dosage === d.value ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
            >
              {d.value}
            </button>
          ))}
        </div>
      )}
      {brandOptions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {brandOptions.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(brand === b ? "" : b)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                brand === b ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 flex gap-2">
        <button type="button" className="text-[11px] font-medium text-teal" onClick={commit}>
          записать
        </button>
        <button type="button" className="text-[11px] text-mute" onClick={onCancel}>
          отмена
        </button>
      </div>
    </div>
  );
}

export function Sec({
  id,
  title,
  badge,
  open,
  onOpen,
  onRemove,
  ai,
  voice,
  children,
}: {
  id: string;
  title: string;
  badge?: string;
  open: boolean;
  onOpen: () => void;
  onRemove: () => void;
  ai?: () => void;
  voice?: (text: string) => void;
  children?: ReactNode;
}) {
  const hidden = useAppStore((s) => s.session.hiddenBlocks.includes(id));
  const spoiler = useAppStore((s) => s.settings.blocksAsSpoiler);
  if (hidden) return null;
  const shown = !spoiler || open;
  return (
    <section
      className={`relative rounded-[10px] border bg-surface py-2 pr-8 pl-2.5 ${
        open ? "border-teal/40 shadow-[0_0_0_3px_var(--color-teal-soft)]" : "border-line"
      }`}
    >
      <button
        type="button"
        className="absolute top-1.5 right-1.5 flex size-[18px] items-center justify-center rounded bg-danger-soft text-xs font-bold text-danger"
        onClick={onRemove}
        aria-label="Убрать блок"
      >
        ×
      </button>
      <div className="flex items-center gap-2 pr-1">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <h4 className="text-sm font-medium">{title}</h4>
          {badge && <span className="rounded bg-teal-soft px-1.5 text-[11px] font-semibold text-teal">{badge}</span>}
        </button>
        <span className="flex shrink-0 items-center gap-1">
          {voice && (
            <span className="legacy-surface">
              <VoiceInputButton onResult={voice} />
            </span>
          )}
          {ai && (
            <button
              type="button"
              onClick={ai}
              className="rounded-md border border-ai-line bg-ai px-2 py-0.5 text-[11px] font-medium"
            >
              AI · причесать
            </button>
          )}
        </span>
      </div>
      {shown && <div className="mt-2">{children}</div>}
    </section>
  );
}

export function RecommendationsBlock({
  showRecs,
  session,
  setSession,
  toggleBlock,
  showAi,
  polish,
  fromPractice,
  addRecommendation,
  hubMode,
  klinrekPanel,
  diagnosisText,
  ixBusy,
  runInteractions,
  ixText,
}: {
  showRecs: boolean;
  session: SessionState;
  setSession: (patch: Partial<SessionState>) => void;
  toggleBlock: (id: string) => void;
  showAi: (section: string) => boolean;
  polish: (section: "complaints" | "anamnesis" | "recommendations" | "all") => void;
  fromPractice: { label: string; line: string }[];
  addRecommendation: (line: string) => void;
  hubMode: string;
  klinrekPanel: (slot: "complaints" | "diagnosis" | "studies" | "recs" | "sheet", bare?: boolean) => ReactNode;
  diagnosisText: string;
  ixBusy: boolean;
  runInteractions: () => void;
  ixText: string | null;
}) {
  const store = useAppStore();
  useEffect(() => {
    const g = (session.generalRecs || "").trim();
    if (!g) return;
    const extra = g.split("\n").map((s) => s.trim()).filter(Boolean);
    const have = new Set(session.recommendations);
    const head = extra.filter((l) => !have.has(l));
    setSession({ generalRecs: "", recommendations: [...head, ...session.recommendations] });
  }, [session.generalRecs, session.recommendations, setSession]);
  if (!showRecs) return null;
  return (
    <Sec
      id="recommendations"
      title="Назначения"
      open={session.openSection === "recommendations"}
      onOpen={() => setSession({ openSection: session.openSection === "recommendations" ? null : "recommendations" })}
      onRemove={() => toggleBlock("recommendations")}
      ai={showAi("recommendations") ? () => polish("recommendations") : undefined}
    >
      {fromPractice.length > 0 && (
        <>
          <div className="text-[10px] tracking-wide text-mute uppercase">из практики</div>
          <ToggleChips
            texts={fromPractice.map((p) => p.label)}
            values={fromPractice.map((p) => p.line)}
            onToggle={addRecommendation}
            selected={session.recommendations}
            dashed
          />
        </>
      )}
      <DrugSearch
        diagnosisCode={session.diagnosisCode}
        diagnosisTitle={session.diagnosisTitle}
        selected={session.recommendations}
        onAdd={addRecommendation}
      />
      <StudyDrugHints studies={session.studies} selected={session.recommendations} onAdd={addRecommendation} />
      {session.recommendations.length > 0 && (
        <>
          <div className="mt-2 text-[10px] tracking-wide text-mute uppercase">в тексте · клик — править · ⋮⋮ перетащить</div>
          <EditableChips
            lines
            removable
            reorder
            markParen
            items={session.recommendations}
            onChange={(next) => store.renameList("recommendations", next)}
            analogsOf={(line) => analogsOf(line).map((a) => a.line)}
            noteOf={extraOfLine}
            editNode={(index, line, close) =>
              parseDrugLine(line) ? (
                <DrugLineEditor
                  line={line}
                  onSave={(next) => {
                    const copy = [...session.recommendations];
                    copy[index] = next;
                    store.renameList("recommendations", copy);
                    close();
                  }}
                  onCancel={close}
                />
              ) : null
            }
            onInsertAfter={(index, line) => {
              const rest = session.recommendations.filter((item, i) => i !== index && item !== line);
              rest.splice(Math.min(index, rest.length), 0, line);
              store.renameList("recommendations", rest);
            }}
          />
        </>
      )}
      {session.diagnosisCode && hubMode === "block" && (
        <div className="legacy-surface klinrek-slot mt-2">{klinrekPanel("recs")}</div>
      )}
      <div className="legacy-surface mt-2 flex flex-wrap items-start gap-2">
        <RecPackSearch
          diagnosisText={diagnosisText}
          onApply={(lines: string[]) => {
            lines.forEach((line) => {
              if (line && !session.recommendations.includes(line)) addRecommendation(line);
            });
            store.setToast("Пакет добавлен");
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="rounded-md border border-ai-line bg-ai px-2 py-1 text-[11px] font-medium"
          onClick={runInteractions}
          disabled={ixBusy}
        >
          {ixBusy ? "Проверяю…" : "AI · взаимодействия"}
        </button>
      </div>
      {ixText && (
        <div className="mt-2 whitespace-pre-wrap rounded-md border border-ai-line bg-ai px-2 py-1.5 text-xs">
          {ixText}
        </div>
      )}
    </Sec>
  );
}
