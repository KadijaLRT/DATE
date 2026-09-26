// On-device learning. Pure functions, no network.
//
// Core idea: for every trait, compare the dates where the person showed that
// trait against dates where they did not, and see whether YOU rated them
// higher. That is a revealed preference. Then blend it with what you SAID you
// want, shrinking toward your stated weight until there is enough evidence.
//
// With one user the sample is tiny, so every step is deliberately cautious:
//  - minimum samples before anything changes
//  - shrinkage (small samples get little say)
//  - hard cap on how far a weight can move
//  - every change is reported with its numbers so it can be checked

import { TRAITS, rememberOf } from './fit.js'

export const MIN_PER_GROUP = 2 // need at least this many dates with AND without a trait
export const MAX_SHIFT = 1.5 // a learned weight can move at most this far from stated
export const SHRINK_K = 4 // higher = more cautious; evidence needed to trust a pattern
export const MIN_RATED_TOTAL = 4
export const EXPECT_MUST = 1.5 // stars a genuine must-have should lift your date ratings
export const EXPECT_NICE = 0.75

const norm = (s) => (s || '').toLowerCase().replace(/[’']/g, "'")

function esc(p) {
  return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function has(text, phrase) {
  return new RegExp(`(?:^|[^a-z])${esc(phrase)}(?:[^a-z]|$)`, 'i').test(text)
}
function hasUnnegated(text, phrase) {
  const re = new RegExp(
    `(?:^|[^a-z])((?:not|never|no|isn't|wasn't|aren't|weren't|didn't|doesn't|don't|won't|hasn't|haven't|hadn't|cannot|can't|without)\\s+(?:\\w+\\s+){0,2})?${esc(phrase)}(?:[^a-z]|$)`,
    'gi'
  )
  let m
  while ((m = re.exec(text)) !== null) if (!m[1]) return true
  return false
}

// Everything known about a person that is NOT the rating being predicted.
function personText(person) {
  return norm([...(person.notes || []), ...rememberOf(person).map((r) => r.text), person.met, person.job].filter(Boolean).join(' . '))
}
function dateText(d) {
  return norm([d.activity, ...(d.impressions || [])].filter(Boolean).join(' . '))
}

// +1 shows the trait, -1 shows the opposite, 0 unknown
export function traitSignal(trait, person, dateRec) {
  const text = personText(person) + ' . ' + (dateRec ? dateText(dateRec) : '')
  const goodTag = trait.tags.some((t) => (person.tags || []).includes(t))
  const badTag = trait.badTags.some((t) => (person.tags || []).includes(t))
  const goodWord = trait.words.some((w) => has(text, w))
  const badWord = trait.badWords.some((w) => hasUnnegated(text, w))
  const pos = goodTag || goodWord
  const neg = badTag || badWord
  if (pos && !neg) return 1
  if (neg && !pos) return -1
  return 0
}

function mean(a) {
  return a.reduce((s, x) => s + x, 0) / a.length
}

/**
 * Compute revealed preferences from rated dates.
 * Returns per-trait stats. Never throws on empty data.
 */
export function learnTraits(people, dates) {
  const byId = Object.fromEntries(people.map((p) => [p.id, p]))
  const rated = dates.filter((d) => d.rating > 0 && byId[d.personId])
  const out = {}

  for (const trait of TRAITS) {
    const withT = []
    const withoutT = [] // opposite shown; unknown is excluded so silence is not treated as absence
    for (const d of rated) {
      const sig = traitSignal(trait, byId[d.personId], d)
      if (sig === 1) withT.push(d.rating)
      else if (sig === -1) withoutT.push(d.rating)
    }
    const n1 = withT.length
    const n0 = withoutT.length
    let effect = null
    let reliable = false
    if (n1 >= 1 && n0 >= 1) {
      effect = mean(withT) - mean(withoutT) // in stars; positive = you rate these dates higher
      reliable = n1 >= MIN_PER_GROUP && n0 >= MIN_PER_GROUP
    }
    // Unpaired evidence: no contrast group. Compare against your overall average instead, but flag as weaker.
    let vsAvg = null
    if (n1 >= 1 && rated.length >= MIN_RATED_TOTAL) {
      vsAvg = mean(withT) - mean(rated.map((d) => d.rating))
    }
    out[trait.id] = { n1, n0, effect, vsAvg, reliable, label: trait.label }
  }
  return { traits: out, ratedCount: rated.length }
}

/**
 * Turn stated priority + learned effect into an adjusted weight.
 * stated: 'must' | 'nice' | undefined (deal-breakers are never touched here).
 * Returns { weight, statedWeight, shift, reason } where weight is in the same units as fit.js (must=3, nice=1).
 */
export function adjustedWeight(traitId, stated, learned, feedbackBias = 0) {
  const base = stated === 'must' ? 3 : stated === 'nice' ? 1 : 0
  const s = learned?.traits?.[traitId]
  let shift = 0
  let reason = ''

  if (s && s.reliable && s.effect !== null) {
    const n = Math.min(s.n1, s.n0)
    const trust = n / (n + SHRINK_K) // 0..1, grows slowly with evidence
    // Calling something a must-have or nice-to-have CLAIMS it should lift your ratings.
    // So the shift is measured against that expectation, not against zero:
    //   must  expects about +1.5 stars, nice expects about +0.75 stars.
    // A trait that lifts ratings by more than expected gains weight; one that lifts them by less loses weight.
    // 1 star of surprise ~ 1 weight point at full trust.
    const expected = stated === 'must' ? EXPECT_MUST : stated === 'nice' ? EXPECT_NICE : 0
    const surprise = s.effect - expected
    shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, surprise * trust))
    reason = `Your dates with this trait averaged ${s.effect >= 0 ? '+' : ''}${s.effect.toFixed(1)} stars versus without (${s.n1} with, ${s.n0} without); a ${stated === 'must' ? 'must have' : 'nice to have'} would be expected to lift ratings by about ${expected.toFixed(1)}.`
  }
  // Explicit "the verdict felt wrong" feedback nudges slightly, capped.
  if (feedbackBias) shift += Math.max(-0.5, Math.min(0.5, feedbackBias))

  shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shift))
  const weight = Math.max(0, base + shift)
  return { weight, statedWeight: base, shift, reason }
}

