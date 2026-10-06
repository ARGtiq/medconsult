import { Copy, Plus, Printer, Eraser } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import GuidelinePanel from "@/legacy/components/GuidelinePanel";
import { RecommendationsBlock, Sec, StudyDrugHints } from "./protocolUi";
import { checkDrugInteractions, hasApiKey, polishNarrative } from "@/legacy/lib/openrouter";
import { escapeHtml, printHtml } from "@/legacy/lib/print";
import { mdToHtml } from "@/legacy/lib/md";
import { getGuidelineHubMode } from "@/legacy/lib/uiPrefs";
import { PlusDocBlockButton, PlusGlobalButton, PlusPackButton } from "./DocBlocks";
import { ComplaintChips, ComplaintOptionMenu, EditableChips, type OptionMenuState } from "./EditableChip";
import { addLocalOption, localItems, localStatusLines, protocolBlockOrder, useTemplates, addObjectiveTemplate, type ObjectiveTemplate } from "./data/templates";
import { AppShell } from "./AppShell";
import { complaintsTextOf, composeAll, composeBlocks, composeHeader, composeHeaderLine } from "./compose";
import { copyText, hasMarkup, polishLocal } from "./copy";
import {
  compactGuideline,
  complaintsForSession,
  drugLine,
  liveDrugRecords,
  learnedDrugs,
  matchPhraseOrWord,
  optionsForComplaint,
  findComplaintVariant,
  suggestComplaints,
  liveIcdMerged,
  searchIcd,
  findStudyByChip,
  getStudyLive,
} from "./live";
import { AnamnesisDisease, AnamnesisVitae } from "./AnamnesisBuilders";
import { composeAnamnesis, composeVitae, emptyAnamnesis, emptyVitae } from "./anamnesisChips";
import { fillVitaeTemplate, templateDefaults, vitaeDefaultKey, vitaeDraftTouched, vitaeTemplates } from "./vitaeTemplates";
import { collectDeviations } from "./data/studies";
import { PlusStudyButton, StudyCard, DeviationsSpoiler, FitTextarea } from "./StudyCard";
import { Typeahead } from "./Typeahead";
import { formatPatient, useAppStore, workKindOf } from "./store";
import type { LocalItem, LocalPack, LocalPick, SessionState } from "./types";

const SPLIT_MIN = 22;
const SPLIT_MAX = 70;
const SPLIT_DEFAULT = 38;

function clampSplit(n: number) {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(n)));
}

function Slot({ order, children }: { order: number; children: ReactNode }) {
  if (children == null || children === false) return null;
  return (
    <div className="flex flex-col gap-1.5" style={{ order }}>
      {children}
    </div>
  );
}

