import { useState } from 'react'
import { getProvider, setProvider, getApiKey, setApiKey, hasApiKey } from '../lib/openrouter'

export default function AiSettings() {
  const [open, setOpen] = useState(false)
  const [provider, setProviderState] = useState(getProvider())
  const [key, setKey] = useState(getApiKey(getProvider()))
  const [savedFlag, setSavedFlag] = useState(false)

  function switchProvider(p) {
    setProviderState(p)
    setKey(getApiKey(p))
  }

  function save() {
    setProvider(provider)
    setApiKey(provider, key)
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
          <div className="ai-provider-toggle">
            <button type="button" className={provider === 'openrouter' ? 'active' : ''} onClick={() => switchProvider('openrouter')}>
              OpenRouter
            </button>
            <button type="button" className={provider === 'google' ? 'active' : ''} onClick={() => switchProvider('google')}>
              Google AI Studio
            </button>
          </div>
          <div className="ai-settings-label">
            {provider === 'google' ? 'Ключ Google AI Studio (aistudio.google.com/apikey)' : 'Ключ OpenRouter (openrouter.ai/keys)'}
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={provider === 'google' ? 'AIza…' : 'sk-or-v1-…'}
          />
          <button type="button" className="btn-secondary btn-small" onClick={save}>
            {savedFlag ? 'Сохранено ✓' : 'Сохранить'}
          </button>
          <div className="ai-settings-hint">
            Хранится только в этом браузере. Модель — Gemini 2.5 Flash в обоих случаях; Google AI Studio даёт бесплатный лимит запросов.
          </div>
        </div>
      )}
    </div>
  )
}
