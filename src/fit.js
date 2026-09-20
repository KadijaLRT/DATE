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
  return {
    wants,
    avoids,
    dealTags: Array.isArray(c.dealTags) ? c.dealTags.filter((x) => typeof x === 'string') : [],
    wantWords: str(c.wantWords),
    avoidWords: str(c.avoidWords),
    softAvoidWords: str(c.softAvoidWords),
    note: str(c.note)
  }
}

const norm = (s) => (s || '').toLowerCase().replace(/[’']/g, "'")

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
  const parts = [...(person.notes || []), person.met, person.job]
  mine.forEach((d) => {
    parts.push(d.activity)
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
  dates
    .filter((d) => d.personId === person.id)
    .forEach((d) => {
      push('a date', d.activity)
      ;(d.impressions || []).forEach((i) => push('a date impression', i))
    })
  ;(person.tags || []).forEach((t) => push('a tag', TAG_LABEL[t] || t))
  return segs
}

function findSegment(segs, phrase, unnegated) {
  for (const s of segs) {
    if (unnegated ? hasUnnegated(s.text, phrase) : has(s.text, phrase)) return s
  }
  return null
}

const clip = (t, n = 60) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t)
const where = (seg) => (seg.where === 'a tag' ? `the tag "${seg.raw}"` : `${seg.where}: "${clip(seg.raw)}"`)

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
    splitWords(c.softAvoidWords).length > 0
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
export function evaluate(person, dates, rawCriteria, model = null) {
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

  // 6. Red-flag tags they carry that were not red lines still count against them.
  const redCount = (person.tags || []).filter((t) =>
    ['inconsistent', 'slowreply', 'vague', 'selfabsorbed', 'pushy'].includes(t)
  ).length
  const greenCount = (person.tags || []).filter((t) =>
    ['communicator', 'consistent', 'dogs', 'funny', 'ambitious'].includes(t)
  ).length
  possible += 2
  earned += Math.max(0, Math.min(2, 1 + (greenCount - redCount) * 0.4))

  const baseScore = possible > 0 ? Math.round((earned / possible) * 100) : 0
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

  return {
    verdict,
    score,
    baseScore,
    penalty,
    confidence,
    dealbreakers: dealTexts,
    flags: flags.sort((a, b) => flagRank(a) - flagRank(b)),
    reasons: [
      ...dealTexts.map((t) => ({ kind: 'bad', dup: true, text: t })),
      ...reasons.sort((a, b) => order[a.kind] - order[b.kind])
    ],
    avgRating,
    dateCount: mine.length,
    adjustments
  }
}

const order = { bad: 0, warn: 1, good: 2, unknown: 3 }
const flagRank = (f) => (f.side === 'avoid' ? (f.level === 'redline' ? 0 : 1) : 2)

export const VERDICT = {
  pursue: { label: 'Keep pursuing', tone: 'sage' },
  watch: { label: 'Keep watching', tone: 'amber' },
  letgo: { label: 'Consider letting go', tone: 'rose' },
  unknown: { label: 'Not enough info', tone: 'stone' }
}
