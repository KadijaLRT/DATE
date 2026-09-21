// Patterns in your own records. Descriptive only: it says what your entries show, never what to do.
import { momentsOf, reflectionOf, reflectionScore, REFLECTION_QUESTIONS, FEELINGS } from './fit.js'

export const MIN_SAMPLE = 3
const FEEL_VALUE = Object.fromEntries(FEELINGS.map((f) => [f.id, f.value]))

export function activityAverages(dates, minCount = 2) {
  const map = new Map()
  for (const d of Array.isArray(dates) ? dates : []) {
    const a = typeof d?.activity === 'string' ? d.activity.trim().toLowerCase() : ''
    if (!a || !(d.rating > 0)) continue
    const m = map.get(a) || { activity: a, sum: 0, n: 0 }
    m.sum += d.rating
    m.n += 1
    map.set(a, m)
  }
  return [...map.values()].filter((m) => m.n >= minCount).map((m) => ({ activity: m.activity, avg: m.sum / m.n, n: m.n })).sort((a, b) => b.avg - a.avg || b.n - a.n)
}

const STOP = new Set(('the and for with that this was were are have has had they them their about from into just really very also been being would could should there then than when what which while your you his her she him our out not but all any can did does get got its like more some such too one two who how why over only other after before because again talked told said asked felt went came make made much many well').split(' '))

export function themes(people, dates, { min = 3, limit = 6 } = {}) {
  const texts = []
  for (const p of Array.isArray(people) ? people : []) {
    if (!p) continue
    ;(p.notes || []).forEach((n) => texts.push(n))
    momentsOf(p).forEach((m) => texts.push(m.text))
  }
  for (const d of Array.isArray(dates) ? dates : []) {
    if (!d) continue
    ;(d.impressions || []).forEach((n) => texts.push(n))
    const r = reflectionOf(d)
    if (r) texts.push(r.understand, r.journal)
  }
  const counts = new Map()
  for (const t of texts) {
    if (typeof t !== 'string') continue
    const seen = new Set(t.toLowerCase().replace(/[’]/g, "'").split(/[^a-z']+/).filter((w) => w.length >= 4 && !STOP.has(w)))
    seen.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1))
  }
  return [...counts.entries()].filter(([, n]) => n >= min).map(([word, n]) => ({ word, n })).sort((a, b) => b.n - a.n || a.word.localeCompare(b.word)).slice(0, limit)
}

// How often you answered Yes and No to each reflection question, across all dates.
export function reflectionTrends(dates) {
  const rs = (Array.isArray(dates) ? dates : []).map(reflectionOf).filter(Boolean)
  const rows = REFLECTION_QUESTIONS.map((q) => {
    const answered = rs.map((r) => r[q.id]).filter(Boolean)
    return { id: q.id, short: q.short, label: q.label, n: answered.length, yes: answered.filter((a) => a === 'yes').length, no: answered.filter((a) => a === 'no').length }
  }).filter((r) => r.n >= MIN_SAMPLE)
  return { reflections: rs.length, rows }
}

// A line of how things have felt over time: moment feelings and reflection scores, oldest first.
export function emotionSeries(people, dates, personId = null) {
  const pts = []
  const list = (Array.isArray(people) ? people : []).filter((p) => p && (!personId || p.id === personId))
  const ids = new Set(list.map((p) => p.id))
  for (const p of list) for (const m of momentsOf(p)) if (m.feeling) pts.push({ date: m.date, value: FEEL_VALUE[m.feeling], source: 'moment', personId: p.id })
  for (const d of Array.isArray(dates) ? dates : []) {
    if (!d || !ids.has(d.personId) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) continue
    const sc = reflectionScore(reflectionOf(d))
    if (sc !== null) pts.push({ date: d.date, value: sc, source: 'reflection', personId: d.personId })
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date))
}
