import { useEffect, useRef, useState } from 'react'
import { emptyCriteria, normalizeCriteria, customFlagsOf, momentsOf, hangoutsOf, intimacyOf, promisesOf, commitmentsOf, plansOf, rememberOf, reflectionOf, TAGS, validDay } from './fit.js'
import { normalizeSettings } from './settings.js'
import { cleanPhoto } from './photos.js'

// Tags live in fit.js so scoring and the UI share one list.
export { TAGS }

// The storage key keeps its original name so everyone's saved data survives the rename to Date-a-Dex.
const KEY = 'roster.v1'

// Order matters: it is the order shown in filters and pickers, roughly from earliest stage to latest.
// 'ended' is special: it is an OUTCOME, not a stage. Ended people leave the active list and the Fit tab,
// but their dates still count for learning.
export const STATUSES = [
  { id: 'talking', label: 'Talking stage', hint: 'Getting to know each other, no dates yet', color: 'var(--sky)' },
  { id: 'texting', label: 'Texting', hint: 'Chatting regularly', color: 'var(--amber)' },
  { id: 'planning', label: 'Planning date', hint: 'A date is being set up', color: 'var(--rose)' },
  { id: 'dating', label: 'Dating', hint: 'Going on dates', color: 'var(--sage)' },
  { id: 'hold', label: 'On hold', hint: 'Paused for now', color: 'var(--stone)' },
  { id: 'ended', label: 'Let go / ended', hint: 'It is over', color: 'var(--ink)' }
]

export const ACTIVE_STATUSES = STATUSES.filter((s) => s.id !== 'ended')

// Why it ended. 'other' is always available so nobody is forced into a reason that is not true.
export const END_REASONS = [
  { id: 'incompatible', label: 'Not compatible' },
  { id: 'ghosted', label: 'They ghosted / faded out' },
  { id: 'lost_interest', label: 'I lost interest' },
  { id: 'they_ended', label: 'They ended it' },
  { id: 'red_flags', label: 'Red flags' },
  { id: 'timing', label: 'Wrong timing' },
  { id: 'other', label: 'Other' }
]

export const isEnded = (p) => p?.status === 'ended'
// Someone shows in the main list and the Fit tab only if they are neither archived nor ended.
export const isActive = (p) => Boolean(p) && !p.archived && p.status !== 'ended'

const empty = { people: [], dates: [], criteria: emptyCriteria, feedback: [], checkins: [], learning: true, settings: normalizeSettings() }

// A stored date keeps its shape; only the reflection is re-validated so a bad backup cannot smuggle junk in.
function cleanDate(d) {
  if (!d || typeof d !== 'object') return d
  const r = reflectionOf(d)
  const { reflection: _old, ...rest } = d
  return r ? { ...rest, reflection: r } : rest
}

function cleanList(x) {
  return Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []
}

export const cleanCriteria = normalizeCriteria

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    return {
      people: Array.isArray(parsed.people) ? parsed.people.map(migratePerson) : [],
      dates: Array.isArray(parsed.dates) ? parsed.dates.filter((x) => x && typeof x === 'object').map(cleanDate) : [],
      criteria: cleanCriteria(parsed.criteria),
      feedback: cleanList(parsed.feedback),
      checkins: cleanList(parsed.checkins),
      learning: parsed.learning !== false,
      settings: normalizeSettings(parsed.settings)
    }
  } catch {
    return empty
  }
}


// Contact history: [{ id, date: 'YYYY-MM-DD', note }]. lastContact is DERIVED from it, never stored separately,
// so the two can never disagree.
export function toDay(iso) {
  if (!iso) return ''
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return ''
    return `${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-${String(iso.getDate()).padStart(2, '0')}`
  }
  const s = String(iso)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Today's date on the user's own calendar (not UTC), so evening entries never land on tomorrow.
export function todayDay() {
  return toDay(new Date())
}

// Newest contact date for a person, or null. Also counts logged dates so a date always counts as contact.
export function lastContactOf(person, dates = []) {
  const days = []
  for (const c of person.contacts || []) if (c && c.date) days.push(c.date)
  for (const d of dates) if (d.personId === person.id && d.date) days.push(toDay(d.date))
  const valid = days.filter(Boolean).sort()
  return valid.length ? valid[valid.length - 1] : null
}

