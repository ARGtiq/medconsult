import { useMemo, useState } from "react";
import { COMPLAINTS, DRUGS, GUIDELINES, SCHEMES } from "./data/catalog";
import { STUDIES } from "./data/studies";
import { AppShell } from "./AppShell";
import type { RefFilter } from "./types";

const FILTERS: { id: RefFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "schemes", label: "Схемы страниц" },
  { id: "complaints", label: "Жалобы" },
  { id: "guidelines", label: "Клинреки" },
  { id: "treatment", label: "Лечение" },
];

export function ReferencePage() {
  const [filter, setFilter] = useState<RefFilter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("complaints");
  const query = q.trim().toLowerCase();

  const items = useMemo(() => {
    const rows: { id: string; group: string; title: string; sub: string }[] = [
      { id: "scheme-consult", group: "schemes", title: "Консультация", sub: "диагноз, жалобы, анамнез, осмотр, назначения" },
      { id: "scheme-study", group: "schemes", title: "Обследование", sub: "поля исследования + своя шапка Медлока" },
      { id: "scheme-mix", group: "schemes", title: "Консультация + исследование", sub: "склейка двух схем и шапки" },
      { id: "complaints", group: "complaints", title: "Словарь жалоб", sub: "глобальный · можно привязать к МКБ" },
      ...GUIDELINES.map((g) => ({
        id: "g-" + g.id,
        group: "guidelines",
        title: g.title,
        sub: g.codes.join(", ") + (g.scenarios.length ? " · есть сценарии" : ""),
      })),
      ...DRUGS.map((d) => ({ id: "d-" + d.name, group: "treatment", title: d.name, sub: d.dose })),
      ...SCHEMES.map((s) => ({ id: "s-" + s.id, group: "treatment", title: s.name, sub: s.phases.join(" → ") })),
      ...STUDIES.map((s) => ({ id: "st-" + s.key, group: "schemes", title: s.label, sub: "поля с референсом" })),
    ];
    return rows.filter((r) => (filter === "all" || r.group === filter) && (!query || `${r.title} ${r.sub}`.toLowerCase().includes(query)));
  }, [filter, query]);

  return (
    <AppShell>
      <div className="grid min-h-[calc(100dvh-3rem)] grid-cols-1 md:grid-cols-[320px_1fr] pb-16 md:pb-0">
        <aside className="border-r border-line bg-rail">
          <div className="flex flex-wrap gap-1 p-3">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  filter === f.id ? "bg-teal text-paper" : "border border-line bg-surface"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="N40, никтурия, тамсулозин…"
            className="mx-3 mb-2 w-[calc(100%-1.5rem)] rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <ul className="space-y-0.5 px-2 pb-6">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => setSel(it.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left ${sel === it.id ? "bg-teal-soft text-teal" : "hover:bg-surface"}`}
                >
                  <div className="text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-ink-soft">{it.sub}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="overflow-auto p-6">
          <span className="mr-1 rounded bg-teal-soft px-2 py-0.5 text-xs text-teal">жалобы</span>
          <span className="rounded bg-teal-soft px-2 py-0.5 text-xs text-teal">словарь</span>
          <h2 className="mt-2 font-display text-2xl">Словарь жалоб</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Один общий список. Код МКБ только сортирует, не запирает. На протоколе сверху — «по этому коду», ниже — весь
            словарь и поиск.
          </p>
          <div className="mt-4 max-w-2xl rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-medium">Часто с N40 / N40.1</h3>
            <div className="mt-2 flex flex-wrap gap-1">
              {COMPLAINTS.filter((c) => c.codes.some((x) => x.startsWith("N40"))).map((c) => (
                <span key={c.text} className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs">
                  {c.text}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 max-w-2xl rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-medium">Без привязки к коду</h3>
            <div className="mt-2 flex flex-wrap gap-1">
              {COMPLAINTS.filter((c) => !c.codes.some((x) => x.startsWith("N40"))).map((c) => (
                <span key={c.text} className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs">
                  {c.text}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-6 max-w-xl text-xs text-mute">
            Схема страницы решает, какие блоки есть. Клинрек предлагает чипы. Словарь жалоб работает без кода. Лекарства и
            схемы — нижний слой.
          </p>
        </main>
      </div>
    </AppShell>
  );
}
