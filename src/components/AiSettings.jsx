import { useState } from 'react'
import { getApiKey, setApiKey, hasApiKey } from '../lib/openrouter'

export default function AiSettings() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(getApiKey())
  const [savedFlag, setSavedFlag] = useState(false)

  function save() {
    setApiKey(key)
    setSavedFlag(true)
    setTimeout(() => setSavedFlag(false), 1200)
  }

  return (
    <div className="ai-settings-wrap">
      <button type="button" className="btn-secondary btn-small" onClick={() => setOpen((v) => !v)}>
        {hasApiKey() ? 'AI ключ ✓' : 'Настроить AI'}
      </button>
      {open && (
        <div className="ai-settings-dropdown">
          <div className="ai-settings-label">Ключ OpenRouter (openrouter.ai/keys)</div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-or-v1-…"
          />
          <button type="button" className="btn-secondary btn-small" onClick={save}>
            {savedFlag ? 'Сохранено ✓' : 'Сохранить'}
          </button>
          <div className="ai-settings-hint">Хранится только в этом браузере, используется для Gemini через OpenRouter.</div>
        </div>
      )}
    </div>
  )
}
