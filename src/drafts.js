// Unfinished forms. Saved on this device only, in the same private browser storage as your other data, so a slip of the
// thumb does not lose what you typed. A draft is removed when you save it or discard it, and it expires after 7 days.
import { reflectionOf } from './fit.js'

const KEY = 'dex.drafts.v1'
export const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000
export const MAX_DRAFTS = 20
const DAY = /^\d{4}-\d{2}-\d{2}$/
const FOLLOW = new Set(['none', 'me', 'them', 'planned', 'done'])
const MOMENT = new Set(['conversation', 'plan', 'milestone', 'feeling'])
const FEEL = new Set(['great', 'good', 'okay', 'uneasy', 'rough'])
const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '')

// Each kind has its own checker: it decides what a draft may contain and whether it is worth keeping.
const KINDS = {
  date(d) {
    if (!d || typeof d !== 'object') return null
    const out = {
      personId: str(d.personId, 60),
      date: DAY.test(d.date || '') ? d.date : '',
      activity: str(d.activity, 80),
      rating: Number.isInteger(d.rating) && d.rating >= 1 && d.rating <= 5 ? d.rating : 0,
      followUp: FOLLOW.has(d.followUp) ? d.followUp : 'none',
      impressions: (Array.isArray(d.impressions) ? d.impressions : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.slice(0, 300)).slice(0, 30),
      reflection: reflectionOf({ reflection: d.reflection }) || {}
    }
    const worth = out.activity.trim() || out.rating > 0 || out.impressions.length || out.followUp !== 'none' || Object.keys(out.reflection).length
    return worth ? out : null
  },
  moment(d) {
    if (!d || typeof d !== 'object') return null
    const out = {
      type: MOMENT.has(d.type) ? d.type : 'conversation',
      date: DAY.test(d.date || '') ? d.date : '',
      text: str(d.text, 600),
      feeling: FEEL.has(d.feeling) ? d.feeling : ''
    }
    return out.text.trim() || out.feeling ? out : null
  },
  plan(d) {
    if (!d || typeof d !== 'object') return null
    const out = { title: str(d.title, 80), place: str(d.place, 80), date: DAY.test(d.date || '') ? d.date : '', remind: d.remind !== false }
    return out.title.trim() || out.place.trim() ? out : null
  }
}
const checkerFor = (kind) => KINDS[String(kind).split(':')[0]] || null

function read(store) {
  try {
    const v = JSON.parse(store.getItem(KEY) || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

// Returns true when a draft was worth keeping and was saved; a draft with nothing in it clears the old one instead.
export function saveDraft(kind, data, now = Date.now(), store = globalThis.localStorage) {
  const check = checkerFor(kind)
  if (!check || typeof kind !== 'string' || kind.length > 80) return false
  const all = read(store)
  const clean = check(data)
  if (!clean) { delete all[kind]; write(store, all); return false }
  all[kind] = { at: now, data: clean }
  const keys = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0))
  keys.slice(MAX_DRAFTS).forEach((k) => delete all[k])
  return write(store, all)
}
function write(store, all) {
  try { store.setItem(KEY, JSON.stringify(all)); return true } catch { return false }
}

export function loadDraft(kind, now = Date.now(), store = globalThis.localStorage) {
  const check = checkerFor(kind)
  const rec = read(store)[kind]
  if (!check || !rec || typeof rec.at !== 'number' || now - rec.at > DRAFT_TTL_MS || rec.at > now + 60000) return null
  return check(rec.data)
}

export function clearDraft(kind, store = globalThis.localStorage) {
  const all = read(store)
  if (kind in all) { delete all[kind]; write(store, all) }
}
export function clearAllDrafts(store = globalThis.localStorage) {
  try { store.removeItem(KEY) } catch { /* nothing to clear */ }
}
export function draftCount(now = Date.now(), store = globalThis.localStorage) {
  return Object.keys(read(store)).filter((k) => loadDraft(k, now, store)).length
}
