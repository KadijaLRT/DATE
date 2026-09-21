// On-device fit scoring. No network, no AI. Pure functions so they can be tested.

// Each trait maps to the tags that signal it, and keywords that may appear in
// notes or date impressions. "negative" keywords signal the opposite.
export const TRAITS = [
  {
    id: 'communication',
    label: 'Communicates well',
    avoidLabel: 'Flaky or hard to reach',
    tags: ['communicator', 'consistent'],
    badTags: ['inconsistent', 'slowreply', 'vague'],
    words: ['texts back', 'good communicator', 'communicates', 'reliable', 'follows through', 'checks in', 'on time'],
    badWords: ['ghost', 'ghosts', 'ghosted', 'ghosting', 'flaky', 'flake', 'flakes', 'flaked', 'flaking', 'cancelled', 'canceled', 'cancels', 'cancelling', 'canceling', 'no reply', 'left on read', 'late', 'bailed', 'bails', 'unreliable', 'inconsistent', 'disappear', 'disappeared', 'disappears', 'disappearing', 'cancel', 'bail', 'no show', 'no-show', 'stood me up', 'slow to reply', 'bad texter', 'hot and cold']
  },
  {
    id: 'humor',
    label: 'Makes me laugh',
    avoidLabel: 'No sense of humor',
    tags: ['funny'],
    badTags: [],
    words: ['funny', 'laughed', 'hilarious', 'witty', 'made me laugh', 'great sense of humor'],
    badWords: ['no sense of humor', 'humorless', 'boring']
  },
  {
    id: 'ambition',
    label: 'Ambitious and driven',
    avoidLabel: 'Unmotivated or aimless',
    tags: ['ambitious'],
    badTags: [],
    words: ['ambitious', 'driven', 'goals', 'career', 'business', 'building', 'hardworking', 'works hard'],
    badWords: ['unemployed', 'no plans', 'unmotivated', 'lazy', 'no direction', 'no goals', 'aimless']
  },
  {
    id: 'dogs',
    label: 'Gets along with dogs',
    avoidLabel: 'Dislikes dogs',
    tags: ['dogs'],
    badTags: [],
    words: ['dog', 'puppy', 'loves dogs', 'dog person'],
    badWords: ['hates dogs', 'afraid of dogs', 'allergic to dogs', 'not a dog person']
  },
  {
    id: 'respect',
    label: 'Respectful and considerate',
    avoidLabel: 'Rude, controlling, or self-centered',
    tags: [],
    badTags: ['pushy', 'selfabsorbed'],
    words: ['respectful', 'kind', 'considerate', 'listens', 'asked about me', 'thoughtful', 'polite', 'genuine'],
    badWords: ['rude', 'talked over', 'only talked about himself', 'only talked about herself', 'disrespect', 'disrespectful', 'condescending', 'controlling', 'entitled', 'arrogant', 'selfish', 'self-absorbed', 'self-centered', 'manipulative', 'egotistical', 'narcissist', 'narcissistic', 'possessive', 'pushy']
  },
  {
    id: 'plans',
    label: 'Makes real plans',
    avoidLabel: 'Vague, never makes real plans',
    tags: ['consistent'],
    badTags: ['vague'],
    words: ['made plans', 'planned', 'suggested', 'booked', 'reservation', 'second date', 'next date'],
    badWords: ['maybe sometime', 'never makes plans', 'vague', 'noncommittal', 'non-committal', 'indecisive']
  },
  {
    id: 'family',
    label: 'Family-oriented / open to kids',
    avoidLabel: 'Against kids or family',
    tags: [],
    badTags: [],
    words: ['family', 'kids', 'wants kids', 'good with kids', 'close with his mom', 'close with her mom'],
    badWords: ['no kids ever', 'doesn\'t want kids', 'does not want kids', 'hates kids']
  },
  {
    id: 'stable',
    label: 'Emotionally stable and mature',
    avoidLabel: 'Dramatic or emotionally unstable',
    tags: [],
    badTags: [],
    words: ['mature', 'stable', 'calm', 'emotionally intelligent', 'self aware', 'therapy', 'healthy'],
    badWords: ['drama', 'dramatic', 'temper', 'jealous', 'angry', 'unstable', 'toxic', 'clingy', 'needy', 'moody', 'insecure', 'emotional baggage', 'mean about his ex', 'mean about her ex']
  }
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
const TAG_LABEL = Object.fromEntries(TAGS.map((t) => [t.id, t.label]))

/**
 * Moments: things you record on a profile that are not a date or a contact, each with a day, a kind, some text,
 * and optionally how it made you feel. They show on the timeline and feed Fit like everything else on a profile.
 */
export const MOMENT_TYPES = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'plan', label: 'Plan' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'feeling', label: 'How I felt' }
]
export const FEELINGS = [
  { id: 'great', label: 'Great', value: 1 },
  { id: 'good', label: 'Good', value: 0.5 },
  { id: 'okay', label: 'Okay', value: 0 },
  { id: 'uneasy', label: 'Uneasy', value: -0.5 },
  { id: 'rough', label: 'Rough', value: -1 }
]
export const MAX_MOMENTS = 200
export const MAX_MOMENT_TEXT = 600
const MOMENT_TYPE_IDS = new Set(MOMENT_TYPES.map((t) => t.id))
const FEELING_VALUE = Object.fromEntries(FEELINGS.map((f) => [f.id, f.value]))
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const validDay = (d) => typeof d === 'string' && DAY_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'))

