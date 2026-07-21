import { createClient } from '@supabase/supabase-js'

// Ключи Supabase теперь можно ввести прямо в приложении (Настройки → Общие →
// Supabase), они хранятся в localStorage. .env по-прежнему поддерживается как
// вариант для тех, кто собирает сам — но не обязателен.

const URL_KEY = 'medconsult_supabase_url'
const ANON_KEY = 'medconsult_supabase_anon_key'

let cachedClient = null
let cachedConfigKey = ''

export function getSupabaseConfig() {
  const url = localStorage.getItem(URL_KEY) || import.meta.env.VITE_SUPABASE_URL || ''
  const anonKey = localStorage.getItem(ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return { url, anonKey }
}

export function setSupabaseConfig(url, anonKey) {
  localStorage.setItem(URL_KEY, url.trim())
  localStorage.setItem(ANON_KEY, anonKey.trim())
  cachedClient = null // пересоздать клиент при следующем обращении
}

export function clearSupabaseConfig() {
  localStorage.removeItem(URL_KEY)
  localStorage.removeItem(ANON_KEY)
  cachedClient = null
}

function buildClient() {
  const { url, anonKey } = getSupabaseConfig()
  const configKey = `${url}::${anonKey}`
  if (cachedClient && cachedConfigKey === configKey) return cachedClient
  if (!url || !anonKey) {
    cachedClient = null
    cachedConfigKey = ''
    return null
  }
  cachedClient = createClient(url, anonKey)
  cachedConfigKey = configKey
  return cachedClient
}

// Геттер вместо статичного экспорта — чтобы подхватывать смену ключей без перезагрузки страницы
export function getSupabaseClient() {
  return buildClient()
}

export const isSupabaseConfigured = () => !!buildClient()
