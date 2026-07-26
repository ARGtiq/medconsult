import { useState, useEffect } from 'react'
import { getSupabaseConfig, setSupabaseConfig, isSupabaseConfigured } from '../lib/supabaseClient'
import { store } from '../lib/store'
import {
  testSupabaseConnection,
  pushToSupabase,
  pullFromSupabase,
  pushNamespace,
  pullNamespace,
  pushVisitsIncremental,
  pullVisitsIncremental,
  getLastSync,
  sendMagicLink,
  getCurrentUser,
  signOut,
  onAuthChange,
} from '../lib/supabaseSync'

const NAMESPACE_LABELS = {
  clinical: 'Пациенты и визиты',
  reference: 'Шаблоны, клинреки, лекарства, группы',
  workspace: 'Пресеты визитов',
  system: 'Багрепорты, настройки',
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('ru-RU')
}

export default function SupabaseSettings() {
  const [config, setConfig] = useState(getSupabaseConfig())
  const [configSaved, setConfigSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [email, setEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState('')
  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')
  const [nsOpen, setNsOpen] = useState(false)
  const [nsBusy, setNsBusy] = useState(null)
  const [nsError, setNsError] = useState({})
  const [nsOk, setNsOk] = useState({})
  const [visitSyncBusy, setVisitSyncBusy] = useState(null)
  const [visitSyncResult, setVisitSyncResult] = useState('')
  const [visitSyncError, setVisitSyncError] = useState('')
  const lastSync = getLastSync()

  async function doPushVisitsIncremental() {
    setVisitSyncBusy('push')
    setVisitSyncError('')
    setVisitSyncResult('')
    try {
      const { pushed } = await pushVisitsIncremental()
      setVisitSyncResult(pushed ? `Отправлено изменённых визитов: ${pushed}` : 'Изменений нет — всё уже синхронизировано')
    } catch (e) {
      setVisitSyncError(e.message)
    } finally {
      setVisitSyncBusy(null)
    }
  }

  async function doPullVisitsIncremental() {
    setVisitSyncBusy('pull')
    setVisitSyncError('')
    setVisitSyncResult('')
    try {
      const { pulled, merged } = await pullVisitsIncremental()
      setVisitSyncResult(pulled ? `Загружено ${pulled}, обновлено локально: ${merged}` : 'Новых визитов в облаке нет')
    } catch (e) {
      setVisitSyncError(e.message)
    } finally {
      setVisitSyncBusy(null)
    }
  }

  useEffect(() => {
    getCurrentUser().then(setUser)
    const unsubscribe = onAuthChange(setUser)
    return unsubscribe
  }, [config])

  function saveConfig(e) {
    e.preventDefault()
    setSupabaseConfig(config.url, config.anonKey)
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 1200)
  }

  async function runTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testSupabaseConnection()
    setTestResult(result)
    setTesting(false)
  }

  async function sendLink(e) {
    e.preventDefault()
    setMagicError('')
    setMagicSent(false)
    try {
      await sendMagicLink(email)
      setMagicSent(true)
    } catch (e) {
      setMagicError(e.message)
    }
  }

  async function doSignOut() {
    await signOut()
    setUser(null)
  }

  async function doPush() {
    setBusy(true)
    setActionError('')
    setActionOk('')
    try {
      await pushToSupabase()
      setActionOk('Данные отправлены в Supabase.')
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doPull() {
    if (!window.confirm('Это заменит текущие локальные данные данными из Supabase. Продолжить?')) return
    setBusy(true)
    setActionError('')
    setActionOk('')
    try {
      await pullFromSupabase()
      setActionOk('Данные загружены из Supabase. Перезагрузи страницу, чтобы увидеть изменения.')
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doPushNamespace(ns) {
    setNsBusy(`push-${ns}`)
    setNsError((p) => ({ ...p, [ns]: '' }))
    setNsOk((p) => ({ ...p, [ns]: '' }))
    try {
      await pushNamespace(ns)
      setNsOk((p) => ({ ...p, [ns]: 'Отправлено ✓' }))
    } catch (e) {
      setNsError((p) => ({ ...p, [ns]: e.message }))
    } finally {
      setNsBusy(null)
    }
  }

  async function doPullNamespace(ns) {
    if (!window.confirm(`Заменить локальный раздел «${NAMESPACE_LABELS[ns] || ns}» данными из облака?`)) return
    setNsBusy(`pull-${ns}`)
    setNsError((p) => ({ ...p, [ns]: '' }))
    setNsOk((p) => ({ ...p, [ns]: '' }))
    try {
      await pullNamespace(ns)
      setNsOk((p) => ({ ...p, [ns]: 'Загружено ✓ (перезагрузи страницу)' }))
    } catch (e) {
      setNsError((p) => ({ ...p, [ns]: e.message }))
    } finally {
      setNsBusy(null)
    }
  }

  return (
    <div className="supabase-settings">
      <form className="supabase-config-form" onSubmit={saveConfig}>
        <input
          placeholder="Project URL (https://xxxx.supabase.co)"
          value={config.url}
          onChange={(e) => setConfig({ ...config, url: e.target.value })}
        />
        <input
          placeholder="anon public key"
          value={config.anonKey}
          onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
        />
        <button type="submit" className="btn-secondary btn-small">
          {configSaved ? 'Сохранено ✓' : 'Сохранить подключение'}
        </button>
      </form>

      <div className={isSupabaseConfigured() ? 'supabase-status ok' : 'supabase-status off'}>
        {isSupabaseConfigured() ? '✓ Подключение настроено' : '✗ Не настроено — вставь URL и anon key выше'}
      </div>

      <button type="button" className="btn-secondary btn-small" onClick={runTest} disabled={testing}>
        {testing ? 'Проверяю…' : 'Проверить соединение'}
      </button>
      {testResult && (
        <div className={testResult.ok ? 'ai-diagnostic ok' : 'ai-diagnostic fail'}>
          {testResult.ok ? `✓ Соединение работает · ${testResult.latency} мс` : `✗ ${testResult.error}${testResult.latency ? ` · ${testResult.latency} мс` : ''}`}
        </div>
      )}

      <div className="supabase-auth-block">
        {user ? (
          <div className="supabase-auth-status">
            <span>Вошли как {user.email}</span>
            <button type="button" className="btn-secondary btn-small" onClick={doSignOut}>Выйти</button>
          </div>
        ) : (
          <form className="supabase-magic-form" onSubmit={sendLink}>
            <input
              type="email"
              placeholder="Твой email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn-secondary btn-small" disabled={!isSupabaseConfigured()}>
              Отправить magic link
            </button>
          </form>
        )}
        {magicSent && <div className="ai-diagnostic ok">Письмо отправлено — перейди по ссылке из письма на этом же устройстве.</div>}
        {magicError && <div className="ai-error">{magicError}</div>}
      </div>

      <div className="supabase-sync-actions">
        <button type="button" className="btn-secondary" onClick={doPush} disabled={busy || !isSupabaseConfigured()}>
          Отправить данные в облако
        </button>
        <button type="button" className="btn-secondary" onClick={doPull} disabled={busy || !isSupabaseConfigured()}>
          Загрузить данные из облака
        </button>
      </div>
      {actionError && <div className="ai-error">{actionError}</div>}
      {actionOk && <div className="ai-diagnostic ok">{actionOk}</div>}

      <div className="visit-incremental-sync">
        <div className="visit-incremental-sync-label">Визиты — только изменённое (не весь список)</div>
        <div className="data-export-ns-actions">
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={doPushVisitsIncremental}
            disabled={visitSyncBusy !== null || !isSupabaseConfigured()}
          >
            {visitSyncBusy === 'push' ? '…' : 'Отправить изменённые'}
          </button>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={doPullVisitsIncremental}
            disabled={visitSyncBusy !== null || !isSupabaseConfigured()}
          >
            {visitSyncBusy === 'pull' ? '…' : 'Забрать изменённые'}
          </button>
        </div>
        {visitSyncError && <div className="ai-error">{visitSyncError}</div>}
        {visitSyncResult && <div className="ai-diagnostic ok">{visitSyncResult}</div>}
      </div>

      <button type="button" className="data-export-toggle" onClick={() => setNsOpen((v) => !v)}>
        {nsOpen ? '▾' : '▸'} Синхронизировать по разделам отдельно
      </button>
      {nsOpen && (
        <div className="data-export-namespaces">
          {store.getNamespaceNames().map((ns) => (
            <div key={ns} className="data-export-ns-row">
              <span>{NAMESPACE_LABELS[ns] || ns}</span>
              <div className="data-export-ns-actions">
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => doPushNamespace(ns)}
                  disabled={nsBusy !== null || !isSupabaseConfigured()}
                >
                  {nsBusy === `push-${ns}` ? '…' : 'Отправить'}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => doPullNamespace(ns)}
                  disabled={nsBusy !== null || !isSupabaseConfigured()}
                >
                  {nsBusy === `pull-${ns}` ? '…' : 'Загрузить'}
                </button>
              </div>
              {nsError[ns] && <div className="ai-error">{nsError[ns]}</div>}
              {nsOk[ns] && <div className="ai-diagnostic ok">{nsOk[ns]}</div>}
            </div>
          ))}
        </div>
      )}
      {lastSync && (
        <p className="settings-note-inline">
          Последняя синхронизация: {lastSync.direction === 'push' ? 'отправка' : 'загрузка'}, {formatTime(lastSync.at)}
        </p>
      )}
      <p className="settings-note-inline">
        Без входа по magic link данные пишутся по твоему auth id — войди на каждом устройстве под тем же email,
        чтобы видеть одни и те же данные. SQL для создания таблиц — ниже в подсказке к этому разделу настроек.
      </p>
    </div>
  )
}
