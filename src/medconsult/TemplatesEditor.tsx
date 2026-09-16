import { useEffect, useState } from "react";
import {
  getTemplates,
  resetTemplates,
  saveTemplates,
  seedTemplates,
  type DocKind,
  type TemplatesState,
  type VitaePreset,
} from "./data/templates";
import type { LocalPack } from "./types";

export function TemplatesEditor() {
  const [tab, setTab] = useState<"status" | "chronic" | "surgery" | "docs">("status");
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
        <span className="text-xs text-mute">правятся здесь — сразу живут в протоколе</span>
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
            ["status", "локальный статус"],
            ["chronic", "хронические"],
            ["surgery", "операции"],
            ["docs", "блоки документа"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              tab === id ? "bg-teal text-paper" : "border border-line bg-paper"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "status" && <PacksEditor packs={data.localPacks} onChange={(localPacks) => persist({ localPacks })} />}
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
    </section>
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
