/**
 * Where the records actually live: this browser.
 *
 * There is no server. Everything is kept in one localStorage key and read back
 * whole — a personal schedule is kilobytes, not megabytes, so there is nothing
 * to gain from anything cleverer. The schedule functions are async only so the
 * screens do not care that the data is local; a Drive-backed or server-backed
 * store could replace this file without touching a single component.
 *
 * The one thing to understand: **this is one copy, in one browser.** Clearing
 * site data clears it. Export and the Drive sync in More are what make that
 * survivable.
 */

import { useSyncExternalStore } from 'react'
import { DEFAULT_TAGS, makeTagId } from './tags'
import type { Reminder, ReminderDraft, ScheduleDraft, ScheduleItem, Tag } from '../types'

const KEY = 'scheduleplan:v1'

/** The envelope Export writes and Import/Drive read. Also the on-disk shape. */
export const FORMAT = 'scheduleplan.backup'

export interface Snapshot {
  format: typeof FORMAT
  version: 1
  savedAt: string
  schedule: ScheduleItem[]
  tags: Tag[]
  reminders: Reminder[]
}

interface DB {
  schedule: ScheduleItem[]
  tags: Tag[]
  reminders: Reminder[]
}

/**
 * Read once, keep it. Rows are rendered often enough that re-parsing the whole
 * store per row would be silly, and a stable object is also what lets React's
 * useSyncExternalStore tell "unchanged" from "changed".
 */
let cache: DB | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function readDb(): DB {
  if (cache) return cache
  let parsed: Partial<Snapshot> | null = null
  try {
    const raw = localStorage.getItem(KEY)
    parsed = raw ? (JSON.parse(raw) as Partial<Snapshot>) : null
  } catch {
    // Unreadable or blocked storage behaves like an empty app rather than
    // taking the whole thing down.
    parsed = null
  }
  cache = {
    schedule: Array.isArray(parsed?.schedule) ? parsed.schedule : [],
    // Backups written before tags were editable have no tags at all.
    tags: Array.isArray(parsed?.tags) && parsed.tags.length ? parsed.tags : DEFAULT_TAGS,
    reminders: Array.isArray(parsed?.reminders) ? parsed.reminders : [],
  }
  return cache
}

function writeDb(db: DB): void {
  const snapshot: Snapshot = { format: FORMAT, version: 1, savedAt: new Date().toISOString(), ...db }
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    throw new Error("Couldn't save. This browser's storage is full or blocked.")
  }
  cache = db
  listeners.forEach((listener) => listener())
}

/** Rejects 31 February and friends, which a regex alone lets through. */
function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
}

// ---------------------------------------------------------------- schedule

function cleanScheduleDraft(draft: ScheduleDraft): ScheduleDraft {
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
    return readDb()
      .schedule.filter((item) => item.date >= start && item.date <= end)
      .sort(byTimeline)
  },

  async createSchedule(draft: ScheduleDraft): Promise<ScheduleItem> {
    const db = readDb()
    const item: ScheduleItem = { id: nextId(db.schedule), ...cleanScheduleDraft(draft) }
    writeDb({ ...db, schedule: [...db.schedule, item] })
    return item
  },

  async updateSchedule(id: number, draft: ScheduleDraft): Promise<ScheduleItem> {
    const db = readDb()
    if (!db.schedule.some((item) => item.id === id)) {
      throw new Error('That schedule item no longer exists.')
    }
    const updated: ScheduleItem = { id, ...cleanScheduleDraft(draft) }
    writeDb({ ...db, schedule: db.schedule.map((item) => (item.id === id ? updated : item)) })
    return updated
  },

  async deleteSchedule(id: number): Promise<void> {
    const db = readDb()
    if (!db.schedule.some((item) => item.id === id)) {
      throw new Error('That schedule item no longer exists.')
    }
    writeDb({ ...db, schedule: db.schedule.filter((item) => item.id !== id) })
  },
}

// -------------------------------------------------------------------- tags

export function useTags(): Tag[] {
  return useSyncExternalStore(subscribe, () => readDb().tags)
}

/**
 * One emoji, kept whole. Splitting by code point would tear the variation
 * selector off things like the weightlifter, and mangle flags and skin tones
 * worse than that.
 */
function firstEmoji(input: string): string {
  const text = input.trim()
  if (!text) return '📌'
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...segmenter.segment(text)][0]?.segment ?? '📌'
  }
  return [...text][0] ?? '📌'
}

function cleanTag(label: string, emoji: string): { label: string; emoji: string } {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Give the tag a name.')
  if (trimmed.length > 20) throw new Error('That name is too long for a chip.')
  return { label: trimmed, emoji: firstEmoji(emoji) }
}