/**
 * Gaps between what you said and what your dates show. Only reported when reliable.
 * kinds: 'unstated_positive' (you did not ask for it but it lifts your ratings),
 *        'overrated_want'    (you called it a must, but it makes no difference or hurts),
 *        'confirmed'         (stated and revealed agree)
 */
export function findGaps(criteria, learned) {
  const gaps = []
  for (const trait of TRAITS) {
    const s = learned.traits[trait.id]
    if (!s || !s.reliable || s.effect === null) continue
    const stated = criteria.wants?.[trait.id]
    if (stated === 'dealbreaker') continue
    const strong = Math.abs(s.effect) >= 0.8
    if (!stated && s.effect >= 0.8) {
      gaps.push({
        kind: 'unstated_positive',
        traitId: trait.id,
        text: `You did not list "${trait.label.toLowerCase()}", but dates with it average ${s.effect.toFixed(1)} stars higher for you.`,
        stats: s
      })
    } else if (stated === 'must' && s.effect <= 0.2 && strong === false) {
      gaps.push({
        kind: 'overrated_want',
        traitId: trait.id,
        text: `You call "${trait.label.toLowerCase()}" a must have, but it barely changes how you rate dates (${s.effect >= 0 ? '+' : ''}${s.effect.toFixed(1)} stars).`,
        stats: s
      })
    } else if (stated === 'must' && s.effect <= -0.8) {
      gaps.push({
        kind: 'overrated_want',
        traitId: trait.id,
        text: `You call "${trait.label.toLowerCase()}" a must have, yet dates with it average ${Math.abs(s.effect).toFixed(1)} stars lower for you.`,
        stats: s
      })
    } else if ((stated === 'must' || stated === 'nice') && s.effect >= 0.8) {
      gaps.push({
        kind: 'confirmed',
        traitId: trait.id,
        text: `Confirmed: "${trait.label.toLowerCase()}" really does lift your ratings (+${s.effect.toFixed(1)} stars).`,
        stats: s
      })
    }
  }
  return gaps
}

