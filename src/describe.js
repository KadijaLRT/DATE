// Reads the user's free-form description and proposes structured criteria.
// It only PROPOSES. Nothing is applied until the user approves it.
// Rule-based and on-device: it understands a fixed vocabulary, not arbitrary meaning.
//
// Every clause is first sorted into a SIDE:
//   want  -> a quality or keyword you are looking for   (levels: must / nice)
//   avoid -> something you do NOT want                  (levels: redline / rathernot)
// Emphasis decides the level, and the softer level is always the default:
//   "I need someone who communicates well"  -> must        "someone funny"          -> nice
//   "I hate flaky people"                   -> red line    "I don't want a smoker"  -> would rather not

import { TRAITS } from './fit.js'

const norm = (s) => (s || '').toLowerCase().replace(/[’]/g, "'")
const esc = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const anyOf = (list) => new RegExp(`(?:^|[^a-z])(?:${list.map(esc).join('|')})(?:[^a-z]|$)`)

// Says how much it matters. Deliberately does NOT include "always", which describes a habit, not importance.
const EMPHASIS = ['must', 'need', 'needs', 'have to', 'has to', 'have got to', 'got to', 'non-negotiable', 'essential', 'required', 'really important', 'important that', 'absolutely', 'definitely', 'strictly']
const NICE_CUES = ['would be nice', 'nice if', 'nice to have', 'bonus', 'prefer', 'ideally', 'hope', 'would like', 'a plus', 'love it if', 'would love']

// Things that clearly mark something as NOT wanted, strongest first.
const RED_CUES = [
  'deal breaker', 'dealbreaker', 'deal-breaker', "can't stand", 'cannot stand', "can't date", 'cannot date', "won't date", "wouldn't date",
  'never date', 'would never', 'absolutely not', 'absolutely no', 'definitely not', 'definitely no', 'strictly no', 'zero tolerance',
  'under no circumstances', 'no way', 'refuse', 'hate', "can't deal with", 'cannot deal with', "won't tolerate", 'will not tolerate',
  "can't be with", 'cannot be with', 'not okay with', 'not ok with'
]
const SOFT_CUES = [
  'prefer not', 'rather not', 'would rather not', 'not a fan', 'not into', 'turn off', 'turnoff', 'turn-off', 'not ideal', 'ideally not', 'ideally no',
  'not too', "don't love", 'do not love', "don't really", 'do not really', 'not crazy about', 'not big on', "wouldn't love", "wouldn't like",
  'not thrilled', 'less of', 'not keen'
]
const PLAIN_AVOID = [
  "don't want", 'do not want', 'not looking for', 'avoid', 'not interested in', 'no one who', 'nobody who', 'not someone who', 'not a person who',
  'dislike', "don't like", 'do not like', 'tired of', 'sick of', 'done with', "don't date", 'do not date'
]
// "Smoking is a dealbreaker": for these the refused thing comes BEFORE the cue, not after it.
const NOUN_CUES = ['deal breaker', 'dealbreaker', 'deal-breaker', 'turn off', 'turnoff', 'turn-off', 'red flag', 'not ideal', 'no-go', 'non-starter', 'non starter']
const NOUN_RE = anyOf(NOUN_CUES)
const RED_RE = anyOf(RED_CUES)
const SOFT_RE = anyOf(SOFT_CUES)
const PLAIN_RE = anyOf(PLAIN_AVOID)
const EMPH_RE = anyOf(EMPHASIS)
const NICE_RE = anyOf(NICE_CUES)
const LEADING_NEG = /^\s*(?:no|not|never|nobody|none|nothing)\b/

// Words that describe each quality when the user WANTS it.
const DESCRIBE = {
  communication: ['communicat', 'texts back', 'text back', 'replies', 'responsive', 'reliable', 'follows through', 'consistent', 'checks in', 'keeps in touch', 'stays in touch'],
  humor: ['funny', 'humor', 'humour', 'laugh', 'witty', 'sense of humor', 'playful'],
  ambition: ['ambitio', 'driven', 'goals', 'career', 'motivated', 'hardworking', 'hard-working', 'works hard', 'entrepreneur', 'business'],
  dogs: ['dog', 'puppy', 'pets', 'animal lover'],
  respect: ['respect', 'kind', 'considerate', 'thoughtful', 'listens', 'polite', 'genuine', 'treats me well', 'treats people well', 'humble'],
  plans: ['makes plans', 'plans dates', 'plans ahead', 'takes initiative', 'initiative', 'follows up on plans', 'plan things'],
  family: ['family', 'kids', 'children', 'wants a family', 'good with kids', 'close with'],
  stable: ['mature', 'stable', 'emotionally', 'calm', 'secure', 'therapy', 'self-aware', 'self aware', 'healthy', 'grounded'],
  quality_time: ['quality time', 'hangs out', 'hang out', 'spends time', 'makes time', 'always around', 'together often']
}

