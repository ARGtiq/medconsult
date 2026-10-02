import { useMemo, useState } from "react";
import { allStudiesLive, liveDrugsMerged, liveIcdMerged, matchPhraseOrWord, suggestComplaints } from "./live";
import { studyMatchesQuery } from "./data/studies";
import { Typeahead, type TypeaheadItem } from "./Typeahead";
import { useAppStore } from "./store";

type Hit = TypeaheadItem & { run: () => void };

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const { toggleComplaint, addRecommendation, addStudy, setSession, setToast } = useAppStore();

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out: Hit[] = [];
    suggestComplaints(s, 8).forEach((hit) =>
      out.push({
        id: "c-" + hit.id,
        label: hit.label,
        hint: hit.hint === "слово" ? "слово" : hit.hint === "опции" ? "опции" : "жалоба",
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
          name: d.name,
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
          label: i.title,
          hint: i.code,
          run: () => {
            setSession({ diagnosisCode: i.code, diagnosisTitle: i.title });
            setToast(`Диагноз ${i.code}`);
          },
        }),
      );
    return out.slice(0, 16);
  }, [q, addRecommendation, addStudy, setSession, setToast, toggleComplaint]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/30 px-4 pt-24" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-line bg-surface p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Typeahead
          autoFocus
          inline
          value={q}
          onChange={setQ}
          items={items}
          onPick={(it) => {
            items.find((x) => x.id === it.id)?.run();
            onClose();
          }}
          placeholder="Жалоба, препарат, обследование, код МКБ…"
          emptyHint={q.trim() ? "Ничего не нашлось" : undefined}
          inputClassName="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
        />
        <p className="mt-2 text-[11px] text-mute">↑↓ выбрать · Enter вставить</p>
      </div>
    </div>
  );
}