// Reads the user's free-form description and proposes structured criteria.
// It only PROPOSES. Nothing is applied until the user approves it.
// Pure rule-based, on-device. It understands a fixed vocabulary, not arbitrary meaning.

import { TRAITS } from './fit.js'

const norm = (s) => (s || '').toLowerCase().replace(/[’]/g, "'")

// Words that signal how important the user says something is.
const MUST_CUES = ['must', 'need', 'needs', 'have to', 'has to', 'non-negotiable', 'essential', 'required', 'always', 'really important', 'important that', 'have got to']
const NICE_CUES = ['would be nice', 'nice if', 'nice to have', 'bonus', 'prefer', 'ideally', 'hope', 'would like', 'a plus', 'love it if', 'would love']
const AVOID_CUES = [
  "don't want", 'do not want', "doesn't want", "won't date", "wouldn't date", 'no one who', 'nobody who', 'not someone who',
  "can't stand", 'cannot stand', 'hate', 'avoid', 'deal breaker', 'dealbreaker', 'deal-breaker', 'never date', 'turn off', 'turnoff', 'not into', 'red flag', "can't date", 'cannot date', 'refuse'
]

// Extra phrases people commonly use to describe each trait in a description.
// These are ONLY used to read the description; matching against person notes still uses fit.js vocabulary.
const DESCRIBE = {
  communication: ['communicat', 'texts back', 'text back', 'replies', 'responsive', 'reliable', 'follows through', 'consistent', 'checks in', 'keeps in touch', 'stays in touch'],
  humor: ['funny', 'humor', 'humour', 'laugh', 'witty', 'sense of humor', 'playful'],
  ambition: ['ambitio', 'driven', 'goals', 'career', 'motivated', 'hardworking', 'hard-working', 'works hard', 'entrepreneur', 'business'],
  dogs: ['dog', 'puppy', 'pets', 'animal lover'],
  respect: ['respect', 'kind', 'considerate', 'thoughtful', 'listens', 'polite', 'genuine', 'treats me well', 'treats people well', 'humble'],
  plans: ['makes plans', 'plans dates', 'plans ahead', 'takes initiative', 'initiative', 'follows up on plans', 'plan things'],
  family: ['family', 'kids', 'children', 'wants a family', 'good with kids', 'close with'],
  stable: ['mature', 'stable', 'emotionally', 'calm', 'secure', 'drama', 'therapy', 'self-aware', 'self aware', 'healthy', 'grounded', 'jealous', 'temper']
}

// Words people use for the bad side of each trait. Used only to read the description.
const BAD_SIDE = {
  communication: ['flaky', 'flake', 'ghost', 'unreliable', 'inconsistent', 'bad texter', 'slow to reply', 'no reply', 'hot and cold', 'disappear'],
  humor: ['boring', 'humorless', 'no sense of humor', 'dry'],
  ambition: ['lazy', 'unmotivated', 'no direction', 'no goals', 'unemployed', 'aimless'],
  dogs: ['hates dogs', 'afraid of dogs'],
  respect: ['rude', 'disrespect', 'condescending', 'controlling', 'entitled', 'arrogant', 'selfish', 'self-absorbed', 'pushy', 'mean', 'manipulative', 'egotistical'],
  plans: ['vague', 'noncommittal', 'non-committal', 'never makes plans', 'indecisive'],
  family: ['hates kids', 'no kids ever'],
  stable: ['drama', 'jealous', 'toxic', 'unstable', 'temper', 'angry', 'moody', 'insecure', 'clingy']
}

// Phrases that flip a trait to its OPPOSITE when the user wants to AVOID it.
// e.g. "I hate flaky people" -> avoid the bad side of communication. Detected via the trait's own badWords too.
const ALL_TRAIT_WORDS = [...Object.values(DESCRIBE).flat(), ...Object.values(BAD_SIDE).flat()]
function coveredByTrait(k) {
  return ALL_TRAIT_WORDS.some((w) => k.includes(w) || w.includes(k))
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w))
}

function splitClauses(text) {
  return norm(text)
    .split(/[.!?\n;]+|\bbut\b|\bhowever\b/)
    .flatMap((c) => c.split(/,\s*(?:and\s+)?(?=(?:i|someone|a person|he|she|they|no|not)\b)/))
    .map((c) => c.trim())
    .filter((c) => c.length > 2)
}

function priorityOf(clause) {
  if (containsAny(clause, AVOID_CUES)) return 'avoid'
  if (containsAny(clause, MUST_CUES)) return 'must'
  if (containsAny(clause, NICE_CUES)) return 'nice'
  return 'nice' // stating a wish with no emphasis reads as a nice-to-have, never silently a must
}

