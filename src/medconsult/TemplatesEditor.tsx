import { useEffect, useMemo, useRef, useState } from "react";
import {
  getTemplates,
  resetTemplates,
  saveTemplates,
  seedTemplates,
  STD_DOC_BLOCKS,
  type ComplaintTemplate,
  type DocKind,
  type ObjectiveTemplate,
  type TemplatesState,
  type VitaePreset,
  type VisitPack,
} from "./data/templates";
import { emptyScale, itemKind, type ScaleDef, type ScaleItem, type ScaleItemKind, type ScaleVerdict } from "./data/questionnaires";
import { searchIcd } from "./live";
import { Typeahead } from "./Typeahead";
import type { LocalPack, WorkKind } from "./types";
import StudiesTab from "@/legacy/components/StudiesTab";

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

export function TemplatesEditor() {
  const [layer, setLayer] = useState<"blocks" | "packs" | "studies">("blocks");
  const [tab, setTab] = useState<"objective" | "status" | "chronic" | "surgery" | "complaints" | "docs" | "questionnaires">("status");
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

  return (
    <section className="mb-4 rounded-[10px] border border-line bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg">Шаблоны</h2>
        <span className="text-xs text-mute">сначала блоки, потом набор из них</span>
        <button
          type="button"
          className="ml-auto text-xs text-mute"
          onClick={() => {
            resetTemplates();
            setData(seedTemplates());
          }}
          hidden={layer === "studies"}
        >
          сбросить к заводским
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {(
          [
            ["blocks", "блоки"],
            ["packs", "наборы"],
            ["studies", "исследования"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setLayer(id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              layer === id ? "bg-teal text-paper" : "border border-line bg-paper"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {layer === "blocks" && (
        <>
          <p className="mb-2 text-xs text-ink-soft">
            Словари чипов: жалобы, статус, перенесённые, операции, анкеты, виды доп. блоков. Из них потом собирается набор.
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {(
              [
                ["objective", "объективный статус"],
                ["status", "локальный статус"],
                ["complaints", "жалобы"],
                ["chronic", "перенесённые"],
                ["surgery", "операции"],
                ["questionnaires", "анкеты"],
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
          {tab === "status" && <PacksEditor packs={data.localPacks} onChange={(localPacks) => persist({ localPacks })} />}
          {tab === "complaints" && (
            <ComplaintDictEditor
              items={data.complaints}
              onChange={(complaints) => persist({ complaints })}
            />
          )}
          {tab === "chronic" && (
            <PresetEditor
              items={data.chronic}
              onChange={(chronic) => persist({ chronic })}
              hint="Чипы перенесённых заболеваний в анамнезе жизни. Дата — для ИМ, ОНМК и т.п."
            />
          )}
          {tab === "surgery" && (
            <PresetEditor
              items={data.surgeries}
              onChange={(surgeries) => persist({ surgeries })}
              hint="Пустая дата может дать «давно» (поле «если пусто»)."
            />
          )}
          {tab === "questionnaires" && (
            <QuestionnaireEditor
              items={data.questionnaires}
              onChange={(questionnaires) => persist({ questionnaires })}
            />
          )}
          {tab === "docs" && <DocKindsEditor items={data.docKinds} onChange={(docKinds) => persist({ docKinds })} />}
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
      {layer === "studies" && <StudiesTab />}
    </section>
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
        Набор — готовый документ: вид приёма, какие блоки, какие пакеты статуса, коды МКБ. На протоколе выбирается кнопкой
        «набор».
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
            <div className="text-[10px] tracking-wide text-mute uppercase">МКБ</div>
            <IcdCodesField
              codes={current.codes}
              onChange={(codes) => patch({ codes })}
              placeholder="коды или кусок названия — пусто = любой диагноз"
            />
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
            <div className="text-[10px] tracking-wide text-mute uppercase">блоки протокола</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {STD_DOC_BLOCKS.map((b) => {
                const on = current.stdBlocks.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleArr("stdBlocks", b.id)}
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
  function patch(i: number, p: Partial<LocalPack>) {
    onChange(packs.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  return (
    <div className="space-y-2">
      {packs.map((p, i) => (
        <div key={p.id} className="rounded-lg border border-line bg-paper p-2">
          <div className="flex gap-2">
            <input
              value={p.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <button type="button" className="text-xs text-danger" onClick={() => onChange(packs.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
          <div className="mt-1">
            <div className="text-[10px] tracking-wide text-mute uppercase">МКБ</div>
            <IcdCodesField codes={p.codes} onChange={(codes) => patch(i, { codes })} />
          </div>
          <textarea
            value={p.chips.join("\n")}
            onChange={(e) => patch(i, { chips: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
            className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs"
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-medium text-teal"
        onClick={() =>
          onChange([...packs, { id: `pack_${Date.now()}`, label: "новый пакет", codes: [], chips: ["фраза"] }])
        }
      >
        + пакет статуса
      </button>
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
  const [openOpt, setOpenOpt] = useState<number | null>(null);
  const shown = items.map((it, i) => ({ it, i }));

  function patch(i: number, next: ComplaintTemplate) {
    onChange(items.map((x, idx) => (idx === i ? next : x)));
  }

  function addOption(i: number, raw: string) {
    const t = raw.trim();
    if (!t) return;
    const cur = items[i];
    if (!cur) return;
    const options = cur.options || [];
    if (options.some((o) => o.toLowerCase() === t.toLowerCase())) return;
    patch(i, { ...cur, options: [...options, t] });
    setOptDraft((d) => ({ ...d, [i]: "" }));
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">
        Словарь жалоб. «+опция» — уточнения чипами под пунктом (справа / слева…). В протоколе после выбора жалобы
        выпадает список, стрелки, пустой пункт = без уточнения.
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
                  onChange([...items, { text, options: it.options ? [...it.options] : undefined }]);
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
              <div className="mt-1 ml-4 flex flex-wrap items-center gap-1 border-l border-line pl-2">
                {(it.options || []).map((o) => (
                  <span
                    key={o}
                    className="inline-flex items-center gap-0.5 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-teal"
                  >
                    {o}
                    <button
                      type="button"
                      className="text-mute"
                      onClick={() =>
                        patch(i, { ...it, options: (it.options || []).filter((x) => x !== o) })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
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
}: {
  items: VitaePreset[];
  onChange: (p: VitaePreset[]) => void;
  hint: string;
}) {
  function patch(i: number, p: Partial<VitaePreset>) {
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">{hint}</p>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={it.id} className="flex flex-wrap items-center gap-1">
            <input
              value={it.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-1 text-[11px] text-mute">
              <input
                type="checkbox"
                checked={!!it.needsDate}
                onChange={(e) => patch(i, { needsDate: e.target.checked })}
              />
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
              onClick={() =>
                onChange([...items, { ...it, id: `p_${Date.now()}`, label: `${it.label} (копия)` }])
              }
            >
              копия
            </button>
            <button type="button" className="text-xs text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
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
