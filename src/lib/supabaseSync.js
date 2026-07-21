import { supabase, isSupabaseConfigured } from './supabaseClient'
import { store } from './store'

const TABLE = 'medconsult_sync'
const LAST_SYNC_KEY = 'medconsult_last_sync'

export function getLastSync() {
  try {
    return JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || 'null')
  } catch {
    return null
  }
}

function setLastSync(info) {
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(info))
}

// Диагностика: проверяем, что переменные окружения заданы и что запрос к таблице
// действительно проходит (а не просто что клиент создан). Ошибка обычно означает,
// что таблица medconsult_sync ещё не создана в Supabase, либо не настроен RLS.
export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase не настроен: нет VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY в .env' }
  }
  const start = performance.now()
  try {
    const { error } = await supabase.from(TABLE).select('id').limit(1)
    const latency = Math.round(performance.now() - start)
    if (error) return { ok: false, latency, error: error.message }
    return { ok: true, latency }
  } catch (e) {
    return { ok: false, latency: Math.round(performance.now() - start), error: e.message }
  }
}

export async function pushToSupabase(syncCode) {
  if (!isSupabaseConfigured()) throw new Error('Supabase не настроен')
  if (!syncCode?.trim()) throw new Error('Укажи код синхронизации')
  const payload = JSON.parse(store.exportAll())
  const { error } = await supabase.from(TABLE).upsert({
    id: syncCode.trim(),
    payload,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  setLastSync({ direction: 'push', at: Date.now(), syncCode: syncCode.trim() })
}

export async function pullFromSupabase(syncCode) {
  if (!isSupabaseConfigured()) throw new Error('Supabase не настроен')
  if (!syncCode?.trim()) throw new Error('Укажи код синхронизации')
  const { data, error } = await supabase.from(TABLE).select('payload').eq('id', syncCode.trim()).single()
  if (error) throw new Error(error.message)
  if (!data?.payload) throw new Error('Данные с этим кодом не найдены')
  store.importAll(JSON.stringify(data.payload))
  setLastSync({ direction: 'pull', at: Date.now(), syncCode: syncCode.trim() })
}