// A trait is "negated" when the clause says the person should NOT have it: "not funny", "doesn't work hard".
const NEG_BEFORE = /(?:^|[^a-z])(?:not|no|never|isn't|aren't|doesn't|don't|without|lacks?|lacking)\s+(?:\w+\s+){0,2}$/

function isNegatedAt(clause, idx) {
  return NEG_BEFORE.test(clause.slice(0, idx))
}

function firstMatch(clause, stems) {
  let best = -1
  for (const s of stems) {
    const i = clause.indexOf(s)
    if (i !== -1 && (best === -1 || i < best)) best = i
  }
  return best
}

// Words we should never offer as keywords.
const STOP = new Set([
  'someone', 'somebody', 'person', 'people', 'who', 'that', 'this', 'with', 'and', 'the', 'for', 'are', 'is', 'was', 'want',
  'looking', 'like', 'love', 'really', 'very', 'just', 'also', 'have', 'has', 'had', 'they', 'them', 'their', 'from', 'about',
  'loves', 'love', 'likes', 'enjoys', 'enjoy', 'loving', 'wants', 'wanting', 'would', 'could', 'should', 'need', 'needs', 'much', 'more', 'most', 'some', 'any', 'all', 'can', 'will', 'you', 'your', 'not',
  'but', 'too', 'lot', 'ideally', 'prefer', 'must', 'nice', 'good', 'great', 'best', 'well', 'able', 'make', 'makes', 'made',
  'who', 'whom', 'when', 'where', 'what', 'why', 'how', 'than', 'then', 'there', 'these', 'those', 'being', 'been', 'does', 'doesn',
  'don', 'didn', 'isn', 'wasn', 'won', 'never', 'always', 'ever', 'even', 'still', 'only', 'other', 'into', 'over', 'under', 'out'
])

// Turn a clause into keyword candidates: the things a person is "into", "loves", or "who <does something>".
// Approach: find the text after a cue, cut it at the first clause-ending word, then split the list into items.
const CUES = /(?:\binto\b|\bloves?\b|\benjoys?\b|\blikes?\b|\bpassionate about\b|\bobsessed with\b|\bwho (?:is|are|has|have)\b|\bwho\b|\bthat (?:is|are|has|have)\b)\s+/g
const CUT = /\b(?:who|that|because|since|so|which|when|while|with their|with his|with her|but)\b/

function splitList(chunk) {
  return chunk
    .split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/)
    .map((x) => x.trim().replace(/^(?:a|an|the|to|be|being|really|very|so)\s+/, ''))
    .filter(Boolean)
}