export function momentsOf(person) {
  const raw = Array.isArray(person?.moments) ? person.moments : []
  const out = []
  const seen = new Set()
  raw.forEach((m, i) => {
    if (!m || typeof m !== 'object' || !validDay(m.date)) return
    const text = typeof m.text === 'string' ? m.text.trim().slice(0, MAX_MOMENT_TEXT) : ''
    const feeling = typeof m.feeling === 'string' && m.feeling in FEELING_VALUE ? m.feeling : null
    if (!text && !feeling) return
    let id = typeof m.id === 'string' && m.id ? m.id : `m-${i}`
    while (seen.has(id)) id += '_'
    seen.add(id)
    out.push({ id, date: m.date, type: MOMENT_TYPE_IDS.has(m.type) ? m.type : 'conversation', text, feeling })
  })
  return out.slice(0, MAX_MOMENTS)
}

/**
 * Plans (upcoming dates) and "remember for next time" items, both stored on the person.
 */
export const REMEMBER_KINDS = [
  { id: 'preference', label: 'Likes' },
  { id: 'place', label: 'Place to try' },
  { id: 'interest', label: 'Interest' },
  { id: 'topic', label: 'Topic to discuss' },
  { id: 'idea', label: 'Date idea' },
  { id: 'note', label: 'Note' }
]
export const MAX_PLANS = 50
export const MAX_REMEMBER = 100
export const MAX_PLAN_TEXT = 80
export const MAX_REMEMBER_TEXT = 200
const REMEMBER_IDS = new Set(REMEMBER_KINDS.map((k) => k.id))

export function plansOf(person) {
  const raw = Array.isArray(person?.plans) ? person.plans : []
  const out = []
  const seen = new Set()
  raw.forEach((p, i) => {
    if (!p || typeof p !== 'object' || !validDay(p.date)) return
    const title = typeof p.title === 'string' ? p.title.trim().slice(0, MAX_PLAN_TEXT) : ''
    const place = typeof p.place === 'string' ? p.place.trim().slice(0, MAX_PLAN_TEXT) : ''
    let id = typeof p.id === 'string' && p.id ? p.id : `p-${i}`
    while (seen.has(id)) id += '_'
    seen.add(id)
    out.push({ id, date: p.date, title, place, remind: p.remind !== false })
  })
  return out.slice(0, MAX_PLANS)
}

export function rememberOf(person) {
  const raw = Array.isArray(person?.remember) ? person.remember : []
  const out = []
  const seen = new Set()
  raw.forEach((r, i) => {
    if (!r || typeof r !== 'object') return
    const text = typeof r.text === 'string' ? r.text.trim().slice(0, MAX_REMEMBER_TEXT) : ''
    if (!text) return
    let id = typeof r.id === 'string' && r.id ? r.id : `r-${i}`
    while (seen.has(id)) id += '_'
    seen.add(id)
    const promptId = typeof r.promptId === 'string' && r.promptId ? r.promptId.slice(0, 40) : ''
    out.push({ id, kind: REMEMBER_IDS.has(r.kind) ? r.kind : 'idea', text, done: r.done === true, ...(promptId ? { promptId } : {}) })
  })
  return out.slice(0, MAX_REMEMBER)
}

/**
 * Post-date reflection, stored on the date. Quick answers plus optional writing.
 */
export const REFLECTION_QUESTIONS = [
  { id: 'comfortable', label: 'I felt comfortable being myself', short: 'Comfortable' },
  { id: 'heard', label: 'I felt heard and understood', short: 'Heard' },
  { id: 'enjoyed', label: 'I enjoyed our time together', short: 'Enjoyed' },
  { id: 'respected', label: 'I felt respected', short: 'Respected' }
]
export const REFLECTION_ANSWERS = [
  { id: 'yes', label: 'Yes', value: 1 },
  { id: 'somewhat', label: 'Somewhat', value: 0 },
  { id: 'no', label: 'No', value: -1 }
]
export const AGAIN_ANSWERS = [
  { id: 'yes', label: 'Yes', value: 1 },
  { id: 'unsure', label: 'Not sure', value: 0 },
  { id: 'no', label: 'No', value: -1 }
]
export const MAX_REFLECTION_NOTE = 300
export const MAX_REFLECTION_JOURNAL = 2000
const ANSWER_VALUE = { yes: 1, somewhat: 0, no: -1, unsure: 0 }

export function reflectionOf(date) {
  const r = date?.reflection
  if (!r || typeof r !== 'object') return null
  const out = {}
  for (const q of REFLECTION_QUESTIONS) if (r[q.id] === 'yes' || r[q.id] === 'somewhat' || r[q.id] === 'no') out[q.id] = r[q.id]
  if (r.again === 'yes' || r.again === 'unsure' || r.again === 'no') out.again = r.again
  const understand = typeof r.understand === 'string' ? r.understand.trim().slice(0, MAX_REFLECTION_NOTE) : ''
  const journal = typeof r.journal === 'string' ? r.journal.trim().slice(0, MAX_REFLECTION_JOURNAL) : ''
  if (understand) out.understand = understand
  if (journal) out.journal = journal
  return Object.keys(out).length ? out : null
}

