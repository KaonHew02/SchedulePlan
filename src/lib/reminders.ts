/**
 * When a reminder is actually due.
 *
 * A reminder used to be one moment. It can now be a stretch — "bring a
 * raincoat" from the 15th until the 20th — and it can come back each day or
 * each week inside that stretch. That turns "is it due?" from a comparison
 * into a small amount of arithmetic, which lives here rather than in the
 * screen that draws it.
 *
 * None of this schedules anything with the operating system. There is no
 * server and no service worker, so an alert can only fire while the tab is
 * open, and the Reminders screen says so out loud rather than letting anyone
 * assume otherwise.
 */

import { addDays, relativeDay, shortDate, todayISO } from './date'
import type { Reminder } from '../types'

export const at = (date: string, time: string): number => new Date(`${date}T${time}`).getTime()

/** The last day this reminder applies to. */
export const untilDate = (reminder: Reminder): string => reminder.end_date ?? reminder.date

/** The moment it stops applying. */
export const endsAt = (reminder: Reminder): number =>
  at(untilDate(reminder), reminder.end_time ?? reminder.time)

/** Every day this reminder should speak up on, first to last. */
export function occurrenceDays(reminder: Reminder): string[] {
  const last = untilDate(reminder)
  if (reminder.repeat === 'none') return [reminder.date]

  const step = reminder.repeat === 'weekly' ? 7 : 1
  const days: string[] = []
  // Capped so a typo in the until date cannot spin here forever.
  for (let day = reminder.date; day <= last && days.length < 400; day = addDays(day, step)) {
    days.push(day)
  }
  return days
}

/**
 * The next time it is due at or after `from`, or null once it is finished.
 *
 * For a one-off this is simply its own moment, which may well be in the past —
 * that is what makes it overdue rather than gone.
 */
export function nextDue(reminder: Reminder, from: number): number | null {
  if (reminder.repeat === 'none') return at(reminder.date, reminder.time)
  for (const day of occurrenceDays(reminder)) {
    const moment = at(day, reminder.time)
    if (moment >= from) return moment
  }
  return null
}

/** What the list sorts and groups by: the next one, or the last if it is over. */
export function dueAt(reminder: Reminder, from = Date.now()): number {
  return nextDue(reminder, from) ?? at(untilDate(reminder), reminder.time)
}

/** Inside its window right now — a range reminder that is currently standing. */
export function isActive(reminder: Reminder, now = Date.now()): boolean {
  return now >= at(reminder.date, reminder.time) && now <= endsAt(reminder)
}

export const isRange = (reminder: Reminder): boolean =>
  Boolean(reminder.end_date && reminder.end_date > reminder.date)

const REPEAT_WORD: Record<Reminder['repeat'], string> = {
  none: '',
  daily: 'Every day',
  weekly: 'Every week',
}

/**
 * 'Today 14:00', '15 Sep 21:30 → 20 Sep', 'Every day 09:00 until 20 Sep'.
 *
 * The shape changes with the reminder because the useful fact changes with
 * it: for a one-off that is when, for a window that is how long, and for a
 * repeat that is how often and when it stops.
 */
export function dueLabel(reminder: Reminder): string {
  const relative = relativeDay(reminder.date)
  const start = ['Today', 'Tomorrow', 'Yesterday'].includes(relative)
    ? relative
    : shortDate(reminder.date)

  if (reminder.repeat !== 'none') {
    return `${REPEAT_WORD[reminder.repeat]} ${reminder.time} until ${shortDate(untilDate(reminder))}`
  }
  if (isRange(reminder)) {
    const end = shortDate(untilDate(reminder))
    return `${start} ${reminder.time} → ${end}${reminder.end_time ? ` ${reminder.end_time}` : ''}`
  }
  if (reminder.end_time) return `${start} ${reminder.time} – ${reminder.end_time}`
  return `${start} ${reminder.time}`
}

/** Which section of the list this belongs in. */
export function groupOf(reminder: Reminder, now = Date.now()): 'overdue' | 'today' | 'upcoming' {
  if (reminder.done) return 'today'
  const today = todayISO()

  // A window that is still open is happening now, however long ago it opened.
  if (isRange(reminder) && isActive(reminder, now)) return 'today'
  if (now > endsAt(reminder)) return 'overdue'

  const next = nextDue(reminder, now)
  if (next === null) return 'overdue'
  if (next < now) return 'overdue'

  const day = new Date(next)
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
    day.getDate(),
  ).padStart(2, '0')}`
  return iso === today ? 'today' : 'upcoming'
}
