import { Copy } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  COMPLAINTS,
  DRUGS,
  GUIDELINES,
  ICD,
  complaintsForCode,
  guidelineForCode,
  packsForCode,
} from "./data/catalog";
import { AppShell } from "./AppShell";
import { composeAll, composeBlocks, composeHeader, composeHeaderLine } from "./compose";
import { copyText, polishLocal } from "./copy";
import { PlusStudyButton, StudyCard } from "./StudyCard";
import { formatPatient, useAppStore } from "./store";

export function ProtocolPage() {
  const store = useAppStore();
  const { session, settings, patients, setSession, toggleBlock, toggleComplaint, toggleLocal, addRecommendation } =
    store;
  const [mobileTab, setMobileTab] = useState<"build" | "preview">("build");
  const [headerOpen, setHeaderOpen] = useState(false);
  const patient = patients.find((p) => p.id === session.patientId);
  const guideline = guidelineForCode(session.diagnosisCode);
  const packs = packsForCode(session.diagnosisCode);
  const codeComplaints = complaintsForCode(session.diagnosisCode);
  const blocks = useMemo(() => composeBlocks(session), [session]);
  const header = useMemo(() => composeHeader(session, patient), [session, patient]);

  useEffect(() => {
    function copyAll() {
      copyText(composeAll(session, patient, false)).then((ok) =>
        store.setToast(ok ? "В буфере — без шапки" : "Не скопировалось"),
      );
    }
    function copyHeader() {
      copyText(header).then((ok) => store.setToast(ok ? "Шапка в буфере" : "Не скопировалось"));
    }
    function copyBlock() {
      const open = session.openSection;
      const b = blocks.find((x) => x.id === open) || blocks[0];
      if (!b) return;
      copyText(b.text).then((ok) => store.setToast(ok ? `${b.title} в буфере` : "Не скопировалось"));
    }
    window.addEventListener("medconsult-copy-all", copyAll);
    window.addEventListener("medconsult-copy-header", copyHeader);
    window.addEventListener("medconsult-copy-block", copyBlock);
    return () => {
      window.removeEventListener("medconsult-copy-all", copyAll);
      window.removeEventListener("medconsult-copy-header", copyHeader);
      window.removeEventListener("medconsult-copy-block", copyBlock);
    };
  }, [blocks, header, patient, session, store]);

  const showAi = (section: string) => {
    if (settings.aiButton === "off") return false;
    if (settings.aiButton === "always") return true;
    return session.openSection === section;
  };

  function polish(section: "complaints" | "anamnesis" | "recommendations") {
    if (section === "complaints") {
      store.setAiUndo({ section, before: JSON.stringify(session.complaints) });
      store.setSession({ complaints: session.complaints.map(polishLocal) });
    } else if (section === "anamnesis") {
      store.setAiUndo({ section, before: session.anamnesis });
      store.setSession({ anamnesis: polishLocal(session.anamnesis) });
    } else {
      store.setAiUndo({ section, before: JSON.stringify(session.recommendations) });
      store.setSession({ recommendations: session.recommendations.map(polishLocal) });
    }
    store.setToast("AI причесал блок");
  }

  const assembly = (
    <div className="flex flex-col gap-1.5 overflow-auto p-2.5 md:p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold"
          value={session.visitKind}
          onChange={(e) => setSession({ visitKind: e.target.value as "primary" | "followup" })}
        >
          <option value="primary">первичный</option>
          <option value="followup">повторный</option>
        </select>
        <select
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold"
          value={session.mode === "study" ? "study" : "consult"}
          onChange={(e) =>
            setSession({
              mode: e.target.value === "study" ? "study" : session.studies.length ? "consult_study" : "consult",
            })
          }
        >
          <option value="consult">консультация</option>
          <option value="study">исследование</option>
        </select>
        <PlusStudyButton />
        <button type="button" className="ml-auto text-xs font-medium text-teal" onClick={() => store.loadLastForPatient()}>
          Повторить прошлый сеанс
        </button>
      </div>

      <Sec
        id="diagnosis"
        title="Диагноз"
        badge={session.diagnosisCode}
        open={session.openSection === "diagnosis"}
        onOpen={() => setSession({ openSection: session.openSection === "diagnosis" ? null : "diagnosis" })}
        onRemove={() => toggleBlock("diagnosis")}
      >
        <input
          list="icd-list"
          value={session.diagnosisCode}
          onChange={(e) => {
            const hit = ICD.find((i) => i.code === e.target.value);
            setSession({ diagnosisCode: e.target.value, diagnosisTitle: hit?.title || session.diagnosisTitle });
          }}
          className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
          placeholder="Код МКБ"
        />
        <datalist id="icd-list">
          {ICD.map((i) => (
            <option key={i.code} value={i.code}>
              {i.title}
            </option>
          ))}
        </datalist>
        <textarea
          value={session.diagnosisTitle}
          onChange={(e) => setSession({ diagnosisTitle: e.target.value })}
          className="w-full resize-y rounded-md border border-line bg-paper px-2 py-1 text-sm"
          rows={2}
        />
      </Sec>

      {settings.guidelineDisplay === "block" && guideline && (
        <div className="rounded-[10px] border border-line bg-surface px-2.5 py-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">Клинрек {guideline.title}</span>
              {guideline.scenarios.length > 0 && (
                <span className="ml-2 rounded bg-teal-soft px-1.5 text-[11px] font-semibold text-teal">есть сценарии</span>
              )}
            </div>
            <span className="text-[11px] text-mute">не обязательно</span>
          </div>
          {guideline.scenarios.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {guideline.scenarios.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSession({ scenario: s, guidelineId: guideline.id })}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    session.scenario === s ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {guideline.recs.map((r) => (
              <button
                key={r}
                type="button"
                className="rounded-full border border-dashed border-teal/40 px-2 py-0.5 text-xs text-teal"
                onClick={() => addRecommendation(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {settings.guidelineDisplay === "modal" && guideline && <GuidelineModal title={guideline.title} />}

      {session.mode !== "study" && (
        <>
          <Sec
            id="complaints"
            title="Жалобы"
            open={session.openSection === "complaints"}
            onOpen={() => setSession({ openSection: session.openSection === "complaints" ? null : "complaints" })}
            onRemove={() => toggleBlock("complaints")}
            ai={showAi("complaints") ? () => polish("complaints") : undefined}
          >
            <div className="text-[10px] tracking-wide text-mute uppercase">вчерашние</div>
            <Chips texts={store.recentChips} onToggle={toggleComplaint} selected={session.complaints} />
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">по {session.diagnosisCode || "коду"}</div>
            <Chips texts={codeComplaints.map((c) => c.text)} onToggle={toggleComplaint} selected={session.complaints} dashed />
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">весь словарь</div>
            <Chips
              texts={COMPLAINTS.filter((c) => !codeComplaints.includes(c))
                .map((c) => c.text)
                .slice(0, 8)}
              onToggle={toggleComplaint}
              selected={session.complaints}
            />
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">в тексте</div>
            <Chips texts={session.complaints} onToggle={toggleComplaint} selected={session.complaints} filled />
          </Sec>

          <Sec
            id="anamnesis"
            title="Анамнез заболевания"
            open={session.openSection === "anamnesis"}
            onOpen={() => setSession({ openSection: session.openSection === "anamnesis" ? null : "anamnesis" })}
            onRemove={() => toggleBlock("anamnesis")}
            ai={showAi("anamnesis") ? () => polish("anamnesis") : undefined}
          >
            <textarea
              value={session.anamnesis}
              onChange={(e) => setSession({ anamnesis: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
          </Sec>

          {session.visitKind === "primary" && (
            <Sec
              id="anamnesisVitae"
              title="Анамнез жизни"
              open={session.openSection === "anamnesisVitae"}
              onOpen={() => setSession({ openSection: session.openSection === "anamnesisVitae" ? null : "anamnesisVitae" })}
              onRemove={() => toggleBlock("anamnesisVitae")}
            >
              <textarea
                value={session.anamnesisVitae}
                onChange={(e) => setSession({ anamnesisVitae: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
              />
            </Sec>
          )}

          <Sec
            id="status"
            title="Локальный статус"
            badge={packs[0] ? `пакет ${packs[0].label}` : undefined}
            open={session.openSection === "status"}
            onOpen={() => setSession({ openSection: session.openSection === "status" ? null : "status" })}
            onRemove={() => toggleBlock("status")}
          >
            <textarea
              value={session.objective}
              onChange={(e) => setSession({ objective: e.target.value })}
              rows={2}
              className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
              placeholder="Объективный статус"
            />
            {packs.map((p) => (
              <div key={p.id} className="mb-1">
                <div className="text-[10px] text-mute uppercase">{p.label}</div>
                <Chips texts={p.chips} onToggle={toggleLocal} selected={session.localStatus} dashed />
              </div>
            ))}
          </Sec>
        </>
      )}

      {session.studies.map((s) => (
        <StudyCard key={s.key} studyKey={s.key} />
      ))}

      {session.mode !== "study" && (
        <Sec
          id="recommendations"
          title="Назначения"
          open={session.openSection === "recommendations"}
          onOpen={() => setSession({ openSection: session.openSection === "recommendations" ? null : "recommendations" })}
          onRemove={() => toggleBlock("recommendations")}
          ai={showAi("recommendations") ? () => polish("recommendations") : undefined}
        >
          <Chips
            texts={DRUGS.map((d) => `${d.name} ${d.dose}`)}
            onToggle={addRecommendation}
            selected={session.recommendations}
            dashed
          />
          <ul className="mt-2 space-y-1 text-sm">
            {session.recommendations.map((r) => (
              <li key={r} className="flex justify-between gap-2">
                <span>{r}</span>
                <button
                  type="button"
                  className="text-mute"
                  onClick={() => setSession({ recommendations: session.recommendations.filter((x) => x !== r) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </Sec>
      )}
    </div>
  );

  const preview = (
    <div className="flex h-full flex-col gap-1.5 bg-preview p-2.5 md:p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="min-w-0 flex-1 text-[10px] font-semibold tracking-wide text-ink-soft uppercase">В Медлок / Word</h3>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
          onClick={() => {
            store.setAiUndo({ section: "anamnesis", before: session.anamnesis });
            setSession({ anamnesis: polishLocal(session.anamnesis) });
            store.setToast("AI причесал текст");
          }}
        >
          Причесать всё
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-paper whitespace-nowrap"
          onClick={() =>
            copyText(composeAll(session, patient, false)).then((ok) =>
              store.setToast(ok ? "В буфере — без шапки" : "Не скопировалось"),
            )
          }
        >
          Копировать всё
        </button>
      </div>
      <p className="text-[11px] text-mute">Блок: Ctrl+Shift+C · шапка: Ctrl+Shift+H · всё: Ctrl+Enter · AI: Ctrl+Z</p>

      <div className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 py-2 text-sm">
        <button type="button" onClick={() => setHeaderOpen((v) => !v)} className="text-mute">
          {headerOpen ? "▾" : "▸"}
        </button>
        <span className="min-w-0 flex-1 truncate font-semibold text-teal">
          {composeHeaderLine(session, patient).split("  ")[0]}
        </span>
        <span className="hidden shrink-0 font-semibold sm:inline">
          {patient ? `${formatPatient(patient)}, ${patient.age}` : ""}
        </span>
        <button
          type="button"
          title="Копировать шапку"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-paper px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
          onClick={() => copyText(header).then((ok) => store.setToast(ok ? "Шапка в буфере" : "Не скопировалось"))}
        >
          <Copy className="size-3" /> шапка
        </button>
      </div>
      {headerOpen && (
        <textarea
          value={session.headerOverride || header}
          onChange={(e) => setSession({ headerOverride: e.target.value })}
          rows={3}
          className="rounded-[10px] border border-line bg-surface px-2.5 py-2 text-sm"
        />
      )}

      {store.aiUndo && (
        <div className="flex items-center gap-2 rounded-lg border border-warn-line bg-warn px-2 py-1.5 text-xs">
          <span>
            <b>AI причесал блок.</b> Если криво — верни как было.
          </span>
          <button type="button" className="ml-auto rounded border border-line bg-surface px-2 py-1" onClick={() => store.undoAi()}>
            Отменить
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pb-16 md:pb-2">
        {blocks.map((b) => (
          <article key={b.id} className="rounded-[10px] border border-line bg-surface px-2.5 py-2">
            <header className="mb-1 flex flex-nowrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-wide text-mute uppercase">
                {b.n} · {b.title}
              </span>
              <button
                type="button"
                title="Копировать блок"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-ink-soft"
                onClick={() => copyText(b.text).then((ok) => store.setToast(ok ? `${b.title} в буфере` : "Не скопировалось"))}
              >
                <Copy className="size-3.5" />
              </button>
            </header>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{b.text}</p>
          </article>
        ))}
        {blocks.length === 0 && (
          <p className="p-6 text-center text-sm text-mute">Пустые блоки в буфер не едут. Натыкайте слева.</p>
        )}
      </div>
    </div>
  );

  return (
    <AppShell
      topRight={
        <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => store.saveVisit()}>
          Сохранить в историю
        </button>
      }
    >
      <div className="border-b border-line bg-surface px-2 md:hidden">
        <div className="flex">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold ${mobileTab === "build" ? "border-b-2 border-teal text-teal" : "text-ink-soft"}`}
            onClick={() => setMobileTab("build")}
          >
            Сборка
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold ${mobileTab === "preview" ? "border-b-2 border-teal text-teal" : "text-ink-soft"}`}
            onClick={() => setMobileTab("preview")}
          >
            В Медлок
          </button>
        </div>
      </div>
      <div className="grid min-h-[calc(100dvh-3rem)] grid-cols-1 pb-16 md:grid-cols-[minmax(280px,420px)_1fr] md:pb-0">
        <div className={`min-h-0 border-r border-line ${mobileTab === "build" ? "block" : "hidden md:block"}`}>{assembly}</div>
        <div className={`min-h-0 ${mobileTab === "preview" ? "block" : "hidden md:block"}`}>{preview}</div>
      </div>
    </AppShell>
  );
}

function Chips({
  texts,
  onToggle,
  selected,
  dashed,
  filled,
}: {
  texts: string[];
  onToggle: (t: string) => void;
  selected: string[];
  dashed?: boolean;
  filled?: boolean;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {texts.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={`rounded-full px-2 py-0.5 text-xs ${
              filled || on
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

function Sec({
  id,
  title,
  badge,
  open,
  onOpen,
  onRemove,
  ai,
  children,
}: {
  id: string;
  title: string;
  badge?: string;
  open: boolean;
  onOpen: () => void;
  onRemove: () => void;
  ai?: () => void;
  children?: ReactNode;
}) {
  const hidden = useAppStore((s) => s.session.hiddenBlocks.includes(id));
  if (hidden) return null;
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
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 text-left">
        <h4 className="text-sm font-medium">{title}</h4>
        {badge && <span className="rounded bg-teal-soft px-1.5 text-[11px] font-semibold text-teal">{badge}</span>}
        {ai && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              ai();
            }}
            className="ml-auto rounded-md border border-ai-line bg-ai px-2 py-0.5 text-[11px] font-medium"
          >
            AI · причесать
          </span>
        )}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

function GuidelineModal({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const g = GUIDELINES.find((x) => x.title === title);
  const addRecommendation = useAppStore((s) => s.addRecommendation);
  return (
    <>
      <button type="button" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" onClick={() => setOpen(true)}>
        Клинрек {title} — открыть окно
      </button>
      {open && g && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg">{g.title}</h3>
            <div className="mt-3 flex flex-wrap gap-1">
              {g.recs.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="rounded-full bg-teal-soft px-2 py-1 text-xs text-teal"
                  onClick={() => addRecommendation(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <button type="button" className="mt-4 text-sm text-mute" onClick={() => setOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
}
