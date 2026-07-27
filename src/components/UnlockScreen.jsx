import { useState } from 'react'
import { unlockWithPassword, unlockWithPin, hasPin } from '../lib/clinicalLock'

export default function UnlockScreen({ onUnlocked }) {
  const [mode, setMode] = useState(hasPin() ? 'pin' : 'password')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitPassword(e) {
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

  async function submitPin(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlockWithPin(pin)
      onUnlocked()
    } catch {
      setError('Неверный ПИН')
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

        {mode === 'pin' ? (
          <>
            <p className="settings-note-inline">Введи ПИН-код для этого устройства.</p>
            <form onSubmit={submitPin}>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="ПИН-код"
                className="unlock-pin-input"
              />
              {error && <div className="ai-error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Проверяю…' : 'Разблокировать'}
              </button>
            </form>
            <button type="button" className="unlock-switch-mode" onClick={() => { setMode('password'); setError('') }}>
              Ввести полный пароль вместо ПИН-кода
            </button>
          </>
        ) : (
          <>
            <p className="settings-note-inline">Введи пароль, чтобы разблокировать доступ на этом устройстве.</p>
            <form onSubmit={submitPassword}>
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
            {hasPin() && (
              <button type="button" className="unlock-switch-mode" onClick={() => { setMode('pin'); setError('') }}>
                Ввести ПИН-код вместо пароля
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