// Bring an older person record (single lastContact stamp) up to the contacts-history shape.
export function migratePerson(p) {
  if (!p || typeof p !== 'object') return p
  let contacts = Array.isArray(p.contacts) ? p.contacts.filter((c) => c && typeof c === 'object' && c.date) : null
  if (contacts === null) {
    const day = toDay(p.lastContact)
    contacts = day ? [{ id: 'mig-' + (p.id || '') , date: day, note: 'Imported from earlier last contact' }] : []
  }
  const { lastContact: _drop, ...rest } = p
  // An unknown or missing status (older data, hand-edited backup) falls back to 'texting' instead of breaking filters.
  const status = STATUSES.some((s) => s.id === rest.status) ? rest.status : 'texting'
  const end = rest.end && typeof rest.end === 'object' ? rest.end : null
  return {
    ...rest,
    status,
    contacts,
    tags: Array.isArray(rest.tags) ? rest.tags : [],
    customFlags: customFlagsOf(rest),
    photo: cleanPhoto(rest.photo),
    moments: momentsOf(rest),
    hangouts: hangoutsOf(rest),
    intimacy: intimacyOf(rest),
    promises: promisesOf(rest),
    commitments: commitmentsOf(rest),
    metDate: validDay(rest.metDate) ? rest.metDate : '',
    relationshipStartDate: validDay(rest.relationshipStartDate) ? rest.relationshipStartDate : '',
    plans: plansOf(rest),
    remember: rememberOf({
      remember: [
        ...(Array.isArray(rest.notes) ? rest.notes : [])
          .filter((n) => typeof n === 'string' && n.trim())
          .map((n, i) => ({ id: `note-${i}`, kind: 'note', text: n, done: false })),
        ...rememberOf(rest)
      ]
    }),
    notes: [], // legacy field: anything saved here is folded into Remember for next time (kind Note) below
    // end = { reason, note, date } only while status is 'ended'; cleared otherwise so stale reasons never linger
    end: status === 'ended' ? end : null
  }
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export function useStore() {
  const [data, setData] = useState(load)
  const [undo, setUndo] = useState(null)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])
  const snapRef = useRef(null)

  // If the browser refuses to save (storage full, or blocked), say so: silently losing changes is the worst outcome.
  const [saveFailed, setSaveFailed] = useState(false)
  useEffect(() => {
    let failed = false
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      failed = true
    }
    queueMicrotask(() => setSaveFailed(failed)) // reported after the effect, not inside it
  }, [data])

  // A short confirmation ("Date logged"), shown in a toast that never blocks anything.
  const [notice, setNotice] = useState(null)
  const notify = (message) => setNotice({ message, key: uid() })
  const clearNotice = () => setNotice(null)

  const addPerson = (p) => {
    const person = {
      id: uid(),
      name: '',
      age: '',
      job: '',
      met: '',
      location: '',
      status: 'talking',
      end: null,
      tags: [],
      customFlags: [],
      photo: '',
      metDate: '',
      relationshipStartDate: '',
      moments: [],
      hangouts: [],
      intimacy: [],
      promises: [],
      commitments: [],
      plans: [],
      remember: [],
      notes: [],
      contacts: [{ id: uid(), date: todayDay(), note: 'Matched' }],
      archived: false,
      created: new Date().toISOString(),
      ...p
    }
    setData((d) => ({ ...d, people: [person, ...d.people] }))
    return person.id
  }

  // Move someone to 'ended' with a reason, or move them back to any other stage (which clears the reason).
  const setStatus = (id, status, endInfo = null) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => {
        if (p.id !== id) return p
        if (status === 'ended') {
          return {
            ...p,
            status: 'ended',
            end: {
              // empty string means "no reason given"; never invent one the user did not choose
              reason: END_REASONS.some((r) => r.id === endInfo?.reason) ? endInfo.reason : '',
              note: (endInfo?.note || '').trim(),
              date: toDay(endInfo?.date) || todayDay()
            }
          }
        }
        // Auto-suggest a relationship-start date the first time someone reaches Dating; never overwrite a date
        // already set, and never invent one for any other stage.
        const suggestStart = status === 'dating' && !p.relationshipStartDate
        return { ...p, status, end: null, relationshipStartDate: suggestStart ? todayDay() : p.relationshipStartDate }
      })
    }))

  const updatePerson = (id, patch) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p))
    }))

  const rawDeletePerson = (id) =>
    setData((d) => ({
      ...d,
      people: d.people.filter((p) => p.id !== id),
      dates: d.dates.filter((x) => x.personId !== id),
      feedback: d.feedback.filter((f) => f.personId !== id),
      checkins: d.checkins.filter((c) => c.personId !== id)
    }))

  const addDate = (x) => {
    const id = uid()
    setData((d) => ({
      ...d,
      dates: [{ id, created: new Date().toISOString(), ...x }, ...d.dates]
    }))
    notify('Date logged')
    return id
  }

  const addContact = (personId, date, note = '') =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId
          ? { ...p, contacts: [...(p.contacts || []), { id: uid(), date: toDay(date) || todayDay(), note: note.trim() }] }
          : p
      )
    }))

  const addMoment = (personId, m) => {
    notify('Moment saved')
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId ? { ...p, moments: momentsOf({ moments: [...momentsOf(p), { id: uid(), ...m }] }) } : p
      )
    }))
  }

  const rawDeleteMoment = (personId, momentId) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === personId ? { ...p, moments: momentsOf(p).filter((m) => m.id !== momentId) } : p))
    }))

  const addHangout = (personId, h) => {
    notify('Time together saved')
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId ? { ...p, hangouts: hangoutsOf({ hangouts: [...hangoutsOf(p), { id: uid(), ...h }] }) } : p
      )
    }))
  }

  const rawDeleteHangout = (personId, hangoutId) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === personId ? { ...p, hangouts: hangoutsOf(p).filter((h) => h.id !== hangoutId) } : p))
    }))

  const addIntimacy = (personId, x) => {
    notify('Saved')
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId ? { ...p, intimacy: intimacyOf({ intimacy: [...intimacyOf(p), { id: uid(), ...x }] }) } : p
      )
    }))
  }

  const rawDeleteIntimacy = (personId, entryId) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === personId ? { ...p, intimacy: intimacyOf(p).filter((x) => x.id !== entryId) } : p))
    }))

  const addPromise = (personId, pr) => {
    notify('Saved')
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId ? { ...p, promises: promisesOf({ promises: [...promisesOf(p), { id: uid(), ...pr }] }) } : p
      )
    }))
  }

  const rawDeletePromise = (personId, promiseId) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === personId ? { ...p, promises: promisesOf(p).filter((pr) => pr.id !== promiseId) } : p))
    }))

  const addCommitment = (personId, cm) => {
    notify('Promise saved')
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId ? { ...p, commitments: commitmentsOf({ commitments: [...commitmentsOf(p), { id: uid(), ...cm }] }) } : p
      )
    }))
  }

  const rawDeleteCommitment = (personId, commitmentId) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === personId ? { ...p, commitments: commitmentsOf(p).filter((cm) => cm.id !== commitmentId) } : p))
    }))

  const rawDeleteContact = (personId, contactId) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === personId ? { ...p, contacts: (p.contacts || []).filter((c) => c.id !== contactId) } : p
      )
    }))

  const updateDate = (id, patch) => {
    setData((d) => ({
      ...d,
      dates: d.dates.map((x) => (x.id === id ? { ...x, ...patch } : x))
    }))
    notify(patch.reflection ? 'Reflection saved' : 'Changes saved')
  }

  const rawDeleteDate = (id) =>
    setData((d) => ({ ...d, dates: d.dates.filter((x) => x.id !== id) }))

  // Deleting anything can be undone for a few seconds. The snapshot lives only in memory and is dropped when the toast goes.
  const undoable = (label, fn) => {
    snapRef.current = dataRef.current
    fn()
    setUndo({ label, key: uid() })
  }
  const undoLast = () => {
    if (snapRef.current) setData(snapRef.current)
    snapRef.current = null
    setUndo(null)
  }
  const dismissUndo = () => {
    snapRef.current = null
    setUndo(null)
  }
  const logTalked = (personId) => undoable('Logged: you talked today', () => addContact(personId, todayDay(), ''))
  const deletePerson = (id) => undoable('Person deleted', () => rawDeletePerson(id))
  const deleteDate = (id) => undoable('Date deleted', () => rawDeleteDate(id))
  const deleteContact = (personId, contactId) => undoable('Contact deleted', () => rawDeleteContact(personId, contactId))
  const deleteMoment = (personId, momentId) => undoable('Moment deleted', () => rawDeleteMoment(personId, momentId))
  const deleteHangout = (personId, hangoutId) => undoable('Time together deleted', () => rawDeleteHangout(personId, hangoutId))
  const deleteIntimacy = (personId, entryId) => undoable('Removed', () => rawDeleteIntimacy(personId, entryId))
  const deletePromise = (personId, promiseId) => undoable('Removed', () => rawDeletePromise(personId, promiseId))
  const deleteCommitment = (personId, commitmentId) => undoable('Promise removed', () => rawDeleteCommitment(personId, commitmentId))
  const eraseEverything = () => undoable('Everything erased', () => setData({ ...empty, settings: dataRef.current.settings }))

  const patchPerson = (id, fn) =>
    setData((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) }))

  const updateMoment = (personId, momentId, patch) =>
    patchPerson(personId, (p) => ({ moments: momentsOf({ moments: momentsOf(p).map((m) => (m.id === momentId ? { ...m, ...patch } : m)) }) }))
  const updateHangout = (personId, hangoutId, patch) =>
    patchPerson(personId, (p) => ({ hangouts: hangoutsOf({ hangouts: hangoutsOf(p).map((h) => (h.id === hangoutId ? { ...h, ...patch } : h)) }) }))
  const updateIntimacy = (personId, entryId, patch) =>
    patchPerson(personId, (p) => ({ intimacy: intimacyOf({ intimacy: intimacyOf(p).map((x) => (x.id === entryId ? { ...x, ...patch } : x)) }) }))
  const updatePromise = (personId, promiseId, patch) =>
    patchPerson(personId, (p) => ({ promises: promisesOf({ promises: promisesOf(p).map((pr) => (pr.id === promiseId ? { ...pr, ...patch } : pr)) }) }))
  const updateCommitment = (personId, commitmentId, patch) =>
    patchPerson(personId, (p) => ({ commitments: commitmentsOf({ commitments: commitmentsOf(p).map((cm) => (cm.id === commitmentId ? { ...cm, ...patch } : cm)) }) }))

  const addPlan = (personId, plan) => {
    patchPerson(personId, (p) => ({ plans: plansOf({ plans: [...plansOf(p), { id: uid(), ...plan }] }) }))
    notify('Plan saved')
  }
  const deletePlan = (personId, planId) =>
    undoable('Plan removed', () => patchPerson(personId, (p) => ({ plans: plansOf(p).filter((x) => x.id !== planId) })))

  const addRemember = (personId, item) =>
    patchPerson(personId, (p) => ({ remember: rememberOf({ remember: [...rememberOf(p), { id: uid(), ...item }] }) }))
  const toggleRemember = (personId, itemId) =>
    patchPerson(personId, (p) => ({ remember: rememberOf(p).map((r) => (r.id === itemId ? { ...r, done: !r.done } : r)) }))
  const deleteRemember = (personId, itemId) =>
    undoable('Removed', () => patchPerson(personId, (p) => ({ remember: rememberOf(p).filter((r) => r.id !== itemId) })))

  const setSettings = (patch) => setData((d) => ({ ...d, settings: normalizeSettings({ ...d.settings, ...patch, card: { ...d.settings.card, ...(patch.card || {}) }, profile: { ...d.settings.profile, ...(patch.profile || {}) }, home: { ...d.settings.home, ...(patch.home || {}) } }) }))

  const replaceAll = (next) =>
    setData({
      people: Array.isArray(next.people) ? next.people.map(migratePerson) : [],
      dates: Array.isArray(next.dates) ? next.dates.filter((x) => x && typeof x === 'object').map(cleanDate) : [],
      criteria: cleanCriteria(next.criteria),
      feedback: cleanList(next.feedback),
      checkins: cleanList(next.checkins),
      learning: next.learning !== false,
      settings: normalizeSettings(next.settings)
    })

  // One verdict-feedback entry per person: the latest answer replaces the earlier one.
  const addFeedback = (personId, verdict, agreed) =>
    setData((d) => ({
      ...d,
      feedback: [
        { id: uid(), personId, verdict, agreed, at: new Date().toISOString() },
        ...d.feedback.filter((f) => f.personId !== personId)
      ]
    }))

  const addCheckin = (entry) =>
    setData((d) => ({
      ...d,
      checkins: [{ id: uid(), at: new Date().toISOString(), ...entry }, ...d.checkins]
    }))

  const setLearning = (on) => setData((d) => ({ ...d, learning: on }))

  const resetLearning = () =>
    setData((d) => ({ ...d, feedback: [], checkins: [] }))

  const setCriteria = (patch) =>
    setData((d) => ({ ...d, criteria: { ...d.criteria, ...patch } }))

  return {
    data,
    addPerson,
    updatePerson,
    setStatus,
    deletePerson,
    addDate,
    addContact,
    logTalked,
    deleteContact,
    addMoment,
    addHangout,
    updateHangout,
    deleteHangout,
    addIntimacy,
    updateIntimacy,
    deleteIntimacy,
    addPromise,
    updatePromise,
    deletePromise,
    addCommitment,
    updateCommitment,
    deleteCommitment,
    deleteMoment,
    updateMoment,
    addPlan,
    deletePlan,
    addRemember,
    toggleRemember,
    deleteRemember,
    setSettings,
    eraseEverything,
    undo,
    undoLast,
    dismissUndo,
    saveFailed,
    notice,
    clearNotice,
    notify,
    updateDate,
    deleteDate,
    replaceAll,
    setCriteria,
    addFeedback,
    addCheckin,
    setLearning,
    resetLearning
  }
}

export function daysSince(day) {
  const d = toDay(day)
  if (!d) return null
  const [y, m, dd] = d.split('-').map(Number)
  const then = new Date(y, m - 1, dd)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today - then) / 86400000))
}

export function agoLabel(day) {
  const d = daysSince(day)
  if (d === null) return 'never'
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

export function fmtDate(iso) {
  const d = toDay(iso)
  if (!d) return ''
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
