// Encrypted backups: AES-256-GCM, key derived from a passphrase with PBKDF2-SHA256. Nothing here ever leaves the device.
const MAGIC = 'date-a-dex-encrypted'
const ITER = 210000
export const MIN_PASSPHRASE = 8
const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s) }
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))

async function keyFor(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function isEncryptedBackup(obj) {
  return Boolean(obj && typeof obj === 'object' && obj.format === MAGIC && typeof obj.data === 'string' && typeof obj.salt === 'string' && typeof obj.iv === 'string')
}

export async function encryptBackup(json, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await keyFor(passphrase, salt, ITER)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json))
  return { format: MAGIC, v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) }
}

export async function decryptBackup(obj, passphrase) {
  if (!isEncryptedBackup(obj)) throw new Error('This is not an encrypted Date-a-Dex backup.')
  try {
    const iter = Number.isInteger(obj.iter) && obj.iter >= 1000 && obj.iter <= 2000000 ? obj.iter : ITER
    const key = await keyFor(String(passphrase ?? ''), unb64(obj.salt), iter)
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.data)))
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.')
  }
}
