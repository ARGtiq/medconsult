// Шифрование AI-ключей паролем перед отправкой в облако (Supabase), чтобы
// восстановить их на другом устройстве. Используется встроенный Web Crypto API
// (PBKDF2 для получения ключа из пароля + AES-GCM для шифрования) — без внешних
// библиотек, ключ шифрования никогда не покидает браузер, в облако уходит только
// шифротекст + соль + IV.

async function deriveKey(password, salt) {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function encryptWithPassword(plaintextObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const data = enc.encode(JSON.stringify(plaintextObj))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return {
    cipher: toBase64(cipherBuf),
    salt: toBase64(salt),
    iv: toBase64(iv),
  }
}

export async function decryptWithPassword({ cipher, salt, iv }, password) {
  const key = await deriveKey(password, fromBase64(salt))
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(cipher)
  )
  const dec = new TextDecoder()
  return JSON.parse(dec.decode(plainBuf))
}
