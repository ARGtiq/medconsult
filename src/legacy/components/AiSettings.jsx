import { useEffect, useMemo, useState } from 'react'
import {
  catalogIsStale,
  getApiKey,
  getModel,
  getModelCatalog,
  getProvider,
  hasApiKey,
  refreshModels,
  setApiKey,
  setModel,
  setProvider,
  testAiConnection,
} from '../lib/openrouter'

function formatWhen(at) {
  if (!at) return 'ещё не загружался'
  try {
    return new Date(at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function AiSettings({ inline = false }) {
  const [open, setOpen] = useState(inline)
  const [provider, setProviderState] = useState(getProvider())
  const [key, setKey] = useState(getApiKey(getProvider()))
  const [model, setModelState] = useState(getModel(getProvider()))
  const [catalog, setCatalog] = useState(() => getModelCatalog(getProvider()))
  const [query, setQuery] = useState('')
  const [savedFlag, setSavedFlag] = useState(false)
  const [testing, setTesting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [testResult, setTestResult] = useState(null)

  function switchProvider(p) {
    setProviderState(p)
    setKey(getApiKey(p))
    setModelState(getModel(p))
    setCatalog(getModelCatalog(p))
    setQuery('')
    setTestResult(null)
    setRefreshError('')
  }

  function save() {
    setProvider(provider)
    setApiKey(provider, key)
    setModel(provider, model)
    setSavedFlag(true)
    setTimeout(() => setSavedFlag(false), 1200)
    if (!catalog.models.length) reloadModels(key)
  }

  function pickModel(id) {
    setModel(provider, id)
    setModelState(getModel(provider))
    setQuery('')
  }

  async function reloadModels(forceKey) {
    const apiKey = forceKey != null ? forceKey : key
    setRefreshing(true)
    setRefreshError('')
    try {
      const next = await refreshModels(provider, apiKey.trim())
      setCatalog(next)
    } catch (e) {
      setRefreshError(e.message || 'Не удалось обновить список')
    }
    setRefreshing(false)
  }

  useEffect(() => {
    if (!open && !inline) return
    if (!catalogIsStale(provider)) return
    reloadModels(key || getApiKey(provider))
    // refresh once when the panel opens or the provider changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inline, provider])

  async function runTest() {
    save()
    setTesting(true)
    setTestResult(null)
    const result = await testAiConnection()
    setTestResult(result)
    setTesting(false)
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return catalog.models
      .filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 12)
  }, [catalog.models, query])

  const typed = query.trim()
  const known = catalog.models.some((m) => m.id.toLowerCase() === typed.toLowerCase())
  const currentName = catalog.models.find((m) => m.id === model)?.name

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
      <div className="ai-settings-label">Модель</div>
      <div className="ai-model-current" title={model}>
        {currentName ? `${currentName}` : model}
        {currentName ? <span>{model}</span> : null}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && typed) {
            e.preventDefault()
            const hit = catalog.models.find((m) => m.id.toLowerCase() === typed.toLowerCase())
            pickModel(hit ? hit.id : typed)
          }
        }}
        placeholder={provider === 'google' ? 'поиск Gemini или свой id, напр. gemini-3.8-flash' : 'поиск по названию или свой id'}
      />
      {matches.length > 0 && (
        <div className="ai-model-list">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === model ? 'is-on' : ''}
              onClick={() => pickModel(m.id)}
            >
              {m.name}
              <span>{m.id}</span>
            </button>
          ))}
        </div>
      )}
      {typed && !known && (
        <button type="button" className="btn-secondary btn-small" onClick={() => pickModel(typed)}>
          использовать «{typed}»
        </button>
      )}
      <div className="ai-settings-actions">
        <button type="button" className="btn-secondary btn-small" onClick={() => reloadModels()} disabled={refreshing}>
          {refreshing ? 'Обновляю…' : 'Обновить список'}
        </button>
        <span className="ai-settings-hint">
          {catalog.models.length ? `${catalog.models.length} · ${formatWhen(catalog.at)}` : 'список пуст'}
        </span>
      </div>
      {catalog.note && !refreshError && <div className="ai-settings-hint">{catalog.note}</div>}
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
            <>✓ Соединение работает · {testResult.model} · {testResult.latency} мс · «{testResult.sample}»</>
          ) : (
            <>✗ Ошибка · {testResult.latency} мс · {testResult.error}</>
          )}
        </div>
      )}
      {refreshError && <div className="ai-diagnostic fail">{refreshError}</div>}
      <div className="ai-settings-hint">
        {provider === 'google'
          ? 'Запросы идут напрямую в Gemini API Google (ключ AI Studio), не через OpenRouter. Модель у каждого провайдера своя. Список обновляется сам раз в сутки и кнопкой: из Google и из новых id Gemini. Свой id можно вписать, даже если его ещё нет в списке.'
          : 'Ключ и выбранная модель хранятся только в этом браузере. Список OpenRouter обновляется сам раз в сутки и кнопкой. Свой id можно вписать, даже если его ещё нет в списке.'}
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
