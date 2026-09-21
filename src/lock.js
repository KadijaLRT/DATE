// App lock: a numeric PIN, stored only as a salted PBKDF2 hash on this device.
// It keeps casual snoopers out of the app. It does NOT encrypt the data stored in the browser; use an encrypted backup for that.
const KEY = 'dex.lock.v1'
const FAILS = 'dex.lock.fails'
const ITER = 150000
export const PIN_RE = /^\d{4,8}$/
export const MAX_TRIES = 5
export const LOCKOUT_MS = 30000

const enc = new TextEncoder()
const b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((c) => { s += String.fromCharCode(c) }); return btoa(s) }
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))

async function derive(pin, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256)
}

export const hasPin = (store = globalThis.localStorage) => {
  try { const v = JSON.parse(store.getItem(KEY) || 'null'); return Boolean(v && v.salt && v.hash) } catch { return false }
}

export async function setPin(pin, store = globalThis.localStorage) {
  if (!PIN_RE.test(pin)) throw new Error('Use 4 to 8 digits.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  store.setItem(KEY, JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), hash: b64(await derive(pin, salt, ITER)) }))
  store.removeItem(FAILS)
}

export async function verifyPin(pin, store = globalThis.localStorage) {
  let rec
  try { rec = JSON.parse(store.getItem(KEY) || 'null') } catch { rec = null }
  if (!rec || !rec.salt || !rec.hash || typeof pin !== 'string') return false
  const got = new Uint8Array(await derive(pin, unb64(rec.salt), rec.iter || ITER))
  const want = unb64(rec.hash)
  let diff = got.length ^ want.length
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ (want[i] || 0)
  return diff === 0
}

export const clearPin = (store = globalThis.localStorage) => { store.removeItem(KEY); store.removeItem(FAILS) }

// After MAX_TRIES wrong PINs in a row, wait LOCKOUT_MS before another try.
export function waitLeft(now = Date.now(), store = globalThis.localStorage) {
  try { const f = JSON.parse(store.getItem(FAILS) || 'null'); return f && f.until > now ? f.until - now : 0 } catch { return 0 }
}
export function recordFail(now = Date.now(), store = globalThis.localStorage) {
  let f = { count: 0, until: 0 }
  try { f = JSON.parse(store.getItem(FAILS) || 'null') || f } catch { /* start fresh */ }
  f.count = (f.until && f.until <= now ? 0 : f.count) + 1
  if (f.count >= MAX_TRIES) { f.until = now + LOCKOUT_MS; f.count = 0 }
  store.setItem(FAILS, JSON.stringify(f))
  return f
}
export const resetFails = (store = globalThis.localStorage) => store.removeItem(FAILS)
