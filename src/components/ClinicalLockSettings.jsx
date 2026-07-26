import { useState } from 'react'
import { isLockEnabled, enableLock, disableLock, lockSession } from '../lib/clinicalLock'

export default function ClinicalLockSettings() {
  const [enabled, setEnabled] = useState(isLockEnabled())
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState('')

  async function handleEnable(e) {
    e.preventDefault()
    setError('')
    if (password.length < 4) {
      setError('Пароль слишком короткий (минимум 4 символа)')
      return
    }
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    try {
      await enableLock(password)
      setEnabled(true)
      setOk('Защита включена. Не забудь пароль — без него данные пациентов не восстановить.')
      setPassword('')
      setPassword2('')
    } finally {
      setBusy(false)
    }
  }

  function handleDisable() {
    if (!window.confirm('Отключить защиту? Данные пациентов будут храниться без шифрования.')) return
    disableLock()
    setEnabled(false)
    setOk('Защита отключена.')
  }

  function handleLockNow() {
    lockSession()
    window.location.reload()
  }

  return (
    <div className="clinical-lock-settings">
      <p className="settings-note-inline">
        Шифрует данные пациентов (ФИО, диагнозы, визиты) паролем прямо в браузере. Без пароля данные не читаются,
        даже если получить доступ к файлам устройства. Пароль нигде не хранится — если забудешь его, данные
        пациентов будет не восстановить.
      </p>

      {enabled ? (
        <div className="clinical-lock-enabled-block">
          <div className="ai-diagnostic ok">✓ Защита включена</div>
          <div className="clinical-lock-actions">
            <button type="button" className="btn-secondary btn-small" onClick={handleLockNow}>
              Заблокировать сейчас
            </button>
            <button type="button" className="btn-secondary btn-danger btn-small" onClick={handleDisable}>
              Отключить защиту
            </button>
          </div>
        </div>
      ) : (
        <form className="clinical-lock-form" onSubmit={handleEnable}>
          <input type="password" placeholder="Новый пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" placeholder="Повтори пароль" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          {error && <div className="ai-error">{error}</div>}
          <button type="submit" className="btn-primary btn-small" disabled={busy}>
            {busy ? 'Включаю…' : 'Включить защиту'}
          </button>
        </form>
      )}
      {ok && <div className="ai-diagnostic ok">{ok}</div>}
    </div>
  )
}
