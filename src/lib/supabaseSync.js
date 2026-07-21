import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'
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

// Диагностика: проверяем, что клиент реально создан и запрос к таблице проходит.
// Ошибка обычно означает, что таблица medconsult_sync ещё не создана в Supabase
// (см. SQL в Настройки → Общие → Supabase), либо не настроен RLS.
export async function testSupabaseConnection() {
  const client = getSupabaseClient()
  if (!client) {
    return { ok: false, error: 'Supabase не настроен: добавь URL и anon key в Настройки → Общие' }
  }
  const start = performance.now()
  try {
    const { error } = await client.from(TABLE).select('id').limit(1)
    const latency = Math.round(performance.now() - start)
    if (error) return { ok: false, latency, error: error.message }
    return { ok: true, latency }
  } catch (e) {
    return { ok: false, latency: Math.round(performance.now() - start), error: e.message }
  }
}

// id строки в облаке — либо auth.uid() залогиненного пользователя (предпочтительно,
// тогда RLS реально разделяет данные между людьми), либо старый вариант с ручным
// "кодом синхронизации" для тех, кто не хочет возиться с magic link.
async function resolveRowId(client, syncCode) {
  const { data } = await client.auth.getUser()
  if (data?.user?.id) return data.user.id
  if (syncCode?.trim()) return syncCode.trim()
  throw new Error('Нужно либо войти по magic link, либо указать код синхронизации')
}

export async function pushToSupabase(syncCode) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const id = await resolveRowId(client, syncCode)
  const payload = JSON.parse(store.exportAll())
  const { error } = await client.from(TABLE).upsert({
    id,
    payload,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  setLastSync({ direction: 'push', at: Date.now() })
}

export async function pullFromSupabase(syncCode) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const id = await resolveRowId(client, syncCode)
  const { data, error } = await client.from(TABLE).select('payload').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (!data?.payload) throw new Error('Данные не найдены')
  store.importAll(JSON.stringify(data.payload))
  setLastSync({ direction: 'pull', at: Date.now() })
}

// --- Magic Link ---
export async function sendMagicLink(email) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.href },
  })
  if (error) throw new Error(error.message)
}

export async function getCurrentUser() {
  const client = getSupabaseClient()
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data?.user || null
}

export async function signOut() {
  const client = getSupabaseClient()
  if (!client) return
  await client.auth.signOut()
}

export function onAuthChange(callback) {
  const client = getSupabaseClient()
  if (!client) return () => {}
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null)
  })
  return () => data.subscription.unsubscribe()
}

// --- Зашифрованное хранение AI-ключей (для восстановления на другом устройстве) ---
const SECRETS_TABLE = 'medconsult_secrets'

export async function pushEncryptedKeys(encryptedBlob) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const { data: userData } = await client.auth.getUser()
  if (!userData?.user?.id) throw new Error('Нужно сначала войти по magic link')
  const { error } = await client.from(SECRETS_TABLE).upsert({
    id: userData.user.id,
    cipher: encryptedBlob.cipher,
    salt: encryptedBlob.salt,
    iv: encryptedBlob.iv,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function pullEncryptedKeys() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const { data: userData } = await client.auth.getUser()
  if (!userData?.user?.id) throw new Error('Нужно сначала войти по magic link')
  const { data, error } = await client
    .from(SECRETS_TABLE)
    .select('cipher, salt, iv')
    .eq('id', userData.user.id)
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Сохранённых ключей не найдено')
  return data
}
