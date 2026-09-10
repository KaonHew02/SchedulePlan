/**
 * Dates are passed around as plain 'YYYY-MM-DD' strings so nothing ever shifts
 * across a timezone. Date objects are only used for arithmetic and formatting.
 */

export function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function fromISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = fromISO(iso)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

export function addMonths(iso: string, months: number): string {
  const date = fromISO(iso)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  // Clamp: 31 Jan + 1 month should land on the last day of February, not March.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return toISO(date)
}

/** Weeks run Monday to Sunday. */
export function startOfWeek(iso: string): string {
  const date = fromISO(iso)
  const offset = (date.getDay() + 6) % 7
  return addDays(iso, -offset)
}

export function weekDays(iso: string): string[] {
  const start = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + '01'
}

export function endOfMonth(iso: string): string {
  const date = fromISO(iso)
  return toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

/** Full weeks covering a month, so the calendar grid is always rectangular. */
export function monthGrid(iso: string): string[] {
  const first = startOfWeek(startOfMonth(iso))
  const last = addDays(startOfWeek(endOfMonth(iso)), 6)
  const days: string[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

const format = (iso: string, options: Intl.DateTimeFormatOptions, locale = 'en-GB') =>
  new Intl.DateTimeFormat(locale, options).format(fromISO(iso))

/** '10 September 2026' */
export const longDate = (iso: string) =>
  format(iso, { day: 'numeric', month: 'long', year: 'numeric' })

/** '10 Sep' (en-GB would abbreviate September to 'Sept'). */
export const shortDate = (iso: string) =>
  `${dayNumber(iso)} ${format(iso, { month: 'short' }, 'en-US')}`

/** 'Thursday' */
export const weekday = (iso: string) => format(iso, { weekday: 'long' })

/** 'Thu' */
export const weekdayShort = (iso: string) => format(iso, { weekday: 'short' })

/** 'September 2026' */
export const monthTitle = (iso: string) => format(iso, { month: 'long', year: 'numeric' })

export const dayNumber = (iso: string) => String(fromISO(iso).getDate())

/** '8 – 14 Sep 2026', collapsing the parts both ends share. */
export function weekTitle(iso: string): string {
  const days = weekDays(iso)
  const first = days[0]
  const last = days[6]
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${dayNumber(first)} – ${shortDate(last)} ${last.slice(0, 4)}`
  }
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${shortDate(first)} – ${shortDate(last)} ${last.slice(0, 4)}`
  }
  return `${shortDate(first)} ${first.slice(0, 4)} – ${shortDate(last)} ${last.slice(0, 4)}`
}

/** 'Today', 'Tomorrow', 'Yesterday' or the weekday, for a day heading. */
export function relativeDay(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  if (iso === addDays(today, -1)) return 'Yesterday'
  return weekday(iso)
}

/** '18:00 – 20:00' or just '18:00'. */
export function timeRange(start: string, end: string | null): string {
  return end ? `${start} – ${end}` : start
}

/** The next round half hour, as a sensible default start time. */
export function nextHalfHour(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  now.setMinutes(now.getMinutes() > 30 ? 60 : 30)
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
