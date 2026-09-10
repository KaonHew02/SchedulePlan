/**
 * Where the records actually live: this browser.
 *
 * There is no server. Everything is kept in one localStorage key and read back
 * whole — a personal schedule is kilobytes, not megabytes, so there is nothing
 * to gain from anything cleverer. The functions are async only so the screens
 * do not care that the data is local; a Drive-backed or server-backed store
 * could replace this file without touching a single component.
 *
 * The one thing to understand: **this is one copy, in one browser.** Clearing
 * site data clears the schedule. Export and the Drive sync in More are what
 * make that survivable.
 */

import type { ScheduleDraft, ScheduleItem } from '../types'

const KEY = 'scheduleplan:v1'

/** The envelope Export writes and Import/Drive read. Also the on-disk shape. */
export const FORMAT = 'scheduleplan.backup'

export interface Snapshot {
  format: typeof FORMAT
  version: 1
  savedAt: string
  schedule: ScheduleItem[]
}

function read(): ScheduleItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const schedule = (parsed as Snapshot | null)?.schedule
    return Array.isArray(schedule) ? schedule : []
  } catch {
    // Unreadable or blocked storage behaves like an empty schedule rather than
    // taking the whole app down.
    return []
  }
}

function write(schedule: ScheduleItem[]): void {
  const snapshot: Snapshot = {
    format: FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    schedule,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    throw new Error("Couldn't save. This browser's storage is full or blocked.")
  }
}

/** Rejects 31 February and friends, which a regex alone lets through. */
function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

/** The rules the API used to enforce, kept in one place now that it is gone. */
function clean(draft: ScheduleDraft): ScheduleDraft {
  const title = draft.title.trim()
  if (!title) throw new Error('Please give this a title.')
  if (!isRealDate(draft.date)) throw new Error('That date is not a real date.')
  if (!/^\d{2}:\d{2}$/.test(draft.start_time)) {
    throw new Error('The start needs to be a time like 18:30.')
  }
  if (draft.end_time && draft.end_time <= draft.start_time) {
    throw new Error('End time must be after the start time.')
  }
  return {
    date: draft.date,
    start_time: draft.start_time,
    end_time: draft.end_time || null,
    title,
    location: draft.location?.trim() || null,
    notes: draft.notes?.trim() || null,
    tag: draft.tag ?? null,
  }
}

const byTimeline = (a: ScheduleItem, b: ScheduleItem) =>
  a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.id - b.id

export const store = {
  /** Items in a date range, in the order the timeline shows them. */
  async listSchedule(start: string, end: string): Promise<ScheduleItem[]> {
    return read()
      .filter((item) => item.date >= start && item.date <= end)
      .sort(byTimeline)
  },

  async createSchedule(draft: ScheduleDraft): Promise<ScheduleItem> {
    const schedule = read()
    const item: ScheduleItem = {
      id: schedule.reduce((max, existing) => Math.max(max, existing.id), 0) + 1,
      ...clean(draft),
    }
    write([...schedule, item])
    return item
  },

  async updateSchedule(id: number, draft: ScheduleDraft): Promise<ScheduleItem> {
    const schedule = read()
    const index = schedule.findIndex((item) => item.id === id)
    if (index === -1) throw new Error('That schedule item no longer exists.')
    const updated: ScheduleItem = { id, ...clean(draft) }
    schedule[index] = updated
    write(schedule)
    return updated
  },

  async deleteSchedule(id: number): Promise<void> {
    const schedule = read()
    if (!schedule.some((item) => item.id === id)) {
      throw new Error('That schedule item no longer exists.')
    }
    write(schedule.filter((item) => item.id !== id))
  },
}

/** Everything, for Export and for the Drive copy. */
export function snapshot(): Snapshot {
  return {
    format: FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    schedule: read().sort(byTimeline),
  }
}

export function itemCount(): number {
  return read().length
}

/**
 * Replace everything with a snapshot. Replace rather than merge: merging two
 * schedules means guessing which entries are the same, and guessing wrong
 * quietly duplicates a day. The caller is expected to have said so first.
 */
export function restore(candidate: unknown): number {
  const data = candidate as Partial<Snapshot> | null
  if (!data || typeof data !== 'object' || !Array.isArray(data.schedule)) {
    throw new Error("That file isn't a SchedulePlan backup.")
  }
  if (data.format && data.format !== FORMAT) {
    throw new Error(`That file is a ${data.format} backup, not a SchedulePlan one.`)
  }

  const schedule: ScheduleItem[] = []
  for (const [index, raw] of data.schedule.entries()) {
    const item = raw as Partial<ScheduleItem>
    if (!item || typeof item.title !== 'string' || typeof item.date !== 'string') {
      throw new Error(`Entry ${index + 1} in that file is missing a title or a date.`)
    }
    schedule.push({
      id: typeof item.id === 'number' ? item.id : index + 1,
      date: item.date,
      start_time: typeof item.start_time === 'string' ? item.start_time : '00:00',
      end_time: typeof item.end_time === 'string' ? item.end_time : null,
      title: item.title,
      location: typeof item.location === 'string' ? item.location : null,
      notes: typeof item.notes === 'string' ? item.notes : null,
      tag: item.tag ?? null,
    })
  }

  write(schedule.sort(byTimeline))
  return schedule.length
}
