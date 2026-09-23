// Builds one chronological story out of what the app already stores: dates, contact, your own moments,
// the match, and how a connection ended. Nothing is copied or duplicated; entries are derived every time.

import { momentsOf, hangoutsOf, promisesOf, plansOf, reflectionOf, MOMENT_TYPES, HANGOUT_TYPES, FOLLOW_THROUGH, REFLECTION_QUESTIONS, REFLECTION_ANSWERS, AGAIN_ANSWERS } from './fit.js'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const goodDay = (d) => typeof d === 'string' && DAY_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'))

export const FOLLOW_TEXT = {
  none: 'No follow-up yet',
  me: 'You need to text them',
  them: 'Waiting on them',
  planned: 'Next date planned',
  done: 'Not continuing'
}

// Which filter chip each kind of entry belongs to.
export const GROUPS = {
  all: null,
  dates: ['date', 'plan'],
  contact: ['contact'],
  moments: ['moment', 'hangout', 'promise', 'matched', 'met', 'startdate', 'ended']
}

// Order within one day, newest-feeling first: how it ended, then dates, then your moments, then contact, then the match.
const KIND_ORDER = { ended: 0, date: 1, plan: 1, hangout: 2, moment: 2, promise: 2, contact: 3, matched: 4, met: 5, startdate: 5 }
const MOMENT_LABEL = Object.fromEntries(MOMENT_TYPES.map((t) => [t.id, t.label]))
const HANGOUT_LABEL = Object.fromEntries(HANGOUT_TYPES.map((t) => [t.id, t.label]))
const FOLLOW_THROUGH_LABEL = Object.fromEntries(FOLLOW_THROUGH.map((f) => [f.id, f.label]))

