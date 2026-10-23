import { useState } from 'react'
import { ACCENT_PRESETS, FONT_PRESETS, getTheme, parseGoogleFont, saveTheme } from '../lib/theme'

export default function ThemeSettings() {
  const [theme, setTheme] = useState(getTheme())
  const [link, setLink] = useState('')
  const [fontError, setFontError] = useState('')

  function update(patch) {
    const next = { ...theme, ...patch }
    setTheme(next)
    saveTheme(next)
  }

  function loadLink() {
    const parsed = parseGoogleFont(link)
    if (!parsed) {
      setFontError('Нужна ссылка Google Fonts или название шрифта')
      return
    }
    setFontError('')
    update({ font: 'custom', fontFamily: parsed.family, fontHref: parsed.href })
  }

  const fontKey = theme.font || 'plex'

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
      <label className="theme-dark-toggle">
        <input
          type="checkbox"
          checked={theme.motion === false}
          onChange={(e) => update({ motion: !e.target.checked })}
        />
        Отключить анимации
      </label>
      <div className="theme-font-label">Шрифт</div>
      <div className="theme-font-row">
        {FONT_PRESETS.map((p) => (
          <button
            type="button"
            key={p.key}
            className={fontKey === p.key ? 'theme-font-btn active' : 'theme-font-btn'}
            style={{ fontFamily: p.family === 'system-ui' ? 'system-ui, sans-serif' : `"${p.family}", sans-serif` }}
            onClick={() => update({ font: p.key, fontFamily: '', fontHref: '' })}
          >
            {p.label}
          </button>
        ))}
        {fontKey === 'custom' && theme.fontFamily ? (
          <button type="button" className="theme-font-btn active" style={{ fontFamily: `"${theme.fontFamily}", sans-serif` }}>
            {theme.fontFamily}
          </button>
        ) : null}
      </div>
      <div className="theme-font-link">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              loadLink()
            }
          }}
          placeholder="ссылка Google Fonts или название"
        />
        <button type="button" className="btn-secondary btn-small" onClick={loadLink}>
          загрузить
        </button>
      </div>
      {fontError ? <div className="ai-error">{fontError}</div> : null}
    </div>
  )
}