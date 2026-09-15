import { useState } from 'react'
import { ACCENT_PRESETS, getTheme, saveTheme } from '../lib/theme'

export default function ThemeSettings() {
  const [theme, setTheme] = useState(getTheme())

  function update(patch) {
    const next = { ...theme, ...patch }
    setTheme(next)
    saveTheme(next)
  }

  return (
    <div className="theme-settings">
      <div className="theme-accent-row">
        {ACCENT_PRESETS.map((p) => (
          <button
            type="button"
            key={p.key}
            className={theme.accent === p.key ? 'theme-swatch active' : 'theme-swatch'}
            style={{ background: p.main }}
            title={p.label}
            onClick={() => update({ accent: p.key })}
          />
        ))}
      </div>
      <label className="theme-dark-toggle">
        <input type="checkbox" checked={!!theme.dark} onChange={(e) => update({ dark: e.target.checked })} />
        Тёмная тема
      </label>
    </div>
  )
}
