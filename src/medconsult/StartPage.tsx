import { NavLink, useNav } from "./NavContext";
import { AppShell } from "./AppShell";
import { useAppStore } from "./store";

export function StartPage() {
  const { visits, loadVisit } = useAppStore();
  const { navigate } = useNav();
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-6 pb-24 md:p-10">
        <h1 className="font-display text-3xl">Не рабочий стол, а полка</h1>
        <p className="mt-2 text-ink-soft">Сюда заходят между приёмами. Утро начинается с Протокола.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-medium">Последние тексты</h3>
            <ul className="mt-2 divide-y divide-line">
              {visits.slice(0, 6).map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="w-full py-2 text-left text-sm"
                    onClick={() => {
                      loadVisit(v.id);
                      navigate("/");
                    }}
                  >
                    {v.preview}
                    <span className="block text-xs text-ink-soft">{new Date(v.savedAt).toLocaleDateString("ru-RU")}</span>
                  </button>
                </li>
              ))}
              {visits.length === 0 && <li className="py-4 text-sm text-mute">Пока пусто</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-medium">Если Медлок лежит</h3>
            <p className="mt-2 mb-4 text-sm text-ink-soft">История текстов — в Пациентах. Отсюда сразу на станок.</p>
            <NavLink to="/" className="inline-block rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-paper">
              Открыть протокол
            </NavLink>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
