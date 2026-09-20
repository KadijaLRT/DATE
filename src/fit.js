// On-device fit scoring. No network, no AI. Pure functions so they can be tested.

// Each trait maps to the tags that signal it, and keywords that may appear in
// notes or date impressions. "negative" keywords signal the opposite.
export const TRAITS = [
  {
    id: 'communication',
    label: 'Communicates well',
    tags: ['communicator', 'consistent'],
    badTags: ['inconsistent', 'slowreply', 'vague'],
    words: ['texts back', 'good communicator', 'communicates', 'reliable', 'follows through', 'checks in', 'on time'],
    badWords: ['ghost', 'flaked', 'cancelled', 'canceled', 'no reply', 'left on read', 'late', 'bailed', 'unreliable']
  },
  {
    id: 'humor',
    label: 'Makes me laugh',
    tags: ['funny'],
    badTags: [],
    words: ['funny', 'laughed', 'hilarious', 'witty', 'made me laugh', 'great sense of humor'],
    badWords: ['no sense of humor', 'humorless']
  },
  {
    id: 'ambition',
    label: 'Ambitious and driven',
    tags: ['ambitious'],
    badTags: [],
    words: ['ambitious', 'driven', 'goals', 'career', 'business', 'building', 'hardworking', 'works hard'],
    badWords: ['unemployed', 'no plans', 'unmotivated', 'lazy', 'no direction']
  },
  {
    id: 'dogs',
    label: 'Gets along with dogs',
    tags: ['dogs'],
    badTags: [],
    words: ['dog', 'puppy', 'loves dogs', 'dog person'],
    badWords: ['hates dogs', 'afraid of dogs', 'allergic to dogs', 'not a dog person']
  },
  {
    id: 'respect',
    label: 'Respectful and considerate',
    tags: [],
    badTags: ['pushy', 'selfabsorbed'],
    words: ['respectful', 'kind', 'considerate', 'listens', 'asked about me', 'thoughtful', 'polite', 'genuine'],
    badWords: ['rude', 'talked over', 'only talked about himself', 'only talked about herself', 'disrespect', 'condescending', 'controlling', 'entitled']
  },
  {
    id: 'plans',
    label: 'Makes real plans',
    tags: ['consistent'],
    badTags: ['vague'],
    words: ['made plans', 'planned', 'suggested', 'booked', 'reservation', 'second date', 'next date'],
    badWords: ['maybe sometime', 'never makes plans', 'vague']
  },
  {
    id: 'family',
    label: 'Family-oriented / open to kids',
    tags: [],
    badTags: [],
    words: ['family', 'kids', 'wants kids', 'good with kids', 'close with his mom', 'close with her mom'],
    badWords: ['no kids ever', 'doesn\'t want kids', 'does not want kids', 'hates kids']
  },
  {
    id: 'stable',
    label: 'Emotionally stable and mature',
    tags: [],
    badTags: [],
    words: ['mature', 'stable', 'calm', 'emotionally intelligent', 'self aware', 'therapy', 'healthy'],
    badWords: ['drama', 'temper', 'jealous', 'angry', 'unstable', 'toxic', 'mean about his ex', 'mean about her ex']
  }
]

export const PRIORITY = {
  must: { label: 'Must have', weight: 3 },
  nice: { label: 'Nice to have', weight: 1 },
  dealbreaker: { label: 'Deal-breaker', weight: 0 }
}

export const emptyCriteria = {
  // traitId -> 'must' | 'nice' | 'dealbreaker'. A deal-breaker means the OPPOSITE trait is unacceptable.
  wants: {},
  // Deal-breaker red-flag tag ids (e.g. 'pushy'). Any match is an automatic let-go signal.
  dealTags: [],
  // Free-form keywords the user supplies, comma or line separated.
  wantWords: '',
  avoidWords: '',
  note: ''
}

