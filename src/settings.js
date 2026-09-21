// User settings, saved with the rest of the data. Anything unreadable falls back to the default.
export const DEFAULT_SETTINGS = {
  // Which lines appear on each card in the People list.
  card: { details: true, notes: true, flags: true, contact: true },
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
  const base = { ...DEFAULT_SETTINGS, card: { ...DEFAULT_SETTINGS.card } }
  if (!s || typeof s !== 'object') return base
  const card = s.card && typeof s.card === 'object' ? s.card : {}
  for (const k of Object.keys(base.card)) if (typeof card[k] === 'boolean') base.card[k] = card[k]
  const rd = Number(s.reminderDays)
  if (Number.isInteger(rd) && rd >= 0 && rd <= 7) base.reminderDays = rd
  const al = Number(s.autoLockSeconds)
  if (LOCK_CHOICES.some((c) => c.value === al)) base.autoLockSeconds = al
  if (typeof s.lastBackup === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastBackup)) base.lastBackup = s.lastBackup
  return base
}
