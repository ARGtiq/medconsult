import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { testSupabaseConnection, pushToSupabase, pullFromSupabase, getLastSync } from '../lib/supabaseSync'

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('ru-RU')
}

export default function SupabaseSettings() {
  const [syncCode, setSyncCode] = useState(localStorage.getItem('medconsult_sync_code') || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')
  const lastSync = getLastSync()

  function persistCode(code) {
    setSyncCode(code)
    localStorage.setItem('medconsult_sync_code', code)
  }

  async function runTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testSupabaseConnection()
    setTestResult(result)
    setTesting(false)
  }

  async function doPush() {
    setBusy(true)
    setActionError('')
    setActionOk('')
    try {
      await pushToSupabase(syncCode)
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
      await pullFromSupabase(syncCode)
      setActionOk('Данные загружены из Supabase. Перезагрузи страницу, чтобы увидеть изменения.')
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="supabase-settings">
      <div className={isSupabaseConfigured() ? 'supabase-status ok' : 'supabase-status off'}>
        {isSupabaseConfigured() ? '✓ Supabase настроен (.env найден)' : '✗ Supabase не настроен — нужен .env с VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY'}
      </div>

      <button type="button" className="btn-secondary btn-small" onClick={runTest} disabled={testing}>
        {testing ? 'Проверяю…' : 'Проверить соединение'}
      </button>
      {testResult && (
        <div className={testResult.ok ? 'ai-diagnostic ok' : 'ai-diagnostic fail'}>
          {testResult.ok ? `✓ Соединение работает · ${testResult.latency} мс` : `✗ ${testResult.error}${testResult.latency ? ` · ${testResult.latency} мс` : ''}`}
        </div>
      )}

      <div className="supabase-sync-row">
        <input
          type="text"
          placeholder="Код синхронизации (придумай свой, напр. albert-uro-2026)"
          value={syncCode}
          onChange={(e) => persistCode(e.target.value)}
        />
      </div>
      <div className="supabase-sync-actions">
        <button type="button" className="btn-secondary" onClick={doPush} disabled={busy || !isSupabaseConfigured()}>
          Отправить в облако
        </button>
        <button type="button" className="btn-secondary" onClick={doPull} disabled={busy || !isSupabaseConfigured()}>
          Загрузить из облака
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
        Требуется таблица <code>medconsult_sync</code> (id text primary key, payload jsonb, updated_at timestamptz) в твоём проекте Supabase.
        Код синхронизации — просто общий "пароль" между устройствами, без полноценной аутентификации.
      </p>
    </div>
  )
}
