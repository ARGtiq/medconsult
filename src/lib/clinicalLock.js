import { encryptWithPassword, decryptWithPassword } from './keyVault'

// Опциональное шифрование неймспейса "clinical" (пациенты + визиты — самые
// чувствительные данные) паролем, который знаешь только ты. Если замок не
// включён — этот модуль просто читает/пишет как обычный localStorage-ключ,
// поведение не меняется (по умолчанию защита выключена).
//
// Технический компромисс: readClinicalSync()/writeClinicalSync() должны
// оставаться синхронными (весь store.js построен на синхронном API, менять
// это — риск сломать десятки мест). Поэтому расшифровка происходит один раз
// при разблокировке (async, до рендера приложения — см. AppRoot), а дальше
// работа идёт с расшифрованным кэшем в памяти; шифрование при записи на диск —
// фоновая, не блокирующая операция.
//
// Удобство без потери смысла защиты:
// - пароль на время вкладки кладём в sessionStorage (не localStorage!) —
//   переживает обновление страницы (F5), но исчезает при закрытии вкладки/
//   браузера. Кто-то с физическим доступом к уже открытой вкладке и так мог
//   бы читать данные на экране — session-кэш ничего дополнительно не открывает.
// - ПИН-код — короткий, для быстрой разблокировки на этом устройстве без
//   ввода длинного пароля каждый раз заново. Технически это сам пароль,
//   обёрнутый (зашифрованный) ключом, полученным из ПИН-кода, и сохранённый
//   в localStorage. Кто-то, укравший файлы устройства, всё ещё должен
//   подобрать ПИН, чтобы прочитать пароль и через него — данные.

const CLINICAL_KEY = 'medconsult_ns_clinical'
const LOCK_FLAG_KEY = 'medconsult_clinical_lock_enabled'
const SESSION_PASSWORD_KEY = 'medconsult_clinical_session_pw' // sessionStorage, не localStorage
const PIN_WRAP_KEY = 'medconsult_clinical_pin_wrap'

let memoryCache = null
let sessionPassword = null

export function isLockEnabled() {
  return localStorage.getItem(LOCK_FLAG_KEY) === '1'
}

export function isUnlocked() {
  return memoryCache !== null
}

export function hasPin() {
  return !!localStorage.getItem(PIN_WRAP_KEY)
}

// true, если замок включён, но эта вкладка ещё не разблокирована —
// сигнал для App показать экран разблокировки перед рендером остального
export function needsUnlock() {
  return isLockEnabled() && memoryCache === null
}

export function readClinicalSync() {
  if (memoryCache !== null) return memoryCache
  if (isLockEnabled()) return {} // защищено, данные физически недоступны без unlock
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

function rememberForSession(password) {
  sessionPassword = password
  try {
    sessionStorage.setItem(SESSION_PASSWORD_KEY, password)
  } catch {
    // sessionStorage недоступен (приватный режим и т.п.) — просто не переживёт reload, не критично
  }
}

export async function unlockWithPassword(password) {
  const raw = localStorage.getItem(CLINICAL_KEY)
  if (!raw) {
    memoryCache = {}
    rememberForSession(password)
    return true
  }
  const parsed = JSON.parse(raw)
  if (!parsed.__encrypted) {
    memoryCache = parsed
    rememberForSession(password)
    return true
  }
  const decrypted = await decryptWithPassword(parsed, password)
  memoryCache = decrypted
  rememberForSession(password)
  return true
}

// Вызывается тихо при старте приложения — если пароль уже лежит в
// sessionStorage этой вкладки (F5 не должен спрашивать заново), пробуем им.
// Возвращает true, если разблокировать удалось.
export async function trySessionUnlock() {
  if (!isLockEnabled()) return true
  let stored
  try {
    stored = sessionStorage.getItem(SESSION_PASSWORD_KEY)
  } catch {
    return false
  }
  if (!stored) return false
  try {
    await unlockWithPassword(stored)
    return true
  } catch {
    return false
  }
}

export async function enableLock(password) {
  const current = readClinicalSync()
  localStorage.setItem(LOCK_FLAG_KEY, '1')
  rememberForSession(password)
  const enc = await encryptWithPassword(current, password)
  localStorage.setItem(CLINICAL_KEY, JSON.stringify({ __encrypted: true, ...enc }))
}

export function disableLock() {
  const current = memoryCache || {}
  localStorage.removeItem(LOCK_FLAG_KEY)
  localStorage.removeItem(PIN_WRAP_KEY)
  sessionPassword = null
  try {
    sessionStorage.removeItem(SESSION_PASSWORD_KEY)
  } catch {
    // ignore
  }
  localStorage.setItem(CLINICAL_KEY, JSON.stringify(current))
}

export function lockSession() {
  memoryCache = null
  sessionPassword = null
  try {
    sessionStorage.removeItem(SESSION_PASSWORD_KEY)
  } catch {
    // ignore
  }
}

// --- ПИН-код: быстрая разблокировка на этом устройстве без полного пароля ---
export async function enablePin(pin, password) {
  const enc = await encryptWithPassword({ pw: password }, pin)
  localStorage.setItem(PIN_WRAP_KEY, JSON.stringify(enc))
}

export function disablePin() {
  localStorage.removeItem(PIN_WRAP_KEY)
}

export async function unlockWithPin(pin) {
  const raw = localStorage.getItem(PIN_WRAP_KEY)
  if (!raw) throw new Error('ПИН не настроен')
  const parsed = JSON.parse(raw)
  const { pw } = await decryptWithPassword(parsed, pin)
  await unlockWithPassword(pw)
  return true
}
