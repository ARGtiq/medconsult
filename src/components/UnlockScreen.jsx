import { useState } from 'react'
import { unlockWithPassword } from '../lib/clinicalLock'

export default function UnlockScreen({ onUnlocked }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlockWithPassword(password)
      onUnlocked()
    } catch {
      setError('Неверный пароль')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="unlock-screen">
      <div className="unlock-box">
        <div className="brand">
          <span className="brand-mark">Rx</span>
          <span className="brand-name">MedConsult</span>
        </div>
        <h3>Данные пациентов защищены</h3>
        <p className="settings-note-inline">Введи пароль, чтобы разблокировать доступ на этом устройстве.</p>
        <form onSubmit={submit}>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />
          {error && <div className="ai-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Проверяю…' : 'Разблокировать'}
          </button>
        </form>
      </div>
    </div>
  )
}
