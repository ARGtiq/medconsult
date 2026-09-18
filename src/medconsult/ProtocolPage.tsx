import { Copy, Plus, Printer } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import GuidelinePanel from "@/legacy/components/GuidelinePanel";
import TreatmentSchemeSearch from "@/legacy/components/TreatmentSchemeSearch";
import VoiceInputButton from "@/legacy/components/VoiceInputButton";
import { checkDrugInteractions, hasApiKey, polishNarrative } from "@/legacy/lib/openrouter";
import { escapeHtml, printHtml } from "@/legacy/lib/print";
import { getGuidelineHubMode } from "@/legacy/lib/uiPrefs";
import { PlusDocBlockButton } from "./DocBlocks";
import { EditableChips, ToggleChips } from "./EditableChip";
import { packsForCodeLive, useTemplates } from "./data/templates";
import { AppShell } from "./AppShell";
import { composeAll, composeBlocks, composeHeader, composeHeaderLine } from "./compose";
import { copyText, polishLocal } from "./copy";
import {
  compactGuideline,
  complaintsForSession,
  drugLine,
  learnedDrugs,
  liveComplaints,
  liveIcdMerged,
  searchDrugs,
} from "./live";
import { AnamnesisDisease, AnamnesisVitae } from "./AnamnesisBuilders";
import { composeAnamnesis, composeVitae, emptyAnamnesis, emptyVitae } from "./anamnesisChips";
import { PlusStudyButton, StudyCard } from "./StudyCard";
import { Typeahead } from "./Typeahead";
import { formatPatient, useAppStore, workKindOf } from "./store";

