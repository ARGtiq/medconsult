import { useState, useEffect } from 'react'
import App from './App.jsx'
import UnlockScreen from './components/UnlockScreen.jsx'
import { needsUnlock } from './lib/clinicalLock'

// Гейт перед рендером основного приложения: если пациенты защищены паролем
// (Настройки → Общие → Защита данных) и эта вкладка ещё не разблокирована —
// показываем экран пароля вместо приложения. Если защита не включена —
// пропускаем сразу, поведение не отличается от того, что было раньше.
export default function AppRoot() {
  const [locked, setLocked] = useState(needsUnlock())

  useEffect(() => {
    setLocked(needsUnlock())
  }, [])

  if (locked) {
    return <UnlockScreen onUnlocked={() => setLocked(false)} />
  }

  return <App />
}
