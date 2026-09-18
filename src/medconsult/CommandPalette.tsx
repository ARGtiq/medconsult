import { useEffect, useMemo, useState } from "react";
import { allStudiesLive, liveDrugsMerged, liveIcdMerged, matchPhraseOrWord, suggestComplaints } from "./live";
import { studyMatchesQuery } from "./data/studies";
import { InfoDot, drugMarked } from "./DrugInfo";
import { useAppStore } from "./store";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const { toggleComplaint, addRecommendation, addStudy, setSession, setToast } = useAppStore();

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out: { id: string; label: string; hint: string; drugName?: string; run: () => void }[] = [];
    suggestComplaints(s, 8).forEach((hit) =>
      out.push({
        id: "c-" + hit.id,
        label: hit.label,
        hint: hit.hint === "слово" ? "слово" : "жалоба",
        run: () => {
          toggleComplaint(hit.label);
          setToast(`Жалоба: ${hit.label}`);
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
          drugName: d.name,
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
      .filter((i) => !s || i.code.toLowerCase().includes(s) || matchPhraseOrWord(i.title, s) || i.title.toLowerCase().includes(s))
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
              <div
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  i === 0 ? "bg-teal-soft text-teal" : "hover:bg-paper"
                } ${it.drugName && drugMarked(it.drugName) ? "border-l-2 border-l-teal" : ""}`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between text-left"
                  onClick={() => {
                    it.run();
                    onClose();
                  }}
                >
                  <span className="truncate">{it.label}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-mute">{it.hint}</span>
                </button>
                {it.drugName ? <InfoDot query={it.drugName} /> : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-3 py-2 text-[11px] text-mute">Enter вставляет первую строку</div>
      </div>
    </div>
  );
}
