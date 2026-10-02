import { useMemo, useState, type ReactNode } from "react";
import RecPackSearch from "@/legacy/components/RecPackSearch";
import VoiceInputButton from "@/legacy/components/VoiceInputButton";
import { EditableChips, ToggleChips } from "./EditableChip";
import { searchDrugs, studyDrugHints } from "./live";
import { Typeahead } from "./Typeahead";
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
            <span className="font-medium">{h.line}</span>
            <span className="mt-0.5 block text-[10px] text-mute">{h.why}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DrugSearch({
  diagnosisCode,
  selected,
  onAdd,
}: {
  diagnosisCode: string;
  selected: string[];
  onAdd: (line: string) => void;
}) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchDrugs(q, diagnosisCode), [q, diagnosisCode]);
  const items = hits
    .filter((h) => !selected.includes(h.line))
    .map((h) => ({ id: h.name + h.via + h.line, label: h.line, hint: h.hint || h.via, name: h.name }));

  return (
    <div className="mt-1">
      <Typeahead
        value={q}
        onChange={setQ}
        items={items}
        onPick={(it) => onAdd(it.label)}
        onSubmitCustom={(raw) => onAdd(raw)}
        placeholder="ДВ, торговое, группа, МКБ…  ↑↓ Enter"
        emptyHint="Нет в справочнике. Enter — вставить как есть. i — карточка, если в базе"
      />
      {!q.trim() && !diagnosisCode && (
        <p className="mt-1.5 text-xs text-mute">
          Справочник не вываливается целиком. Найди препарат или поставь диагноз — подтянутся схема и клинрек.
        </p>
      )}
      {!q.trim() && !!diagnosisCode && hits.length > 0 && (
        <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">по диагнозу {diagnosisCode} — стрелки и Enter</div>
      )}
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
  fromPractice: string[];
  addRecommendation: (line: string) => void;
  hubMode: string;
  klinrekPanel: (slot: "complaints" | "diagnosis" | "studies" | "recs" | "sheet", bare?: boolean) => ReactNode;
  diagnosisText: string;
  ixBusy: boolean;
  runInteractions: () => void;
  ixText: string | null;
}) {
  const store = useAppStore();
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
          <ToggleChips texts={fromPractice} onToggle={addRecommendation} selected={session.recommendations} dashed />
        </>
      )}
      <DrugSearch
        diagnosisCode={session.diagnosisCode}
        selected={session.recommendations}
        onAdd={addRecommendation}
      />
      <StudyDrugHints studies={session.studies} selected={session.recommendations} onAdd={addRecommendation} />
      {session.recommendations.length > 0 && (
        <>
          <div className="mt-2 text-[10px] tracking-wide text-mute uppercase">в тексте · клик — править</div>
          <EditableChips
            lines
            removable
            items={session.recommendations}
            onChange={(next) => store.renameList("recommendations", next)}
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
