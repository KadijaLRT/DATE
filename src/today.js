// Builds the Today screen from what is already stored. Pure: pass in "today" (YYYY-MM-DD) so it can be tested.
import { plansOf, rememberOf, reflectionOf } from './fit.js'
import { buildTimeline } from './timeline.js'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const ms = (d) => (DAY.test(d) ? Date.parse(d + 'T00:00:00Z') : NaN)
export const daysBetween = (from, to) => Math.round((ms(to) - ms(from)) / 86400000)

export const UPCOMING_WINDOW = 14
export const REFLECT_WINDOW = 21

export function buildToday(data, { today, reminderDays = 2 } = {}) {
  const people = (Array.isArray(data?.people) ? data.people : []).filter((p) => p && typeof p === 'object')
  const dates = Array.isArray(data?.dates) ? data.dates : []
  const live = people.filter((p) => !p.archived && p.status !== 'ended')
  const byId = new Map(people.map((p) => [p.id, p]))

  const upcoming = []
  const overdue = []
  for (const p of live) {
    for (const plan of plansOf(p)) {
      const days = daysBetween(today, plan.date)
      if (Number.isNaN(days)) continue
      const item = { person: p, plan, days, due: plan.remind && days >= 0 && days <= reminderDays, remember: rememberOf(p).filter((r) => !r.done) }
      if (days < 0) overdue.push(item)
      else if (days <= UPCOMING_WINDOW) upcoming.push(item)
    }
  }
  upcoming.sort((a, b) => a.days - b.days)
  overdue.sort((a, b) => b.days - a.days)

  // Dates from the last few weeks that have no reflection yet.
  const reflections = dates
    .filter((d) => d && byId.has(d.personId) && !byId.get(d.personId).archived && DAY.test(d.date || '') && !reflectionOf(d))
    .map((d) => ({ date: d, person: byId.get(d.personId), ago: daysBetween(d.date, today) }))
    .filter((x) => x.ago >= 0 && x.ago <= REFLECT_WINDOW)
    .sort((a, b) => a.ago - b.ago)

  const recent = buildTimeline(people, dates).filter((e) => e.kind !== 'plan' && e.kind !== 'matched' && e.date && e.date <= today).slice(0, 5)

  // People ordered by their most recent activity of any kind.
  const latest = new Map()
  for (const e of buildTimeline(people, dates)) {
    if (e.kind === 'plan' || !e.date || e.date > today) continue
    if (!latest.has(e.personId) || e.date > latest.get(e.personId)) latest.set(e.personId, e.date)
  }
  const updated = live
    .filter((p) => latest.has(p.id))
    .map((p) => ({ person: p, date: latest.get(p.id), ago: daysBetween(latest.get(p.id), today) }))
    .sort((a, b) => a.ago - b.ago)
    .slice(0, 4)

  return { upcoming, overdue, reflections: reflections.slice(0, 5), recent, updated, quickPeople: live, empty: live.length === 0 }
}
