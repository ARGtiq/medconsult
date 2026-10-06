import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  getTemplates,
  resetTemplates,
  saveTemplates,
  seedTemplates,
  STD_DOC_BLOCKS,
  complaintOptionSubs,
  complaintOptionText,
  type ComplaintTemplate,
  type DocKind,
  type GlobalTemplate,
  type ObjectiveTemplate,
  type TemplatesState,
  type VitaePreset,
  type VisitPack,
} from "./data/templates";
import { emptyScale, itemKind, type ScaleDef, type ScaleItem, type ScaleItemKind, type ScaleVerdict } from "./data/questionnaires";
import { searchIcd } from "./live";
import { Typeahead } from "./Typeahead";
import type { LocalItem, LocalPack, WorkKind } from "./types";
import { deleteDisease, diseaseKey, findDisease, listDiseases, saveDisease, type Disease } from "./diseases";
import StudiesTab from "@/legacy/components/StudiesTab";
import { useAppStore } from "./store";

type BlockTab = "objective" | "status" | "chronic" | "complaints" | "docs" | "questionnaires" | "studies" | "vitae";

function IcdCodesField({
  codes,
  onChange,
  placeholder = "МКБ: N40, гиперплаз… неполный код тоже",
}: {
  codes: string[];
  onChange: (c: string[]) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchIcd(q, 12), [q]);
  function add(code: string) {
    const c = code.trim();
    if (!c) return;
    if (codes.some((x) => x.toUpperCase() === c.toUpperCase())) return;
    onChange([...codes, c]);
  }
  return (
    <div>
      {codes.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {codes.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-0.5 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-teal"
            >
              {c}
              <button type="button" className="text-mute" onClick={() => onChange(codes.filter((x) => x !== c))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <Typeahead
        value={q}
        onChange={setQ}
        items={hits.map((h) => ({ id: h.code, label: h.code, hint: h.title }))}
        onPick={(it) => add(it.id)}
        onSubmitCustom={add}
        placeholder={placeholder}
        emptyHint={q.trim() ? "Enter — как есть" : undefined}
      />
    </div>
  );
}

const ITEM_KINDS: { id: ScaleItemKind; label: string }[] = [
  { id: "score", label: "балл" },
  { id: "yesno", label: "да/нет" },
  { id: "choice", label: "варианты" },
  { id: "text", label: "текст" },
  { id: "heading", label: "заголовок" },
];

function formatOptions(it: ScaleItem) {
  return (it.options || []).map((o) => `${o.label}=${o.score ?? o.value}`).join("; ");
}

function parseOptions(raw: string): ScaleItem["options"] {
  return raw
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      const m = s.match(/^(.*?)\s*=\s*(-?\d+(?:[.,]\d+)?)$/);
      if (m) return { value: String(i), label: m[1].trim(), score: Number(m[2].replace(",", ".")) };
      return { value: String(i), label: s, score: i };
    });
}

export function TemplatesEditor({
  layer = "blocks",
  initialSection,
}: {
  layer?: "blocks" | "packs" | "global";
  initialSection?: BlockTab;
}) {
  const [tab, setTab] = useState<BlockTab>(initialSection || "status");
  const [data, setData] = useState<TemplatesState>(() => getTemplates());

  const echo = useRef(false);

  useEffect(() => {
    function reload() {
      if (echo.current) return;
      setData(getTemplates());
    }
    window.addEventListener("medconsult-templates", reload);
    return () => window.removeEventListener("medconsult-templates", reload);
  }, []);

  function persist(patch: Partial<TemplatesState>) {
    const next = { ...data, ...patch };
    setData(next);
    echo.current = true;
    saveTemplates(patch);
    echo.current = false;
  }

  const title = layer === "packs" ? "Наборы" : layer === "global" ? "Глобальные шаблоны" : "Блоки";

  return (
    <section className="mb-4 rounded-[10px] border border-line bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        <button
          type="button"
          className="ml-auto text-xs text-mute"
          onClick={() => {
            resetTemplates();
            setData(seedTemplates());
          }}
          hidden={layer === "global" || (layer === "blocks" && (tab === "studies" || tab === "vitae"))}
        >
          сбросить к заводским
        </button>
      </div>
      {layer === "blocks" && (
        <>
          <p className="mb-2 text-xs text-ink-soft">
            Словари чипов и исследования. Из чипов потом собирается набор, из исследований — протокол.
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {(
              [
                ["complaints", "жалобы"],
                ["vitae", "анамнез жизни"],
                ["objective", "объективный статус"],
                ["status", "локальный статус"],
                ["questionnaires", "анкеты"],
                ["studies", "исследования"],
                ["docs", "виды блоков"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  tab === id ? "bg-teal-soft font-semibold text-teal" : "border border-line bg-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "objective" && (
            <ObjectiveEditor items={data.objective || []} onChange={(objective) => persist({ objective })} />
          )}
          {tab === "vitae" && (
            <div className="space-y-2">
              <StudiesTab scope="vitae" />
              <Fold title="Перенесённые заболевания" hint="Один список с карточками болезней. Чипы на приёме берутся отсюда. «i» есть, если кроме названия что-то заполнено.">
                <PastDiseaseEditor items={data.chronic} onChange={(chronic) => persist({ chronic })} />
              </Fold>
              <Fold title="Операции" hint="Свои операции с приёма тоже попадают сюда.">
                <PresetEditor
                  items={data.surgeries}
                  onChange={(surgeries) => persist({ surgeries })}
                  describe
                />
              </Fold>
            </div>
          )}
          {tab === "status" && <PacksEditor packs={data.localPacks} onChange={(localPacks) => persist({ localPacks })} />}
          {tab === "complaints" && (
            <ComplaintDictEditor
              items={data.complaints}
              onChange={(complaints) => persist({ complaints })}
            />
          )}
          {tab === "questionnaires" && (
            <QuestionnaireEditor
              items={data.questionnaires}
              onChange={(questionnaires) => persist({ questionnaires })}
            />
          )}
          {tab === "docs" && <DocKindsEditor items={data.docKinds} onChange={(docKinds) => persist({ docKinds })} />}
          {tab === "studies" && <StudiesTab />}
        </>
      )}
      {layer === "packs" && (
        <VisitPacksEditor
          packs={data.visitPacks}
          localPacks={data.localPacks}
          docKinds={data.docKinds}
          onChange={(visitPacks) => persist({ visitPacks })}
        />
      )}
      {layer === "global" && (
        <GlobalTemplatesEditor
          items={data.globalTemplates || []}
          docKinds={data.docKinds}
          onChange={(globalTemplates) => persist({ globalTemplates })}
        />
      )}
    </section>
  );
}

function Fold({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-line bg-paper">
      <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-semibold" onClick={() => setOpen((v) => !v)}>
        <span className="text-mute">{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && (
        <div className="border-t border-line/70 px-2 py-2">
          {hint ? <p className="mb-2 text-xs text-ink-soft">{hint}</p> : null}
          {children}
        </div>
      )}
    </div>
  );
}

function ItemFold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-line/70 bg-surface">
      <button type="button" className="flex w-full items-center gap-1 px-2 py-1 text-left text-sm" onClick={() => setOpen((v) => !v)}>
        <span className="w-3 text-[10px] text-mute">{open ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1 truncate">{title.trim() || "без названия"}</span>
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

const EMPTY_DISEASE = { classification: "", diagnosis: "", treatment: "", prevention: "", extra: "" };

function diseaseBody(name: string): Disease {
  return findDisease(name) || { name, ...EMPTY_DISEASE };
}

function writeDisease(name: string, patch: Partial<Disease>) {
  const n = name.trim();
  if (!n) return;
  const prev = diseaseBody(n);
  saveDisease({ ...prev, ...patch, name: n });
}

function PastDiseaseEditor({ items, onChange }: { items: VitaePreset[]; onChange: (p: VitaePreset[]) => void }) {
  const [diseases, setDiseases] = useState<Disease[]>(() => listDiseases());
  useEffect(() => {
    const sync = () => setDiseases(listDiseases());
    window.addEventListener("medconsult-diseases", sync);
    return () => window.removeEventListener("medconsult-diseases", sync);
  }, []);
  const sig = items.map((p) => p.label.trim().toLowerCase()).join("\n");
  const diseaseSig = diseases.map((d) => d.name.trim().toLowerCase()).join("\n");
  useEffect(() => {
    const have = new Set(sig.split("\n").filter(Boolean));
    const extra = diseases.filter((d) => d.name.trim() && !have.has(d.name.trim().toLowerCase()));
    if (!extra.length) return;
    onChange([
      ...items,
      ...extra.map((d, i) => ({ id: `dis_${Date.now().toString(36)}_${i}`, label: d.name })),
    ]);
    // merge orphan disease cards into the chip list once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, diseaseSig]);

  function patch(i: number, p: Partial<VitaePreset>) {
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }

  function rename(i: number, label: string) {
    const prevLabel = items[i]?.label || "";
    patch(i, { label });
    const body = diseaseBody(prevLabel);
    if (prevLabel.trim() && diseaseKey(prevLabel) !== diseaseKey(label)) deleteDisease(prevLabel);
    if (label.trim()) saveDisease({ ...body, name: label.trim() });
  }

  return (
    <div className="space-y-1">
      {items.map((it, i) => {
        const body = diseaseBody(it.label);
        return (
          <ItemFold key={it.id} title={it.label}>
            <div className="flex flex-wrap items-center gap-1">
              <input
                value={it.label}
                onChange={(e) => rename(i, e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-1 text-[11px] text-mute">
                <input type="checkbox" checked={!!it.needsDate} onChange={(e) => patch(i, { needsDate: e.target.checked })} />
                дата
              </label>
              {it.needsDate && (
                <input
                  value={it.emptyDateText || ""}
                  onChange={(e) => patch(i, { emptyDateText: e.target.value })}
                  placeholder="если пусто"
                  className="w-24 rounded-md border border-line bg-paper px-1 py-1 text-xs"
                />
              )}
              <button
                type="button"
                className="text-xs font-medium text-teal"
                onClick={() => {
                  const label = `${it.label} (копия)`;
                  onChange([...items, { ...it, id: `p_${Date.now()}`, label }]);
                  if (it.label.trim()) saveDisease({ ...body, name: label });
                }}
              >
                копия
              </button>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => {
                  onChange(items.filter((_, j) => j !== i));
                  if (it.label.trim()) deleteDisease(it.label);
                }}
              >
                ×
              </button>
            </div>
            <textarea value={body.classification} onChange={(e) => writeDisease(it.label, { classification: e.target.value })} rows={2} placeholder="классификация" className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs" />
            <textarea value={body.diagnosis} onChange={(e) => writeDisease(it.label, { diagnosis: e.target.value })} rows={2} placeholder="диагностика" className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs" />
            <textarea value={body.treatment} onChange={(e) => writeDisease(it.label, { treatment: e.target.value })} rows={2} placeholder="лечение" className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs" />
            <textarea value={body.prevention} onChange={(e) => writeDisease(it.label, { prevention: e.target.value })} rows={2} placeholder="профилактика" className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs" />
            <textarea value={body.extra} onChange={(e) => writeDisease(it.label, { extra: e.target.value })} rows={2} placeholder="дополнительная информация" className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs" />
          </ItemFold>
        );
      })}
      <button
        type="button"
        className="mt-1 text-xs font-medium text-teal"
        onClick={() => onChange([...items, { id: `p_${Date.now()}`, label: "новое" }])}
      >
        + пункт
      </button>
    </div>
  );
}

function linesText(value: string[]) {
  return value.join("\n");
}

function textLines(raw: string) {
  return raw.split("\n");
}

function blankGlobal(): GlobalTemplate {
  return {
    id: `gtpl_${Date.now().toString(36)}`,
    name: "новый шаблон",
    codes: [],
    kind: "primary",
    stdBlocks: STD_DOC_BLOCKS.map((b) => b.id),
    extraKinds: [],
    complaints: [],
    anamnesis: "",
    anamnesisVitae: "",
    objective: "",
    localStatus: [],
    diagnosisCode: "",
    diagnosisTitle: "",
    recommendations: [],
    notes: "",
  };
}

function GlobalTemplatesEditor({
  items,
  docKinds,
  onChange,
}: {
  items: GlobalTemplate[];
  docKinds: DocKind[];
  onChange: (items: GlobalTemplate[]) => void;
}) {
  const [sel, setSel] = useState(items[0]?.id || "");
  const current = items.find((p) => p.id === sel) || items[0];

  function patch(p: Partial<GlobalTemplate>) {
    if (!current) return;
    onChange(items.map((x) => (x.id === current.id ? { ...x, ...p } : x)));
  }

  function toggleBlock(id: string) {
    if (!current) return;
    const set = new Set(current.stdBlocks);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ stdBlocks: [...set] });
  }

  function toggleExtra(id: string) {
    if (!current) return;
    const set = new Set(current.extraKinds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ extraKinds: [...set] });
  }

  function takeFromProtocol() {
    if (!current) return;
    const s = useAppStore.getState().session;
    const all = STD_DOC_BLOCKS.map((b) => b.id);
    const stdBlocks = s.mode === "document" ? s.docStd || [] : all.filter((id) => !s.hiddenBlocks.includes(id));
    const kind = s.mode === "document" ? "document" : s.mode === "study" ? "study" : s.visitKind;
    patch({
      kind,
      stdBlocks,
      extraKinds: (s.extraBlocks || []).map((b) => b.kindId),
      complaints: [...(s.complaints || [])],
      anamnesis: s.anamnesis || "",
      anamnesisVitae: s.anamnesisVitae || "",
      objective: s.objective || "",
      localStatus: [...(s.localStatus || [])],
      diagnosisCode: s.diagnosisCode || "",
      diagnosisTitle: s.diagnosisTitle || "",
      recommendations: [...(s.recommendations || [])],
      notes: s.notes || "",
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">
        Глобальный шаблон — какие блоки открыть и что в них уже написано. На протоколе кнопка «шаблон». Пустые поля при
        вставке не затирают то, что уже введено.
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              current?.id === p.id ? "bg-teal text-paper" : "border border-line bg-paper"
            }`}
          >
            {p.name || "без названия"}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-dashed border-teal/50 px-2.5 py-1 text-xs font-medium text-teal"
          onClick={() => {
            const next = blankGlobal();
            onChange([...items, next]);
            setSel(next.id);
          }}
        >
          + шаблон
        </button>
      </div>
      {current ? (
        <div className="space-y-2 rounded-lg border border-line bg-paper p-2">
          <div className="flex flex-wrap gap-1">
            <input
              value={current.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="название, напр. цистит первичный"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <button type="button" className="text-xs text-teal" onClick={takeFromProtocol}>
              взять с протокола
            </button>
            <button
              type="button"
              className="text-xs text-danger"
              onClick={() => {
                const next = items.filter((p) => p.id !== current.id);
                onChange(next);
                setSel(next[0]?.id || "");
              }}
            >
              ×
            </button>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-mute uppercase">МКБ</div>
            <IcdCodesField codes={current.codes} onChange={(codes) => patch({ codes })} />
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-mute uppercase">вид</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(
                [
                  ["primary", "первичный"],
                  ["followup", "повторный"],
                  ["study", "обследование"],
                  ["document", "другой документ"],
                ] as [WorkKind, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ kind: id })}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    current.kind === id ? "bg-teal-soft font-medium text-teal" : "border border-line bg-surface"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-mute uppercase">блоки</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {STD_DOC_BLOCKS.map((b) => {
                const on = current.stdBlocks.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBlock(b.id)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-surface"
                    }`}
                  >
                    {b.title}
                  </button>
                );
              })}
            </div>
          </div>
          {docKinds.length > 0 && (
            <div>
              <div className="text-[10px] tracking-wide text-mute uppercase">доп. блоки</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {docKinds.map((b) => {
                  const on = current.extraKinds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleExtra(b.id)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-surface"
                      }`}
                    >
                      {b.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">жалобы, каждая с новой строки</span>
            <textarea
              value={linesText(current.complaints)}
              onChange={(e) => patch({ complaints: textLines(e.target.value) })}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">анамнез заболевания</span>
            <textarea
              value={current.anamnesis}
              onChange={(e) => patch({ anamnesis: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">анамнез жизни</span>
            <textarea
              value={current.anamnesisVitae}
              onChange={(e) => patch({ anamnesisVitae: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">объективный статус</span>
            <textarea
              value={current.objective}
              onChange={(e) => patch({ objective: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">локальный статус, каждая строка — чип</span>
            <textarea
              value={linesText(current.localStatus)}
              onChange={(e) => patch({ localStatus: textLines(e.target.value) })}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <input
              value={current.diagnosisCode}
              onChange={(e) => patch({ diagnosisCode: e.target.value })}
              placeholder="код МКБ"
              className="w-28 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <input
              value={current.diagnosisTitle}
              onChange={(e) => patch({ diagnosisTitle: e.target.value })}
              placeholder="формулировка диагноза"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </div>
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">назначения, каждое с новой строки</span>
            <textarea
              value={linesText(current.recommendations)}
              onChange={(e) => patch({ recommendations: textLines(e.target.value) })}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[10px] tracking-wide text-mute uppercase">заметки</span>
            <textarea
              value={current.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
        </div>
      ) : (
        <p className="text-xs text-mute">Пока нет шаблонов — нажми «+ шаблон».</p>
      )}
    </div>
  );
}

function VisitPacksEditor({
  packs,
  localPacks,
  docKinds,
  onChange,
}: {
  packs: VisitPack[];
  localPacks: LocalPack[];
  docKinds: DocKind[];
  onChange: (p: VisitPack[]) => void;
}) {
  const [sel, setSel] = useState(packs[0]?.id || "");
  const current = packs.find((p) => p.id === sel) || packs[0];

  function patch(p: Partial<VisitPack>) {
    if (!current) return;
    onChange(packs.map((x) => (x.id === current.id ? { ...x, ...p } : x)));
  }

  function toggleArr(key: "stdBlocks" | "extraKinds" | "localPackIds", id: string) {
    if (!current) return;
    const set = new Set(current[key]);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ [key]: [...set] } as Partial<VisitPack>);
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">
        Набор — какие блоки открыть, без готового текста. На протоколе кнопка «набор». Готовый текст — во вкладке
        «Глобальные».
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {packs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              current?.id === p.id ? "bg-teal text-paper" : "border border-line bg-paper"
            }`}
          >
            {p.name || "без названия"}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-dashed border-teal/50 px-2.5 py-1 text-xs font-medium text-teal"
          onClick={() => {
            const id = `pack_${Date.now()}`;
            const next: VisitPack = {
              id,
              name: "новый набор",
              kind: "primary",
              codes: [],
              stdBlocks: STD_DOC_BLOCKS.map((b) => b.id),
              extraKinds: [],
              localPackIds: [],
            };
            onChange([...packs, next]);
            setSel(id);
          }}
        >
          + набор
        </button>
      </div>
      {current ? (
        <div className="space-y-2 rounded-lg border border-line bg-paper p-2">
          <div className="flex flex-wrap gap-1">
            <input
              value={current.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="название, напр. ДГПЖ первичный"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <button
              type="button"
              className="text-xs text-danger"
              onClick={() => {
                const next = packs.filter((p) => p.id !== current.id);
                onChange(next);
                setSel(next[0]?.id || "");
              }}
            >
              ×
            </button>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-mute uppercase">блоки протокола</div>
            <p className="mt-0.5 text-[10px] text-ink-soft">Порядок здесь — порядок на протоколе, когда выбран этот набор.</p>
            <div className="mt-1 space-y-1">
              {current.stdBlocks.map((id, i) => {
                const b = STD_DOC_BLOCKS.find((x) => x.id === id);
                if (!b) return null;
                return (
                  <div key={id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded border border-line px-1.5 text-xs text-ink-soft disabled:opacity-30"
                      disabled={i === 0}
                      onClick={() => {
                        const stdBlocks = [...current.stdBlocks];
                        [stdBlocks[i - 1], stdBlocks[i]] = [stdBlocks[i], stdBlocks[i - 1]];
                        patch({ stdBlocks });
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded border border-line px-1.5 text-xs text-ink-soft disabled:opacity-30"
                      disabled={i === current.stdBlocks.length - 1}
                      onClick={() => {
                        const stdBlocks = [...current.stdBlocks];
                        [stdBlocks[i + 1], stdBlocks[i]] = [stdBlocks[i], stdBlocks[i + 1]];
                        patch({ stdBlocks });
                      }}
                    >
                      ↓
                    </button>
                    <span className="min-w-0 flex-1 text-xs">{b.title}</span>
                    <button type="button" className="text-xs text-danger" onClick={() => toggleArr("stdBlocks", id)}>
                      убрать
                    </button>
                  </div>
                );
              })}
            </div>
            {STD_DOC_BLOCKS.some((b) => !current.stdBlocks.includes(b.id)) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {STD_DOC_BLOCKS.filter((b) => !current.stdBlocks.includes(b.id)).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleArr("stdBlocks", b.id)}
                    className="rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-xs text-teal"
                  >
                    + {b.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          {docKinds.length > 0 && (
            <div>
              <div className="text-[10px] tracking-wide text-mute uppercase">доп. блоки</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {docKinds.map((b) => {
                  const on = current.extraKinds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleArr("extraKinds", b.id)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-surface"
                      }`}
                    >
                      {b.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {localPacks.length > 0 && (
            <div>
              <div className="text-[10px] tracking-wide text-mute uppercase">пакеты локального статуса</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {localPacks.map((b) => {
                  const on = current.localPackIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleArr("localPackIds", b.id)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        on ? "bg-teal-soft font-medium text-teal" : "border border-line bg-surface"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-mute">Пока нет наборов — нажми «+ набор».</p>
      )}
    </div>
  );
}

function QuestionnaireEditor({
  items,
  onChange,
}: {
  items: ScaleDef[];
  onChange: (p: ScaleDef[]) => void;
}) {
  const [sel, setSel] = useState(items[0]?.totalKey || "");
  const current = items.find((s) => s.totalKey === sel) || items[0];

  function patch(p: Partial<ScaleDef>) {
    if (!current) return;
    onChange(items.map((x) => (x.totalKey === current.totalKey ? { ...x, ...p } : x)));
  }

  function patchItem(i: number, p: Partial<ScaleItem>) {
    if (!current) return;
    patch({ items: current.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) });
  }

  function patchVerdict(i: number, p: Partial<ScaleVerdict>) {
    if (!current) return;
    const list = [...(current.verdicts || [])];
    list[i] = { ...list[i], ...p };
    patch({ verdicts: list });
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">
        Каждая анкета вставляется отдельно. МКБ — чтобы предлагать её при диагнозе. Типы вопросов: балл, да/нет, варианты,
        текст, заголовок блока. Сумма и вердикт — если нужно.
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {items.map((s) => (
          <button
            key={s.totalKey}
            type="button"
            onClick={() => setSel(s.totalKey)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              current?.totalKey === s.totalKey ? "bg-teal text-paper" : "border border-line bg-paper"
            }`}
          >
            {s.title || "без названия"}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-dashed border-teal/50 px-2.5 py-1 text-xs font-medium text-teal"
          onClick={() => {
            const next = emptyScale();
            onChange([...items, next]);
            setSel(next.totalKey);
          }}
        >
          + анкета
        </button>
      </div>
      {current ? (
        <div className="space-y-2 rounded-lg border border-line bg-paper p-2">
          <div className="flex flex-wrap gap-1">
            <input
              value={current.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="название, напр. IPSS"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <button
              type="button"
              className="text-xs text-danger"
              onClick={() => {
                const next = items.filter((s) => s.totalKey !== current.totalKey);
                onChange(next);
                setSel(next[0]?.totalKey || "");
              }}
            >
              ×
            </button>
          </div>
          <input
            value={current.hint}
            onChange={(e) => patch({ hint: e.target.value })}
            placeholder="подсказка под названием"
            className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
          />
          <div>
            <div className="text-[10px] tracking-wide text-mute uppercase">МКБ</div>
            <IcdCodesField codes={current.codes || []} onChange={(codes) => patch({ codes })} />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={current.sum !== false}
              onChange={(e) => patch({ sum: e.target.checked })}
            />
            считать сумму баллов
          </label>
          <div>
            <div className="text-[10px] tracking-wide text-mute uppercase">вердикт по сумме</div>
            {(current.verdicts || []).map((v, i) => (
              <div key={i} className="mt-1 flex flex-wrap items-center gap-1">
                <input
                  value={v.min}
                  onChange={(e) => patchVerdict(i, { min: Number(e.target.value) })}
                  className="w-12 rounded-md border border-line bg-surface px-1 py-1 text-center text-xs tabular-nums"
                  title="от"
                />
                <span className="text-[10px] text-mute">–</span>
                <input
                  value={v.max}
                  onChange={(e) => patchVerdict(i, { max: Number(e.target.value) })}
                  className="w-12 rounded-md border border-line bg-surface px-1 py-1 text-center text-xs tabular-nums"
                  title="до"
                />
                <input
                  value={v.text}
                  onChange={(e) => patchVerdict(i, { text: e.target.value })}
                  placeholder="лёгкие"
                  className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-[10px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={!!v.flag}
                    onChange={(e) => patchVerdict(i, { flag: e.target.checked })}
                  />
                  откл.
                </label>
                <button
                  type="button"
                  className="text-xs text-danger"
                  onClick={() => patch({ verdicts: (current.verdicts || []).filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-1 text-xs font-medium text-teal"
              onClick={() =>
                patch({
                  verdicts: [...(current.verdicts || []), { min: 0, max: 0, text: "норма" }],
                })
              }
            >
              + вердикт
            </button>
          </div>
          <div className="text-[10px] tracking-wide text-mute uppercase">вопросы</div>
          {current.items.map((it, i) => {
            const kind = itemKind(it);
            return (
              <div key={it.key} className="rounded-md border border-line bg-surface p-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    value={it.label}
                    onChange={(e) => patchItem(i, { label: e.target.value })}
                    placeholder={kind === "heading" ? "заголовок блока" : "вопрос"}
                    className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
                  />
                  <select
                    value={kind}
                    onChange={(e) => {
                      const next = e.target.value as ScaleItemKind;
                      const extra: Partial<ScaleItem> = { kind: next };
                      if (next === "yesno") {
                        extra.min = 0;
                        extra.max = 1;
                        extra.binary = true;
                      } else if (next === "heading" || next === "text") {
                        extra.skipSum = true;
                      } else {
                        extra.binary = false;
                        extra.skipSum = false;
                      }
                      patchItem(i, extra);
                    }}
                    className="rounded-md border border-line bg-paper px-1 py-1 text-[11px]"
                  >
                    {ITEM_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-xs text-danger"
                    onClick={() => patch({ items: current.items.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
                {kind === "score" && (
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      value={it.min}
                      onChange={(e) => patchItem(i, { min: Number(e.target.value) || 0 })}
                      className="w-12 rounded-md border border-line bg-paper px-1 py-1 text-center text-xs tabular-nums"
                      title="мин"
                    />
                    <span className="text-[10px] text-mute">–</span>
                    <input
                      value={it.max}
                      onChange={(e) => patchItem(i, { max: Number(e.target.value) || 0 })}
                      className="w-12 rounded-md border border-line bg-paper px-1 py-1 text-center text-xs tabular-nums"
                      title="макс"
                    />
                  </div>
                )}
                {kind === "choice" && (
                  <input
                    value={formatOptions(it)}
                    onChange={(e) => patchItem(i, { options: parseOptions(e.target.value) })}
                    placeholder="нет=0; редко=1; часто=2"
                    className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
                  />
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-xs font-medium text-teal"
              onClick={() =>
                patch({
                  items: [
                    ...current.items,
                    {
                      key: `${current.totalKey}_${current.items.length + 1}_${Date.now().toString(36)}`,
                      label: `вопрос ${current.items.length + 1}`,
                      min: 0,
                      max: 5,
                      kind: "score",
                    },
                  ],
                })
              }
            >
              + вопрос
            </button>
            <button
              type="button"
              className="text-xs font-medium text-teal"
              onClick={() =>
                patch({
                  items: [
                    ...current.items,
                    {
                      key: `${current.totalKey}_h_${Date.now().toString(36)}`,
                      label: "блок",
                      min: 0,
                      max: 0,
                      kind: "heading",
                      skipSum: true,
                    },
                  ],
                })
              }
            >
              + заголовок
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-mute">Пока нет анкет — нажми «+ анкета».</p>
      )}
    </div>
  );
}

function ObjectiveEditor({
  items,
  onChange,
}: {
  items: ObjectiveTemplate[];
  onChange: (p: ObjectiveTemplate[]) => void;
}) {
  function patch(i: number, p: Partial<ObjectiveTemplate>) {
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-soft">
        Готовые тексты объективного статуса. На протоколе клик подставляет текст целиком, его можно сразу править. Пустые
        коды МКБ — шаблон для любого диагноза.
      </p>
      {items.map((item, i) => (
        <div key={item.id} className="rounded-lg border border-line bg-paper p-2">
          <div className="flex gap-2">
            <input
              value={item.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder="название"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <button
              type="button"
              className="text-[11px] font-medium text-teal"
              onClick={() => {
                const copy: ObjectiveTemplate = {
                  ...item,
                  id: `obj_${Date.now().toString(36)}`,
                  label: `${item.label || "статус"} (копия)`,
                  codes: [...(item.codes || [])],
                };
                onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)]);
              }}
            >
              копия
            </button>
            <button type="button" className="text-xs text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
          <div className="mt-1">
            <div className="text-[10px] tracking-wide text-mute uppercase">МКБ</div>
            <IcdCodesField
              codes={item.codes || []}
              onChange={(codes) => patch(i, { codes })}
              placeholder="МКБ, если шаблон только для этого кода"
            />
          </div>
          <textarea
            value={item.text}
            onChange={(e) => patch(i, { text: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs"
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-medium text-teal"
        onClick={() =>
          onChange([
            ...items,
            { id: `obj_${Date.now().toString(36)}`, label: "новый", text: "Состояние удовлетворительное.", codes: [] },
          ])
        }
      >
        + шаблон статуса
      </button>
    </div>
  );
}

function PacksEditor({ packs, onChange }: { packs: LocalPack[]; onChange: (p: LocalPack[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  function patch(i: number, p: Partial<LocalPack>) {
    onChange(packs.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  function itemsOf(p: LocalPack): LocalItem[] {
    if (p.items?.length) return p.items;
    return (p.chips || []).filter(Boolean).map((c, n) => ({ id: `${p.id}_c${n}`, label: c, options: [] }));
  }
  function setItems(i: number, items: LocalItem[]) {
    const chips = items
      .map((it) => (it.options[0] ? `${it.label} ${it.options[0]}` : it.label))
      .map((s) => s.trim())
      .filter(Boolean);
    patch(i, { items, chips });
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-soft">
        Список названий. Клик открывает шаблон. На протоколе клик по шаблону вставляет пункты, повторный клик убирает.
      </p>
      <div className="space-y-1">
        {packs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenId(p.id)}
            className="flex w-full items-center rounded-md border border-line bg-paper px-2 py-1.5 text-left text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{p.label.trim() || "без названия"}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-xs font-medium text-teal"
        onClick={() => {
          const id = `pack_${Date.now()}`;
          onChange([
            ...packs,
            {
              id,
              label: "новый пакет",
              codes: [],
              chips: [],
              items: [{ id: `it_${Date.now().toString(36)}`, label: "пункт", options: ["вариант"] }],
            },
          ]);
          setOpenId(id);
        }}
      >
        + пакет статуса
      </button>
      {packs.map((p, i) => {
        if (openId !== p.id) return null;
        const items = itemsOf(p);
        const editor = (
          <div className="rounded-lg border border-line bg-paper p-2">
            <div className="flex gap-2">
              <input
                value={p.label}
                onChange={(e) => patch(i, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
              />
              <button
                type="button"
                className="text-[11px] font-medium text-teal"
                onClick={() => {
                  const copyItems = items.map((it) => ({ ...it, id: `${it.id}_c`, options: [...it.options] }));
                  const copy: LocalPack = {
                    ...p,
                    id: `pack_${Date.now().toString(36)}`,
                    label: `${p.label || "пакет"} (копия)`,
                    codes: [...p.codes],
                    chips: [...p.chips],
                    items: copyItems,
                  };
                  onChange([...packs.slice(0, i + 1), copy, ...packs.slice(i + 1)]);
                  setOpenId(copy.id);
                }}
              >
                копия
              </button>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => {
                  setOpenId(null);
                  onChange(packs.filter((_, j) => j !== i));
                }}
              >
                ×
              </button>
            </div>
            <div className="mt-1">
              <div className="text-[10px] tracking-wide text-mute uppercase">разделители</div>
              <div className="mt-1 flex gap-2">
                <label className="min-w-0 flex-1 text-[10px] text-mute">
                  между пунктами
                  <input
                    value={p.itemSep ?? ", "}
                    onChange={(e) => patch(i, { itemSep: e.target.value })}
                    className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
                  />
                </label>
                <label className="min-w-0 flex-1 text-[10px] text-mute">
                  после шаблона
                  <input
                    value={p.packSep ?? "."}
                    onChange={(e) => patch(i, { packSep: e.target.value })}
                    className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>
            <div className="mt-1">
              <div className="text-[10px] tracking-wide text-mute uppercase">МКБ</div>
              <IcdCodesField codes={p.codes} onChange={(codes) => patch(i, { codes })} />
            </div>
            <div className="mt-2 space-y-2">
              {items.map((it, ii) => (
                <div key={it.id} className="rounded-md border border-line/70 bg-surface px-2 py-1.5">
                  <div className="flex gap-1">
                    <input
                      value={it.label}
                      onChange={(e) => setItems(i, items.map((x, j) => (j === ii ? { ...x, label: e.target.value } : x)))}
                      placeholder="пункт, напр. поколачивание"
                      className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={() => setItems(i, items.filter((_, j) => j !== ii))}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {it.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        title="Убрать вариант"
                        className="rounded-full bg-teal-soft px-2 py-0.5 text-xs text-teal"
                        onClick={() =>
                          setItems(
                            i,
                            items.map((x, j) => (j === ii ? { ...x, options: x.options.filter((opt) => opt !== o) } : x)),
                          )
                        }
                      >
                        {o} ×
                      </button>
                    ))}
                  </div>
                  <input
                    placeholder="вариант + Enter"
                    className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const raw = e.currentTarget.value.trim();
                      if (!raw) return;
                      e.preventDefault();
                      if (it.options.some((o) => o.toLowerCase() === raw.toLowerCase())) return;
                      setItems(i, items.map((x, j) => (j === ii ? { ...x, options: [...x.options, raw] } : x)));
                      e.currentTarget.value = "";
                    }}
                  />
                  <div className="mt-1">
                    <div className="text-[10px] text-mute">подпункты</div>
                    {(it.subs || []).map((group, gi) => (
                      <div key={gi} className="mt-1 flex flex-wrap items-center gap-1">
                        {group.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-teal"
                            onClick={() => {
                              const subs = (it.subs || []).map((g, j) => (j === gi ? g.filter((x) => x !== opt) : g)).filter((g) => g.length);
                              setItems(i, items.map((x, j) => (j === ii ? { ...x, subs } : x)));
                            }}
                          >
                            {opt} ×
                          </button>
                        ))}
                        <input
                          placeholder="вариант + Enter"
                          className="w-28 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px]"
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            const raw = e.currentTarget.value.trim();
                            if (!raw || group.some((o) => o.toLowerCase() === raw.toLowerCase())) return;
                            e.preventDefault();
                            const subs = (it.subs || []).map((g, j) => (j === gi ? [...g, raw] : g));
                            setItems(i, items.map((x, j) => (j === ii ? { ...x, subs } : x)));
                            e.currentTarget.value = "";
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-teal"
                      onClick={() => setItems(i, items.map((x, j) => (j === ii ? { ...x, subs: [...(x.subs || []), ["вариант"]] } : x)))}
                    >
                      + группа подпунктов
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-teal"
                onClick={() =>
                  setItems(i, [...items, { id: `it_${Date.now().toString(36)}`, label: "пункт", options: [] }])
                }
              >
                + пункт
              </button>
            </div>
          </div>
        );
        if (typeof document === "undefined") return editor;
        return createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-3 sm:items-center"
            onClick={() => setOpenId(null)}
          >
            <div
              className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-surface p-3 shadow-lg"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="text-sm font-semibold">Шаблон локального статуса</div>
                <button type="button" className="ml-auto text-xs text-mute" onClick={() => setOpenId(null)}>
                  закрыть
                </button>
              </div>
              {editor}
            </div>
          </div>,
          document.body,
        );
      })}
    </div>
  );
}


function ComplaintDictEditor({
  items,
  onChange,
}: {
  items: ComplaintTemplate[];
  onChange: (p: ComplaintTemplate[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [optDraft, setOptDraft] = useState<Record<number, string>>({});
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});
  const [openOpt, setOpenOpt] = useState<number | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const shown = items.map((it, i) => ({ it, i }));

  function patch(i: number, next: ComplaintTemplate) {
    onChange(items.map((x, idx) => (idx === i ? next : x)));
  }

  function addOption(i: number, raw: string) {
    const t = raw.trim();
    if (!t) return;
    const cur = items[i];
    if (!cur) return;
    const options = (cur.options || []).map((o) => ({ text: complaintOptionText(o), options: complaintOptionSubs(o) }));
    if (options.some((o) => o.text.toLowerCase() === t.toLowerCase())) return;
    patch(i, { ...cur, options: [...options, { text: t }] });
    setOptDraft((d) => ({ ...d, [i]: "" }));
  }

  function addSub(i: number, option: string, raw: string) {
    const t = raw.trim();
    if (!t) return;
    const cur = items[i];
    if (!cur) return;
    const options = (cur.options || []).map((o) => ({ text: complaintOptionText(o), options: complaintOptionSubs(o) }));
    patch(i, {
      ...cur,
      options: options.map((o) => {
        if (o.text.toLowerCase() !== option.toLowerCase()) return o;
        if ((o.options || []).some((s) => s.toLowerCase() === t.toLowerCase())) return o;
        return { ...o, options: [...(o.options || []), t] };
      }),
    });
    setSubDraft((d) => ({ ...d, [`${i}:${option}`]: "" }));
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">
        Словарь жалоб. «+опция» — уточнение (справа / слева). «+» на опции — подпункт этой опции. В протоколе они
        выпадают списком.
      </p>
      <div className="space-y-1.5">
        {shown.map(({ it, i }) => (
          <div key={`c-${i}`} className="rounded-md border border-line/70 bg-paper px-2 py-1.5">
            <div className="flex items-center gap-1">
              <input
                value={it.text}
                onChange={(e) => patch(i, { ...it, text: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
              />
              <button
                type="button"
                className="shrink-0 text-[11px] font-medium text-teal"
                onClick={() => {
                  const base = it.text.trim() || "жалоба";
                  let text = `${base} (копия)`;
                  let n = 2;
                  while (items.some((x) => x.text.toLowerCase() === text.toLowerCase())) text = `${base} (копия ${n++})`;
                  onChange([...items, { text, options: it.options?.map((o) => ({ text: complaintOptionText(o), options: complaintOptionSubs(o).slice() })) }]);
                }}
              >
                копия
              </button>
              <button
                type="button"
                className="shrink-0 rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-[11px] font-medium text-teal"
                onClick={() => setOpenOpt((v) => (v === i ? null : i))}
              >
                +опция
              </button>
              <button type="button" className="text-xs text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
            {(it.options && it.options.length > 0) || openOpt === i ? (
              <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-line pl-2">
                {(it.options || []).map((raw) => {
                  const label = complaintOptionText(raw);
                  const kids = complaintOptionSubs(raw);
                  const subKey = `${i}:${label}`;
                  return (
                    <div key={label}>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-teal">
                        {label}
                        <button
                          type="button"
                          className="text-mute"
                          title="Подпункт"
                          onClick={() => setOpenSub((v) => (v === subKey ? null : subKey))}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="text-mute"
                          onClick={() =>
                            patch(i, {
                              ...it,
                              options: (it.options || []).filter((x) => complaintOptionText(x).toLowerCase() !== label.toLowerCase()),
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                      {(kids.length > 0 || openSub === subKey) && (
                        <div className="mt-0.5 ml-4 flex flex-wrap items-center gap-1 border-l border-line pl-2">
                          {kids.map((s) => (
                            <span key={s} className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px]">
                              {s}
                              <button
                                type="button"
                                className="text-mute"
                                onClick={() =>
                                  patch(i, {
                                    ...it,
                                    options: (it.options || []).map((x) => {
                                      if (complaintOptionText(x).toLowerCase() !== label.toLowerCase()) return x;
                                      return { text: label, options: complaintOptionSubs(x).filter((k) => k !== s) };
                                    }),
                                  })
                                }
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {openSub === subKey ? (
                            <input
                              autoFocus
                              value={subDraft[subKey] || ""}
                              onChange={(e) => setSubDraft((d) => ({ ...d, [subKey]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addSub(i, label, subDraft[subKey] || "");
                                }
                                if (e.key === "Escape") setOpenSub(null);
                              }}
                              onBlur={() => {
                                if ((subDraft[subKey] || "").trim()) addSub(i, label, subDraft[subKey] || "");
                              }}
                              placeholder="подпункт + Enter"
                              className="w-36 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px]"
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
                {openOpt === i ? (
                  <input
                    autoFocus
                    value={optDraft[i] || ""}
                    onChange={(e) => setOptDraft((d) => ({ ...d, [i]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption(i, optDraft[i] || "");
                      }
                      if (e.key === "Escape") setOpenOpt(null);
                    }}
                    onBlur={() => {
                      if ((optDraft[i] || "").trim()) addOption(i, optDraft[i] || "");
                    }}
                    placeholder="опция + Enter"
                    className="w-32 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px]"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              const t = draft.trim();
              if (!items.some((x) => x.text.toLowerCase() === t.toLowerCase())) onChange([...items, { text: t }]);
              setDraft("");
            }
          }}
          placeholder="новая жалоба + Enter"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
        <button
          type="button"
          className="text-xs font-medium text-teal"
          onClick={() => {
            const t = draft.trim();
            if (!t) return;
            if (!items.some((x) => x.text.toLowerCase() === t.toLowerCase())) onChange([...items, { text: t }]);
            setDraft("");
          }}
        >
          + жалоба
        </button>
      </div>
    </div>
  );
}

function StringListEditor({
  items,
  onChange,
  hint,
  addLabel,
}: {
  items: string[];
  onChange: (p: string[]) => void;
  hint: string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const shown = [...items].sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
  function patchShown(i: number, next: string) {
    const old = shown[i];
    onChange(items.map((x) => (x === old ? next : x)));
  }
  function removeShown(i: number) {
    const old = shown[i];
    onChange(items.filter((x) => x !== old));
  }
  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">{hint}</p>
      <div className="space-y-1">
        {shown.map((it, i) => (
          <div key={`${it}-${i}`} className="flex items-center gap-1">
            <input
              value={it}
              onChange={(e) => patchShown(i, e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <button type="button" className="text-xs text-danger" onClick={() => removeShown(i)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              const t = draft.trim();
              if (!items.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...items, t]);
              setDraft("");
            }
          }}
          placeholder="новая формулировка + Enter"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
        />
        <button
          type="button"
          className="text-xs font-medium text-teal"
          onClick={() => {
            const t = draft.trim();
            if (!t) return;
            if (!items.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...items, t]);
            setDraft("");
          }}
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function PresetEditor({
  items,
  onChange,
  hint,
  describe,
}: {
  items: VitaePreset[];
  onChange: (p: VitaePreset[]) => void;
  hint?: string;
  describe?: boolean;
}) {
  function patch(i: number, p: Partial<VitaePreset>) {
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  return (
    <div>
      {hint ? <p className="mb-2 text-xs text-ink-soft">{hint}</p> : null}
      <div className="space-y-1">
        {items.map((it, i) => (
          <ItemFold key={it.id} title={it.label}>
            <div className="flex flex-wrap items-center gap-1">
              <input
                value={it.label}
                onChange={(e) => patch(i, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-1 text-[11px] text-mute">
                <input type="checkbox" checked={!!it.needsDate} onChange={(e) => patch(i, { needsDate: e.target.checked })} />
                дата
              </label>
              {it.needsDate && (
                <input
                  value={it.emptyDateText || ""}
                  onChange={(e) => patch(i, { emptyDateText: e.target.value })}
                  placeholder="если пусто"
                  className="w-24 rounded-md border border-line bg-paper px-1 py-1 text-xs"
                />
              )}
              <button
                type="button"
                className="text-xs font-medium text-teal"
                onClick={() => onChange([...items, { ...it, id: `p_${Date.now()}`, label: `${it.label} (копия)` }])}
              >
                копия
              </button>
              <button type="button" className="text-xs text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
            {describe && (
              <textarea
                value={it.about || ""}
                onChange={(e) => patch(i, { about: e.target.value })}
                rows={2}
                placeholder="описание. Если заполнено, на приёме у операции появится i"
                className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs"
              />
            )}
          </ItemFold>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 text-xs font-medium text-teal"
        onClick={() => onChange([...items, { id: `p_${Date.now()}`, label: "новое" }])}
      >
        + пункт
      </button>
    </div>
  );
}

function DocKindsEditor({ items, onChange }: { items: DocKind[]; onChange: (p: DocKind[]) => void }) {
  function patch(i: number, p: Partial<DocKind>) {
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">Доп. блоки «другого документа». Дневник может копировать прошлый текст.</p>
      {items.map((it, i) => (
        <div key={it.id} className="mb-1 flex flex-wrap items-center gap-1">
          <input
            value={it.title}
            onChange={(e) => patch(i, { title: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1 text-[11px] text-mute">
            <input
              type="checkbox"
              checked={!!it.copyPrevious}
              onChange={(e) => patch(i, { copyPrevious: e.target.checked })}
            />
            копировать прошлый
          </label>
          <button type="button" className="text-xs text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="mt-2 text-xs font-medium text-teal"
        onClick={() => onChange([...items, { id: `d_${Date.now()}`, title: "Новый блок" }])}
      >
        + вид блока
      </button>
    </div>
  );
}
