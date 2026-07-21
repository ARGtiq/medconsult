import { useState, useEffect } from 'react'
import { getSupabaseConfig, setSupabaseConfig, isSupabaseConfigured } from '../lib/supabaseClient'
import {
  testSupabaseConnection,
  pushToSupabase,
  pullFromSupabase,
  getLastSync,
  sendMagicLink,
  getCurrentUser,
  signOut,
  onAuthChange,
} from '../lib/supabaseSync'

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
  const lastSync = getLastSync()

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
