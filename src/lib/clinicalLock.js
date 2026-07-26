import { encryptWithPassword, decryptWithPassword } from './keyVault'

// Опциональное шифрование неймспейса "clinical" (пациенты + визиты — самые
// чувствительные данные) паролем, который знаешь только ты. Пароль нигде не
// хранится, держится только в памяти вкладки на время сессии. Если замок не
// включён — этот модуль просто читает/пишет как обычный localStorage-ключ,
// поведение не меняется (по умолчанию защита выключена).
//
// Технический компромисс: readClinicalSync()/writeClinicalSync() должны
// оставаться синхронными (весь store.js построен на синхронном API, менять
// это — риск сломать десятки мест). Поэтому расшифровка происходит один раз
// при разблокировке (async, до рендера приложения — см. AppRoot), а дальше
// работа идёт с расшифрованным кэшем в памяти; шифрование при записи на диск —
// фоновая, не блокирующая операция.

const CLINICAL_KEY = 'medconsult_ns_clinical'
const LOCK_FLAG_KEY = 'medconsult_clinical_lock_enabled'

let memoryCache = null
let sessionPassword = null

export function isLockEnabled() {
  return localStorage.getItem(LOCK_FLAG_KEY) === '1'
}

export function isUnlocked() {
  return memoryCache !== null
}

// true, если замок включён, но эта вкладка ещё не разблокирована паролем —
// сигнал для App показать экран разблокировки перед рендером остального
export function needsUnlock() {
  return isLockEnabled() && memoryCache === null
}

export function readClinicalSync() {
  if (memoryCache !== null) return memoryCache
  if (isLockEnabled()) return {} // защищено, данные физически недоступны без unlockWithPassword()
  try {
    const raw = localStorage.getItem(CLINICAL_KEY)
    memoryCache = raw ? JSON.parse(raw) : {}
  } catch {
    memoryCache = {}
  }
  return memoryCache
}

export function writeClinicalSync(data) {
  memoryCache = data
  if (isLockEnabled()) {
    if (!sessionPassword) return // замок включён, но сессия не разблокирована — писать некуда, кэш в памяти всё равно жив
    encryptWithPassword(data, sessionPassword).then((enc) => {
      localStorage.setItem(CLINICAL_KEY, JSON.stringify({ __encrypted: true, ...enc }))
    })
  } else {
    localStorage.setItem(CLINICAL_KEY, JSON.stringify(data))
  }
}

export async function unlockWithPassword(password) {
  const raw = localStorage.getItem(CLINICAL_KEY)
  if (!raw) {
    memoryCache = {}
    sessionPassword = password
    return true
  }
  const parsed = JSON.parse(raw)
  if (!parsed.__encrypted) {
    memoryCache = parsed
    sessionPassword = password
    return true
  }
  const decrypted = await decryptWithPassword(parsed, password)
  memoryCache = decrypted
  sessionPassword = password
  return true
}

export async function enableLock(password) {
  const current = readClinicalSync()
  sessionPassword = password
  localStorage.setItem(LOCK_FLAG_KEY, '1')
  const enc = await encryptWithPassword(current, password)
  localStorage.setItem(CLINICAL_KEY, JSON.stringify({ __encrypted: true, ...enc }))
}

export function disableLock() {
  const current = memoryCache || {}
  localStorage.removeItem(LOCK_FLAG_KEY)
  sessionPassword = null
  localStorage.setItem(CLINICAL_KEY, JSON.stringify(current))
}

export function lockSession() {
  memoryCache = null
  sessionPassword = null
}