export function buildTimeline(people, dates, opts = {}) {
  const { personId = null, group = 'all', includeArchived = false, endReasons = [] } = opts
  const reasonLabel = Object.fromEntries((endReasons || []).map((r) => [r.id, r.label]))
  const wanted = GROUPS[group] || null
  const list = (Array.isArray(people) ? people : []).filter(
    (p) => p && typeof p === 'object' && (!personId || p.id === personId) && (includeArchived || personId || !p.archived)
  )
  const byPerson = new Map(list.map((p) => [p.id, p]))
  const entries = []
  let seq = 0
  const add = (e) => entries.push({ seq: seq++, ...e })

  for (const p of list) {
    const base = { personId: p.id, personName: p.name || 'Unnamed', archived: Boolean(p.archived) }

    for (const c of Array.isArray(p.contacts) ? p.contacts : []) {
      if (!c || typeof c !== 'object') continue
      const note = typeof c.note === 'string' ? c.note.trim() : ''
      const isMatch = /^matched$/i.test(note)
      add({
        ...base,
        key: `c:${p.id}:${c.id ?? seq}`,
        kind: isMatch ? 'matched' : 'contact',
        date: goodDay(c.date) ? c.date : '',
        title: isMatch ? 'Matched' : 'In touch',
        text: isMatch ? '' : note,
        refId: c.id,
        deletable: true // a wrong match date must be fixable, so this stays a normal, deletable entry
      })
    }

    for (const m of momentsOf(p)) {
      add({
        ...base,
        key: `m:${p.id}:${m.id}`,
        kind: 'moment',
        date: m.date,
        title: MOMENT_LABEL[m.type] || 'Moment',
        momentType: m.type,
        text: m.text,
        feeling: m.feeling,
        refId: m.id,
        deletable: true
      })
    }

    for (const h of hangoutsOf(p)) {
      add({
        ...base,
        key: `h:${p.id}:${h.id}`,
        kind: 'hangout',
        date: h.date,
        title: HANGOUT_LABEL[h.type] || 'Time together',
        hangoutType: h.type,
        text: h.text,
        feeling: h.feeling,
        refId: h.id,
        deletable: true
      })
    }

    for (const pr of promisesOf(p)) {
      add({
        ...base,
        key: `pr:${p.id}:${pr.id}`,
        kind: 'promise',
        date: pr.date,
        title: 'Something they said',
        text: pr.text,
        followThrough: pr.followThrough,
        followThroughLabel: FOLLOW_THROUGH_LABEL[pr.followThrough],
        promiseFlag: pr.flag,
        refId: pr.id,
        deletable: true
      })
    }

    for (const pl of plansOf(p)) {
      add({
        ...base,
        key: `p:${p.id}:${pl.id}`,
        kind: 'plan',
        date: pl.date,
        title: pl.title || 'Planned date',
        text: pl.place ? `At ${pl.place}` : '',
        remind: pl.remind,
        refId: pl.id,
        deletable: true
      })
    }

    if (goodDay(p.metDate)) {
      add({
        ...base,
        key: `met:${p.id}`,
        kind: 'met',
        date: p.metDate,
        title: 'First met',
        text: '',
        deletable: false
      })
    }

    if (goodDay(p.relationshipStartDate)) {
      add({
        ...base,
        key: `startdate:${p.id}`,
        kind: 'startdate',
        date: p.relationshipStartDate,
        title: 'Started dating',
        text: '',
        deletable: false
      })
    }

    if (p.status === 'ended' && p.end && typeof p.end === 'object') {
      const why = reasonLabel[p.end.reason] || ''
      const note = typeof p.end.note === 'string' ? p.end.note.trim() : ''
      add({
        ...base,
        key: `e:${p.id}`,
        kind: 'ended',
        date: goodDay(p.end.date) ? p.end.date : '',
        title: 'Let go',
        text: [why, note].filter(Boolean).join('. '),
        deletable: false
      })
    }
  }

  for (const d of Array.isArray(dates) ? dates : []) {
    if (!d || typeof d !== 'object') continue
    const p = byPerson.get(d.personId)
    if (!p) continue
    add({
      personId: p.id,
      personName: p.name || 'Unnamed',
      archived: Boolean(p.archived),
      key: `d:${d.id ?? seq}`,
      kind: 'date',
      date: goodDay(d.date) ? d.date : '',
      title: typeof d.activity === 'string' && d.activity.trim() ? d.activity.trim() : 'Date',
      rating: Number.isFinite(d.rating) && d.rating > 0 ? Math.min(5, Math.round(d.rating)) : 0,
      followUp: d.followUp && d.followUp !== 'none' && FOLLOW_TEXT[d.followUp] ? FOLLOW_TEXT[d.followUp] : '',
      bullets: Array.isArray(d.impressions) ? d.impressions.filter((x) => typeof x === 'string' && x.trim()) : [],
      reflection: reflectionChips(reflectionOf(d)),
      refId: d.id,
      deletable: false
    })
  }

  return entries
    .filter((e) => !wanted || wanted.includes(e.kind))
    .sort((a, b) => {
      if (a.date !== b.date) {
        if (!a.date) return 1 // undated entries go last
        if (!b.date) return -1
        return b.date.localeCompare(a.date)
      }
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.seq - b.seq
    })
}

// "2026-09-20" -> { month: 'SEP', day: '20', year: '2026', group: 'September 2026' }, all in local time.
export function dayParts(day) {
  if (!goodDay(day)) return { month: '', day: '', year: '', group: 'No date' }
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    month: dt.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: String(d),
    year: String(y),
    group: dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
}

// "Heard: Yes", "See again: Not sure": the quick answers from a post-date reflection, for the timeline.
export function reflectionChips(r) {
  if (!r) return []
  const label = (list, id) => list.find((a) => a.id === id)?.label
  const out = REFLECTION_QUESTIONS.filter((q) => r[q.id]).map((q) => `${q.short}: ${label(REFLECTION_ANSWERS, r[q.id])}`)
  if (r.again) out.push(`See again: ${label(AGAIN_ANSWERS, r.again)}`)
  return out
}
