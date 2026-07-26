import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'
import { store } from './store'

// Раньше вся база синкалась одним блобом в таблицу medconsult_sync.
// Теперь — своя таблица на каждый неймспейс (medconsult_ns_clinical и т.п.),
// той же формы, что и локальные ключи store.js. Даёт: можно синкать визиты
// часто и отдельно от редко меняющихся справочников, конфликт при
// одновременном редактировании на двух устройствах локальнее (не весь блоб
// целиком), и точку, куда прицельно повесить шифрование — таблица clinical
// самая чувствительная и растёт быстрее остальных.
function tableFor(ns) {
  return `medconsult_ns_${ns}`
}

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

// Диагностика: проверяем, что клиент реально создан и запрос хотя бы к одной
// из таблиц-неймспейсов проходит. Ошибка обычно означает, что таблицы ещё не
// созданы в Supabase (см. SQL в Настройки → Общие → Supabase), либо не настроен RLS.
export async function testSupabaseConnection() {
  const client = getSupabaseClient()
  if (!client) {
    return { ok: false, error: 'Supabase не настроен: добавь URL и anon key в Настройки → Общие' }
  }
  const start = performance.now()
  try {
    const { error } = await client.from(tableFor('system')).select('id').limit(1)
    const latency = Math.round(performance.now() - start)
    if (error) return { ok: false, latency, error: error.message }
    return { ok: true, latency }
  } catch (e) {
    return { ok: false, latency: Math.round(performance.now() - start), error: e.message }
  }
}

async function requireUserId(client) {
  const { data } = await client.auth.getUser()
  if (!data?.user?.id) throw new Error('Нужно сначала войти по magic link (см. блок выше)')
  return data.user.id
}

// --- push/pull одного неймспейса ---
export async function pushNamespace(ns) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const id = await requireUserId(client)
  const payload = JSON.parse(store.exportNamespace(ns))
  const { error } = await client.from(tableFor(ns)).upsert({
    id,
    payload,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function pullNamespace(ns) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase не настроен')
  const id = await requireUserId(client)
  const { data, error } = await client.from(tableFor(ns)).select('payload').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (!data?.payload) throw new Error('Данные не найдены')
  store.importNamespace(ns, JSON.stringify(data.payload))
}

// --- push/pull всех неймспейсов разом (обычная кнопка "Отправить/Загрузить") ---
export async function pushToSupabase() {
  for (const ns of store.getNamespaceNames()) {
    await pushNamespace(ns)
  }
  setLastSync({ direction: 'push', at: Date.now() })
  localStorage.setItem('medconsult_last_backup', String(Date.now()))
}

export async function pullFromSupabase() {
  for (const ns of store.getNamespaceNames()) {
    await pullNamespace(ns)
  }
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
