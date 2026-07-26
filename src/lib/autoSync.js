import { store } from './store'
import { isSupabaseConfigured } from './supabaseClient'
import { pushVisitsIncremental, pushPatientsIncremental, getCurrentUser } from './supabaseSync'

// Фоновый автосинк: после сохранения визита/пациента, если Supabase настроен
// и есть вход по magic link — тихо отправляет только изменённое (используя ту
// же инкрементальную логику, что и ручные кнопки в Настройках), с задержкой
// в несколько секунд, чтобы не долбить сеть на каждое нажатие клавиши, а
// дождаться, пока врач закончит редактировать. Ошибки проглатываются молча —
// автосинк не должен мешать работе; при желании можно всегда синкнуть вручную.
const DEBOUNCE_MS = 5000
const ENABLED_KEY = 'medconsult_auto_sync_enabled'

const timers = {}

export function isAutoSyncEnabled() {
  return localStorage.getItem(ENABLED_KEY) !== '0' // включён по умолчанию
}

export function setAutoSyncEnabled(enabled) {
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
}

async function runPush(entity, pushFn, onStatus) {
  if (!isAutoSyncEnabled() || !isSupabaseConfigured()) return
  try {
    const user = await getCurrentUser()
    if (!user) return
    onStatus?.({ entity, status: 'syncing' })
    const result = await pushFn()
    onStatus?.({ entity, status: 'done', result })
  } catch (e) {
    onStatus?.({ entity, status: 'error', error: e.message })
  }
}

function schedule(entity, pushFn, onStatus) {
  clearTimeout(timers[entity])
  timers[entity] = setTimeout(() => runPush(entity, pushFn, onStatus), DEBOUNCE_MS)
}

// Вызывается один раз при старте приложения (см. App.jsx)
export function initAutoSync(onStatus) {
  const offVisits = store.on('visits', () => schedule('visits', pushVisitsIncremental, onStatus))
  const offPatients = store.on('patients', () => schedule('patients', pushPatientsIncremental, onStatus))
  return () => {
    offVisits()
    offPatients()
    Object.values(timers).forEach(clearTimeout)
  }
}
