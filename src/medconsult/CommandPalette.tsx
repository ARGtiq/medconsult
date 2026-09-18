import { useEffect, useMemo, useState } from "react";
import { allStudiesLive, liveComplaints, liveDrugsMerged, liveIcdMerged } from "./live";
import { studyMatchesQuery } from "./data/studies";
import { useAppStore } from "./store";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const { toggleComplaint, addRecommendation, addStudy, setSession, setToast } = useAppStore();

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out: { id: string; label: string; hint: string; run: () => void }[] = [];
    liveComplaints()
      .filter((text) => s.length >= 2 && text.toLowerCase().includes(s))
      .forEach((text) =>
        out.push({
          id: "c-" + text,
          label: text,
          hint: "жалоба",
          run: () => {
            toggleComplaint(text);
            setToast(`Жалоба: ${text}`);
          },
        }),
      );
    liveDrugsMerged()
      .filter((d) => !s || d.name.toLowerCase().includes(s))
      .forEach((d) =>
        out.push({
          id: "d-" + d.name,
          label: `${d.name} ${d.dose}`.trim(),
          hint: "назначение",
          run: () => {
            addRecommendation(`${d.name} ${d.dose}`.trim());
            setToast(`Назначение: ${d.name}`);
          },
        }),
      );
    allStudiesLive()
      .filter((st) => !s || studyMatchesQuery(st, s))
      .forEach((st) =>
        out.push({
          id: "s-" + st.key,
          label: st.label,
          hint: "обследование",
          run: () => {
            addStudy(st.key);
            setToast(`Добавлено: ${st.label}`);
          },
        }),
      );
    liveIcdMerged()
      .filter((i) => !s || i.code.toLowerCase().includes(s) || i.title.toLowerCase().includes(s))
      .forEach((i) =>
        out.push({
          id: "i-" + i.code,
          label: `${i.code} ${i.title}`,
          hint: "диагноз",
          run: () => {
            setSession({ diagnosisCode: i.code, diagnosisTitle: i.title });
            setToast(`Диагноз ${i.code}`);
          },
        }),
      );
    return out.slice(0, 16);
  }, [q, addRecommendation, addStudy, setSession, setToast, toggleComplaint]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && items[0]) {
        e.preventDefault();
        items[0].run();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/30 px-4 pt-24" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Жалоба, препарат, УЗИ, код МКБ…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-mute">Ничего не нашлось</li>}
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  i === 0 ? "bg-teal-soft text-teal" : "hover:bg-paper"
                }`}
                onClick={() => {
                  it.run();
                  onClose();
                }}
              >
                <span>{it.label}</span>
                <span className="text-[11px] text-mute">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-3 py-2 text-[11px] text-mute">Enter вставляет первую строку</div>
      </div>
    </div>
  );
}
