import type { ReactNode } from "react";
import LegacySettings from "@/legacy/components/SettingsPage";
import "@/legacy/legacy.css";
import { AppShell } from "./AppShell";
import { useAppStore } from "./store";

export function SettingsPage() {
  const { settings, setSettings } = useAppStore();
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-3 p-4 pb-24 md:p-8">
        <h1 className="font-display text-2xl">Как ведёт себя станок</h1>
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Кнопка AI на протоколе">
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
          <Card title="Старт">
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.openOnProtocol}
                onChange={(e) => setSettings({ openOnProtocol: e.target.checked })}
              />
              При запуске открывать Протокол
            </label>
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
          </Card>
          <Card title="Сеанс станка">
            <p className="mt-2 text-xs text-ink-soft">Протокол v2 + старые неймспейсы в одном файле.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                onClick={() => {
                  const blob = new Blob([useAppStore.getState().exportData()], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `medconsult-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
              >
                Скачать всё
              </button>
              <label className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                Загрузить
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file.text().then((raw) => useAppStore.getState().importData(raw));
                  }}
                />
              </label>
            </div>
          </Card>
        </div>
        <div className="legacy-surface rounded-xl border border-line bg-surface p-3">
          <LegacySettings />
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