export function createTag(label: string, emoji: string): Tag {
  const db = readDb()
  const clean = cleanTag(label, emoji)
  if (db.tags.some((tag) => tag.label.toLowerCase() === clean.label.toLowerCase())) {
    throw new Error(`There is already a "${clean.label}" tag.`)
  }
  const tag: Tag = { id: makeTagId(clean.label, db.tags.map((t) => t.id)), ...clean }
  writeDb({ ...db, tags: [...db.tags, tag] })
  return tag
}

export function updateTag(id: string, label: string, emoji: string): Tag {
  const db = readDb()
  const clean = cleanTag(label, emoji)
  if (
    db.tags.some(
      (tag) => tag.id !== id && tag.label.toLowerCase() === clean.label.toLowerCase(),
    )
  ) {
    throw new Error(`There is already a "${clean.label}" tag.`)
  }
  const updated: Tag = { id, ...clean }
  writeDb({ ...db, tags: db.tags.map((tag) => (tag.id === id ? updated : tag)) })
  return updated
}

/** How many schedule items would lose their tag if this one went. */
export function tagUsage(id: string): number {
  return readDb().schedule.filter((item) => item.tag === id).length
}

/**
 * Delete a tag, and untag anything using it. The items themselves are never
 * deleted — losing an appointment because a label was tidied up would be a
 * nasty surprise.
 */
export function deleteTag(id: string): number {
  const db = readDb()
  let cleared = 0
  const schedule = db.schedule.map((item) => {
    if (item.tag !== id) return item
    cleared += 1
    return { ...item, tag: null }
  })
  writeDb({ ...db, tags: db.tags.filter((tag) => tag.id !== id), schedule })
  return cleared
}

// --------------------------------------------------------------- reminders

export function useReminders(): Reminder[] {
  return useSyncExternalStore(subscribe, () => readDb().reminders)
}

function cleanReminderDraft(draft: ReminderDraft): ReminderDraft {
  const title = draft.title.trim()
  if (!title) throw new Error('Please give this a title.')
  if (!isRealDate(draft.date)) throw new Error('That date is not a real date.')
  if (!/^\d{2}:\d{2}$/.test(draft.time)) throw new Error('The time needs to look like 18:30.')
  return { title, date: draft.date, time: draft.time, notes: draft.notes?.trim() || null }
}

export const byDue = (a: Reminder, b: Reminder) =>
  a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id

export function createReminder(draft: ReminderDraft): Reminder {
  const db = readDb()
  const reminder: Reminder = {
    id: nextId(db.reminders),
    ...cleanReminderDraft(draft),
    done: false,
  }
  writeDb({ ...db, reminders: [...db.reminders, reminder] })
  return reminder
}

export function updateReminder(id: number, draft: ReminderDraft): Reminder {
  const db = readDb()
  const existing = db.reminders.find((reminder) => reminder.id === id)
  if (!existing) throw new Error('That reminder no longer exists.')
  const updated: Reminder = { ...existing, ...cleanReminderDraft(draft) }
  writeDb({
    ...db,
    reminders: db.reminders.map((reminder) => (reminder.id === id ? updated : reminder)),
  })
  return updated
}

export function toggleReminder(id: number): void {
  const db = readDb()
  writeDb({
    ...db,
    reminders: db.reminders.map((reminder) =>
      reminder.id === id ? { ...reminder, done: !reminder.done } : reminder,
    ),
  })
}

export function deleteReminder(id: number): void {
  const db = readDb()
  writeDb({ ...db, reminders: db.reminders.filter((reminder) => reminder.id !== id) })
}

// ------------------------------------------------------------------ backup

/** Everything, for Export and for the Drive copy. */
export function snapshot(): Snapshot {
  const db = readDb()
  return {
    format: FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    schedule: [...db.schedule].sort(byTimeline),
    tags: db.tags,
    reminders: [...db.reminders].sort(byDue),
  }
}

export function itemCount(): number {
  const db = readDb()
  return db.schedule.length + db.reminders.length
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
      tag: typeof item.tag === 'string' ? item.tag : null,
    })
  }

  const tags: Tag[] = Array.isArray(data.tags)
    ? data.tags.filter(
        (tag): tag is Tag =>
          !!tag && typeof tag.id === 'string' && typeof tag.label === 'string',
      )
    : []

  const reminders: Reminder[] = Array.isArray(data.reminders)
    ? data.reminders
        .filter(
          (reminder): reminder is Reminder =>
            !!reminder &&
            typeof reminder.title === 'string' &&
            typeof reminder.date === 'string',
        )
        .map((reminder, index) => ({
          id: typeof reminder.id === 'number' ? reminder.id : index + 1,
          title: reminder.title,
          date: reminder.date,
          time: typeof reminder.time === 'string' ? reminder.time : '09:00',
          notes: typeof reminder.notes === 'string' ? reminder.notes : null,
          done: reminder.done === true,
        }))
    : []

  writeDb({
    schedule: schedule.sort(byTimeline),
    tags: tags.length ? tags : DEFAULT_TAGS,
    reminders: reminders.sort(byDue),
  })
  return schedule.length + reminders.length
}
