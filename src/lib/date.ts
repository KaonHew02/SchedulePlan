import { isZh } from './i18n'

/**
 * Dates are passed around as plain 'YYYY-MM-DD' strings so nothing ever shifts
 * across a timezone. Date objects are only used for arithmetic and formatting.
 *
 * Every label below is written in the app's language. The Chinese ones are
 * built by hand where Intl would put the parts in a different order from the
 * English — 9月8日 – 14日 rather than a translation of '8 – 14 Sep'.
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

/** English unless the app is in Chinese; en-GB is the day-month order a Malaysian reads. */
const format = (iso: string, options: Intl.DateTimeFormatOptions, locale = 'en-GB') =>
  new Intl.DateTimeFormat(isZh() ? 'zh-CN' : locale, options).format(fromISO(iso))

/** The month and day as numbers, for building the Chinese labels. */
const md = (iso: string) => [Number(iso.slice(5, 7)), Number(iso.slice(8, 10))] as const

/** '10 September 2026' · 2026年9月10日 */
export const longDate = (iso: string) =>
  format(iso, { day: 'numeric', month: 'long', year: 'numeric' })

/** '10 Sep' (en-GB would abbreviate September to 'Sept') · 9月10日 */
export const shortDate = (iso: string) =>
  isZh() ? `${md(iso)[0]}月${md(iso)[1]}日` : `${dayNumber(iso)} ${format(iso, { month: 'short' }, 'en-US')}`

/** 'Thursday' · 星期四 */
export const weekday = (iso: string) => format(iso, { weekday: 'long' })

/** 'Thu' · 周四 */
export const weekdayShort = (iso: string) => format(iso, { weekday: 'short' })

/** 'September 2026' · 2026年9月 */
export const monthTitle = (iso: string) => format(iso, { month: 'long', year: 'numeric' })

export const dayNumber = (iso: string) => String(fromISO(iso).getDate())

/** '8 – 14 Sep 2026', collapsing the parts both ends share · 2026年9月8日 – 14日 */
export function weekTitle(iso: string): string {
  const days = weekDays(iso)
  const first = days[0]
  const last = days[6]
  if (isZh()) {
    const [m1, d1] = md(first)
    const [m2, d2] = md(last)
    const y1 = first.slice(0, 4)
    const y2 = last.slice(0, 4)
    if (y1 !== y2) return `${y1}年${m1}月${d1}日 – ${y2}年${m2}月${d2}日`
    return m1 === m2 ? `${y1}年${m1}月${d1}日 – ${d2}日` : `${y1}年${m1}月${d1}日 – ${m2}月${d2}日`
  }
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
  if (iso === today) return isZh() ? '今天' : 'Today'
  if (iso === addDays(today, 1)) return isZh() ? '明天' : 'Tomorrow'
  if (iso === addDays(today, -1)) return isZh() ? '昨天' : 'Yesterday'
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

/** Whole days from a to b, counting both ends. Same day is 1. */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000) + 1
}

/** '10 – 14 Sep' within a month, '28 Sep – 2 Oct' across two · 9月10日 – 14日, 9月28日 – 10月2日 */
export function rangeLabel(start: string, end: string): string {
  if (start === end) return shortDate(start)
  if (isZh()) {
    return start.slice(0, 7) === end.slice(0, 7)
      ? `${shortDate(start)} – ${md(end)[1]}日`
      : `${shortDate(start)} – ${shortDate(end)}`
  }
  if (start.slice(0, 7) === end.slice(0, 7)) return `${dayNumber(start)} – ${shortDate(end)}`
  return `${shortDate(start)} – ${shortDate(end)}`
}

/** Which day of a span this is, 1-based. */
export const dayOfSpan = (start: string, day: string): number => daysBetween(start, day)

/** 'HH:MM' shifted by some minutes, wrapping at midnight. */
export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const total = ((hours * 60 + mins + minutes) % 1440 + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Minutes since midnight, for sorting and for measuring a gap. */
export function minutesOf(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

/** '2h 30m', '45m' — how long something runs for · 2小时30分, 45分钟 */
export function durationLabel(start: string, end: string): string {
  const total = minutesOf(end) - minutesOf(start)
  if (total <= 0) return ''
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (isZh()) {
    if (!hours) return `${mins}分钟`
    return mins ? `${hours}小时${mins}分` : `${hours}小时`
  }
  if (!hours) return `${mins}m`
  return mins ? `${hours}h ${mins}m` : `${hours}h`
}

/** The current time, rounded down to the minute. */
export function nowTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** 'September' · 九月 */
export const monthName = (iso: string) => format(iso, { month: 'long' })

/** 'Sep 2026', for an expense month heading · 2026年9月 */
export const monthShort = (iso: string) =>
  isZh()
    ? `${iso.slice(0, 4)}年${md(iso)[0]}月`
    : `${format(iso, { month: 'short' }, 'en-US')} ${iso.slice(0, 4)}`

/** The YYYY-MM this date sits in. */
export const monthKey = (iso: string) => iso.slice(0, 7)