export function ProtocolPage() {
  const store = useAppStore();
  const { session, settings, patients, setSession, toggleBlock, toggleComplaint, toggleLocal, addRecommendation } =
    store;
  const templates = useTemplates();
  const [mobileTab, setMobileTab] = useState<"build" | "preview">("build");
  const [headerOpen, setHeaderOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [ixText, setIxText] = useState<string | null>(null);
  const [ixBusy, setIxBusy] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [complaintQ, setComplaintQ] = useState("");
  const [localQ, setLocalQ] = useState("");
  const [localAdd, setLocalAdd] = useState(false);
  const patient = patients.find((p) => p.id === session.patientId);
  const guideline = compactGuideline(session.diagnosisCode);
  const packs = useMemo(
    () => packsForCodeLive(session.diagnosisCode),
    [session.diagnosisCode, templates.localPacks],
  );
  const chips = complaintsForSession(session.diagnosisCode);
  const icd = liveIcdMerged();
  const fromPractice = learnedDrugs(session.complaints, session.diagnosisCode);
  const work = workKindOf(session);
  const consult = session.mode === "consult" || session.mode === "consult_study";
  const documentMode = session.mode === "document";
  const want = (id: string) => consult || (documentMode && (session.docStd || []).includes(id));
  const hubMode = getGuidelineHubMode() === "modal" || settings.guidelineDisplay === "modal" ? "modal" : "block";
  const blocks = useMemo(() => composeBlocks(session, patient), [session, patient]);
  const header = useMemo(() => composeHeader(session, patient), [session, patient]);
  const diagnosisText = [session.diagnosisCode, session.diagnosisTitle].filter(Boolean).join(" ");

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

  useEffect(() => {
    if (!session.diagnosisCode) return;
    if (session.localStatusAutoFor === session.diagnosisCode) return;
    store.applyLocalFromIcd(session.diagnosisCode);
  }, [session.diagnosisCode, session.localStatusAutoFor, store]);

  const showAi = (section: string) => {
    if (settings.aiButton === "off") return false;
    if (settings.aiButton === "always") return true;
    return session.openSection === section;
  };

  async function polish(section: "complaints" | "anamnesis" | "recommendations" | "all") {
    setAiBusy(true);
    try {
      if (section === "complaints") {
        store.setAiUndo({ section, before: JSON.stringify(session.complaints) });
        const src = session.complaints.join(", ");
        const next = hasApiKey() ? await polishNarrative(src) : polishLocal(src);
        store.setSession({ complaints: next.split(/,\s*/).map((s) => s.trim()).filter(Boolean) });
      } else if (section === "anamnesis") {
        store.setAiUndo({ section, before: session.anamnesis });
        const next = hasApiKey() ? await polishNarrative(session.anamnesis) : polishLocal(session.anamnesis);
        store.setSession({ anamnesis: next });
      } else if (section === "recommendations") {
        store.setAiUndo({ section, before: JSON.stringify(session.recommendations) });
        const src = session.recommendations.join(". ");
        const next = hasApiKey() ? await polishNarrative(src) : polishLocal(src);
        store.setSession({
          recommendations: next
            .split(/[.;]\s+/)
            .map((s) => s.trim())
            .filter(Boolean),
        });
      } else {
        store.setAiUndo({ section: "anamnesis", before: session.anamnesis });
        const body = composeAll(session, patient, false);
        if (hasApiKey()) {
          const next = await polishNarrative(body);
          store.setSession({ notes: next });
        } else {
          store.setSession({ anamnesis: polishLocal(session.anamnesis) });
        }
      }
      store.setToast(hasApiKey() ? "AI причесал блок" : "Локально причесал блок");
    } catch {
      store.setToast("AI не ответил — проверь ключ в Настройках");
    } finally {
      setAiBusy(false);
    }
  }

  async function runInteractions() {
    const names = [
      ...session.recommendations,
      ...(patient?.currentMedications || []),
    ]
      .map((s) => s.split(/\s+/)[0])
      .filter(Boolean);
    if (!names.length) {
      store.setToast("Нет назначений для проверки");
      return;
    }
    if (!hasApiKey()) {
      store.setToast("Нужен ключ AI в Настройках");
      return;
    }
    setIxBusy(true);
    try {
      setIxText(await checkDrugInteractions(names));
    } catch (e) {
      setIxText(e instanceof Error ? e.message : "Не удалось проверить");
    } finally {
      setIxBusy(false);
    }
  }

  function printProtocol() {
    const html = `
      <div class="print-letterhead"><h1>MedConsult</h1><p>протокол консультации</p></div>
      <div class="print-meta">${escapeHtml(header).replace(/\n/g, "<br/>")}</div>
      ${blocks
        .map(
          (b) =>
            `<div class="print-section"><h3>${escapeHtml(b.title)}</h3><div>${escapeHtml(b.text)}</div></div>`,
        )
        .join("")}
    `;
    printHtml(html, "Протокол");
  }

  const insertDrug = (d: { name?: string; dosage?: string; dose?: string; frequency?: string; duration?: string }) => {
    addRecommendation(drugLine({ name: d.name || "", dosage: d.dosage || d.dose, frequency: d.frequency, duration: d.duration }));
  };

  function setWork(kind: "primary" | "followup" | "study" | "document") {
    if (kind === "primary") {
      setSession({ visitKind: "primary", mode: session.studies.length ? "consult_study" : "consult" });
    } else if (kind === "followup") {
      setSession({ visitKind: "followup", mode: session.studies.length ? "consult_study" : "consult" });
    } else if (kind === "study") {
      setSession({ mode: "study" });
    } else {
      store.ensureGlobals();
      setSession({ mode: "document" });
    }
  }

  const renameInserted = (field: "complaints" | "localStatus" | "recommendations") => (from: string, to: string) => {
    store.renameList(
      field,
      session[field].map((x) => (x === from ? to : x)),
    );
  };

  const commitLocalPhrase = () => {
    const t = localQ.trim();
    if (!t) return;
    store.addLocalPhrase(t);
    setLocalQ("");
    setLocalAdd(false);
  };

  const kindBtn = (id: "primary" | "followup" | "study" | "document", label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setWork(id)}
      className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
        work === id ? "bg-teal text-paper" : "border border-line bg-surface"
      }`}
    >
      {label}
    </button>
  );

  const assembly = (
    <div className="flex flex-col gap-1.5 overflow-auto p-2.5 md:p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {kindBtn("primary", "первичный")}
        {kindBtn("followup", "повторный")}
        {kindBtn("study", "обследование")}
        {kindBtn("document", "другой документ")}
        <PlusStudyButton />
        {documentMode && <PlusDocBlockButton />}
        <button type="button" className="ml-auto text-xs font-medium text-teal" onClick={() => store.loadLastForPatient()}>
          Повторить прошлый сеанс
        </button>
      </div>

      {patient ? (
        <div className="rounded-[10px] border border-warn-line bg-warn px-2.5 py-2 text-xs leading-relaxed">
          <div className="mb-1 text-[10px] font-semibold tracking-wide uppercase">карточка · во все документы</div>
          <GlobalField
            label="Аллергии"
            items={patient.allergies || []}
            onChange={(allergies) => {
              store.updatePatient(patient.id, { allergies });
              const d = session.vitaeDraft || emptyVitae();
              store.setSession({
                anamnesisVitae: composeVitae(d, { medications: patient.currentMedications, allergies }),
              });
            }}
            placeholder="аллерген + Enter"
          />
          <GlobalField
            label="Принимает постоянно"
            items={patient.currentMedications || []}
            onChange={(currentMedications) => {
              store.updatePatient(patient.id, { currentMedications });
              const d = session.vitaeDraft || emptyVitae();
              store.setSession({
                anamnesisVitae: composeVitae(d, { medications: currentMedications, allergies: patient.allergies }),
              });
            }}
            placeholder="препарат + Enter"
          />
        </div>
      ) : null}

      {documentMode && !(session.docStd || []).length && !(session.extraBlocks || []).length && !session.notes.trim() && (
        <p className="rounded-[10px] border border-dashed border-line px-3 py-3 text-sm text-ink-soft">
          Пустой документ. «+ блок» — жалобы, анамнезы, статусы, диагноз, назначения, дневник (копирует прошлый),
          эпикриз, протокол операции или свой.
        </p>
      )}

      {(session.mode !== "document" || want("diagnosis")) && (
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
            const hit = icd.find((i) => i.code === e.target.value);
            setSession({ diagnosisCode: e.target.value, diagnosisTitle: hit?.title || session.diagnosisTitle });
          }}
          className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
          placeholder="Код МКБ"
        />
        <datalist id="icd-list">
          {icd.slice(0, 400).map((i) => (
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
        {session.diagnosisCode && hubMode === "block" && (
          <div className="legacy-surface mt-2">
            <GuidelinePanel
              diagnosisText={diagnosisText}
              mode="diagnosis"
              onInsertFormulation={(text: string) => setSession({ diagnosisTitle: text })}
              onInsertClassificationLine={(line: string) =>
                setSession({ diagnosisTitle: session.diagnosisTitle ? `${session.diagnosisTitle}. ${line}` : line })
              }
              onInsertComplaint={toggleComplaint}
              onInsertInvestigation={(item: string) => addRecommendation(item)}
              onInsertDrug={insertDrug}
            />
          </div>
        )}
      </Sec>
      )}

      {hubMode === "block" && guideline && !documentMode && (
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

      {hubMode === "modal" && guideline && !documentMode && (
        <>
          <button
            type="button"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            onClick={() => setHubOpen(true)}
          >
            Клинрек {guideline.title} — открыть окно
          </button>
          {hubOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={() => setHubOpen(false)}>
              <div
                className="legacy-surface max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl bg-surface p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <GuidelinePanel
                  diagnosisText={diagnosisText}
                  mode="drugs"
                  onInsertFormulation={(text: string) => setSession({ diagnosisTitle: text })}
                  onInsertClassificationLine={(line: string) =>
                    setSession({ diagnosisTitle: session.diagnosisTitle ? `${session.diagnosisTitle}. ${line}` : line })
                  }
                  onInsertComplaint={toggleComplaint}
                  onInsertInvestigation={(item: string) => addRecommendation(item)}
                  onInsertDrug={insertDrug}
                />
                <button type="button" className="mt-4 text-sm text-mute" onClick={() => setHubOpen(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {want("complaints") && (
          <Sec
            id="complaints"
            title="Жалобы"
            open={session.openSection === "complaints"}
            onOpen={() => setSession({ openSection: session.openSection === "complaints" ? null : "complaints" })}
            onRemove={() => toggleBlock("complaints")}
            ai={showAi("complaints") ? () => polish("complaints") : undefined}
            voice={(t) => toggleComplaint(t)}
          >
            <Typeahead
              value={complaintQ}
              onChange={setComplaintQ}
              items={
                complaintQ.trim().length >= 2
                  ? liveComplaints()
                      .filter((t) => t.toLowerCase().includes(complaintQ.trim().toLowerCase()))
                      .slice(0, 12)
                      .map((t) => ({ id: t, label: t }))
                  : []
              }
              onPick={(it) => {
                if (!session.complaints.includes(it.label)) toggleComplaint(it.label);
              }}
              onSubmitCustom={(raw) => toggleComplaint(raw)}
              placeholder="Начать вводить жалобу…  ↑↓ Enter"
              emptyHint={complaintQ.trim().length >= 2 ? "Enter — добавить свою формулировку" : undefined}
            />
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">вчерашние</div>
            <ToggleChips
              texts={store.recentChips}
              onToggle={toggleComplaint}
              selected={session.complaints}
              onRename={renameInserted("complaints")}
            />
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">по {session.diagnosisCode || "коду"}</div>
            <ToggleChips
              texts={chips.fromCode}
              onToggle={toggleComplaint}
              selected={session.complaints}
              dashed
              onRename={renameInserted("complaints")}
            />
            {complaintQ.trim().length >= 2 ? (
              <>
                <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">весь словарь</div>
                <ToggleChips
                  texts={chips.rest
                    .filter((t) => t.toLowerCase().includes(complaintQ.trim().toLowerCase()))
                    .slice(0, 16)}
                  onToggle={toggleComplaint}
                  selected={session.complaints}
                  onRename={renameInserted("complaints")}
                />
              </>
            ) : (
              <div className="mt-1 text-[10px] text-mute">словарь — после двух букв</div>
            )}
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">в тексте · клик — править</div>
            <EditableChips items={session.complaints} onChange={(next) => store.renameList("complaints", next)} />
            {session.diagnosisCode && (
              <div className="legacy-surface mt-2">
                <GuidelinePanel
                  diagnosisText={diagnosisText}
                  mode="complaints"
                  onInsertComplaint={toggleComplaint}
                  onInsertFormulation={(text: string) => setSession({ diagnosisTitle: text })}
                  onInsertClassificationLine={(line: string) =>
                    setSession({ diagnosisTitle: session.diagnosisTitle ? `${session.diagnosisTitle}. ${line}` : line })
                  }
                  onInsertInvestigation={(item: string) => addRecommendation(item)}
                  onInsertDrug={insertDrug}
                />
              </div>
            )}
          </Sec>
      )}

      {want("anamnesis") && (
          <Sec
            id="anamnesis"
            title="Анамнез заболевания"
            open={session.openSection === "anamnesis"}
            onOpen={() => {
              if (session.openSection === "anamnesis") {
                const t = composeAnamnesis(session.anamnesisDraft || emptyAnamnesis());
                setSession({
                  openSection: null,
                  anamnesisChipMode: t ? false : session.anamnesisChipMode,
                  anamnesis: t || session.anamnesis,
                });
              } else {
                setSession({ openSection: "anamnesis" });
              }
            }}
            onRemove={() => toggleBlock("anamnesis")}
            ai={showAi("anamnesis") ? () => polish("anamnesis") : undefined}
            voice={(t) => setSession({ anamnesis: session.anamnesis ? `${session.anamnesis} ${t}` : t, anamnesisChipMode: false })}
          >
            <AnamnesisDisease
              draft={session.anamnesisDraft || emptyAnamnesis()}
              text={session.anamnesis}
              chipMode={session.anamnesisChipMode ?? !session.anamnesis}
              onDraft={(d) => setSession({ anamnesisDraft: d, anamnesis: composeAnamnesis(d) })}
              onText={(t) => setSession({ anamnesis: t })}
              onMode={(chipsMode) =>
                setSession({
                  anamnesisChipMode: chipsMode,
                  anamnesis: chipsMode ? composeAnamnesis(session.anamnesisDraft || emptyAnamnesis()) : session.anamnesis,
                })
              }
            />
          </Sec>
      )}

      {want("anamnesisVitae") && (
          <Sec
            id="anamnesisVitae"
            title="Предварительный анамнез жизни"
            open={session.openSection === "anamnesisVitae"}
            onOpen={() => {
              if (session.openSection === "anamnesisVitae") {
                const t = composeVitae(session.vitaeDraft || emptyVitae(), {
                  medications: patient?.currentMedications,
                  allergies: patient?.allergies,
                });
                setSession({
                  openSection: null,
                  vitaeChipMode: t ? false : session.vitaeChipMode,
                  anamnesisVitae: t || session.anamnesisVitae,
                });
              } else {
                setSession({ openSection: "anamnesisVitae" });
              }
            }}
            onRemove={() => toggleBlock("anamnesisVitae")}
            voice={(t) => setSession({ anamnesisVitae: session.anamnesisVitae ? `${session.anamnesisVitae} ${t}` : t, vitaeChipMode: false })}
          >
            <AnamnesisVitae
              draft={session.vitaeDraft || emptyVitae()}
              text={session.anamnesisVitae}
              chipMode={session.vitaeChipMode ?? !session.anamnesisVitae}
              onDraft={(d) =>
                setSession({
                  vitaeDraft: d,
                  anamnesisVitae: composeVitae(d, {
                    medications: patient?.currentMedications,
                    allergies: patient?.allergies,
                  }),
                })
              }
              onText={(t) => setSession({ anamnesisVitae: t })}
              onMode={(chipsMode) =>
                setSession({
                  vitaeChipMode: chipsMode,
                  anamnesisVitae: composeVitae(session.vitaeDraft || emptyVitae(), {
                    medications: patient?.currentMedications,
                    allergies: patient?.allergies,
                  }),
                })
              }
            />
          </Sec>
      )}

      {want("status") && (
          <Sec
            id="status"
            title="Локальный статус"
            badge={packs[0] ? `пакет ${packs[0].label}` : undefined}
            open={session.openSection === "status"}
            onOpen={() => setSession({ openSection: session.openSection === "status" ? null : "status" })}
            onRemove={() => toggleBlock("status")}
            voice={(t) => setSession({ objective: session.objective ? `${session.objective} ${t}` : t })}
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
                <div className="text-[10px] text-mute uppercase">{p.label} · по МКБ</div>
                <ToggleChips
                  texts={p.chips}
                  onToggle={toggleLocal}
                  selected={session.localStatus}
                  dashed
                  onRename={renameInserted("localStatus")}
                />
              </div>
            ))}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-xs font-bold text-teal"
                onClick={() => setLocalAdd(true)}
                title="Добавить свой шаблон в блок"
              >
                <Plus className="size-3" /> свой шаблон
              </button>
            </div>
            {localAdd && (
              <div className="mt-1.5 flex gap-1">
                <input
                  autoFocus
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitLocalPhrase();
                    }
                    if (e.key === "Escape") setLocalAdd(false);
                  }}
                  placeholder="формулировка — в блок и в шаблоны"
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
                />
                <button type="button" className="rounded-md bg-teal px-2.5 text-sm font-bold text-paper" onClick={commitLocalPhrase}>
                  +
                </button>
              </div>
            )}
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">в тексте · клик — править</div>
            <EditableChips items={session.localStatus} onChange={(next) => store.renameList("localStatus", next)} />
          </Sec>
      )}

      {session.studies.map((s) => (
        <StudyCard key={s.key} studyKey={s.key} />
      ))}

      {(session.extraBlocks || []).map((b) => (
        <Sec
          key={b.id}
          id={b.id}
          title={b.title}
          open={session.openSection === b.id}
          onOpen={() => setSession({ openSection: session.openSection === b.id ? null : b.id })}
          onRemove={() => store.removeExtraBlock(b.id)}
          voice={(t) => store.updateExtraBlock(b.id, { text: b.text ? `${b.text} ${t}` : t })}
        >
          <textarea
            value={b.text}
            onChange={(e) => store.updateExtraBlock(b.id, { text: e.target.value })}
            rows={5}
            className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            placeholder={b.title}
          />
        </Sec>
      ))}

      {session.mode === "document" && (
        <Sec
          id="notes"
          title="Текст документа"
          open={session.openSection === "notes"}
          onOpen={() => setSession({ openSection: session.openSection === "notes" ? null : "notes" })}
          onRemove={() => toggleBlock("notes")}
          voice={(t) => setSession({ notes: session.notes ? `${session.notes} ${t}` : t })}
        >
          <textarea
            value={session.notes}
            onChange={(e) => setSession({ notes: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
            placeholder="Справка, направление, заключение…"
          />
        </Sec>
      )}

      {(consult || want("recommendations")) && (
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
          {session.recommendations.length > 0 && (
            <>
              <div className="mt-2 text-[10px] tracking-wide text-mute uppercase">в тексте · клик — править</div>
              <EditableChips
                items={session.recommendations}
                onChange={(next) => store.renameList("recommendations", next)}
              />
            </>
          )}
          {session.diagnosisCode && (
            <div className="legacy-surface mt-2 space-y-2">
              <GuidelinePanel
                diagnosisText={diagnosisText}
                mode="drugs"
                onInsertComplaint={toggleComplaint}
                onInsertFormulation={(text: string) => setSession({ diagnosisTitle: text })}
                onInsertClassificationLine={(line: string) =>
                  setSession({ diagnosisTitle: session.diagnosisTitle ? `${session.diagnosisTitle}. ${line}` : line })
                }
                onInsertInvestigation={(item: string) => addRecommendation(item)}
                onInsertDrug={insertDrug}
              />
              <TreatmentSchemeSearch
                diagnosisText={diagnosisText}
                onApplyPhase={(phaseDrugs: { name?: string; dosage?: string; dose?: string; frequency?: string; duration?: string }[]) => {
                  phaseDrugs.forEach(insertDrug);
                  store.setToast("Фаза схемы добавлена");
                }}
              />
            </div>
          )}
          {!session.diagnosisCode && (
            <div className="legacy-surface mt-2">
              <TreatmentSchemeSearch
                diagnosisText={diagnosisText}
                onApplyPhase={(phaseDrugs: { name?: string; dosage?: string; dose?: string; frequency?: string; duration?: string }[]) => {
                  phaseDrugs.forEach(insertDrug);
                  store.setToast("Фаза схемы добавлена");
                }}
              />
            </div>
          )}
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
          onClick={() => polish("all")}
          disabled={aiBusy}
        >
          {aiBusy ? "Причёсываю…" : "Причесать всё"}
        </button>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
          onClick={printProtocol}
        >
          <Printer className="size-3.5" /> печать
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

function GlobalField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  return (
    <div className="mt-1">
      <div className="text-[10px] font-semibold tracking-wide uppercase">{label}</div>
      <EditableChips items={items} onChange={onChange} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) {
            e.preventDefault();
            if (!items.includes(q.trim())) onChange([...items, q.trim()]);
            setQ("");
          }
        }}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-warn-line bg-surface px-2 py-1 text-xs"
      />
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
    .map((h) => ({ id: h.name + h.via + h.line, label: h.line, hint: h.via }));

  return (
    <div className="mt-1">
      <Typeahead
        value={q}
        onChange={setQ}
        items={items}
        onPick={(it) => onAdd(it.label)}
        onSubmitCustom={(raw) => onAdd(raw)}
        placeholder="ДВ, торговое, группа, МКБ…  ↑↓ Enter"
        emptyHint="Нет в справочнике. Enter — вставить как есть"
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

function Sec({
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
