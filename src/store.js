import { useEffect, useState } from 'react'
import { emptyCriteria } from './fit.js'

const KEY = 'roster.v1'

export const STATUSES = [
  { id: 'texting', label: 'Texting', color: 'var(--amber)' },
  { id: 'planning', label: 'Planning date', color: 'var(--rose)' },
  { id: 'dating', label: 'Dating', color: 'var(--sage)' },
  { id: 'hold', label: 'On hold', color: 'var(--stone)' }
]

export const TAGS = [
  { id: 'communicator', label: 'Great communicator', kind: 'green' },
  { id: 'consistent', label: 'Consistent', kind: 'green' },
  { id: 'dogs', label: 'Dog lover', kind: 'green' },
  { id: 'funny', label: 'Funny', kind: 'green' },
  { id: 'ambitious', label: 'Ambitious', kind: 'green' },
  { id: 'inconsistent', label: 'Inconsistent', kind: 'red' },
  { id: 'slowreply', label: 'Slow replies', kind: 'red' },
  { id: 'vague', label: 'Vague plans', kind: 'red' },
  { id: 'selfabsorbed', label: 'Self-focused', kind: 'red' },
  { id: 'pushy', label: 'Pushy', kind: 'red' }
]

const empty = { people: [], dates: [], criteria: emptyCriteria, feedback: [], checkins: [], learning: true }

function cleanList(x) {
  return Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []
}

export function cleanCriteria(c) {
  const base = emptyCriteria
  if (!c || typeof c !== 'object') return base
  return {
    wants: c.wants && typeof c.wants === 'object' ? c.wants : {},
    dealTags: Array.isArray(c.dealTags) ? c.dealTags : [],
    wantWords: typeof c.wantWords === 'string' ? c.wantWords : '',
    avoidWords: typeof c.avoidWords === 'string' ? c.avoidWords : '',
    note: typeof c.note === 'string' ? c.note : ''
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      dates: Array.isArray(parsed.dates) ? parsed.dates : [],
      criteria: cleanCriteria(parsed.criteria),
      feedback: cleanList(parsed.feedback),
      checkins: cleanList(parsed.checkins),
      learning: parsed.learning !== false
    }
  } catch {
    return empty
  }
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export function useStore() {
  const [data, setData] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage full or blocked; state still works for the session */
    }
  }, [data])

  const addPerson = (p) => {
    const person = {
      id: uid(),
      name: '',
      age: '',
      job: '',
      met: '',
      location: '',
      status: 'texting',
      tags: [],
      notes: [],
      lastContact: new Date().toISOString(),
      archived: false,
      created: new Date().toISOString(),
      ...p
    }
    setData((d) => ({ ...d, people: [person, ...d.people] }))
    return person.id
  }

  const updatePerson = (id, patch) =>
    setData((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p))
    }))

  const deletePerson = (id) =>
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
      dates: [{ id, created: new Date().toISOString(), ...x }, ...d.dates],
      people: d.people.map((p) =>
        p.id === x.personId ? { ...p, lastContact: new Date().toISOString() } : p
      )
    }))
    return id
  }

  const updateDate = (id, patch) =>
    setData((d) => ({
      ...d,
      dates: d.dates.map((x) => (x.id === id ? { ...x, ...patch } : x))
    }))

  const deleteDate = (id) =>
    setData((d) => ({ ...d, dates: d.dates.filter((x) => x.id !== id) }))

  const replaceAll = (next) =>
    setData({
      people: Array.isArray(next.people) ? next.people : [],
      dates: Array.isArray(next.dates) ? next.dates : [],
      criteria: cleanCriteria(next.criteria),
      feedback: cleanList(next.feedback),
      checkins: cleanList(next.checkins),
      learning: next.learning !== false
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
    deletePerson,
    addDate,
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

export function daysSince(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

export function agoLabel(iso) {
  const d = daysSince(iso)
  if (d === null) return 'never'
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

export function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
