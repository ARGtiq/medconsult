import { useState, type ReactNode } from "react";
import LegacySettings from "@/legacy/components/SettingsPage";
import ThemeSettings from "@/legacy/components/ThemeSettings";
import "@/legacy/legacy.css";
import { AppShell } from "./AppShell";
import { useAppStore } from "./store";

export function SettingsPage() {
  const { settings, setSettings } = useAppStore();
  const [keysOpen, setKeysOpen] = useState(false);
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-3 p-4 pb-24 md:p-8">
        <h1 className="font-display text-2xl">Как ведёт себя станок</h1>
        <div className="rounded-xl border border-line bg-surface">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
            onClick={() => setKeysOpen((v) => !v)}
          >
            <span className="text-mute">{keysOpen ? "▾" : "▸"}</span>
            Горячие клавиши · Windows
          </button>
          {keysOpen && (
            <table className="w-full border-t border-line px-4 text-sm">
              <tbody>
                {[
                  ["Ctrl + K", "Поиск и вставка фразы / препарата / визита"],
                  ["Ctrl + Enter", "Копировать всё (без пустых, без шапки)"],
                  ["Ctrl + Shift + C", "Копировать активный блок"],
                  ["Ctrl + Shift + H", "Копировать шапку Медлока"],
                  ["Ctrl + Z", "Отменить последнее «Причесать» AI"],
                  ["Esc", "Закрыть список обследований / модалку / поиск"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-t border-line first:border-t-0">
                    <td className="py-1.5 pl-4 text-ink-soft">{k}</td>
                    <td className="py-1.5 pr-4">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Интерфейс">
            <p className="mt-1 text-xs text-ink-soft">Акцентный цвет, тёмная тема, анимации и шрифт. Действует на весь станок.</p>
            <div className="legacy-surface mt-2">
              <ThemeSettings />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.openOnProtocol}
                onChange={(e) => setSettings({ openOnProtocol: e.target.checked })}
              />
              При запуске открывать Протокол
            </label>
            <p className="mt-3 text-xs font-medium text-ink-soft">Кнопка AI на протоколе</p>
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
          <Card title="Блоки протокола">
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.blocksAsSpoiler}
                onChange={(e) => setSettings({ blocksAsSpoiler: e.target.checked })}
              />
              Сворачивать блоки в спойлер
            </label>
            <p className="mt-1 text-xs text-ink-soft">
              Вкл — клик по заголовку открывает один блок. Выкл — все поля сразу на виду.
            </p>
            <label className="mt-3 block text-sm">
              Ширина сборки / Медлок
              <input
                type="range"
                min={22}
                max={70}
                value={settings.splitPct ?? 38}
                onChange={(e) => setSettings({ splitPct: Number(e.target.value) })}
                className="mt-1 w-full accent-teal"
              />
              <span className="mt-0.5 block text-xs text-ink-soft">
                сборка {settings.splitPct ?? 38}% · Медлок {100 - (settings.splitPct ?? 38)}%. На протоколе можно тянуть
                разделитель.
              </span>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.studyDeviations !== false}
                onChange={(e) => setSettings({ studyDeviations: e.target.checked })}
              />
              Итог отклонений в обследованиях
            </label>
            <p className="mt-1 text-xs text-ink-soft">
              Спойлер со всеми значениями вне нормы. Выкл — не показывать ни на станке, ни в Медлок.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.infoOnHover === true}
                onChange={(e) => setSettings({ infoOnHover: e.target.checked })}
              />
              По наведению на «i» показывать краткую карточку
            </label>
            <p className="mt-1 text-xs text-ink-soft">Клик по «i» по-прежнему открывает полное окно. Аллергия, лекарства и болезни.</p>
          </Card>
        </div>
        <div className="legacy-surface rounded-xl border border-line bg-surface p-3">
          <LegacySettings />
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