function keywordCandidates(clause) {
  const found = new Set()
  let m
  CUES.lastIndex = 0
  while ((m = CUES.exec(clause)) !== null) {
    let rest = clause.slice(m.index + m[0].length)
    const cut = rest.search(CUT)
    if (cut > 0) rest = rest.slice(0, cut)
    for (const item of splitList(rest)) {
      const words = item.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
      if (words.length === 0) continue
      found.add(words.slice(0, 2).join(' '))
    }
  }
  // Fallback: a couple of distinctive single words, only when no cue matched.
  if (found.size === 0) {
    clause
      .split(/[^a-z']+/)
      .filter((w) => w.length > 4 && !STOP.has(w))
      .slice(0, 3)
      .forEach((w) => found.add(w))
  }
  return [...found].filter((k) => k.length > 2 && k.length <= 28 && looksLikeWords(k))
}

// Rejects keyboard mash like "asdf" or "qwerty" and words with no vowels.
function looksLikeWords(k) {
  const bad = ['asdf', 'qwer', 'zxcv', 'hjkl', 'sdfg', 'wasd']
  if (bad.some((b) => k.includes(b))) return false
  return k.split(/\s+/).every((w) => /[aeiouy]/.test(w))
}

// A clause only earns keyword extraction if it reads like a statement about a person, not noise.
const INTENT = /\b(want|need|looking|prefer|love|like|enjoy|into|hate|avoid|someone|person|partner|who|ideally|hope|can't|cannot|don't|do not|no one|nobody|never|must)\b/

/**
 * Returns suggestions the user can accept, edit, or reject.
 * {
 *   traits:   [{ id, label, priority: 'must'|'nice'|'dealbreaker', evidence }],
 *   wantWords:[{ text, evidence }],
 *   avoidWords:[{ text, evidence }],
 *   conflicts:[{ text }],        // description says one thing, checklist says another
 *   unread:   [string]           // clauses it could not understand, shown so nothing is silently dropped
 * }
 */
export function parseDescription(text, criteria = {}) {
  const out = { traits: [], wantWords: [], avoidWords: [], conflicts: [], unread: [] }
  if (!text || !text.trim()) return out

  const seenTrait = new Map() // traitId -> suggestion (keep the strongest reading)
  const rank = { nice: 1, must: 2, dealbreaker: 3 }

  for (const clause of splitClauses(text)) {
    const pri = priorityOf(clause)
    let matchedTrait = false

    for (const trait of TRAITS) {
      const stems = DESCRIBE[trait.id] || []
      const goodIdx = firstMatch(clause, stems)
      const badWords = [...trait.badWords.map((w) => w.toLowerCase()), ...(BAD_SIDE[trait.id] || [])]
      const badIdx = firstMatch(clause, badWords)
      const talksAboutBadSide = badIdx !== -1 && !isNegatedAt(clause, badIdx)
      const idx = goodIdx !== -1 ? goodIdx : talksAboutBadSide ? badIdx : -1
      if (idx === -1) continue
      matchedTrait = true

      const negated = goodIdx !== -1 ? isNegatedAt(clause, goodIdx) : false

      let level
      if (pri === 'avoid') {
        // "I hate flaky people": avoid the bad side => deal-breaker. "I don't want someone funny" is unusual; treat as unread.
        level = talksAboutBadSide || !negated ? (talksAboutBadSide ? 'dealbreaker' : null) : null
      } else if (negated) {
        // "someone who is NOT ambitious" => the user does not want this trait. Do not turn it into a want.
        level = null
      } else {
        level = pri
      }

      if (level === null) {
        out.unread.push(negated ? `${clause} (I skip statements about traits you do NOT want, so I did not turn this into a criterion)` : clause)
        continue
      }

      const prev = seenTrait.get(trait.id)
      if (prev && prev.priority !== level) {
        // Said two different things about the same quality. Record it instead of silently picking one.
        const kinds = new Set([prev.priority, level])
        if (kinds.has('dealbreaker') && (kinds.has('must') || kinds.has('nice'))) {
          // Want the good side AND refuse the bad side: these agree. Keep the WANT as the priority,
          // because a deal-breaker on the bad side is already implied by a must-have of the good side.
          const want = prev.priority === 'dealbreaker' ? { ...seenTrait.get(trait.id), priority: level, evidence: clause } : prev
          seenTrait.set(trait.id, { ...want, alsoAvoids: true })
          continue
        }
      }
      if (!prev || rank[level] > rank[prev.priority]) {
        seenTrait.set(trait.id, { id: trait.id, label: trait.label, priority: level, evidence: clause })
      }
    }

    // Keywords come from every clause, but a candidate that is really just a trait word is dropped so it is not double-counted.
    const kws = INTENT.test(clause) ? keywordCandidates(clause).filter((k) => !coveredByTrait(k)) : []
    if (!matchedTrait && kws.length === 0) {
      out.unread.push(clause)
    }
    if (pri === 'avoid') kws.forEach((k) => out.avoidWords.push({ text: k, evidence: clause }))
    else kws.forEach((k) => out.wantWords.push({ text: k, evidence: clause }))
  }

  out.traits = [...seenTrait.values()]

  // De-duplicate keywords and drop ones already in the user's criteria.
  const have = (s) => (s || '').split(/[\n,;]+/).map((w) => w.trim().toLowerCase()).filter(Boolean)
  const haveWant = new Set(have(criteria.wantWords))
  const haveAvoid = new Set(have(criteria.avoidWords))
  const dedupe = (arr, existing) => {
    const seen = new Set(existing)
    return arr.filter((k) => {
      const key = k.text.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  out.wantWords = dedupe(out.wantWords, haveWant)
  out.avoidWords = dedupe(out.avoidWords, haveAvoid)

  // Conflicts with the existing checklist.
  for (const s of out.traits) {
    const cur = criteria.wants?.[s.id]
    if (cur && cur !== s.priority) {
      const nice = { must: 'a must have', nice: 'a nice to have', dealbreaker: 'a deal-breaker' }
      out.conflicts.push({
        traitId: s.id,
        text: `Your description reads like "${s.label.toLowerCase()}" is ${nice[s.priority]}, but your checklist has it as ${nice[cur]}.`
      })
    }
  }

  // Trait suggestions that already match the checklist add nothing.
  out.traits = out.traits.filter((s) => criteria.wants?.[s.id] !== s.priority)
  // A suggestion that would OVERWRITE a different level the user already chose must not be pre-selected.
  out.traits = out.traits.map((s) => ({ ...s, overwrites: criteria.wants?.[s.id] || null }))

  return out
}

export function hasSuggestions(s) {
  return s.traits.length + s.wantWords.length + s.avoidWords.length + s.conflicts.length > 0
}
