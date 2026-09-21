// Conversation prompts: questions you might bring up with someone. Suggestions only, never advice about a person.
// Early questions come first while you are still getting to know someone; the deeper ones open up after a couple of dates.
import { rememberOf } from './fit.js'

export const PROMPT_CATEGORIES = [
  { id: 'know', label: 'Getting to know' },
  { id: 'fun', label: 'Fun' },
  { id: 'values', label: 'Values' },
  { id: 'talk', label: 'How we talk' },
  { id: 'care', label: 'Care and support' },
  { id: 'future', label: 'Looking ahead' }
]

const P = (id, category, depth, text) => ({ id, category, depth, text })
export const PROMPTS = [
  P('know-1', 'know', 'early', 'What does a really good ordinary day look like for you?'),
  P('know-2', 'know', 'early', 'What is something you have been into lately?'),
  P('know-3', 'know', 'early', 'What is a small thing that reliably makes your day better?'),
  P('know-4', 'know', 'early', 'Where did you grow up, and what do you miss or not miss about it?'),
  P('know-5', 'know', 'early', 'What is a job you would try for a year if money were no issue?'),
  P('know-6', 'know', 'early', 'What is something people are often surprised to learn about you?'),
  P('fun-1', 'fun', 'early', 'What is the best meal you have ever had, and who were you with?'),
  P('fun-2', 'fun', 'early', 'What is a place you would go back to again and again?'),
  P('fun-3', 'fun', 'early', 'What is a hobby you are bad at but enjoy anyway?'),
  P('fun-4', 'fun', 'early', 'What is the best trip you have taken, and what made it great?'),
  P('fun-5', 'fun', 'early', 'What show, book, or album do you recommend to everyone?'),
  P('fun-6', 'fun', 'early', 'What would a perfect lazy Sunday be?'),
  P('values-1', 'values', 'deeper', 'What do you value most in your friendships?'),
  P('values-2', 'values', 'deeper', 'What does a good balance between work and the rest of life look like to you?'),
  P('values-3', 'values', 'deeper', 'How important is family to you, and what does that look like in practice?'),
  P('values-4', 'values', 'deeper', 'What is something you have changed your mind about in the last few years?'),
  P('values-5', 'values', 'deeper', 'What does being reliable mean to you?'),
  P('values-6', 'values', 'deeper', 'What do you want to be known for?'),
  P('talk-1', 'talk', 'deeper', 'How do you like to keep in touch when you are busy?'),
  P('talk-2', 'talk', 'deeper', 'When something bothers you, how do you prefer to bring it up?'),
  P('talk-3', 'talk', 'deeper', 'How much time together versus apart feels right for you?'),
  P('talk-4', 'talk', 'deeper', 'What helps you feel heard in a conversation?'),
  P('talk-5', 'talk', 'deeper', 'How do you usually handle disagreements?'),
  P('talk-6', 'talk', 'deeper', 'What is your texting style, honestly?'),
  P('care-1', 'care', 'deeper', 'What helps when you are stressed or having a rough week?'),
  P('care-2', 'care', 'deeper', 'How do you like to celebrate good news?'),
  P('care-3', 'care', 'deeper', 'What is something someone did for you that you never forgot?'),
  P('care-4', 'care', 'deeper', 'What makes you feel appreciated?'),
  P('care-5', 'care', 'deeper', 'How do you recharge when you are worn out?'),
  P('care-6', 'care', 'deeper', 'What is your relationship with rest, and how do you protect it?'),
  P('future-1', 'future', 'deeper', 'What are you working toward this year?'),
  P('future-2', 'future', 'deeper', 'Where do you picture yourself living in five years?'),
  P('future-3', 'future', 'deeper', 'What is on your list of things to do someday?'),
  P('future-4', 'future', 'deeper', 'What do you want more of in your life right now?'),
  P('future-5', 'future', 'deeper', 'How do you feel about kids, or about the family you want, if any?'),
  P('future-6', 'future', 'deeper', 'What would make the next year feel like a good one?')
]

const BY_ID = new Map(PROMPTS.map((p) => [p.id, p]))
export const promptById = (id) => BY_ID.get(id) || null

// Prompts already saved for this person, whether or not they were ticked off as talked about.
export function usedPromptIds(person) {
  return new Set(rememberOf(person).map((r) => r.promptId).filter(Boolean))
}

// Early days (still talking, or fewer than two dates) favor light questions; after that the deeper ones come first.
export function isEarly(person, dates) {
  const n = (Array.isArray(dates) ? dates : []).filter((d) => d && d.personId === person?.id).length
  return person?.status === 'talking' || n < 2
}

/**
 * The ordered list of prompts still worth suggesting. Deterministic: same input, same list.
 * Categories alternate so a run of suggestions does not all come from one theme.
 */
export function candidates(person, dates, { category = 'all' } = {}) {
  const used = usedPromptIds(person)
  const early = isEarly(person, dates)
  const pool = PROMPTS.filter((p) => !used.has(p.id) && (category === 'all' || p.category === category))
  const first = pool.filter((p) => (early ? p.depth === 'early' : p.depth === 'deeper'))
  const rest = pool.filter((p) => !first.includes(p))
  const spread = (list) => {
    const buckets = PROMPT_CATEGORIES.map((c) => list.filter((p) => p.category === c.id)).filter((b) => b.length)
    const out = []
    for (let i = 0; buckets.some((b) => i < b.length); i++) for (const b of buckets) if (i < b.length) out.push(b[i])
    return out
  }
  return [...spread(first), ...spread(rest)]
}

export function suggest(person, dates, skip = 0, opts = {}) {
  const list = candidates(person, dates, opts)
  return list.length ? list[((skip % list.length) + list.length) % list.length] : null
}
