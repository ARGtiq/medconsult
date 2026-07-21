import { useState } from 'react'
import { getProvider, setProvider, getApiKey, setApiKey, hasApiKey, testAiConnection } from '../lib/openrouter'

export default function AiSettings({ inline = false }) {
  const [open, setOpen] = useState(inline)
  const [provider, setProviderState] = useState(getProvider())
  const [key, setKey] = useState(getApiKey(getProvider()))
  const [savedFlag, setSavedFlag] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  function switchProvider(p) {
    setProviderState(p)
    setKey(getApiKey(p))
    setTestResult(null)
  }

  function save() {
    setProvider(provider)
    setApiKey(provider, key)
    setSavedFlag(true)
    setTimeout(() => setSavedFlag(false), 1200)
  }

  async function runTest() {
    save()
    setTesting(true)
    setTestResult(null)
    const result = await testAiConnection()
    setTestResult(result)
    setTesting(false)
  }

  const body = (
    <div className={inline ? 'ai-settings-inline' : 'ai-settings-dropdown'}>
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
      <div className="ai-settings-actions">
        <button type="button" className="btn-secondary btn-small" onClick={save}>
          {savedFlag ? 'Сохранено ✓' : 'Сохранить'}
        </button>
        <button type="button" className="btn-secondary btn-small" onClick={runTest} disabled={testing}>
          {testing ? 'Проверяю…' : 'Проверить соединение'}
        </button>
      </div>
      {testResult && (
        <div className={testResult.ok ? 'ai-diagnostic ok' : 'ai-diagnostic fail'}>
          {testResult.ok ? (
            <>✓ Соединение работает · {testResult.latency} мс · ответ: «{testResult.sample}»</>
          ) : (
            <>✗ Ошибка · {testResult.latency} мс · {testResult.error}</>
          )}
        </div>
      )}
      <div className="ai-settings-hint">
        Хранится только в этом браузере. Модель — Gemini 2.5 Flash в обоих случаях; Google AI Studio даёт бесплатный лимит запросов.
      </div>
    </div>
  )

  if (inline) return body

  return (
    <div className="ai-settings-wrap">
      <button type="button" className="btn-secondary btn-small" onClick={() => setOpen((v) => !v)}>
        {hasApiKey() ? 'AI ключ ✓' : 'Настроить AI'}
      </button>
      {open && body}
    </div>
  )
}