// Average of the answered questions on a -1..1 scale, or null when only text was written.
export function reflectionScore(r) {
  if (!r) return null
  const vals = [...REFLECTION_QUESTIONS.map((q) => r[q.id]), r.again].filter(Boolean).map((a) => ANSWER_VALUE[a])
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

/**
 * Flags the user typed themselves: [{ id, label, kind: 'green' | 'red' }].
 * Accepts anything (old saves, hand-edited backups) and returns only valid, de-duplicated entries.
 */
export const MAX_CUSTOM_FLAGS = 20
export const MAX_FLAG_LENGTH = 40
export function customFlagsOf(person) {
  const raw = Array.isArray(person?.customFlags) ? person.customFlags : []
  const seen = new Set()
  const out = []
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue
    const label = typeof f.label === 'string' ? f.label.trim().replace(/\s+/g, ' ').slice(0, MAX_FLAG_LENGTH) : ''
    if (!label || (f.kind !== 'green' && f.kind !== 'red')) continue
    const key = f.kind + ':' + label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: typeof f.id === 'string' && f.id ? f.id : key, label, kind: f.kind })
  }
  return out.slice(0, MAX_CUSTOM_FLAGS)
}

// Two independent sides. A quality can be wanted AND its opposite refused at the same time
// ("I need someone who communicates well. I hate flaky people.").
export const WANT_LEVELS = {
  must: { label: 'Must have', weight: 3 },
  nice: { label: 'Nice to have', weight: 1 }
}
export const AVOID_LEVELS = {
  redline: { label: 'Red line', hint: 'Forces "Consider letting go"' },
  rathernot: { label: 'Would rather not', hint: 'Lowers the score and is flagged, never forces' }
}
// A "would rather not" hit costs this many score points, up to a cap, and can never force "let go" on its own.
export const SOFT_PENALTY = 12
export const SOFT_CAP = 30

export const emptyCriteria = {
  // traitId -> 'must' | 'nice'
  wants: {},
  // traitId -> 'redline' | 'rathernot'. Applies to the OPPOSITE of the quality (its avoidLabel).
  avoids: {},
  // Red-flag tag ids (e.g. 'pushy'). Any match is an automatic red line.
  dealTags: [],
  // Free-form keywords, comma or line separated.
  wantWords: '',
  avoidWords: '', // red line words
  softAvoidWords: '', // would-rather-not words
  // Age range and places you are open to. Outside them counts as a don't-want at the chosen strength.
  ageMin: null,
  ageMax: null,
  ageLevel: 'rathernot',
  places: '', // comma separated, matched against a person's location
  placesLevel: 'rathernot',
  note: ''
}

/**
 * Accepts anything (old saves, hand-edited backups) and returns criteria that are safe to score.
 * Old saves stored a "dealbreaker" level inside wants; that becomes a red line on the avoid side.
 */
export function normalizeCriteria(c) {
  if (!c || typeof c !== 'object') return { ...emptyCriteria, wants: {}, avoids: {}, dealTags: [] }
  const ids = new Set(TRAITS.map((t) => t.id))
  const wants = {}
  const avoids = {}
  const rawW = c.wants && typeof c.wants === 'object' ? c.wants : {}
  for (const [id, v] of Object.entries(rawW)) {
    if (!ids.has(id)) continue
    if (v === 'must' || v === 'nice') wants[id] = v
    else if (v === 'dealbreaker') avoids[id] = 'redline' // legacy
  }
  const rawA = c.avoids && typeof c.avoids === 'object' ? c.avoids : {}
  for (const [id, v] of Object.entries(rawA)) {
    if (ids.has(id) && (v === 'redline' || v === 'rathernot')) avoids[id] = v
  }
  const str = (x) => (typeof x === 'string' ? x : '')
  const age = (x) => {
    const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN
    return Number.isInteger(n) && n >= 18 && n <= 120 ? n : null
  }
  let ageMin = age(c.ageMin)
  let ageMax = age(c.ageMax)
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin]
  const lvl = (x) => (x === 'redline' || x === 'rathernot' ? x : 'rathernot')
  return {
    ageMin,
    ageMax,
    ageLevel: lvl(c.ageLevel),
    places: str(c.places),
    placesLevel: lvl(c.placesLevel),
    wants,
    avoids,
    dealTags: Array.isArray(c.dealTags) ? c.dealTags.filter((x) => typeof x === 'string') : [],
    wantWords: str(c.wantWords),
    avoidWords: str(c.avoidWords),
    softAvoidWords: str(c.softAvoidWords),
    note: str(c.note)
  }
}

