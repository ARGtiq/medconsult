import { FileText, Layers, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STD_DOC_BLOCKS, globalsMatchingCode, packsMatchingCode, useTemplates } from "./data/templates";
import { useAppStore } from "./store";

export function PlusDocBlockButton() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 320, width: 280 });
  const { session, toggleDocStd, addExtraBlock } = useAppStore();
  const { docKinds: kinds } = useTemplates();

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 280;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxH = Math.max(180, Math.min(440, openUp ? spaceAbove : spaceBelow));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = openUp ? Math.max(8, r.top - maxH - 4) : Math.min(r.bottom + 4, window.innerHeight - maxH - 8);
      setPos({ top, left, maxH, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="rounded-lg border border-teal px-2.5 py-1.5 text-sm font-bold text-teal"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1">
          <Plus className="size-3.5" /> блок
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.maxH }}
            className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <div className="text-[10px] tracking-wide text-mute uppercase">стандартные</div>
              {STD_DOC_BLOCKS.map((b) => {
                const on = (session.docStd || []).includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      toggleDocStd(b.id);
                      setOpen(false);
                    }}
                    className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                      on ? "border-teal bg-teal-soft text-teal" : "border-line bg-paper"
                    }`}
                  >
                    {b.title}
                    {on ? " · в документе" : ""}
                  </button>
                );
              })}
              <div className="mt-2 text-[10px] tracking-wide text-mute uppercase">дополнительные</div>
              {kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    addExtraBlock(k.id);
                    setOpen(false);
                  }}
                  className="mb-1 w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-left text-xs font-medium"
                >
                  {k.title}
                  {k.copyPrevious ? " · копирует прошлый" : ""}
                </button>
              ))}
              <div className="mt-2 flex gap-1">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && custom.trim()) {
                      addExtraBlock("custom", custom.trim());
                      setCustom("");
                      setOpen(false);
                    }
                  }}
                  placeholder="свой блок + Enter"
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  primary: "первичный",
  followup: "повторный",
  study: "обследование",
  document: "документ",
};

export function PlusPackButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 320, width: 280 });
  const { session, applyVisitPack } = useAppStore();
  const { visitPacks } = useTemplates();
  const matched = packsMatchingCode(session.diagnosisCode);
  const matchedIds = new Set(matched.map((p) => p.id));
  const rest = visitPacks.filter((p) => !matchedIds.has(p.id));

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 280;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxH = Math.max(180, Math.min(440, openUp ? spaceAbove : spaceBelow));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = openUp ? Math.max(8, r.top - maxH - 4) : Math.min(r.bottom + 4, window.innerHeight - maxH - 8);
      setPos({ top, left, maxH, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    applyVisitPack(id);
    setOpen(false);
  }

  const active = visitPacks.find((p) => p.id === session.templateId);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
          active ? "bg-teal text-paper" : "border border-line bg-surface"
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Выбрать набор"
      >
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3.5" />
          {active ? active.name : "набор"}
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.maxH }}
            className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {matched.length > 0 && (
                <>
                  <div className="text-[10px] tracking-wide text-mute uppercase">по {session.diagnosisCode}</div>
                  {matched.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pick(p.id)}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                        session.templateId === p.id ? "border-teal bg-teal-soft text-teal" : "border-line bg-paper"
                      }`}
                    >
                      {p.name}
                      <span className="ml-1 text-mute">· {KIND_LABEL[p.kind] || p.kind}</span>
                    </button>
                  ))}
                </>
              )}
              <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">все наборы</div>
              {rest.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                    session.templateId === p.id ? "border-teal bg-teal-soft text-teal" : "border-line bg-paper"
                  }`}
                >
                  {p.name}
                  <span className="ml-1 text-mute">· {KIND_LABEL[p.kind] || p.kind}</span>
                  {p.codes.length ? <span className="ml-1 text-mute">{p.codes.join(", ")}</span> : null}
                </button>
              ))}
              {visitPacks.length === 0 && <p className="px-1 py-2 text-xs text-mute">Справочник → Наборы</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function PlusGlobalButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 320, width: 300 });
  const { session, applyGlobalTemplate } = useAppStore();
  const { globalTemplates } = useTemplates();
  const matched = globalsMatchingCode(session.diagnosisCode);
  const matchedIds = new Set(matched.map((p) => p.id));
  const rest = (globalTemplates || []).filter((p) => !matchedIds.has(p.id));

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 300;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxH = Math.max(180, Math.min(440, openUp ? spaceAbove : spaceBelow));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = openUp ? Math.max(8, r.top - maxH - 4) : Math.min(r.bottom + 4, window.innerHeight - maxH - 8);
      setPos({ top, left, maxH, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = (globalTemplates || []).find((p) => p.id === session.globalTemplateId);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
          active ? "bg-teal text-paper" : "border border-line bg-surface"
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Выбрать глобальный шаблон"
      >
        <span className="inline-flex items-center gap-1">
          <FileText className="size-3.5" />
          {active ? active.name : "шаблон"}
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.maxH }}
            className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {matched.length > 0 && (
                <>
                  <div className="text-[10px] tracking-wide text-mute uppercase">по {session.diagnosisCode}</div>
                  {matched.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        applyGlobalTemplate(p.id);
                        setOpen(false);
                      }}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                        session.globalTemplateId === p.id ? "border-teal bg-teal-soft text-teal" : "border-line bg-paper"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </>
              )}
              <div className="mt-1 text-[10px] tracking-wide text-mute uppercase">глобальные шаблоны</div>
              {rest.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    applyGlobalTemplate(p.id);
                    setOpen(false);
                  }}
                  className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                    session.globalTemplateId === p.id ? "border-teal bg-teal-soft text-teal" : "border-line bg-paper"
                  }`}
                >
                  {p.name}
                  <span className="ml-1 text-mute">· {KIND_LABEL[p.kind] || p.kind}</span>
                </button>
              ))}
              {(globalTemplates || []).length === 0 && (
                <p className="px-1 py-2 text-xs text-mute">Справочник → Глобальные. Там набор блоков и готовый текст.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