function LocalOptionRow({
  item,
  value,
  subs,
  onChange,
  onSubs,
  onAddOption,
}: {
  item: LocalItem;
  value: string;
  subs: string[];
  onChange: (v: string) => void;
  onSubs: (v: string[]) => void;
  onAddOption: (v: string) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(value);
  const [custom, setCustom] = useState("");
  const options = item.options.length ? item.options : [];
  const selected = value.trim();
  const known = options.some((o) => o.toLowerCase() === selected.toLowerCase());

  function commitEdit() {
    const next = draft.trim();
    if (next) onChange(next);
    setEdit(false);
  }

  return (
    <div className="mt-1">
      <div className="text-xs font-semibold text-ink">{item.label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((o) => {
          const on = selected.toLowerCase() === o.toLowerCase();
          if (on && edit) {
            return (
              <input
                key={o}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === "Escape") setEdit(false);
                }}
                className="min-w-[8rem] rounded-full border border-teal bg-paper px-2 py-0.5 text-xs"
              />
            );
          }
          return (
            <button
              key={o}
              type="button"
              title={on ? "Нажми — править текст" : "Выбрать"}
              className={`rounded-full px-2 py-0.5 text-xs ${
                on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
              }`}
              onClick={() => {
                if (on) {
                  setDraft(selected);
                  setEdit(true);
                } else onChange(o);
              }}
            >
              {on ? selected : o}
            </button>
          );
        })}
        {!options.length &&
          (edit ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") setEdit(false);
              }}
              className="min-w-[8rem] rounded-full border border-teal bg-paper px-2 py-0.5 text-xs"
            />
          ) : (
            <button
              type="button"
              className="rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal"
              onClick={() => {
                setDraft(selected || item.label);
                setEdit(true);
              }}
            >
              {selected || item.label}
            </button>
          ))}
        {!!options.length && selected && !known && !edit && (
          <button
            type="button"
            className="rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal"
            onClick={() => {
              setDraft(selected);
              setEdit(true);
            }}
          >
            {selected}
          </button>
        )}
      </div>
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const raw = custom.trim();
          if (!raw) return;
          e.preventDefault();
          onAddOption(raw);
          setCustom("");
        }}
        placeholder="свой вариант + Enter"
        className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
      />
      {(item.subs || []).map((group, gi) => (
        <div key={gi} className="mt-1 flex flex-wrap gap-1">
          {group.map((opt) => {
            const on = (subs[gi] || "").toLowerCase() === opt.toLowerCase();
            return (
              <button
                key={opt}
                type="button"
                className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-teal text-paper" : "border border-dashed border-line bg-paper"}`}
                onClick={() => {
                  const next = [...subs];
                  next[gi] = on ? "" : opt;
                  onSubs(next);
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ProtocolPage() {
  const store = useAppStore();
  const { session, settings, patients, setSession, toggleBlock, toggleComplaint, addRecommendation, applyComplaintOption, applyComplaintSub, addStudy } =
    store;
  const templates = useTemplates();
  const [mobileTab, setMobileTab] = useState<"build" | "preview">("build");
  const [headerOpen, setHeaderOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [ixText, setIxText] = useState<string | null>(null);
  const [ixBusy, setIxBusy] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<"complaints" | "diagnosis" | "studies" | "recs" | "sheet">("diagnosis");
  const [complaintQ, setComplaintQ] = useState("");
  const [dictOpen, setDictOpen] = useState(false);
  const [optMenu, setOptMenu] = useState<OptionMenuState | null>(null);
  const complaintTa = useRef<HTMLDivElement>(null);
  const [localQ, setLocalQ] = useState("");
  const [localAdd, setLocalAdd] = useState(false);
  const [liveSplit, setLiveSplit] = useState<number | null>(null);
  const splitWrap = useRef<HTMLDivElement>(null);
  const splitDragging = useRef(false);
  const splitLive = useRef(SPLIT_DEFAULT);
  const patient = patients.find((p) => p.id === session.patientId);
  const guideline = compactGuideline(session.diagnosisCode);
  const packs = useMemo(() => {
    const code = session.diagnosisCode.trim().toUpperCase();
    const prefix = code.split(".")[0];
    const matches = (codes: string[]) => {
      if (!code) return codes.length === 0;
      return codes.some((raw) => {
        const u = raw.trim().toUpperCase();
        if (!u) return false;
        return u === code || u === prefix || code.startsWith(`${u}.`) || u.startsWith(`${code}.`);
      });
    };
    return [...(templates.localPacks || [])].sort(
      (a, b) => Number(matches(b.codes)) - Number(matches(a.codes)) || a.label.localeCompare(b.label, "ru"),
    );
  }, [session.diagnosisCode, templates.localPacks]);
  const objectiveTemplates = useMemo(() => {
    const code = session.diagnosisCode.trim().toUpperCase();
    const prefix = code.split(".")[0];
    const list = templates.objective || [];
    const rank = (item: ObjectiveTemplate) => {
      if (!code) return 1;
      const codes = (item.codes || []).map((c) => c.toUpperCase());
      if (!codes.length) return 1;
      return codes.some((c) => c === code || c === prefix) ? 0 : 2;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, "ru"));
  }, [session.diagnosisCode, templates.objective]);
  const chips = complaintsForSession(session.diagnosisCode);
  const icd = liveIcdMerged();
  const codeHit = icd.find((i) => i.code.toUpperCase() === session.diagnosisCode.trim().toUpperCase());
  const fromPractice = learnedDrugs(session.complaints, session.diagnosisCode);
  const work = workKindOf(session);
  const consult = session.mode === "consult" || session.mode === "consult_study";
  const documentMode = session.mode === "document";
  const want = (id: string) => {
    if (consult) return true;
    if (!documentMode) return false;
    const std = session.docStd || [];
    if (id === "objective") return std.includes("objective") || std.includes("status");
    return std.includes(id);
  };
  const showRecs = consult || want("recommendations");
  const hubMode = getGuidelineHubMode() === "modal" || settings.guidelineDisplay === "modal" ? "modal" : "block";
  const blocks = useMemo(
    () => composeBlocks(session, patient, { deviations: settings.studyDeviations !== false }),
    [session, patient, settings.studyDeviations],
  );
  const deviationCount = useMemo(
    () => (settings.studyDeviations === false ? 0 : collectDeviations(session.studies, getStudyLive).length),
    [session.studies, settings.studyDeviations, templates.questionnaires],
  );
  const header = useMemo(() => composeHeader(session, patient), [session, patient]);
  const diagnosisText = [session.diagnosisCode, session.diagnosisTitle].filter(Boolean).join(" ");

  useEffect(() => {
    function copyAll() {
      copyText(composeAll(session, patient, false, { deviations: settings.studyDeviations !== false })).then((ok) =>
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
    const root = splitWrap.current;
    if (!root) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (!t || !root.contains(t)) return;
      if (t.getAttribute("aria-expanded") === "true") return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      const input = t as HTMLInputElement;
      if (input.disabled || input.type === "hidden" || input.type === "checkbox" || input.type === "radio" || input.type === "range" || input.type === "button") return;
      const fields = [...root.querySelectorAll<HTMLElement>("input, textarea, select")].filter((el) => {
        const inp = el as HTMLInputElement;
        if (inp.disabled || inp.type === "hidden" || inp.type === "checkbox" || inp.type === "radio" || inp.type === "range") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const i = fields.indexOf(t);
      if (i < 0) return;
      const next = fields[i + (e.shiftKey ? -1 : 1)];
      if (!next) return;
      e.preventDefault();
      next.focus();
    }
    root.addEventListener("keydown", onKey, true);
    return () => root.removeEventListener("keydown", onKey, true);
  }, []);

  const showAi = (section: string) => {
    if (settings.aiButton === "off") return false;
    if (settings.aiButton === "always") return true;
    return session.openSection === section;
  };

  async function polish(section: "complaints" | "anamnesis" | "recommendations" | "all") {
    setAiBusy(true);
    try {
      if (section === "complaints") {
        const src = complaintsTextOf(session);
        store.setAiUndo({
          section,
          before: JSON.stringify({
            complaints: session.complaints,
            complaintsText: session.complaintsText ?? null,
            complaintsChipMode: !!session.complaintsChipMode,
          }),
        });
        const next = hasApiKey() ? await polishNarrative(src) : polishLocal(src);
        const complaints = next.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
        store.setSession(
          session.complaintsChipMode
            ? { complaints }
            : { complaints, complaintsText: next, complaintsChipMode: false },
        );
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
      ...(session.currentMedications || []),
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
            `<div class="print-section"><h3>${escapeHtml(b.title)}</h3><div>${hasMarkup(b.text) ? mdToHtml(b.text) : escapeHtml(b.text).replace(/\n/g, "<br/>").replace(/(^|<br\/>)(Источник: [^<]*)/g, '$1<span class="pack-source">$2</span>')}</div></div>`,
        )
        .join("")}
    `;
    printHtml(html, "Протокол");
  }

  const insertDrug = (d: { name?: string; dosage?: string; dose?: string; frequency?: string; duration?: string }) => {
    const known = liveDrugRecords().find((r) => r.name.toLowerCase() === (d.name || "").trim().toLowerCase());
    addRecommendation(
      drugLine({
        name: d.name || "",
        dosage: d.dosage || known?.dosage,
        frequency: d.frequency || known?.frequency,
        duration: d.duration || known?.duration,
        dose: d.dose || known?.dose,
      }),
    );
  };

  const insertInvestigation = (item: string) => {
    const hit = findStudyByChip(item);
    if (hit) addStudy(hit.key);
    else addRecommendation(item);
  };

  const pickScenario = (name: string) => {
    setSession({
      scenario: session.scenario === name ? null : name,
      guidelineId: guideline?.id || session.guidelineId,
    });
  };

  const klinrekPanel = (
    slice: "complaints" | "diagnosis" | "studies" | "recs" | "sheet",
    bare?: boolean,
  ) => (
    <GuidelinePanel
      diagnosisText={diagnosisText}
      slice={slice}
      scenario={session.scenario}
      onPickScenario={pickScenario}
      onInsertFormulation={(text: string) => setSession({ diagnosisTitle: text })}
      onInsertClassificationLine={(line: string) =>
        setSession({ diagnosisTitle: session.diagnosisTitle ? `${session.diagnosisTitle}. ${line}` : line })
      }
      onInsertComplaint={toggleComplaint}
      onInsertInvestigation={insertInvestigation}
      onInsertPlain={(text: string) => addRecommendation(text)}
      onInsertDrug={insertDrug}
      onInsertQuestionnaire={(key: string) => addStudy(key)}
      addedStudyKeys={session.studies.map((s) => s.key)}
      sheetBare={bare}
    />
  );

  function setWork(kind: "primary" | "followup" | "study" | "document") {
    if (kind === "primary" || kind === "followup") {
      setSession({
        visitKind: kind,
        mode: session.studies.length ? "consult_study" : "consult",
        templateId: undefined,
        hiddenBlocks: session.hiddenBlocks.filter((id) => id !== "objective"),
      });
    } else if (kind === "study") {
      setSession({ mode: "study", templateId: undefined });
    } else {
      store.ensureGlobals();
      setSession({ mode: "document", templateId: undefined });
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

  const localFree = () => {
    const generated = new Set(localStatusLines(session.localPicks || [], templates.localPacks, []));
    return session.localStatus.filter((x) => !generated.has(x));
  };

  const writeLocal = (active: string[], picks: LocalPick[], free: string[]) => {
    setSession({
      activeLocalPacks: active,
      localPicks: picks,
      localStatus: localStatusLines(picks, templates.localPacks, free),
    });
  };

  const toggleLocalPack = (pack: LocalPack) => {
    const active = session.activeLocalPacks || [];
    const free = localFree();
    if (active.includes(pack.id)) {
      writeLocal(
        active.filter((id) => id !== pack.id),
        (session.localPicks || []).filter((p) => p.packId !== pack.id),
        free,
      );
      return;
    }
    const picks = [
      ...(session.localPicks || []).filter((p) => p.packId !== pack.id),
      ...localItems(pack).map((it) => ({ packId: pack.id, itemId: it.id, value: it.options[0] || it.label })),
    ];
    writeLocal([...active, pack.id], picks, free);
  };

  const setLocalPickValue = (packId: string, itemId: string, value: string, subs?: string[]) => {
    const picks = (session.localPicks || []).map((p) =>
      p.packId === packId && p.itemId === itemId ? { ...p, value, subs: subs ?? p.subs } : p,
    );
    writeLocal(session.activeLocalPacks || [], picks, localFree());
  };

  const cardCtx = {
    medications: session.currentMedications || [],
    medicationNotes: session.medicationNotes || {},
    allergies: session.allergies || [],
  };

  const splitPct = clampSplit(liveSplit ?? settings.splitPct ?? SPLIT_DEFAULT);
  splitLive.current = splitPct;

  const moveSplit = (clientX: number) => {
    const wrap = splitWrap.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 8) return;
    setLiveSplit(clampSplit(((clientX - rect.left) / rect.width) * 100));
  };

  const commitSplit = () => {
    splitDragging.current = false;
    store.setSettings({ splitPct: splitLive.current });
    setLiveSplit(null);
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

  const packOrder = session.templateId ? protocolBlockOrder(session.templateId, session.docStd) : null;
  const slotOf = (id: string, fallback: number) => {
    if (!packOrder) return fallback;
    const i = packOrder.indexOf(id);
    return i < 0 ? 500 + fallback : i * 10;
  };
  const studiesOrder = (() => {
    if (!packOrder) return 65;
    const pts = ["objective", "status"].map((id) => packOrder.indexOf(id)).filter((i) => i >= 0);
    if (pts.length) return Math.max(...pts) * 10 + 5;
    const rec = packOrder.indexOf("recommendations");
    return rec >= 0 ? rec * 10 - 1 : 65;
  })();
  const tailOrder = packOrder ? Math.max(0, ...packOrder.map((_, i) => i * 10)) + 15 : 70;

  const diagnosisItems = useMemo(() => {
    const q = session.diagnosisCode.trim();
    if (!q) return [];
    const hits = searchIcd(q, 12).map((h) => ({ id: h.code, label: h.title, hint: h.code }));
    const exact = hits.some((h) => h.id.toUpperCase() === q.toUpperCase());
    if (exact) return hits;
    return [{ id: "__as_is__", label: q, hint: "как есть" }, ...hits];
  }, [session.diagnosisCode]);

  function commitDiagnosis(raw: string, picked?: { code: string; title: string }) {
    const prev = icd.find((i) => i.code.toUpperCase() === session.diagnosisCode.trim().toUpperCase());
    const title = session.diagnosisTitle.trim();
    const keepCustom = !!title && title !== (prev?.title || "");
    if (picked) {
      setSession({
        diagnosisCode: picked.code,
        diagnosisTitle: keepCustom ? session.diagnosisTitle : picked.title,
      });
      return;
    }
    const hit = icd.find((i) => i.code.toUpperCase() === raw.trim().toUpperCase());
    setSession({
      diagnosisCode: hit ? hit.code : raw,
      diagnosisTitle: hit && !keepCustom ? hit.title : session.diagnosisTitle,
    });
  }

  const diagnosisBlock = (session.mode !== "document" || want("diagnosis")) ? (
    <Sec
      id="diagnosis"
      title="Диагноз"
      badge={session.diagnosisCode}
      open={session.openSection === "diagnosis"}
      onOpen={() => setSession({ openSection: session.openSection === "diagnosis" ? null : "diagnosis" })}
      onRemove={() => toggleBlock("diagnosis")}
    >
      {session.diagnosisCode ? (
        <div className="mb-0.5 text-xs font-semibold tracking-wide text-teal uppercase">Код МКБ</div>
      ) : null}
      <Typeahead
        value={session.diagnosisCode}
        onChange={commitDiagnosis}
        items={diagnosisItems}
        clearOnPick={false}
        onPick={(it) => {
          if (it.id === "__as_is__") commitDiagnosis(it.label);
          else commitDiagnosis(it.id, { code: it.id, title: it.label });
        }}
        onSubmitCustom={(raw) => commitDiagnosis(raw)}
        placeholder="Код или название МКБ  ↑↓ Enter"
        emptyHint={session.diagnosisCode.trim() ? "Enter — оставить как есть" : undefined}
        inputClassName="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm"
      />
      {codeHit ? (
        <p className="mt-1 mb-1 text-xs leading-snug text-ink-soft">
          <span className="font-medium text-ink">{codeHit.code}</span> — {codeHit.title}
        </p>
      ) : (
        <div className="mb-1" />
      )}
      {session.diagnosisTitle ? (
        <div className="mb-0.5 text-xs font-semibold tracking-wide text-teal uppercase">Формулировка</div>
      ) : null}
      <textarea
        value={session.diagnosisTitle}
        onChange={(e) => setSession({ diagnosisTitle: e.target.value })}
        className="w-full resize-y rounded-md border border-line bg-paper px-2 py-1 text-sm"
        rows={2}
        placeholder="Формулировка диагноза"
      />
      {session.diagnosisCode && hubMode === "block" && (
        <div className="legacy-surface klinrek-slot mt-2 space-y-2">
          {klinrekPanel("diagnosis")}
          {klinrekPanel("sheet")}
        </div>
      )}
    </Sec>
  ) : null;

  const assembly = (
    <div className="flex flex-col gap-1.5 overflow-auto p-2.5 md:p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {kindBtn("primary", "первичный")}
        {kindBtn("followup", "повторный")}
        {kindBtn("study", "обследование")}
        {kindBtn("document", "другой документ")}
        <PlusPackButton />
        <PlusGlobalButton />
        <PlusStudyButton />
        {documentMode && <PlusDocBlockButton />}
        <button type="button" className="ml-auto text-xs font-medium text-teal" onClick={() => store.loadLastForPatient()}>
          Повторить прошлый сеанс
        </button>
      </div>

      {documentMode && !(session.docStd || []).length && !(session.extraBlocks || []).length && !session.notes.trim() && (
        <p className="rounded-[10px] border border-dashed border-line px-3 py-3 text-sm text-ink-soft">
          Пустой документ. «+ блок» — жалобы, анамнезы, статусы, диагноз, назначения, дневник (копирует прошлый),
          эпикриз, протокол операции или свой.
        </p>
      )}

      {!settings.diagnosisAbovePreview && <Slot order={slotOf("diagnosis", 10)}>{diagnosisBlock}</Slot>}

      {hubMode === "modal" && guideline && !documentMode && (
        <>
          <button
            type="button"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm"
            onClick={() => setHubOpen(true)}
          >
            Клинрек {guideline.title}
          </button>
          {hubOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={() => setHubOpen(false)}>
              <div
                className="legacy-surface max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl bg-surface p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 text-sm font-medium">Клинрек {guideline.title}</div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {(
                    [
                      ["complaints", "Жалобы"],
                      ["diagnosis", "Диагноз"],
                      ["studies", "Обследования"],
                      ["recs", "Назначения"],
                      ["sheet", "Шпаргалка"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        hubTab === id ? "bg-teal-soft font-medium text-teal" : "border border-line bg-paper"
                      }`}
                      onClick={() => setHubTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {klinrekPanel(hubTab, hubTab === "sheet")}
                <button type="button" className="mt-4 text-sm text-mute" onClick={() => setHubOpen(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Slot order={slotOf("complaints", 20)}>
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
            <div ref={complaintTa}>
            <Typeahead
              value={complaintQ}
              onChange={setComplaintQ}
              items={(() => {
                const q = complaintQ.trim();
                if (q.length < 2) return [];
                const hits = suggestComplaints(q, 12);
                const exact = hits.some((h) => h.label.toLowerCase() === q.toLowerCase());
                if (exact) return hits;
                return [...hits, { id: "__as_is__", label: q, hint: "как есть" }];
              })()}
              onPick={(it) => {
                const has = !!findComplaintVariant(session.complaints, it.label) || session.complaints.includes(it.label);
                if (!has) toggleComplaint(it.label);
                if (optionsForComplaint(it.label).length) {
                  const r = complaintTa.current?.getBoundingClientRect();
                  if (r) setOptMenu({ base: it.label, rect: { top: r.top, left: r.left, bottom: r.bottom, width: r.width } });
                } else {
                  setOptMenu(null);
                }
              }}
              onSubmitCustom={(raw) => toggleComplaint(raw)}
              placeholder="Начать вводить жалобу…  ↑↓ Enter"
              emptyHint={complaintQ.trim().length >= 2 ? "Enter — добавить свою формулировку" : undefined}
            />
            </div>
            {optMenu ? (
              <ComplaintOptionMenu
                state={optMenu}
                selected={session.complaints}
                onPick={(opt) => {
                  applyComplaintOption(optMenu.base, opt);
                }}
                onPickSub={(opt, child) => applyComplaintSub(optMenu.base, opt, child)}
                onClose={() => setOptMenu(null)}
              />
            ) : null}
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">вчерашние</div>
            <ComplaintChips
              texts={store.recentChips}
              onToggle={toggleComplaint}
              selected={session.complaints}
              onApplyOption={applyComplaintOption}
              onApplySub={applyComplaintSub}
              setOptionMenu={setOptMenu}
            />
            <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">по {session.diagnosisCode || "коду"}</div>
            <ComplaintChips
              texts={chips.fromCode}
              onToggle={toggleComplaint}
              selected={session.complaints}
              dashed
              onApplyOption={applyComplaintOption}
              onApplySub={applyComplaintSub}
              setOptionMenu={setOptMenu}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  dictOpen ? "bg-teal text-paper" : "border border-dashed border-teal/50 text-teal"
                }`}
                onClick={() => setDictOpen((v) => !v)}
              >
                {dictOpen ? "скрыть словарь" : "+ словарь"}
              </button>
              {!dictOpen && complaintQ.trim().length < 2 ? (
                <span className="text-[10px] text-mute">или две буквы</span>
              ) : null}
            </div>
            {dictOpen || complaintQ.trim().length >= 2 ? (
              <>
                <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">весь словарь</div>
                <ComplaintChips
                  texts={
                    complaintQ.trim().length >= 2
                      ? chips.rest.filter((t) => matchPhraseOrWord(t, complaintQ)).slice(0, 24)
                      : chips.rest
                  }
                  onToggle={toggleComplaint}
                  selected={session.complaints}
                  onApplyOption={applyComplaintOption}
              onApplySub={applyComplaintSub}
                  setOptionMenu={setOptMenu}
                />
              </>
            ) : null}
            {session.complaintsChipMode ? (
              <>
                <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">в тексте · клик — править</div>
                <EditableChips items={session.complaints} onChange={(next) => store.renameList("complaints", next)} />
                <button
                  type="button"
                  className="mt-1 text-[11px] font-medium text-teal"
                  onClick={() => setSession({ complaintsChipMode: false, complaintsText: undefined })}
                >
                  как текст
                </button>
              </>
            ) : (
              <>
                <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">в тексте</div>
                <textarea
                  value={session.complaintsText ?? session.complaints.join(", ")}
                  onChange={(e) => {
                    const complaintsText = e.target.value;
                    setSession({
                      complaintsText,
                      complaintsChipMode: false,
                      complaints: complaintsText.split(/,\s*/).map((s) => s.trim()).filter(Boolean),
                    });
                  }}
                  rows={3}
                  placeholder="Жалобы в протоколе"
                  className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  className="mt-1 text-[11px] font-medium text-teal"
                  onClick={() => {
                    const text = session.complaintsText ?? session.complaints.join(", ");
                    setSession({
                      complaintsChipMode: true,
                      complaints: text.split(/,\s*/).map((s) => s.trim()).filter(Boolean),
                      complaintsText: undefined,
                    });
                  }}
                >
                  вернуть чипы
                </button>
              </>
            )}
            {session.diagnosisCode && hubMode === "block" && (
              <div className="legacy-surface klinrek-slot mt-2">{klinrekPanel("complaints")}</div>
            )}
          </Sec>
      )}
      </Slot>

      <Slot order={slotOf("anamnesis", 30)}>
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
              onDraft={(d) => setSession({ anamnesisDraft: d, anamnesis: composeAnamnesis(d), anamnesisChipMode: true })}
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
      </Slot>

      <Slot order={slotOf("anamnesisVitae", 40)}>
      {want("anamnesisVitae") && (
          <Sec
            id="anamnesisVitae"
            title="Предварительный анамнез жизни"
            open={session.openSection === "anamnesisVitae"}
            onOpen={() => {
              if (session.openSection === "anamnesisVitae") {
                const usingTpl = session.vitaeTemplateId && session.vitaeTemplateId !== "chips";
                const tpl = usingTpl ? vitaeTemplates().find((t) => t.key === session.vitaeTemplateId) : undefined;
                const t = tpl
                  ? fillVitaeTemplate(tpl, session.vitaeFields || templateDefaults(tpl), cardCtx)
                  : composeVitae(session.vitaeDraft || emptyVitae(), cardCtx);
                setSession({
                  openSection: null,
                  vitaeChipMode: t ? false : session.vitaeChipMode,
                  anamnesisVitae: t || session.anamnesisVitae,
                });
              } else {
                const patch: Partial<SessionState> = { openSection: "anamnesisVitae" };
                if (!session.vitaeTemplateId && !vitaeDraftTouched(session.vitaeDraft) && !session.anamnesisVitae.trim()) {
                  const key = vitaeDefaultKey();
                  const tpl = key !== "chips" ? vitaeTemplates().find((t) => t.key === key) : undefined;
                  if (tpl) {
                    const fields = templateDefaults(tpl);
                    patch.vitaeTemplateId = tpl.key;
                    patch.vitaeFields = fields;
                    patch.vitaeChipMode = true;
                    patch.anamnesisVitae = fillVitaeTemplate(tpl, fields, cardCtx);
                  } else {
                    patch.vitaeTemplateId = "chips";
                    patch.vitaeChipMode = true;
                  }
                }
                setSession(patch);
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
                  vitaeChipMode: true,
                  anamnesisVitae: composeVitae(d, cardCtx),
                })
              }
              onText={(t) => setSession({ anamnesisVitae: t })}
              onMode={(chipsMode) => {
                const usingTpl = session.vitaeTemplateId && session.vitaeTemplateId !== "chips";
                const tpl = usingTpl ? vitaeTemplates().find((t) => t.key === session.vitaeTemplateId) : undefined;
                setSession({
                  vitaeChipMode: chipsMode,
                  anamnesisVitae:
                    chipsMode && tpl
                      ? fillVitaeTemplate(tpl, session.vitaeFields || templateDefaults(tpl), cardCtx)
                      : chipsMode
                        ? composeVitae(session.vitaeDraft || emptyVitae(), cardCtx)
                        : session.anamnesisVitae,
                });
              }}
            />
          </Sec>
      )}
      </Slot>

      <Slot order={slotOf("objective", 50)}>
      {want("objective") && (
          <Sec
            id="objective"
            title="Объективный статус"
            open={session.openSection === "objective"}
            onOpen={() => setSession({ openSection: session.openSection === "objective" ? null : "objective" })}
            onRemove={() => toggleBlock("objective")}
            voice={(t) => setSession({ objective: session.objective ? `${session.objective} ${t}` : t })}
          >
            <div className="mb-2 flex flex-wrap gap-1">
              {objectiveTemplates.map((tpl) => {
                const on = session.objective.trim() === tpl.text.trim();
                const code = session.diagnosisCode.trim().toUpperCase();
                const prefix = code.split(".")[0];
                const byIcd =
                  !!code &&
                  (tpl.codes || []).some((c) => {
                    const u = c.toUpperCase();
                    return u === code || u === prefix;
                  });
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    title={tpl.text}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      on ? "bg-teal text-paper" : "border border-line bg-paper text-ink"
                    }`}
                    onClick={() => setSession({ objective: tpl.text })}
                  >
                    {tpl.label}
                    {byIcd ? " · мкб" : ""}
                  </button>
                );
              })}
              <button
                type="button"
                className="rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-[11px] font-medium text-teal"
                onClick={() => {
                  const text = session.objective.trim();
                  const label = text.split(/[.!?\n]/)[0]?.trim().slice(0, 42) || "свой";
                  const res = addObjectiveTemplate(label, text);
                  store.setToast(
                    res === "added"
                      ? "Шаблон объективного статуса сохранён"
                      : res === "exists"
                        ? "Такой текст уже есть в шаблонах"
                        : "Сначала напишите текст статуса",
                  );
                }}
              >
                + в шаблоны
              </button>
            </div>
            <FitTextarea
              value={session.objective}
              onChange={(v) => setSession({ objective: v })}
              placeholder="Объективный статус"
              className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none"
            />
          </Sec>
      )}
      </Slot>

      <Slot order={slotOf("status", 60)}>
      {want("status") && (
          <Sec
            id="status"
            title="Локальный статус"
            badge={session.localStatus.length ? String(session.localStatus.length) : undefined}
            open={session.openSection === "status"}
            onOpen={() => setSession({ openSection: session.openSection === "status" ? null : "status" })}
            onRemove={() => toggleBlock("status")}
          >
            <div className="flex flex-wrap gap-1">
              {packs.map((p) => {
                const code = session.diagnosisCode.trim().toUpperCase();
                const prefix = code.split(".")[0];
                const byIcd =
                  !!code &&
                  p.codes.some((raw) => {
                    const u = raw.trim().toUpperCase();
                    return u === code || u === prefix || code.startsWith(`${u}.`) || u.startsWith(`${code}.`);
                  });
                const on = (session.activeLocalPacks || []).includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={on ? "Убрать шаблон" : "Вставить шаблон"}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      on ? "bg-teal text-paper" : "border border-line bg-paper"
                    }`}
                    onClick={() => toggleLocalPack(p)}
                  >
                    {p.label}
                    {byIcd ? " · мкб" : ""}
                  </button>
                );
              })}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-xs font-bold text-teal"
                onClick={() => setLocalAdd(true)}
                title="Своя фраза — в текст и в шаблоны"
              >
                свой
              </button>
            </div>
            {packs.length === 0 && (
              <p className="mt-1 text-xs text-mute">Шаблонов нет. Справочник → Блоки → локальный статус.</p>
            )}
            {(session.activeLocalPacks || []).map((id) => {
              const pack = packs.find((p) => p.id === id);
              if (!pack) return null;
              return (
                <div key={id} className="mt-2 rounded-md border border-line/70 bg-paper px-2 py-1.5">
                  <div className="text-[10px] font-semibold tracking-wide text-mute uppercase">{pack.label}</div>
                  {localItems(pack).map((it) => {
                    const pick = (session.localPicks || []).find((x) => x.packId === id && x.itemId === it.id);
                    return (
                      <LocalOptionRow
                        key={it.id}
                        item={it}
                        value={pick?.value || ""}
                        subs={pick?.subs || []}
                        onChange={(v) => setLocalPickValue(id, it.id, v)}
                        onSubs={(subs) => setLocalPickValue(id, it.id, pick?.value || "", subs)}
                        onAddOption={(v) => {
                          addLocalOption(id, it.id, v);
                          setLocalPickValue(id, it.id, v);
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
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
            {localFree().length > 0 && (
              <>
                <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">свои фразы · клик — править</div>
                <EditableChips
                  items={localFree()}
                  onChange={(next) => writeLocal(session.activeLocalPacks || [], session.localPicks || [], next)}
                />
              </>
            )}
          </Sec>
      )}
      </Slot>

      <Slot order={studiesOrder}>
      {session.diagnosisCode && hubMode === "block" && !documentMode && (
        <div className="legacy-surface klinrek-slot">{klinrekPanel("studies")}</div>
      )}
      {!showRecs && (
        <StudyDrugHints studies={session.studies} selected={session.recommendations} onAdd={addRecommendation} />
      )}
      {session.studies.map((s) => (
        <StudyCard key={s.key} studyKey={s.key} />
      ))}
      <DeviationsSpoiler />
      </Slot>

      <Slot order={tailOrder}>
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
      </Slot>

      <Slot order={tailOrder + 5}>
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
      </Slot>

      <Slot order={slotOf("recommendations", 80)}>
        <RecommendationsBlock
          showRecs={showRecs}
          session={session}
          setSession={setSession}
          toggleBlock={toggleBlock}
          showAi={showAi}
          polish={polish}
          fromPractice={fromPractice}
          addRecommendation={addRecommendation}
          hubMode={hubMode}
          klinrekPanel={klinrekPanel}
          diagnosisText={diagnosisText}
          ixBusy={ixBusy}
          runInteractions={runInteractions}
          ixText={ixText}
        />
      </Slot>
    </div>
  );

  const preview = (
    <div className="flex h-full flex-col gap-1.5 bg-preview p-2.5 md:p-3">
      {settings.diagnosisAbovePreview && diagnosisBlock}
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
            copyText(composeAll(session, patient, false, { deviations: settings.studyDeviations !== false })).then((ok) =>
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
          {patient ? `${formatPatient(patient)}, ${patient.age}` : "без пациента"}
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
            <ProtocolText text={b.text} />
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
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Очистить протокол. Карточка пациента не трогается."
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:border-danger hover:bg-danger-soft hover:text-danger"
            onClick={() => store.clearProtocol()}
          >
            <Eraser className="size-3.5" />
            стереть
          </button>
          <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => store.saveVisit()}>
            Сохранить в историю
          </button>
        </div>
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
      <div
        ref={splitWrap}
        className={`grid min-h-[calc(100dvh-3rem)] grid-cols-1 md:[grid-template-columns:minmax(240px,var(--split))_8px_minmax(280px,1fr)] ${
          deviationCount ? "pb-28 md:pb-16" : "pb-16 md:pb-0"
        } ${liveSplit != null ? "select-none" : ""}`}
        style={{ ["--split" as string]: `${splitPct}%` }}
      >
        <div className={`min-h-0 min-w-0 ${mobileTab === "build" ? "block" : "hidden md:block"}`}>{assembly}</div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ширина сборки и Медлок"
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          aria-valuenow={splitPct}
          tabIndex={0}
          className="relative hidden cursor-col-resize touch-none outline-none md:block"
          onPointerDown={(e) => {
            splitDragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
            moveSplit(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!splitDragging.current) return;
            moveSplit(e.clientX);
          }}
          onPointerUp={commitSplit}
          onPointerCancel={commitSplit}
          onDoubleClick={() => {
            store.setSettings({ splitPct: SPLIT_DEFAULT });
            setLiveSplit(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              store.setSettings({ splitPct: clampSplit(splitPct - 2) });
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              store.setSettings({ splitPct: clampSplit(splitPct + 2) });
            } else if (e.key === "Home") {
              e.preventDefault();
              store.setSettings({ splitPct: SPLIT_MIN });
            } else if (e.key === "End") {
              e.preventDefault();
              store.setSettings({ splitPct: SPLIT_MAX });
            }
          }}
        >
          <span
            className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${
              liveSplit != null ? "bg-teal" : "bg-line"
            }`}
          />
          <span
            className={`absolute top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              liveSplit != null ? "bg-teal" : "bg-mute"
            }`}
          />
        </div>
        <div className={`min-h-0 min-w-0 ${mobileTab === "preview" ? "block" : "hidden md:block"}`}>{preview}</div>
      </div>
    </AppShell>
  );
}

function ProtocolText({ text }: { text: string }) {
  if (!hasMarkup(text)) {
    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {text.split("\n").map((line, i) =>
          line.startsWith("Источник:") ? (
            <span key={i} className="mt-1 block text-[11px] text-mute">
              {line}
              {"\n"}
            </span>
          ) : (
            <span key={i}>
              {line}
              {i < text.split("\n").length - 1 ? "\n" : ""}
            </span>
          ),
        )}
      </div>
    );
  }
  return (
    <div
      className="text-sm leading-relaxed [&_em]:italic [&_p]:m-0 [&_.pack-source]:mt-1 [&_.pack-source]:block [&_.pack-source]:text-[11px] [&_.pack-source]:text-mute [&_strong]:font-semibold [&_u]:underline [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
      dangerouslySetInnerHTML={{ __html: mdToHtml(text) }}
    />
  );
}