const norm = (s) => (typeof s === 'string' ? s : s == null ? '' : String(s)).toLowerCase().replace(/[’']/g, "'")

export function splitWords(str) {
  return (str || '')
    .split(/[\n,;]+/)
    .map((w) => norm(w).trim())
    .filter((w) => w.length >= 3)
}

const esc = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Whole-phrase match, so "late" does not match "chocolate" or "plate".
function has(text, phrase) {
  return new RegExp(`(?:^|[^a-z])${esc(phrase)}(?:[^a-z]|$)`, 'i').test(text)
}

// Negation guard: "not late", "never rude", "isn't controlling" should not count as bad.
function hasUnnegated(text, phrase) {
  const re = new RegExp(`(?:^|[^a-z])((?:not|never|no|isn't|wasn't|aren't|weren't|didn't|doesn't|don't|won't|hasn't|haven't|hadn't|cannot|can't|without)\\s+(?:\\w+\\s+){0,2})?${esc(phrase)}(?:[^a-z]|$)`, 'gi')
  let m
  while ((m = re.exec(text)) !== null) {
    if (!m[1]) return true
  }
  return false
}

function evidenceText(person, dates) {
  const mine = dates.filter((d) => d.personId === person.id)
  const parts = [...(person.notes || []), person.met, person.job, ...realContacts(person).map((c) => c.note), ...momentsOf(person).map((m) => m.text), ...plansOf(person).flatMap((x) => [x.title, x.place]), ...rememberOf(person).map((x) => x.text)]
  mine.forEach((d) => {
    parts.push(d.activity)
    const rf = reflectionOf(d)
    if (rf) parts.push(rf.understand, rf.journal)
    ;(d.impressions || []).forEach((i) => parts.push(i))
  })
  return norm(parts.filter(Boolean).join(' . '))
}

// The same evidence, kept as separate pieces so a flag can say WHICH note it came from.
function evidenceSegments(person, dates) {
  const segs = []
  const push = (where, raw) => {
    const text = norm(raw)
    if (text.trim()) segs.push({ where, raw: String(raw).trim(), text })
  }
  ;(person.notes || []).forEach((n) => push('a note', n))
  push('how you met', person.met)
  push('their job', person.job)
  push('their location', person.location)
  realContacts(person).filter((c) => !isSystemContact(c)).forEach((c) => push('a contact note', c.note))
  momentsOf(person).forEach((m) => push('a moment', m.text))
  plansOf(person).forEach((x) => { push('a plan', x.title); push('a plan', x.place) })
  rememberOf(person).forEach((x) => push(x.kind === 'note' ? 'a note' : 'a remembered detail', x.text))
  dates
    .filter((d) => d.personId === person.id)
    .forEach((d) => {
      push('a date', d.activity)
      const rf = reflectionOf(d)
      if (rf) { push('a reflection', rf.understand); push('a reflection', rf.journal) }
      ;(d.impressions || []).forEach((i) => push('a date impression', i))
    })
  ;(person.tags || []).forEach((t) => push('a tag', TAG_LABEL[t] || t))
  customFlagsOf(person).forEach((f) => push('a flag', f.label))
  return segs
}

function findSegment(segs, phrase, unnegated) {
  for (const s of segs) {
    if (unnegated ? hasUnnegated(s.text, phrase) : has(s.text, phrase)) return s
  }
  return null
}

export const splitPlaces = (str) =>
  (str || '').split(/[\n,;]+/).map((w) => norm(w).trim()).filter((w) => w.length >= 2)

export function parseAge(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseInt(v, 10) : NaN
  return Number.isInteger(n) && n >= 18 && n <= 120 ? n : null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayMs = (d) => (DAY.test(d) ? Date.parse(d + 'T00:00:00Z') : NaN)
const localToday = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
// Entries the app writes itself say nothing about the person.
const isSystemContact = (c) => /^(matched|imported from)/i.test((c.note || '').trim())
function realContacts(person) {
  return (Array.isArray(person?.contacts) ? person.contacts : []).filter((c) => c && typeof c === 'object' && DAY.test(c.date || ''))
}

const clip = (t, n = 60) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t)
const where = (seg) =>
  seg.where === 'a tag' ? `the tag "${seg.raw}"` : seg.where === 'a flag' ? `your flag "${seg.raw}"` : `${seg.where}: "${clip(seg.raw)}"`

/**
 * Which people a keyword would match right now. Used to preview a want or a don't-want BEFORE it is saved,
 * so a red line is never added blind. kind 'avoid' ignores negated uses ("doesn't smoke"), exactly like scoring does.
 */
export function wordHits(people, dates, word, kind = 'want') {
  const w = norm(word).trim()
  if (w.length < 3) return []
  return (people || [])
    .filter((p) => findSegment(evidenceSegments(p, dates || []), w, kind === 'avoid'))
    .map((p) => p.name || 'Unnamed')
}

export function hasCriteria(raw) {
  const c = normalizeCriteria(raw)
  return (
    Object.keys(c.wants).length > 0 ||
    Object.keys(c.avoids).length > 0 ||
    c.dealTags.length > 0 ||
    splitWords(c.wantWords).length > 0 ||
    splitWords(c.avoidWords).length > 0 ||
    splitWords(c.softAvoidWords).length > 0 ||
    c.ageMin !== null ||
    c.ageMax !== null ||
    splitPlaces(c.places).length > 0
  )
}

// Everything we can tell about one quality for one person.
function readTrait(trait, person, text) {
  const goodTag = trait.tags.some((t) => (person.tags || []).includes(t))
  const badTag = trait.badTags.some((t) => (person.tags || []).includes(t))
  const goodWord = trait.words.some((w) => has(text, w))
  const badWord = trait.badWords.some((w) => hasUnnegated(text, w))
  return { goodTag, badTag, goodWord, badWord, positive: goodTag || goodWord, negative: badTag || badWord }
}

/**
 * Returns { verdict, score, confidence, reasons, dealbreakers, flags, penalty, ... }
 * verdict: 'pursue' | 'watch' | 'letgo' | 'unknown'
 * flags: [{ side: 'want'|'avoid', level, label, detail }] one entry per want or don't-want that showed up for this person.
 */
export function evaluate(person, dates, rawCriteria, model = null, opts = {}) {
  // model (optional): { weightFor(traitId, stated) -> {weight, statedWeight, shift, reason}, thresholdShift, thresholdReason }
  // When absent, behavior is identical to the stated-criteria-only scorer.
  const criteria = normalizeCriteria(rawCriteria)
  const text = evidenceText(person, dates)
  const segs = evidenceSegments(person, dates)
  const mine = dates.filter((d) => d.personId === person.id)
  const ratings = mine.filter((d) => d.rating > 0).map((d) => d.rating)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  const reasons = []
  const adjustments = []
  const flags = []
  const reds = [] // { key, text }  red lines that fired
  const softs = [] // { text }      would-rather-not hits
  let earned = 0
  let possible = 0
  let evidenceHits = 0 // how many criteria we actually had info on

  const tagName = (id) => TAG_LABEL[id] || id

  // 1. Red-flag tags picked as automatic red lines.
  for (const id of criteria.dealTags) {
    if ((person.tags || []).includes(id)) {
      reds.push({ key: 'tag:' + id, text: `Red line triggered: tagged "${tagName(id)}".` })
      flags.push({ side: 'avoid', level: 'redline', label: tagName(id), detail: 'you tagged them this' })
    }
  }
  const tagReported = (trait) => trait.badTags.some((t) => reds.some((r) => r.key === 'tag:' + t))

  // 2. What you want, quality by quality.
  for (const trait of TRAITS) {
    const pri = criteria.wants[trait.id]
    if (!pri) continue
    const { goodTag, badTag, badWord, positive, negative } = readTrait(trait, person, text)
    const known = positive || negative
    // If you also refuse the opposite of this quality, that side reports it; do not repeat it here.
    const refusedElsewhere = Boolean(criteria.avoids[trait.id])

    let weight = WANT_LEVELS[pri].weight
    if (model?.weightFor) {
      const adj = model.weightFor(trait.id, pri)
      if (adj && Math.abs(adj.shift) >= 0.05) {
        weight = adj.weight
        adjustments.push({
          traitId: trait.id,
          label: trait.label,
          from: adj.statedWeight,
          to: Number(adj.weight.toFixed(2)),
          shift: Number(adj.shift.toFixed(2)),
          reason: adj.reason
        })
      }
    }
    possible += weight
    if (known) evidenceHits += 1

    if (positive && !negative) {
      earned += weight
      reasons.push({ kind: 'good', text: `${trait.label}: shows up in your notes${goodTag ? ' and tags' : ''}.` })
      flags.push({ side: 'want', level: pri, label: trait.label, detail: goodTag ? 'from their tags' : 'from their notes' })
    } else if (positive && negative) {
      earned += weight * 0.4
      reasons.push({ kind: 'warn', text: `${trait.label}: mixed evidence, some good and some concerning.` })
    } else if (negative && !refusedElsewhere && tagReported(trait) && !badWord) {
      // Already shown above as a red line; count it against the score without repeating it.
    } else if (negative && refusedElsewhere) {
      // The don't-want side below explains this one.
    } else if (negative) {
      const basis = badTag && badWord ? 'your tags and notes' : badTag ? 'a red-flag tag you added' : 'your notes'
      reasons.push({
        kind: pri === 'must' ? 'bad' : 'warn',
        text: `${trait.label}: ${basis} point the other way.`
      })
    } else {
      // Unknown. Give partial credit so missing data does not read as failure.
      earned += weight * 0.35
      reasons.push({ kind: 'unknown', text: `${trait.label}: nothing recorded yet.` })
    }
  }

  // 3. What you do not want, quality by quality (the OPPOSITE of the quality).
  for (const trait of TRAITS) {
    const lvl = criteria.avoids[trait.id]
    if (!lvl) continue
    const { goodTag, badTag, negative } = readTrait(trait, person, text)
    if (!negative) continue
    if (goodTag) {
      reasons.push({ kind: 'warn', text: `Mixed signals on "${trait.label.toLowerCase()}", worth watching.` })
      continue
    }
    const hitWord = trait.badWords.find((w) => hasUnnegated(text, w))
    const seg = hitWord ? findSegment(segs, hitWord, true) : null
    const detail = seg ? where(seg) : badTag ? 'a red-flag tag you added' : 'your notes'
    if (lvl === 'redline') {
      reds.push({ key: 'trait:' + trait.id, text: `Red line triggered: ${trait.avoidLabel.toLowerCase()} (${detail}).` })
      flags.push({ side: 'avoid', level: 'redline', label: trait.avoidLabel, detail })
    } else {
      softs.push({ text: `Would rather not: ${trait.avoidLabel.toLowerCase()} (${detail}).` })
      flags.push({ side: 'avoid', level: 'rathernot', label: trait.avoidLabel, detail })
    }
  }

  // 3b. Age and place. Missing data is never held against someone: no age or location means no check.
  const hitLimit = (key, level, label, detail) => {
    if (level === 'redline') {
      reds.push({ key, text: `Red line triggered: ${label.toLowerCase()} (${detail}).` })
      flags.push({ side: 'avoid', level: 'redline', label, detail })
    } else {
      softs.push({ text: `Would rather not: ${label.toLowerCase()} (${detail}).` })
      flags.push({ side: 'avoid', level: 'rathernot', label, detail })
    }
  }
  const theirAge = parseAge(person.age)
  if (theirAge !== null && (criteria.ageMin !== null || criteria.ageMax !== null)) {
    const range = criteria.ageMin !== null && criteria.ageMax !== null ? `${criteria.ageMin} to ${criteria.ageMax}` : criteria.ageMin !== null ? `${criteria.ageMin} or older` : `${criteria.ageMax} or younger`
    if ((criteria.ageMin !== null && theirAge < criteria.ageMin) || (criteria.ageMax !== null && theirAge > criteria.ageMax)) {
      hitLimit('age', criteria.ageLevel, 'Age outside your range', `they are ${theirAge}, you said ${range}`)
    }
  }
  const okPlaces = splitPlaces(criteria.places)
  const theirPlace = norm(person.location).trim()
  if (okPlaces.length && theirPlace && !okPlaces.some((pl) => has(theirPlace, pl))) {
    hitLimit('place', criteria.placesLevel, 'Outside your places', `they are in "${clip(String(person.location).trim(), 30)}", you said ${okPlaces.join(', ')}`)
  }

  // 4. Free-form words you typed.
  const wantW = splitWords(criteria.wantWords)
  const redW = splitWords(criteria.avoidWords)
  const softW = splitWords(criteria.softAvoidWords)
  const gotWant = wantW.filter((w) => findSegment(segs, w, false))

  if (wantW.length) {
    possible += 2
    if (gotWant.length) {
      evidenceHits += 1
      earned += 2 * Math.min(1, gotWant.length / Math.max(1, Math.ceil(wantW.length / 2)))
      reasons.push({ kind: 'good', dup: true, text: `Matches things you asked for: ${gotWant.slice(0, 4).join(', ')}.` })
      gotWant.forEach((w) => flags.push({ side: 'want', level: 'word', label: w, detail: where(findSegment(segs, w, false)) }))
    } else {
      earned += 2 * 0.35
    }
  }
  const seen = new Set()
  redW.forEach((w) => {
    const seg = findSegment(segs, w, true)
    if (!seg || seen.has(w)) return
    seen.add(w)
    reds.push({ key: 'word:' + w, text: `Red line: "${w}" appears in ${where(seg)}. You said to avoid this.` })
    flags.push({ side: 'avoid', level: 'redline', label: w, detail: where(seg) })
  })
  softW.forEach((w) => {
    const seg = findSegment(segs, w, true)
    if (!seg || seen.has(w)) return // a word that is also a red line is reported once, as the stronger one
    seen.add(w)
    softs.push({ text: `Would rather not: "${w}" appears in ${where(seg)}.` })
    flags.push({ side: 'avoid', level: 'rathernot', label: w, detail: where(seg) })
  })
  if (reds.some((r) => r.key.startsWith('word:')) || softs.length) evidenceHits += 1

  // 5. Date experience matters: how it actually felt.
  if (avgRating !== null) {
    possible += 3
    earned += 3 * ((avgRating - 1) / 4)
    // Ratings are counted once via mine.length in confidence below; do not double count here.
    if (avgRating >= 4) reasons.push({ kind: 'good', text: `Your dates with them average ${avgRating.toFixed(1)} of 5.` })
    else if (avgRating <= 2.5) reasons.push({ kind: 'bad', text: `Your dates with them average only ${avgRating.toFixed(1)} of 5.` })
    else reasons.push({ kind: 'warn', text: `Your dates with them average ${avgRating.toFixed(1)} of 5, a middling result.` })
  }

  // Direct point adjustments from follow-ups (+/-6), contact history (+/-4), how you felt (+/-4), and reflections (+/-4): together at most 10 points either way.
  let profileAdjust = 0

  // 5b. Where the last date left off: the most recent follow-up you recorded (weight 2).
  const followed = mine.filter((d) => d.followUp && d.followUp !== 'none' && FOLLOW_SCORE[d.followUp] !== undefined).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  if (followed.length) {
    const f = followed[0]
    const pts = Math.round((FOLLOW_SCORE[f.followUp] - 0.5) * 12) // planned +6, not continuing -6
    profileAdjust += pts
    evidenceHits += 1
    reasons.push({ kind: pts > 0 ? 'good' : pts < 0 ? 'bad' : 'unknown', text: `Your last logged follow-up: ${FOLLOW_TEXT[f.followUp]}${pts ? ` (${pts > 0 ? '+' : ''}${pts} points)` : ''}.` })
  }

  // 5c. How much you are actually in touch (weight 1). Only counts real contact you logged, in either direction,
  // so it reflects the connection, not just them. No logged contact means no opinion.
  const today = opts.today && DAY.test(opts.today) ? opts.today : localToday()
  const touch = realContacts(person).filter((c) => !isSystemContact(c))
  if (touch.length) {
    const ago = (c) => Math.round((dayMs(today) - dayMs(c.date)) / 86400000)
    const gaps = touch.map(ago).filter((n) => n >= 0)
    if (gaps.length) {
      const last = Math.min(...gaps)
      const month = gaps.filter((n) => n <= 30).length
      const recency = last <= 3 ? 1 : last <= 7 ? 0.8 : last <= 14 ? 0.5 : last <= 30 ? 0.25 : 0
      const freq = month >= 8 ? 1 : month >= 4 ? 0.7 : month >= 2 ? 0.4 : month === 1 ? 0.2 : 0
      const engagement = (recency + freq) / 2
      const pts = Math.round((engagement - 0.5) * 8) // very active +4, gone quiet -4
      profileAdjust += pts
      reasons.push({
        kind: pts > 0 ? 'good' : pts < 0 ? 'warn' : 'unknown',
        text: `Contact: last logged ${last === 0 ? 'today' : last === 1 ? 'yesterday' : last + ' days ago'}, ${month} in the past 30 days${pts ? ` (${pts > 0 ? '+' : ''}${pts} points)` : ''}.`
      })
    }
  }

  // 5d. How you have felt around them: your most recent five moments that carry a feeling (up to 4 points either way).
  const felt = momentsOf(person).filter((m) => m.feeling).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  if (felt.length) {
    const avg = felt.reduce((sum, m) => sum + FEELING_VALUE[m.feeling], 0) / felt.length
    const pts = Math.round(avg * 4)
    profileAdjust += pts
    evidenceHits += 1
    const mood = avg >= 0.6 ? 'great' : avg >= 0.25 ? 'good' : avg > -0.25 ? 'mixed' : avg > -0.6 ? 'uneasy' : 'rough'
    reasons.push({
      kind: pts > 0 ? 'good' : pts < 0 ? 'warn' : 'unknown',
      text: `How you have felt around them: mostly ${mood} across ${felt.length} moment${felt.length === 1 ? '' : 's'}${pts ? ` (${pts > 0 ? '+' : ''}${pts} points)` : ''}.`
    })
  }

  // 5e. Your own reflections after dates: the most recent three that have quick answers (up to 4 points either way).
  const reflected = mine
    .map((d) => ({ date: String(d.date || ''), score: reflectionScore(reflectionOf(d)) }))
    .filter((x) => x.score !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
  if (reflected.length) {
    const avg = reflected.reduce((sum, x) => sum + x.score, 0) / reflected.length
    const pts = Math.round(avg * 4)
    profileAdjust += pts
    evidenceHits += 1
    const mood = avg >= 0.5 ? 'positive' : avg >= 0.15 ? 'leaning positive' : avg > -0.15 ? 'mixed' : avg > -0.5 ? 'leaning negative' : 'negative'
    reasons.push({
      kind: pts > 0 ? 'good' : pts < 0 ? 'warn' : 'unknown',
      text: `After your reflections on ${reflected.length} date${reflected.length === 1 ? '' : 's'}: ${mood}${pts ? ` (${pts > 0 ? '+' : ''}${pts} points)` : ''}.`
    })
  }

  // 6. Red-flag tags they carry that were not red lines still count against them.
  const redCount = (person.tags || []).filter((t) =>
    ['inconsistent', 'slowreply', 'vague', 'selfabsorbed', 'pushy'].includes(t)
  ).length
  const greenCount = (person.tags || []).filter((t) =>
    ['communicator', 'consistent', 'dogs', 'funny', 'ambitious'].includes(t)
  ).length
  // Flags you typed yourself count exactly like the built-in ones: red lowers, green raises.
  const custom = customFlagsOf(person)
  const customGreen = custom.filter((f) => f.kind === 'green').length
  const customRed = custom.filter((f) => f.kind === 'red').length
  if (custom.length) {
    reasons.push({
      kind: customRed > customGreen ? 'warn' : customGreen > customRed ? 'good' : 'unknown',
      text: `Flags you added: ${customGreen} green, ${customRed} red (${custom.map((f) => f.label).slice(0, 3).join(', ')}${custom.length > 3 ? ', …' : ''}).`
    })
  }
  possible += 2
  earned += Math.max(0, Math.min(2, 1 + (greenCount + customGreen - redCount - customRed) * 0.4))

  const baseScore = Math.max(0, Math.min(100, (possible > 0 ? Math.round((earned / possible) * 100) : 0) + Math.max(-10, Math.min(10, profileAdjust))))
  // "Would rather not" lowers the score by a fixed, visible amount. It is capped so a pile of small dislikes
  // cannot behave like a red line.
  const penalty = Math.min(SOFT_CAP, SOFT_PENALTY * softs.length)
  const score = Math.max(0, baseScore - penalty)
  softs.forEach((x) => reasons.push({ kind: 'warn', dup: true, text: `${x.text} Score -${SOFT_PENALTY}.` }))
  if (softs.length * SOFT_PENALTY > SOFT_CAP) {
    reasons.push({ kind: 'warn', text: `Several "would rather not" hits. The reduction stops at -${SOFT_CAP}.` })
  }

  // Confidence: how much real data backs this up.
  // A single date is one observation, not proof: require several distinct signals.
  const dataPoints = evidenceHits + mine.length
  const confidence = dataPoints >= 5 ? 'high' : dataPoints >= 3 ? 'medium' : 'low'

  const dealTexts = reds.map((r) => r.text)

  const tShift = model?.thresholdShift || 0
  const PURSUE_AT = 70 + tShift
  const WATCH_AT = 45 + tShift
  let verdict
  if (reds.length > 0) verdict = 'letgo'
  else if (dataPoints === 0) verdict = 'unknown'
  else if (score >= PURSUE_AT) verdict = 'pursue'
  else if (score >= WATCH_AT) verdict = 'watch'
  else verdict = 'letgo'
  if (tShift !== 0 && reds.length === 0 && dataPoints > 0) {
    adjustments.push({
      traitId: '_threshold',
      label: 'Decision bar',
      from: 70,
      to: PURSUE_AT,
      shift: tShift,
      reason: model.thresholdReason
    })
  }

  // Guardrail: do not tell someone to give up on thin data unless a red line fired.
  if (verdict === 'letgo' && reds.length === 0 && confidence === 'low') verdict = 'watch'
  // Guardrail: do not strongly say pursue on almost no data.
  if (verdict === 'pursue' && confidence === 'low') verdict = 'watch'
  // Guardrail: "would rather not" lowers the score but never forces "let go" by itself.
  if (verdict === 'letgo' && reds.length === 0 && softs.length > 0 && baseScore >= WATCH_AT) verdict = 'watch'

  // The four parts of the explanation: what fits, how much we know, what has not been explored, and how it has felt.
  const unknowns = []
  for (const trait of TRAITS) {
    if (!criteria.wants[trait.id] && !criteria.avoids[trait.id]) continue
    const sig = readTrait(trait, person, text)
    if (!sig.positive && !sig.negative) unknowns.push(`${trait.label}: nothing recorded yet.`)
  }
  if ((criteria.ageMin !== null || criteria.ageMax !== null) && parseAge(person.age) === null) unknowns.push('Age: not on their profile yet.')
  if (splitPlaces(criteria.places).length && !norm(person.location).trim()) unknowns.push('Location: not on their profile yet.')
  if (wantW.length && !gotWant.length) unknowns.push('Good signs you look for: none noted yet.')

  const allReasons = [
    ...dealTexts.map((t) => ({ kind: 'bad', dup: true, text: t })),
    ...reasons.sort((a, b) => order[a.kind] - order[b.kind])
  ].map((r) => ({ ...r, section: sectionOf(r) }))

  const evidence = {
    confidence,
    dates: mine.length,
    reflections: mine.filter((d) => reflectionOf(d)).length,
    notes: (person.notes || []).length + rememberOf(person).filter((x) => x.kind === 'note').length,
    contacts: touch.length,
    moments: momentsOf(person).length,
    plans: plansOf(person).length,
    flags: (person.tags || []).length + custom.length,
    remembered: rememberOf(person).filter((x) => x.kind !== 'note').length
  }

  return {
    verdict,
    score,
    baseScore,
    penalty,
    confidence,
    dealbreakers: dealTexts,
    flags: flags.sort((a, b) => flagRank(a) - flagRank(b)),
    reasons: allReasons,
    unknowns,
    evidence,
    avgRating,
    dateCount: mine.length,
    adjustments
  }
}

const order = { bad: 0, warn: 1, good: 2, unknown: 3 }
// Which of the four explanation sections a reason belongs to.
export function sectionOf(r) {
  if (r.kind === 'unknown' && /nothing recorded yet/.test(r.text)) return 'unknowns'
  if (/^(Your last logged follow-up|Contact:|How you have felt|After your reflections|Your dates with them average)/.test(r.text)) return 'experience'
  return 'compatibility'
}
// How positive each follow-up is, and how it reads in a reason.
const FOLLOW_SCORE = { planned: 1, me: 0.6, them: 0.5, done: 0 }
const FOLLOW_TEXT = { planned: 'a next date is planned', me: 'you still want to text them', them: 'you are waiting on them', done: 'you marked it as not continuing' }
const flagRank = (f) => (f.side === 'avoid' ? (f.level === 'redline' ? 0 : 1) : 2)

export const VERDICT = {
  pursue: { label: 'Keep pursuing', tone: 'sage' },
  watch: { label: 'Keep watching', tone: 'amber' },
  letgo: { label: 'Consider letting go', tone: 'rose' },
  unknown: { label: 'Not enough info', tone: 'stone' }
}
