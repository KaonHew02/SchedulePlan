/**
 * Repeating schedule items: turning the rule back into days, and saying it in
 * words.
 *
 * A repeating item is one row with a `repeat` on it (see `ScheduleRepeat` for
 * why it is never copies on disk). Everything that draws days asks for a
 * stretch of them through `inRange`, and that is where the rule is unrolled —
 * into one item per time round, each a copy of the row moved to its own date.
 *
 * This file imports nothing from the store, which imports it.
 */

import { addDays, addMonths, daysBetween, fromISO, shortDate, startOfWeek, todayISO } from './date'
import type { RepeatUnit, ScheduleItem, ScheduleRepeat } from '../types'

/** The weekday of a date with Monday as 0, the way the weeks here run. */
export const weekdayOf = (iso: string): number => (fromISO(iso).getDay() + 6) % 7

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const UNIT_NAMES: Record<RepeatUnit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
}

export const unitName = (unit: RepeatUnit, count: number): string =>
  UNIT_NAMES[unit][count === 1 ? 0 : 1]

/** Months from a's month to b's, ignoring the day. */
const monthsBetween = (a: string, b: string): number =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
  (Number(b.slice(5, 7)) - Number(a.slice(5, 7)))

/**
 * The days a rule starts on from `anchor`, in order, before skips and the
 * until date have had their say.
 *
 * It begins near `from` rather than at the anchor, so a daily thing that
 * began three years ago does not walk a thousand days to reach this week. It
 * may begin a little before `from`; the caller filters. It never ends on its
 * own — the caller stops reading.
 *
 * A month is counted from the anchor each time, not from the last one, so the
 * 31st lands on the 30th in April and back on the 31st in May rather than
 * drifting down to the 28th for good after February. `addMonths` clamps, which
 * is what makes "the 31st" mean the last day of a shorter month: rent and pay
 * day both work that way.
 */
function* starts(anchor: string, rule: ScheduleRepeat, from: string): Generator<string> {
  const every = Math.max(1, rule.every)

  if (rule.unit === 'day' || (rule.unit === 'week' && rule.weekdays.length === 0)) {
    const step = rule.unit === 'day' ? every : every * 7
    const gap = Math.max(0, daysBetween(anchor, from) - 1)
    for (let k = Math.floor(gap / step); ; k += 1) yield addDays(anchor, k * step)
  } else if (rule.unit === 'week') {
    // Weeks are counted from the Monday of the anchor's week, so "every other
    // week on Mon and Thu" keeps both days in the same week of the pair.
    const days = [...rule.weekdays].sort((a, b) => a - b)
    const firstWeek = startOfWeek(anchor)
    const weeks = Math.max(0, Math.floor((daysBetween(firstWeek, from) - 1) / 7))
    for (let week = Math.floor(weeks / every) * every; ; week += every) {
      for (const day of days) {
        const date = addDays(firstWeek, week * 7 + day)
        // The anchor's own week may have picked days before it started.
        if (date >= anchor) yield date
      }
    }
  } else {
    const months = rule.unit === 'year' ? every * 12 : every
    const gap = monthsBetween(anchor, from)
    for (let k = Math.max(0, Math.floor(gap / months) - 1); ; k += 1) {
      yield addMonths(anchor, k * months)
    }
  }
}

/**
 * Every time an item comes round that is not over by `from` — each one whose
 * last day is on or after it — in order.
 *
 * A one-off yields itself or nothing. A repeat yields a copy per time round,
 * with `series` set to its first date; one with no until date never runs out,
 * so read what you need and stop.
 */
export function* occurrences(item: ScheduleItem, from: string): Generator<ScheduleItem> {
  const rule = item.repeat
  // A copy is already one time round. Unrolling it again would start a second
  // series from the copy's date, and a month counted from 28 Feb is not the
  // same month as one counted from 31 Jan.
  if (!rule || item.series) {
    if ((item.end_date ?? item.date) >= from) yield item
    return
  }

  // A trip that repeats still runs as many days each time round.
  const extra = item.end_date && item.end_date > item.date ? daysBetween(item.date, item.end_date) - 1 : 0
  const skip = new Set(rule.skip)
  for (const date of starts(item.date, rule, addDays(from, -extra))) {
    if (rule.until && date > rule.until) return
    if (skip.has(date)) continue
    const ends = addDays(date, extra)
    if (ends < from) continue
    yield { ...item, date, end_date: extra ? ends : null, series: item.date }
  }
}

