import { useEffect, useState } from "react";
import {
  getTemplates,
  resetTemplates,
  saveTemplates,
  seedTemplates,
  STD_DOC_BLOCKS,
  type DocKind,
  type TemplatesState,
  type VitaePreset,
  type VisitPack,
} from "./data/templates";
import type { LocalPack, WorkKind } from "./types";

export function TemplatesEditor() {
  const [layer, setLayer] = useState<"blocks" | "packs">("blocks");
  const [tab, setTab] = useState<"status" | "chronic" | "surgery" | "complaints" | "docs">("status");
  const [data, setData] = useState<TemplatesState>(() => getTemplates());

  useEffect(() => {
    function reload() {
      setData(getTemplates());
    }
    window.addEventListener("medconsult-templates", reload);
    return () => window.removeEventListener("medconsult-templates", reload);
  }, []);

  function persist(patch: Partial<TemplatesState>) {
    const next = { ...data, ...patch };
    setData(next);
    saveTemplates(patch);
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
        >
          сбросить к заводским
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {(
          [
            ["blocks", "блоки"],
            ["packs", "наборы"],
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
            Словари чипов: жалобы, статус, хронические, операции, виды доп. блоков. Из них потом собирается набор.
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {(
              [
                ["status", "локальный статус"],
                ["complaints", "жалобы"],
                ["chronic", "хронические"],
                ["surgery", "операции"],
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
          {tab === "status" && <PacksEditor packs={data.localPacks} onChange={(localPacks) => persist({ localPacks })} />}
          {tab === "complaints" && (
            <StringListEditor
              items={data.complaints}
              onChange={(complaints) => persist({ complaints })}
              hint="Словарь жалоб. Свои формулировки из протокола попадают сюда сами."
              addLabel="+ жалоба"
            />
          )}
          {tab === "chronic" && (
            <PresetEditor
              items={data.chronic}
              onChange={(chronic) => persist({ chronic })}
              hint="Чипы анамнеза жизни. Дата — для ИМ, ОНМК и т.п."
            />
          )}
          {tab === "surgery" && (
            <PresetEditor
              items={data.surgeries}
              onChange={(surgeries) => persist({ surgeries })}
              hint="Пустая дата может дать «давно» (поле «если пусто»)."
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
          <input
            value={current.codes.join(", ")}
            onChange={(e) =>
              patch({
                codes: e.target.value
                  .split(/[,;\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="МКБ, через запятую — пусто = любой диагноз"
            className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
          />
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
            <input
              value={p.codes.join(", ")}
              onChange={(e) =>
                patch(i, {
                  codes: e.target.value
                    .split(/[,;\s]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="МКБ"
              className="w-36 rounded-md border border-line bg-surface px-2 py-1 text-sm"
            />
            <button type="button" className="text-xs text-danger" onClick={() => onChange(packs.filter((_, j) => j !== i))}>
              ×
            </button>
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
