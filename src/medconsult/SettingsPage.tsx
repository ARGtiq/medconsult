import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import { useAppStore } from "./store";

export function SettingsPage() {
  const { settings, setSettings, exportData, importData, setToast } = useAppStore();

  function downloadExport() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "medconsult-backup.json";
    a.click();
    setToast("Экспорт скачан");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-3 p-4 pb-24 md:p-8">
        <h1 className="font-display text-2xl">Как ведёт себя станок</h1>
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Кнопка AI">
            {(
              [
                ["always", "Постоянно в каждом блоке"],
                ["temporary", "Временная — только в открытом блоке"],
                ["off", "Выключено"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className="mt-2 flex items-center gap-2 text-sm">
                <input type="radio" checked={settings.aiButton === id} onChange={() => setSettings({ aiButton: id })} />
                {label}
              </label>
            ))}
          </Card>
          <Card title="Мастер и старт">
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.wizardEnabled}
                onChange={(e) => setSettings({ wizardEnabled: e.target.checked })}
              />
              Кнопка «по шагам» на протоколе
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.openOnProtocol}
                onChange={(e) => setSettings({ openOnProtocol: e.target.checked })}
              />
              При запуске открывать Протокол
            </label>
          </Card>
          <Card title="Клинреки на протоколе">
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={settings.guidelineDisplay === "block"}
                onChange={() => setSettings({ guidelineDisplay: "block" })}
              />
              Блок на странице
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={settings.guidelineDisplay === "modal"}
                onChange={() => setSettings({ guidelineDisplay: "modal" })}
              />
              Модальное окно
            </label>
          </Card>
          <Card title="AI-провайдер и ключи">
            <p className="text-xs text-ink-soft">
              OpenRouter. Ключ живёт только в этом браузере. Облачный резерв — из вашего репозитория (Supabase), здесь
              превью без облака.
            </p>
            <input
              type="password"
              value={settings.openRouterKey}
              onChange={(e) => setSettings({ openRouterKey: e.target.value })}
              placeholder="sk-or-…"
              className="mt-2 w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm"
            />
            <input
              value={settings.aiModel}
              onChange={(e) => setSettings({ aiModel: e.target.value })}
              className="mt-2 w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </Card>
          <Card title="Данные">
            <p className="text-xs text-ink-soft">Справочники, пациенты, тексты сеансов.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm" onClick={downloadExport}>
                Экспорт
              </button>
              <label className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                Импорт
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file.text().then(importData);
                  }}
                />
              </label>
            </div>
          </Card>
          <Card title="Синхронизация Supabase">
            <p className="text-xs text-ink-soft">
              Офлайн и так работает. В полном репозитории — URL и ключ проекта. Здесь достаточно экспорта JSON.
            </p>
            <button type="button" className="mt-2 rounded-lg bg-teal px-3 py-1.5 text-sm font-medium text-paper">
              Подключить
            </button>
          </Card>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-sm font-medium">Горячие клавиши · Windows</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {[
                ["Ctrl + K", "Поиск и вставка фразы / препарата / визита"],
                ["Ctrl + Enter", "Копировать всё (без пустых, без шапки)"],
                ["Ctrl + Shift + C", "Копировать активный блок"],
                ["Ctrl + Shift + H", "Копировать шапку Медлока"],
                ["Ctrl + Z", "Отменить последнее «Причесать» AI"],
                ["Esc", "Закрыть список обследований / модалку / поиск"],
              ].map(([k, v]) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-1.5 text-ink-soft">{k}</td>
                  <td className="py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}