/** Every time an item lands on a day between `start` and `end`, both included. */
export function unroll(item: ScheduleItem, start: string, end: string): ScheduleItem[] {
  const found: ScheduleItem[] = []
  for (const copy of occurrences(item, start)) {
    if (copy.date > end) break
    found.push(copy)
  }
  return found
}

/** The first time an item actually happens, which for a weekly repeat may not be its own date. */
export function firstOccurrence(item: ScheduleItem): ScheduleItem | null {
  return occurrences(item, item.date).next().value ?? null
}

// ------------------------------------------------------------------ words

const ordinal = (n: number): string => {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** 'Mon, Wed and Fri'. */
function dayList(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((day) => WEEKDAY_NAMES[day])
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
}

/** '23 Sep', with the year when it is not this one. */
const dayLabel = (iso: string) =>
  iso.slice(0, 4) === todayISO().slice(0, 4) ? shortDate(iso) : `${shortDate(iso)} ${iso.slice(0, 4)}`

/**
 * The rule as a sentence: 'Every week on Tue', 'Every 2 months on the 23rd',
 * 'Every year on 23 Sep, until 1 Dec 2027'. `date` is the item's first day,
 * which is what the rule counts from.
 */
export function describeRepeat(rule: ScheduleRepeat, date: string): string {
  const weekdays = rule.weekdays.length ? rule.weekdays : [weekdayOf(date)]
  let said: string
  if (rule.unit === 'week' && rule.every === 1 && weekdays.join() === '0,1,2,3,4') {
    said = 'Every weekday'
  } else {
    said = rule.every === 1 ? `Every ${unitName(rule.unit, 1)}` : `Every ${rule.every} ${unitName(rule.unit, 2)}`
    const day = fromISO(date).getDate()
    if (rule.unit === 'week') said += ` on ${dayList(weekdays)}`
    // Past the 28th some months do not have the day, and the last one stands in.
    if (rule.unit === 'month') said += ` on the ${ordinal(day)}${day > 28 ? ' (or the last day)' : ''}`
    if (rule.unit === 'year') said += ` on ${shortDate(date)}`
  }
  if (rule.until) said += `, until ${dayLabel(rule.until)}`
  return said
}

// ---------------------------------------------------------------- presets

/** The choices the form offers before anyone has to think about a rule. */
export type RepeatChoice = 'never' | RepeatUnit | 'custom'

/** A plain every-one-unit rule. Weekly follows the item's own weekday. */
export const presetRule = (unit: RepeatUnit, until: string | null = null): ScheduleRepeat => ({
  unit,
  every: 1,
  weekdays: [],
  until,
  skip: [],
})

/**
 * Which preset a rule is, if any. A weekly rule picked out on its own weekday
 * alone is still plain "every week" — it is what the custom panel writes when
 * nobody changed the day.
 */
export function choiceOf(rule: ScheduleRepeat | null, date: string): RepeatChoice {
  if (!rule) return 'never'
  if (rule.every !== 1) return 'custom'
  if (rule.unit === 'week' && rule.weekdays.length > 0) {
    return rule.weekdays.length === 1 && rule.weekdays[0] === weekdayOf(date) ? 'week' : 'custom'
  }
  return rule.unit
}

/** How the preset reads in the menu, with the part that depends on the date. */
export function presetLabel(unit: RepeatUnit, date: string): string {
  if (unit === 'day') return 'Every day'
  if (unit === 'week') return `Every week on ${WEEKDAY_NAMES[weekdayOf(date)]}`
  if (unit === 'month') return `Every month on the ${ordinal(fromISO(date).getDate())}`
  return `Every year on ${shortDate(date)}`
}
