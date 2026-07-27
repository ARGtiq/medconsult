import { useState, useEffect } from 'react'
import App from './App.jsx'
import UnlockScreen from './components/UnlockScreen.jsx'
import { needsUnlock, trySessionUnlock } from './lib/clinicalLock'

// Гейт перед рендером основного приложения: если пациенты защищены паролем
// (Настройки → Общие → Защита данных) и эта вкладка ещё не разблокирована —
// показываем экран пароля/ПИН-кода вместо приложения. Если защита не включена
// — пропускаем сразу. Если пароль уже лежит в sessionStorage этой вкладки
// (обычное обновление страницы F5, не новый визит в браузер) — тихо
// разблокируем без вопросов, экран пароля не мелькает вообще.
export default function AppRoot() {
  const [status, setStatus] = useState('checking') // 'checking' | 'locked' | 'ready'

  useEffect(() => {
    if (!needsUnlock()) {
      setStatus('ready')
      return
    }
    trySessionUnlock().then((ok) => {
      setStatus(ok ? 'ready' : 'locked')
    })
  }, [])

  if (status === 'checking') return null
  if (status === 'locked') {
    return <UnlockScreen onUnlocked={() => setStatus('ready')} />
  }
  return <App />
}