// The BAD side of each quality comes from TRAITS[].badWords: the same list the scorer uses, so a don't-want the
// reader creates can actually fire on the notes you write. (One source of truth; they used to drift apart.)
const badWordsOf = (trait) => trait.badWords.map((w) => w.toLowerCase())

// A stem matches at the start of a word. Short stems must be whole words (optionally plural) so "mean" never fires on "meaning".
function stemRe(stem) {
  const e = esc(stem)
  return stem.length >= 5
    ? new RegExp(`(^|[^a-z])(${e}[a-z]*)`, 'i')
    : new RegExp(`(^|[^a-z])(${e}(?:s|es)?)(?=[^a-z]|$)`, 'i')
}
const ENDINGS = '(?:s|es|ed|d|ing|ly|er|ers)?'
function findWord(text, words) {
  let best = null
  for (const w of words) {
    const m = new RegExp(`(^|[^a-z])(${esc(w)}${ENDINGS})(?=[^a-z]|$)`, 'i').exec(text)
    if (!m) continue
    const idx = m.index + m[1].length
    if (!best || idx < best.idx) best = { idx, stem: w }
  }
  return best
}
function findStem(text, stems) {
  let best = null
  for (const st of stems) {
    const m = stemRe(st).exec(text)
    if (!m) continue
    const idx = m.index + m[1].length
    if (!best || idx < best.idx) best = { idx, stem: st }
  }
  return best
}
// The whole word a stem hit sits inside: "ambitio" in "ambitious" -> "ambitious".
function wordAt(text, idx) {
  const left = text.slice(0, idx).search(/[a-z'-]*$/)
  const right = /^[a-z'-]*/.exec(text.slice(idx))[0]
  return (text.slice(left, idx) + right).replace(/^[-']+|[-']+$/g, '')
}

const NEG_BEFORE = /(?:^|[^a-z])(?:not|no|never|isn't|aren't|wasn't|doesn't|don't|didn't|without|lacks?|lacking|can't|cannot)\s+(?:\w+\s+){0,2}$/
const negatedAt = (text, idx) => NEG_BEFORE.test(text.slice(0, idx))

// ---------- keyword extraction ----------

const LEAD = /^(?:to date|to be with|dating|someone|somebody|anyone|anybody|people|person|a person|a guy|a girl|a man|a woman|him|her|them|who|that|which|is|are|be|being|been|too|very|really|so|always|constantly|often|just|quite|extremely|overly|super|pretty|a|an|the|to|no|not|never|with|who is|who are)\s+/
const TRAIL = /\s+(?:a lot|too much|all the time|constantly|often|daily|every day|at all|though|too|either|regularly|for me|to me|for sure|in a partner|in a person|in someone|in a relationship|in a man|in a woman)$/
const FILLER = new Set([
  ...EMPHASIS.flatMap((e) => e.split(/[^a-z]+/)).filter(Boolean),
  'partner', 'partners', 'relationship', 'relationships', 'date', 'dates', 'dating', 'boyfriend', 'girlfriend', 'man', 'men', 'woman', 'women', 'guy', 'guys', 'girl', 'girls',
  'me', 'my', 'mine', 'myself', 'you', 'us', 'we', 'it', 'its', 'he', 'she', 'him', 'her', 'his', 'hers', 'ours', 'negotiable', 'important', 'essential', 'required',
  'someone', 'somebody', 'person', 'people', 'who', 'that', 'this', 'with', 'and', 'the', 'for', 'are', 'is', 'was', 'want', 'looking', 'like', 'love',
  'really', 'very', 'just', 'also', 'have', 'has', 'had', 'they', 'them', 'their', 'from', 'about', 'loves', 'likes', 'enjoys', 'enjoy', 'would',
  'could', 'should', 'need', 'needs', 'much', 'more', 'most', 'some', 'any', 'all', 'can', 'will', 'you', 'your', 'not', 'but', 'too', 'lot', 'ideally',
  'prefer', 'must', 'nice', 'good', 'great', 'best', 'well', 'able', 'make', 'makes', 'made', 'when', 'where', 'what', 'why', 'how', 'than', 'then',
  'there', 'these', 'those', 'being', 'been', 'does', 'never', 'always', 'ever', 'even', 'still', 'only', 'other', 'into', 'over', 'under', 'out'
])

const TAIL_WORDS = new Set(['of', 'in', 'on', 'at', 'to', 'with', 'the', 'a', 'an', 'for', 'and', 'or', 'about', 'their', 'his', 'her', 'my', 'your', 'from', 'by'])

function looksLikeWords(k) {
  if (['asdf', 'qwer', 'zxcv', 'hjkl', 'sdfg', 'wasd'].some((b) => k.includes(b))) return false
  return k.split(/\s+/).every((w) => /[aeiouy]/.test(w))
}

// Clean one candidate phrase: trim filler off both ends, keep meaningful words in between, limit length.
// Long phrases keep their LAST four words: in English the informative part ("on their phone", "meaning of life") comes last.
function trimEdges(p) {
  let out = p
  for (let i = 0; i < 6; i++) {
    const before = out
    out = out.replace(LEAD, '').replace(TRAIL, '').trim()
    if (out === before) break
  }
  return out
}

function tidy(phrase) {
  let p = trimEdges(phrase.trim().replace(/[.,;:!?]+$/g, ''))
  let words = p.split(/\s+/).filter(Boolean)
  if (words.length > 4) {
    p = trimEdges(words.slice(-4).join(' '))
    words = p.split(/\s+/).filter(Boolean)
  }
  while (words.length > 1 && TAIL_WORDS.has(words[words.length - 1])) words.pop()
  // Judge the FINAL phrase, never the longer one it was cut from.
  if (words.length === 0 || !words.some((w) => w.length >= 3 && !FILLER.has(w))) return ''
  const k = words.join(' ')
  return k.length > 2 && k.length <= 32 && looksLikeWords(k) ? k : ''
}

// "hiking, travel and cooking" -> ['hiking','travel','cooking']
function splitList(chunk) {
  return chunk.split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s*&\s*/).map((x) => x.trim()).filter(Boolean)
}

const WANT_CUES = /(?:\binto\b|\bloves?\b|\benjoys?\b|\blikes?\b|\bpassionate about\b|\bobsessed with\b|\bwho (?:is|are|has|have)\b|\bwho\b|\bthat (?:is|are|has|have)\b)\s+/g
const CUT = /\b(?:who|that|because|since|so|which|when|while|but)\b/

function wantKeywords(clause) {
  const found = new Set()
  let m
  WANT_CUES.lastIndex = 0
  while ((m = WANT_CUES.exec(clause)) !== null) {
    let rest = clause.slice(m.index + m[0].length)
    const cut = rest.search(CUT)
    if (cut > 0) rest = rest.slice(0, cut)
    for (const item of splitList(rest)) {
      const k = tidy(item)
      if (k) found.add(k)
    }
  }
  if (found.size === 0) {
    clause
      .split(/[^a-z']+/)
      .filter((w) => w.length > 4 && !FILLER.has(w) && looksLikeWords(w))
      .slice(0, 3)
      .forEach((w) => found.add(w))
  }
  return [...found]
}

// ---------- clause handling ----------

function splitClauses(text) {
  return (text || '')
    .split(/[.!?\n;]+|\bbut\b|\bhowever\b/i)
    .flatMap((c) => c.split(/,\s*(?:and\s+)?(?=(?:i|someone|a person|he|she|they|no|not)\b)/i))
    .map((c) => c.trim())
    .filter((c) => c.length > 2)
}

// Splits "someone with a good job who is not obsessed with work" into the wanted part and the refused part.
const INNER_NEG = /(?:^|\s)(?:(?:and|who|that|but)\s+)?(?:(?:is|are|does|do|has|have|can|will)\s+)?(?:not|never|isn't|aren't|doesn't|don't|won't)\s+/
function splitMixed(low) {
  const m = INNER_NEG.exec(low)
  if (!m || m.index < 3) return null
  return { before: low.slice(0, m.index), after: low.slice(m.index + m[0].length) }
}

// Everything AFTER the words that made this an avoid-clause, so the cue itself is not read as content.
const COPULA_TAIL = /\s*(?:is|are|was|were|would be|'s|being|be)?\s*(?:a|an|my|the|major|huge|big|total|real)?\s*$/
function avoidBody(low) {
  const noun = NOUN_RE.exec(low)
  if (noun) {
    const before = low.slice(0, noun.index).replace(COPULA_TAIL, '').trim()
    if (tidy(before)) return before
  }
  const cues = [RED_RE, SOFT_RE, PLAIN_RE]
  let end = -1
  for (const re of cues) {
    const m = re.exec(low)
    if (m) end = Math.max(end, m.index + m[0].length - (/[^a-z]$/.test(m[0]) ? 1 : 0))
  }
  if (end === -1) {
    const m = LEADING_NEG.exec(low)
    end = m ? m[0].length : 0
  }
  return low.slice(end)
}

// Bad-side phrases that contain "and" / "or" would be torn apart by list splitting ("hot and cold" -> "hot", "cold").
const CONJ_PHRASES = TRAITS.flatMap(badWordsOf).filter((w) => / (?:and|or) /.test(w))

const RANK = { nice: 1, must: 2, rathernot: 1, redline: 2 }

export function parseDescription(text, criteria = {}) {
  const out = { wants: { traits: [], words: [] }, avoids: { traits: [], words: [] }, conflicts: [], unread: [] }
  if (!text || !text.trim()) return out

  const wTraits = new Map()
  const aTraits = new Map()
  const wWords = new Map()
  const aWords = new Map()
  const bump = (map, key, entry, tie = RANK) => {
    const prev = map.get(key)
    if (!prev || tie[entry.level] > tie[prev.level]) map.set(key, entry)
  }

  const addAvoid = (rawItemLow, level, evidence) => {
    let body = rawItemLow
    for (const phrase of CONJ_PHRASES) body = body.split(phrase).join(phrase.replace(/ /g, '~'))
    const items = splitList(body).map((x) => x.replace(/~/g, ' '))
    let used = false
    for (const itemRaw of items) {
      const item = itemRaw.replace(/^(?:no|not|never)\s+/, '').trim()
      if (!item) continue
      let matched = false
      // (a) the bad side of a quality: "flaky", "drama", "controlling"
      for (const trait of TRAITS) {
        const hit = findWord(item, badWordsOf(trait))
        if (hit && !negatedAt(item, hit.idx)) {
          bump(aTraits, trait.id, { id: trait.id, label: trait.avoidLabel, level, evidence })
          matched = true
        }
        // (b) the ABSENCE of a good quality: "aren't respectful", "doesn't communicate"
        const good = findStem(item, DESCRIBE[trait.id] || [])
        if (good && negatedAt(item, good.idx)) {
          bump(aTraits, trait.id, { id: trait.id, label: trait.avoidLabel, level, evidence })
          matched = true
        }
      }
      if (matched) {
        used = true
        continue
      }
      // (c) rejecting a good quality outright ("someone funny") or any other thing: becomes a keyword
      let word = ''
      for (const trait of TRAITS) {
        const good = findStem(item, DESCRIBE[trait.id] || [])
        if (good) {
          word = wordAt(item, good.idx)
          break
        }
      }
      const k = word && word.length > 2 ? word : tidy(item)
      if (k) {
        bump(aWords, k, { text: k, level, evidence })
        used = true
      }
    }
    return used
  }

  for (const raw of splitClauses(text)) {
    const low = norm(raw)
    const emphasised = EMPH_RE.test(low) && !NICE_RE.test(low)

    // ----- avoid side -----
    const red = RED_RE.test(low)
    const soft = SOFT_RE.test(low)
    const plain = PLAIN_RE.test(low)
    const leading = LEADING_NEG.test(low)
    if (red || soft || plain || leading) {
      const level = red || (emphasised && !soft) ? 'redline' : 'rathernot'
      const used = addAvoid(avoidBody(low), level, raw)
      if (!used) out.unread.push(raw)
      continue
    }

    // ----- a want and a refusal in one clause: "someone with a good job who is not obsessed with work" -----
    let wantPart = low
    const mixed = splitMixed(low)
    let fragment = false
    let beforeRaw = raw
    if (mixed) {
      wantPart = mixed.before
      beforeRaw = raw.slice(0, mixed.before.length).trim()
      fragment = true
      // firm wording before the negation ("I need someone who doesn't ghost") makes the refusal firm too
      const level = EMPH_RE.test(mixed.before) && !NICE_RE.test(mixed.before) ? 'redline' : 'rathernot'
      addAvoid(mixed.after, level, raw)
    }

    // ----- want side -----
    const level = NICE_RE.test(wantPart) ? 'nice' : EMPH_RE.test(wantPart) ? 'must' : 'nice'
    let matchedTrait = false
    for (const trait of TRAITS) {
      const hit = findStem(wantPart, DESCRIBE[trait.id] || [])
      if (!hit || negatedAt(wantPart, hit.idx)) continue
      matchedTrait = true
      bump(wTraits, trait.id, { id: trait.id, label: trait.label, level, evidence: raw })
    }
    const intent = /\b(want|need|looking|prefer|love|like|enjoy|into|someone|person|partner|who|ideally|hope|must)\b/.test(wantPart) || EMPH_RE.test(wantPart)
    const kws = intent ? wantKeywords(wantPart).filter((k) => !coveredByTrait(k)) : []
    kws.forEach((k) => { if (!wWords.has(k)) wWords.set(k, { text: k, evidence: raw }) })
    if (!matchedTrait && kws.length === 0) {
      // A leftover like "I need someone who" is just the lead-in to the refusal. Anything with real content is shown.
      const content = wantPart.split(/[^a-z']+/).filter((w) => w.length > 2 && !FILLER.has(w))
      if (!fragment || content.length > 0) out.unread.push(fragment ? beforeRaw : raw)
    }
  }

  out.wants.traits = [...wTraits.values()]
  out.avoids.traits = [...aTraits.values()]
  out.wants.words = [...wWords.values()]
  out.avoids.words = [...aWords.values()]

  // A word that is both wanted and refused is a contradiction: report it instead of guessing which one was meant.
  for (const k of [...wWords.keys()]) {
    if (aWords.has(k)) {
      out.conflicts.push({ text: `You both want and do not want "${k}". I left it out; add it yourself once you decide.` })
      wWords.delete(k)
      aWords.delete(k)
    }
  }
  out.wants.words = [...wWords.values()]
  out.avoids.words = [...aWords.values()]

  // ----- compare with what is already saved -----
  const crit = criteria || {}
  const list = (s) => (s || '').split(/[\n,;]+/).map((w) => w.trim().toLowerCase()).filter(Boolean)
  const haveWant = new Set(list(crit.wantWords))
  const haveRed = new Set(list(crit.avoidWords))
  const haveSoft = new Set(list(crit.softAvoidWords))
  const NAME = { must: 'a must have', nice: 'a nice to have', redline: 'a red line', rathernot: 'something you would rather not have' }

  out.wants.words = out.wants.words.filter((w) => !haveWant.has(w.text.toLowerCase()))

  // Suggestions that would REPLACE a level you already chose are flagged so they are not applied by accident.
  out.wants.traits = out.wants.traits
    .filter((s) => crit.wants?.[s.id] !== s.level)
    .map((s) => ({ ...s, overwrites: crit.wants?.[s.id] || null }))
  out.avoids.traits = out.avoids.traits
    .filter((s) => crit.avoids?.[s.id] !== s.level)
    .map((s) => ({ ...s, overwrites: crit.avoids?.[s.id] || null }))
  out.avoids.words = out.avoids.words
    .filter((w) => !(w.level === 'redline' ? haveRed : haveSoft).has(w.text.toLowerCase()))
    .map((w) => {
      const other = w.level === 'redline' ? haveSoft : haveRed
      return { ...w, overwrites: other.has(w.text.toLowerCase()) ? (w.level === 'redline' ? 'rathernot' : 'redline') : null }
    })

  for (const s of [...out.wants.traits, ...out.avoids.traits]) {
    if (s.overwrites) {
      out.conflicts.push({
        text: `Your note reads like "${s.label.toLowerCase()}" is ${NAME[s.level]}, but you currently have it as ${NAME[s.overwrites]}.`
      })
    }
  }
  for (const w of out.avoids.words) {
    if (w.overwrites) {
      out.conflicts.push({ text: `Your note treats "${w.text}" as ${NAME[w.level]}, but you currently have it as ${NAME[w.overwrites]}.` })
    }
  }
  return out
}

// A keyword that is really just one of the built-in quality words is covered by that quality already.
const ALL_QUALITY_WORDS = [...Object.values(DESCRIBE).flat(), ...TRAITS.flatMap(badWordsOf)]
function coveredByTrait(k) {
  return ALL_QUALITY_WORDS.some((w) => k.includes(w) || w.includes(k))
}

export function hasSuggestions(s) {
  return s.wants.traits.length + s.wants.words.length + s.avoids.traits.length + s.avoids.words.length + s.conflicts.length > 0
}
