import { useState } from 'react'
import { encryptWithPassword, decryptWithPassword } from '../lib/keyVault'
import { pushEncryptedKeys, pullEncryptedKeys } from '../lib/supabaseSync'
import { getProvider, getApiKey, setProvider, setApiKey } from '../lib/openrouter'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export default function AiKeyBackup() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function backup() {
    if (!password.trim()) {
      setErr('Придумай пароль для шифрования')
      return
    }
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const payload = {
        provider: getProvider(),
        openrouter: getApiKey('openrouter'),
        google: getApiKey('google'),
      }
      const encrypted = await encryptWithPassword(payload, password)
      await pushEncryptedKeys(encrypted)
      setMsg('Ключи зашифрованы и сохранены в облаке.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    if (!password.trim()) {
      setErr('Введи пароль, которым шифровал ключи')
      return
    }
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const blob = await pullEncryptedKeys()
      const payload = await decryptWithPassword(blob, password)
      if (payload.provider) setProvider(payload.provider)
      if (payload.openrouter) setApiKey('openrouter', payload.openrouter)
      if (payload.google) setApiKey('google', payload.google)
      setMsg('Ключи восстановлены на этом устройстве. Перезагрузи страницу.')
    } catch (e) {
      setErr(e.message.includes('decrypt') || e.name === 'OperationError' ? 'Неверный пароль' : e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-key-backup">
      <p className="settings-note-inline">
        Резервная копия AI-ключей в облаке (зашифрована паролем, который знаешь только ты — Anthropic и Supabase
        не видят пароль и не могут расшифровать ключи). Требует входа по magic link (см. блок Supabase выше).
      </p>
      <input
        type="password"
        placeholder="Пароль для шифрования/восстановления"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="ai-key-backup-actions">
        <button type="button" className="btn-secondary btn-small" onClick={backup} disabled={busy || !isSupabaseConfigured()}>
          Сохранить ключи в облако
        </button>
        <button type="button" className="btn-secondary btn-small" onClick={restore} disabled={busy || !isSupabaseConfigured()}>
          Восстановить на этом устройстве
        </button>
      </div>
      {err && <div className="ai-error">{err}</div>}
      {msg && <div className="ai-diagnostic ok">{msg}</div>}
    </div>
  )
}