const norm = (s) => (s || '').toLowerCase().replace(/[’']/g, "'")

function splitWords(str) {
  return (str || '')
    .split(/[\n,;]+/)
    .map((w) => norm(w).trim())
    .filter((w) => w.length >= 3)
}

// Whole-phrase match, so "late" does not match "chocolate" or "plate".
function has(text, phrase) {
  const p = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z])${p}(?:[^a-z]|$)`, 'i').test(text)
}

// Negation guard: "not late", "never rude", "isn't controlling" should not count as bad.
function hasUnnegated(text, phrase) {
  const p = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?:^|[^a-z])((?:not|never|no|isn't|wasn't|aren't|weren't|didn't|doesn't|don't|won't|hasn't|haven't|hadn't|cannot|can't|without)\\s+(?:\\w+\\s+){0,2})?${p}(?:[^a-z]|$)`, 'gi')
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

export function hasCriteria(c) {
  return (
    Object.keys(c.wants || {}).length > 0 ||
    (c.dealTags || []).length > 0 ||
    splitWords(c.wantWords).length > 0 ||
    splitWords(c.avoidWords).length > 0
  )
}

/**
 * Returns { verdict, score, confidence, reasons: [{kind, text}], dealbreakers: [] }
 * verdict: 'pursue' | 'watch' | 'letgo' | 'unknown'
 */