/**
 * Feedback tally. feedback items: { personId, verdict, agreed: true|false, at }
 * Returns overall accuracy and a per-verdict breakdown so the user can see how trustworthy the tool has been.
 */
export function feedbackStats(feedback) {
  const list = (feedback || []).filter((f) => typeof f.agreed === 'boolean')
  const total = list.length
  const agreed = list.filter((f) => f.agreed).length
  const byVerdict = {}
  for (const f of list) {
    const b = (byVerdict[f.verdict] ||= { total: 0, agreed: 0 })
    b.total += 1
    if (f.agreed) b.agreed += 1
  }
  return {
    total,
    agreed,
    accuracy: total ? agreed / total : null,
    byVerdict
  }
}

/**
 * When the user disagrees with a verdict, learn direction. If the tool said "letgo" and the user disagreed,
 * the tool is too harsh, so relax slightly. If it said "pursue" and the user disagreed, it is too generous.
 * Returns a threshold offset in score points, capped and only after enough feedback.
 */
export const MIN_FEEDBACK = 4
export const MAX_THRESHOLD_SHIFT = 8

export function thresholdShift(feedback) {
  const list = (feedback || []).filter((f) => typeof f.agreed === 'boolean')
  if (list.length < MIN_FEEDBACK) return { shift: 0, reason: '' }
  let harsh = 0
  let generous = 0
  for (const f of list) {
    if (f.agreed) continue
    if (f.verdict === 'letgo') harsh += 1
    else if (f.verdict === 'pursue') generous += 1
  }
  const net = generous - harsh // positive = tool too generous => raise the bar
  const n = list.length
  const raw = (net / n) * 20
  const shift = Math.max(-MAX_THRESHOLD_SHIFT, Math.min(MAX_THRESHOLD_SHIFT, Math.round(raw)))
  if (shift === 0) return { shift: 0, reason: '' }
  return {
    shift,
    reason:
      shift > 0
        ? `You disagreed with several "keep pursuing" calls, so the bar for that call was raised by ${shift} points.`
        : `You disagreed with several "let go" calls, so the bar for that call was lowered by ${Math.abs(shift)} points.`
  }
}

/**
 * Check-in answers: { personId, dateId, valued: [traitId...], missing: [traitId...], at }
 * "valued" counts as a positive vote for the trait, "missing" as a negative vote when absent.
 * Returns a small bias per trait, capped, so a chatty user cannot swing everything.
 */
export function checkinBias(checkins) {
  const bias = {}
  const counts = {}
  for (const c of checkins || []) {
    for (const t of c.valued || []) counts[t] = (counts[t] || 0) + 1
    for (const t of c.missing || []) counts[t] = (counts[t] || 0) + 1
  }
  for (const c of checkins || []) {
    for (const t of c.valued || []) bias[t] = (bias[t] || 0) + 1
    for (const t of c.missing || []) bias[t] = (bias[t] || 0) - 1
  }
  const out = {}
  for (const t of Object.keys(bias)) {
    const n = counts[t]
    if (n < 2) continue // one mention is not a pattern
    const trust = n / (n + SHRINK_K)
    const sign = bias[t] > 0 ? 1 : bias[t] < 0 ? -1 : 0
    out[t] = sign * Math.min(0.5, 0.5 * trust)
  }
  return out
}

/** Master call: everything the scorer and the UI need. */
export function buildModel(data) {
  const learned = learnTraits(data.people, data.dates)
  const gaps = findGaps(data.criteria, learned)
  const fb = feedbackStats(data.feedback)
  const thr = thresholdShift(data.feedback)
  const bias = checkinBias(data.checkins)
  return { learned, gaps, feedback: fb, threshold: thr, checkinBias: bias }
}
