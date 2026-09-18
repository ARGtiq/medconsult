import { Info, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { lookupDrug, type DrugCardInfo } from "./drugLookup";
import { useAppStore } from "./store";

export function InfoDot({ query, className = "" }: { query: string; className?: string }) {
  if (!lookupDrug(query)) return null;
  return (
    <button
      type="button"
      title="карточка препарата"
      aria-label={`о препарате ${query}`}
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-teal text-paper ${className}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        useAppStore.getState().openDrugInfo(query);
      }}
    >
      <Info className="size-2.5" strokeWidth={2.5} />
    </button>
  );
}

export function drugMarked(text: string) {
  return Boolean(lookupDrug(text));
}

function Row({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  if (!value?.trim()) return null;
  return (
    <div className={`rounded-md px-2 py-1.5 ${warn ? "bg-warn" : "bg-paper"}`}>
      <div className="text-[10px] tracking-wide text-mute uppercase">{label}</div>
      <div className="text-sm leading-relaxed">{value}</div>
    </div>
  );
}

function Card({ info }: { info: DrugCardInfo }) {
  const dose = [info.dosage, info.frequency, info.duration].filter(Boolean).join(" · ");
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {info.inDatabase ? (
          <span className="rounded-full bg-teal px-2 py-0.5 text-[10px] font-semibold text-paper">в базе</span>
        ) : (
          <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[10px] font-semibold text-teal">
            справочник
          </span>
        )}
        {info.group ? <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[10px] text-teal">{info.group}</span> : null}
      </div>
      <Row label="доза / схема" value={dose} />
      <Row label="торговые названия" value={info.brandNames} />
      <Row label="МКБ-10" value={info.mkb10Codes} />
      <Row label="примечание" value={info.note} />
      <Row label="мониторинг" value={info.monitoring} warn />
      <Row label="противопоказания" value={info.contraindications} warn />
      <Row label="побочные" value={info.sideEffects} />
      <Row label="взаимодействия" value={info.interactions} />
      <Row label="перекрёстная аллергия" value={info.crossAllergyNote} warn />
      {info.evidenceLevel ? <Row label="доказательность" value={info.evidenceLevel} /> : null}
    </div>
  );
}

export function DrugInfoModal() {
  const query = useAppStore((s) => s.drugInfoQuery);
  const close = useAppStore((s) => s.closeDrugInfo);
  const info = query ? lookupDrug(query) : null;

  useEffect(() => {
    if (!query) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [query, close]);

  if (!query || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drug-info-title"
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-xl border border-line bg-surface p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-wide text-mute uppercase">препарат</div>
            <h3 id="drug-info-title" className="font-display text-lg leading-tight">
              {info?.name || query}
            </h3>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex size-8 items-center justify-center rounded-md text-mute hover:bg-paper"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>
        {info ? (
          <Card info={info} />
        ) : (
          <p className="text-sm text-ink-soft">В базе и справочнике ничего нет — только название.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