export function evaluate(person, dates, criteria, model = null) {
  // model (optional): { weightFor(traitId, stated) -> {weight, statedWeight, shift, reason}, thresholdShift, thresholdReason }
  // When absent, behavior is identical to the original stated-criteria-only scorer.
  const text = evidenceText(person, dates)
  const mine = dates.filter((d) => d.personId === person.id)
  const ratings = mine.filter((d) => d.rating > 0).map((d) => d.rating)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  const reasons = []
  const adjustments = []
  const dealbreakers = []
  let earned = 0
  let possible = 0
  let evidenceHits = 0 // how many criteria we actually had info on

  // 1. Deal-breaker tags picked directly.
  for (const id of criteria.dealTags || []) {
    if ((person.tags || []).includes(id)) {
      dealbreakers.push(id)
    }
  }

  // 2. Traits.
  for (const trait of TRAITS) {
    const pri = criteria.wants?.[trait.id]
    if (!pri) continue

    const goodTag = trait.tags.some((t) => (person.tags || []).includes(t))
    const badTag = trait.badTags.some((t) => (person.tags || []).includes(t))
    const goodWord = trait.words.some((w) => has(text, w))
    const badWord = trait.badWords.some((w) => hasUnnegated(text, w))

    const positive = goodTag || goodWord
    const negative = badTag || badWord
    // A red-flag tag already reported as a deal-breaker should not also be repeated as a trait miss.
    const tagAlreadyReported = trait.badTags.some((t) => dealbreakers.includes(t))
    const known = positive || negative

    if (pri === 'dealbreaker') {
      // The user wants to avoid people who show the BAD side of this trait.
      if (negative && !goodTag) {
        dealbreakers.push(trait.id)
      } else if (negative && goodTag) {
        reasons.push({ kind: 'warn', text: `Mixed signals on "${trait.label.toLowerCase()}", worth watching.` })
      }
      continue
    }

    let weight = PRIORITY[pri].weight
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
    } else if (positive && negative) {
      earned += weight * 0.4
      reasons.push({ kind: 'warn', text: `${trait.label}: mixed evidence, some good and some concerning.` })
    } else if (negative && tagAlreadyReported && !badWord) {
      // Already shown above as a deal-breaker; count it against the score without repeating it.
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

  // 3. Free-form words the user typed.
  const wantW = splitWords(criteria.wantWords)
  const avoidW = splitWords(criteria.avoidWords)
  const gotWant = wantW.filter((w) => has(text, w))
  const gotAvoid = avoidW.filter((w) => hasUnnegated(text, w))

  if (wantW.length) {
    possible += 2
    if (gotWant.length) {
      evidenceHits += 1
      earned += 2 * Math.min(1, gotWant.length / Math.max(1, Math.ceil(wantW.length / 2)))
      reasons.push({ kind: 'good', text: `Matches things you asked for: ${gotWant.slice(0, 4).join(', ')}.` })
    } else {
      earned += 2 * 0.35
    }
  }
  if (gotAvoid.length) {
    evidenceHits += 1
    gotAvoid.forEach((w) => dealbreakers.push('word:' + w))
  }

  // 4. Date experience matters: how it actually felt.
  if (avgRating !== null) {
    possible += 3
    earned += 3 * ((avgRating - 1) / 4)
    // Ratings are counted once via mine.length in confidence below; do not double count here.
    if (avgRating >= 4) reasons.push({ kind: 'good', text: `Your dates with them average ${avgRating.toFixed(1)} of 5.` })
    else if (avgRating <= 2.5) reasons.push({ kind: 'bad', text: `Your dates with them average only ${avgRating.toFixed(1)} of 5.` })
    else reasons.push({ kind: 'warn', text: `Your dates with them average ${avgRating.toFixed(1)} of 5, a middling result.` })
  }

  // 5. Untagged red flags they carry that were not deal-breakers still count against them.
  const redCount = (person.tags || []).filter((t) =>
    ['inconsistent', 'slowreply', 'vague', 'selfabsorbed', 'pushy'].includes(t)
  ).length
  const greenCount = (person.tags || []).filter((t) =>
    ['communicator', 'consistent', 'dogs', 'funny', 'ambitious'].includes(t)
  ).length
  possible += 2
  earned += Math.max(0, Math.min(2, 1 + (greenCount - redCount) * 0.4))

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0

  // Confidence: how much real data backs this up.
  // A single date is one observation, not proof: require several distinct signals.
  const dataPoints = evidenceHits + mine.length
  const confidence = dataPoints >= 5 ? 'high' : dataPoints >= 3 ? 'medium' : 'low'

  // Explain deal-breakers in plain language.
  const dealTexts = dealbreakers.map((d) => {
    if (d.startsWith('word:')) return `Your notes mention "${d.slice(5)}", which you said to avoid.`
    const trait = TRAITS.find((t) => t.id === d)
    if (trait) return `Deal-breaker triggered: ${trait.label.toLowerCase()} is a problem here.`
    const t = { inconsistent: 'Inconsistent', slowreply: 'Slow replies', vague: 'Vague plans', selfabsorbed: 'Self-focused', pushy: 'Pushy' }[d]
    return `Deal-breaker triggered: tagged "${t || d}".`
  })

  const tShift = model?.thresholdShift || 0
  const PURSUE_AT = 70 + tShift
  const WATCH_AT = 45 + tShift
  let verdict
  if (dealbreakers.length > 0) verdict = 'letgo'
  else if (dataPoints === 0) verdict = 'unknown'
  else if (score >= PURSUE_AT) verdict = 'pursue'
  else if (score >= WATCH_AT) verdict = 'watch'
  else verdict = 'letgo'
  if (tShift !== 0 && dealbreakers.length === 0 && dataPoints > 0) {
    adjustments.push({
      traitId: '_threshold',
      label: 'Decision bar',
      from: 70,
      to: PURSUE_AT,
      shift: tShift,
      reason: model.thresholdReason
    })
  }

  // Guardrail: do not tell someone to give up on thin data unless a deal-breaker fired.
  if (verdict === 'letgo' && dealbreakers.length === 0 && confidence === 'low') verdict = 'watch'
  // Guardrail: do not strongly say pursue on almost no data.
  if (verdict === 'pursue' && confidence === 'low') verdict = 'watch'

  return {
    verdict,
    score,
    confidence,
    dealbreakers: dealTexts,
    reasons: [
      ...dealTexts.map((t) => ({ kind: 'bad', text: t })),
      ...reasons.sort((a, b) => order[a.kind] - order[b.kind])
    ],
    avgRating,
    dateCount: mine.length,
    adjustments
  }
}

const order = { bad: 0, warn: 1, good: 2, unknown: 3 }

export const VERDICT = {
  pursue: { label: 'Keep pursuing', tone: 'sage' },
  watch: { label: 'Keep watching', tone: 'amber' },
  letgo: { label: 'Consider letting go', tone: 'rose' },
  unknown: { label: 'Not enough info', tone: 'stone' }
}
