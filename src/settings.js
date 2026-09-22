// User settings, saved with the rest of the data. Anything unreadable falls back to the default.
export const DEFAULT_SETTINGS = {
  // Which lines appear on each card in the People list.
  card: { details: true, notes: true, flags: true, contact: true, photos: true, plan: true },
  // The look of the People screen: large photo cards or a compact grid, the greeting, and the week strip.
  peopleView: 'card',
  home: { hero: true, week: true },
  // Which sections appear on a profile. Hidden sections keep their data and still count in Fit.
  profile: { flags: true, plans: true, remember: true, promises: true, prompts: true, timeline: true },
  // How many days before a plan the Today screen starts reminding you (0 = only on the day).
  reminderDays: 2,
  // Lock again after the app has been in the background this long. 0 = every time you leave it.
  autoLockSeconds: 60,
  lastBackup: ''
}
export const LOCK_CHOICES = [
  { value: 0, label: 'Every time I leave the app' },
  { value: 60, label: 'After 1 minute away' },
  { value: 300, label: 'After 5 minutes away' },
  { value: 3600, label: 'After 1 hour away' }
]

export function normalizeSettings(s) {
  const base = { ...DEFAULT_SETTINGS, card: { ...DEFAULT_SETTINGS.card }, profile: { ...DEFAULT_SETTINGS.profile }, home: { ...DEFAULT_SETTINGS.home } }
  if (!s || typeof s !== 'object') return base
  const card = s.card && typeof s.card === 'object' ? s.card : {}
  for (const k of Object.keys(base.card)) if (typeof card[k] === 'boolean') base.card[k] = card[k]
  const profile = s.profile && typeof s.profile === 'object' ? s.profile : {}
  for (const k of Object.keys(base.profile)) if (typeof profile[k] === 'boolean') base.profile[k] = profile[k]
  if (s.peopleView === 'card' || s.peopleView === 'grid') base.peopleView = s.peopleView
  const home = s.home && typeof s.home === 'object' ? s.home : {}
  for (const k of Object.keys(base.home)) if (typeof home[k] === 'boolean') base.home[k] = home[k]
  const rd = Number(s.reminderDays)
  if (Number.isInteger(rd) && rd >= 0 && rd <= 7) base.reminderDays = rd
  const al = Number(s.autoLockSeconds)
  if (LOCK_CHOICES.some((c) => c.value === al)) base.autoLockSeconds = al
  if (typeof s.lastBackup === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastBackup)) base.lastBackup = s.lastBackup
  return base
}
