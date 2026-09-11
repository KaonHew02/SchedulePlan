/**
 * Where the records actually live: this browser.
 *
 * There is no server. The whole notebook is one document in IndexedDB, read
 * into memory once at startup and written back whenever it changes. Reads are
 * therefore synchronous and cheap — a personal schedule is kilobytes — while
 * writes go to disk in the background.
 *
 * Attachment *bytes* are the exception: they live one-per-key in a separate
 * store (see files.ts) so a photo is never parsed just because a row rendered.
 *
 * The one thing to understand: **this is one copy, in one browser.** Clearing
 * site data clears it. Export and the Drive copy in More are what make that
 * survivable.
 */

import { useSyncExternalStore } from 'react'
import { DB_KEY, RECORDS, idbGet, idbPut, persist } from './idb'
import { deleteFiles, readFileAsDataUrl, writeFileFromDataUrl } from './files'
import { divideCents } from './split'
import { DEFAULT_CATEGORIES, DEFAULT_TAGS, makeTagId } from './tags'
import type {
  Attachment,
  BillSplit,
  Expense,
  ExpenseDraft,
  Reminder,
  ReminderDraft,
  ScheduleDraft,
  ScheduleItem,
  Settings,
  SplitLine,
  SplitPerson,
  Tag,
  WishPlace,
} from '../types'

/** A split entry as it was saved before lines existed. Only `fillSplit` reads it. */
interface LegacyEntry {
  label?: string
  amount?: number
  paidBy?: string
  shares?: string[]
  custom?: Record<string, number> | null
}

/** The old home. Read once, on first run after the move, then left alone. */
const LEGACY_KEY = 'scheduleplan:v1'

/** The envelope Export writes and Import/Drive read. Also the on-disk shape. */
export const FORMAT = 'scheduleplan.backup'

/** One attachment's bytes, inlined for a backup file. */
export interface FilePayload {
  id: string
  dataUrl: string
}

export interface Snapshot {
  format: typeof FORMAT
  version: 2
  savedAt: string
  schedule: ScheduleItem[]
  expenses: Expense[]
  tags: Tag[]
  categories: Tag[]
  reminders: Reminder[]
  splits: BillSplit[]
  wishlist: WishPlace[]
  settings: Settings
  /** Present in a full export; absent when only the records were wanted. */
  files?: FilePayload[]
}

interface DB {
  schedule: ScheduleItem[]
  expenses: Expense[]
  tags: Tag[]
  categories: Tag[]
  reminders: Reminder[]
  splits: BillSplit[]
  wishlist: WishPlace[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'MYR',
  autoDrive: false,
  lastDriveSync: null,
  manualRates: {},
  travelGoal: 50,
}

const EMPTY: DB = {
  schedule: [],
  expenses: [],
  tags: DEFAULT_TAGS,
  categories: DEFAULT_CATEGORIES,
  reminders: [],
  splits: [],
  wishlist: [],
  settings: DEFAULT_SETTINGS,
}

let cache: DB = EMPTY
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

// -------------------------------------------------------------- save state

/** What the backup bar reads: when it last landed on disk, and what went wrong. */
export interface SaveState {
  savedAt: string | null
  saving: boolean
  error: string | null
}

let saveState: SaveState = { savedAt: null, saving: false, error: null }

function setSaveState(next: Partial<SaveState>): void {
  saveState = { ...saveState, ...next }
  notify()
}

export function useSaveState(): SaveState {
  return useSyncExternalStore(subscribe, () => saveState)
}

/** Fires after every successful write, so Drive autosave can hook in. */
const afterSave = new Set<() => void>()

export function onSaved(handler: () => void): () => void {
  afterSave.add(handler)
  return () => afterSave.delete(handler)
}

// ---------------------------------------------------------------- start up

/**
 * Backups written before multi-day items existed have no end_date and no
 * all_day. Reading one must not produce an item the rest of the app then has
 * to null-check forever, so the gaps are filled here, once.
 */
function fillItem(raw: Partial<ScheduleItem>, index = 0): ScheduleItem {
  return {
    id: typeof raw.id === 'number' ? raw.id : index + 1,
    date: String(raw.date ?? ''),
    end_date: typeof raw.end_date === 'string' ? raw.end_date : null,
    all_day: raw.all_day === true,
    start_time: typeof raw.start_time === 'string' ? raw.start_time : '00:00',
    end_time: typeof raw.end_time === 'string' ? raw.end_time : null,
    title: String(raw.title ?? ''),
    location: typeof raw.location === 'string' ? raw.location : null,
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    tag: typeof raw.tag === 'string' ? raw.tag : null,
    // Backups from before Travel existed have no place at all.
    place:
      raw.place && typeof raw.place.country === 'string'
        ? { country: raw.place.country, city: raw.place.city ?? null }
        : null,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  }
}

function fillReminder(raw: Partial<Reminder>, index = 0): Reminder {
  return {
    id: typeof raw.id === 'number' ? raw.id : index + 1,
    title: String(raw.title ?? ''),
    date: String(raw.date ?? ''),
    time: typeof raw.time === 'string' ? raw.time : '09:00',
    end_date: typeof raw.end_date === 'string' ? raw.end_date : null,
    end_time: typeof raw.end_time === 'string' ? raw.end_time : null,
    repeat: raw.repeat === 'daily' || raw.repeat === 'weekly' ? raw.repeat : 'none',
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    done: raw.done === true,
  }
}

function fillExpense(raw: Partial<Expense>, index = 0): Expense {
  return {
    id: typeof raw.id === 'number' ? raw.id : index + 1,
    date: String(raw.date ?? ''),
    title: String(raw.title ?? ''),
    amount: Number(raw.amount) || 0,
    currency: typeof raw.currency === 'string' ? raw.currency : DEFAULT_SETTINGS.currency,
    category: typeof raw.category === 'string' ? raw.category : null,
    original_amount: typeof raw.original_amount === 'number' ? raw.original_amount : null,
    original_currency: typeof raw.original_currency === 'string' ? raw.original_currency : null,
    exchange_rate: typeof raw.exchange_rate === 'number' ? raw.exchange_rate : null,
    schedule_id: typeof raw.schedule_id === 'number' ? raw.schedule_id : null,
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  }
}

/**
 * Read a split forward.
 *
 * Two migrations live here, and the second is the one that matters. Splits
 * saved before a share could be pushed into the spending list have neither
 * link field. Splits saved before 2026-09-11 held **entries** — an item, who
 * paid for it and who shared it — rather than lines under the person who had
 * it, because the model was "divide this item" and is now "what did each
 * person have".
 *
 * A saved bill is a record, so every old shape is turned into the lines that
 * come to the same figures rather than being dropped:
 *
 *   split by exact amounts   one line per person, for their own amount
 *   shared by everyone       one line on the shared card
 *   shared by some of them   one line each, for their part of it
 *
 * Who paid moves from the item to the bill — whoever fronted the most is
 * taken as the payer, which with one payer (nearly every old split) is simply
 * who it always was.
 */
function fillSplit(raw: Partial<BillSplit> & { entries?: LegacyEntry[] }, index = 0): BillSplit {
  const people: SplitPerson[] = Array.isArray(raw.people) ? raw.people : []
  const ids = people.map((person) => person.id)

  let lines: SplitLine[] = Array.isArray(raw.lines) ? raw.lines : []
  let paidBy = typeof raw.paidBy === 'string' ? raw.paidBy : ''

  if (!Array.isArray(raw.lines) && Array.isArray(raw.entries)) {
    const converted: SplitLine[] = []
    const fronted = new Map<string, number>()
    let next = 1
    const push = (label: string, amount: number, person: string | null) => {
      converted.push({ id: `l${next++}`, label, amount, person })
    }

    for (const entry of raw.entries) {
      const amount = Number(entry?.amount) || 0
      const label = String(entry?.label ?? '')
      if (entry?.paidBy) fronted.set(entry.paidBy, (fronted.get(entry.paidBy) ?? 0) + amount)

      if (entry?.custom) {
        for (const [id, value] of Object.entries(entry.custom)) {
          if (ids.includes(id) && value) push(label, Number(value) || 0, id)
        }
        continue
      }

      const sharers = Array.isArray(entry?.shares) && entry.shares.length
        ? entry.shares.filter((id) => ids.includes(id))
        : ids
      if (sharers.length === 0 || sharers.length === ids.length) {
        push(label, amount, null)
        continue
      }
      const parts = divideCents(Math.round(amount * 100), sharers.length)
      sharers.forEach((id, part) => push(label, parts[part] / 100, id))
    }

    lines = converted
    if (!paidBy) {
      paidBy = [...fronted.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    }
  }

  return {
    id: typeof raw.id === 'number' ? raw.id : index + 1,
    title: String(raw.title ?? ''),
    date: String(raw.date ?? ''),
    currency: typeof raw.currency === 'string' ? raw.currency : DEFAULT_SETTINGS.currency,
    people,
    lines,
    paidBy: ids.includes(paidBy) ? paidBy : (ids[0] ?? ''),
    expense_id: typeof raw.expense_id === 'number' ? raw.expense_id : null,
    expense_person: typeof raw.expense_person === 'string' ? raw.expense_person : null,
  }
}

function coerce(parsed: Partial<Snapshot> | null): DB {
  return {
    schedule: Array.isArray(parsed?.schedule) ? parsed.schedule.map(fillItem) : [],
    expenses: Array.isArray(parsed?.expenses) ? parsed.expenses.map(fillExpense) : [],
    tags: Array.isArray(parsed?.tags) && parsed.tags.length ? parsed.tags : DEFAULT_TAGS,
    categories:
      Array.isArray(parsed?.categories) && parsed.categories.length
        ? parsed.categories
        : DEFAULT_CATEGORIES,
    reminders: Array.isArray(parsed?.reminders) ? parsed.reminders.map(fillReminder) : [],
    splits: Array.isArray(parsed?.splits) ? parsed.splits.map(fillSplit) : [],
    wishlist: Array.isArray(parsed?.wishlist) ? parsed.wishlist : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed?.settings ?? {}) },
  }
}

/**
 * Hydrate before the first render. main.tsx waits on this: rendering an empty
 * notebook and then filling it in makes a returning user think they lost it.
 */
export async function initStore(): Promise<void> {
  let stored: Partial<Snapshot> | undefined
  try {
    stored = await idbGet<Partial<Snapshot>>(RECORDS, DB_KEY)
  } catch {
    // A browser that refuses its own database still gets a working app for
    // this session; nothing will survive the reload, and More says so.
    stored = undefined
  }

  if (!stored) {
    // First run since the move off localStorage — carry the old notebook over.
    try {
      const raw = localStorage.getItem(LEGACY_KEY)
      if (raw) {
        cache = coerce(JSON.parse(raw) as Partial<Snapshot>)
        notify()
        void persist()
        await flush()
        // The old copy is left in place on purpose. It costs a few kilobytes
        // and it is the only way back if this migration got something wrong.
        return
      }
    } catch {
      /* Unreadable legacy data is the same as none. */
    }
  }

  cache = coerce(stored ?? null)
  saveState = { savedAt: stored?.savedAt ?? null, saving: false, error: null }
  notify()
  void persist()
}

// ------------------------------------------------------------------ writing

function toDocument(db: DB): Snapshot {
  return {
    format: FORMAT,
    version: 2,
    savedAt: new Date().toISOString(),
    schedule: db.schedule,
    expenses: db.expenses,
    tags: db.tags,
    categories: db.categories,
    reminders: db.reminders,
    splits: db.splits,
    wishlist: db.wishlist,
    settings: db.settings,
  }
}

async function flush(): Promise<void> {
  const document = toDocument(cache)
  setSaveState({ saving: true })
  try {
    await idbPut(RECORDS, DB_KEY, document)
    setSaveState({ savedAt: document.savedAt, saving: false, error: null })
    afterSave.forEach((handler) => handler())
  } catch (err) {
    setSaveState({
      saving: false,
      error: err instanceof Error ? err.message : 'Could not save to this browser.',
    })
    throw err
  }
}

/**
 * Apply a change: memory first so the screen is never behind the tap, disk
 * straight after. A failed write leaves the change on screen and the error in
 * the backup bar, which is the honest order — pretending the tap never
 * happened would be worse than saying it did not stick.
 */
function writeDb(next: DB): Promise<void> {
  cache = next
  notify()
  return flush()
}

const readDb = (): DB => cache

/** Rejects 31 February and friends, which a regex alone lets through. */
function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const isTime = (value: string) => /^\d{2}:\d{2}$/.test(value)

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
}

const orphaned = (before: Attachment[], after: Attachment[]): string[] => {
  const kept = new Set(after.map((file) => file.id))
  return before.filter((file) => !kept.has(file.id)).map((file) => file.id)
}

// ----------------------------------------------------------------- schedule

/** The last day an item covers — its own date when it does not span. */
export const lastDay = (item: ScheduleItem): string => item.end_date ?? item.date

/** Does this item sit on this day at all? True for every day a trip covers. */
export const occupies = (item: ScheduleItem, day: string): boolean =>
  item.date <= day && lastDay(item) >= day

export const spansDays = (item: ScheduleItem): boolean =>
  item.end_date !== null && item.end_date > item.date

function cleanScheduleDraft(draft: ScheduleDraft): ScheduleDraft {
  const title = draft.title.trim()
  if (!title) throw new Error('Please give this a title.')
  if (!isRealDate(draft.date)) throw new Error('That date is not a real date.')

  const endDate = draft.end_date && draft.end_date !== draft.date ? draft.end_date : null
  if (endDate) {
    if (!isRealDate(endDate)) throw new Error('That end date is not a real date.')
    if (endDate < draft.date) throw new Error('The end date is before the start date.')
  }

  // A whole-day item keeps a start time so sorting still works, but nothing
  // reads it and nothing validates it.
  const start = draft.all_day ? '00:00' : draft.start_time
  if (!draft.all_day && !isTime(start)) {
    throw new Error('The start needs to be a time like 18:30.')
  }
  const end = draft.all_day ? null : draft.end_time || null
  if (end && !isTime(end)) throw new Error('The end needs to be a time like 20:00.')
  // Only meaningful within one day. On a trip, 09:00 on the last day is
  // perfectly sensible even though it reads as "before" a 14:00 start.
  if (end && !endDate && end <= start) {
    throw new Error('End time must be after the start time.')
  }

  return {
    date: draft.date,
    end_date: endDate,
    all_day: draft.all_day,
    start_time: start,
    end_time: end,
    title,
    location: draft.location?.trim() || null,
    notes: draft.notes?.trim() || null,
    tag: draft.tag ?? null,
    place: draft.place?.country
      ? { country: draft.place.country.toUpperCase(), city: draft.place.city?.trim() || null }
      : null,
    attachments: draft.attachments ?? [],
  }
}

/** Whole-day things sort above timed ones, then by time. */
const byTimeline = (a: ScheduleItem, b: ScheduleItem) =>
  a.date.localeCompare(b.date) ||
  Number(b.all_day) - Number(a.all_day) ||
  a.start_time.localeCompare(b.start_time) ||
  a.id - b.id

export function useSchedule(): ScheduleItem[] {
  return useSyncExternalStore(subscribe, () => readDb().schedule)
}

/** Items touching a date range, in the order the timeline shows them. */
export function inRange(items: ScheduleItem[], start: string, end: string): ScheduleItem[] {
  return items.filter((item) => item.date <= end && lastDay(item) >= start).sort(byTimeline)
}

/** Items on one day, spanning ones included, in timeline order. */
export function onDay(items: ScheduleItem[], day: string): ScheduleItem[] {
  return items.filter((item) => occupies(item, day)).sort(byTimeline)
}

export const store = {
  async createSchedule(draft: ScheduleDraft): Promise<ScheduleItem> {
    const db = readDb()
    const item: ScheduleItem = { id: nextId(db.schedule), ...cleanScheduleDraft(draft) }
    await writeDb({ ...db, schedule: [...db.schedule, item] })
    return item
  },

  async updateSchedule(id: number, draft: ScheduleDraft): Promise<ScheduleItem> {
    const db = readDb()
    const existing = db.schedule.find((item) => item.id === id)
    if (!existing) throw new Error('That schedule item no longer exists.')
    const updated: ScheduleItem = { id, ...cleanScheduleDraft(draft) }
    await writeDb({
      ...db,
      schedule: db.schedule.map((item) => (item.id === id ? updated : item)),
    })
    // Anything the edit dropped is now unreachable, so let the bytes go.
    void deleteFiles(orphaned(existing.attachments, updated.attachments))
    return updated
  },

  async deleteSchedule(id: number): Promise<void> {
    const db = readDb()
    const existing = db.schedule.find((item) => item.id === id)
    if (!existing) throw new Error('That schedule item no longer exists.')
    await writeDb({
      ...db,
      schedule: db.schedule.filter((item) => item.id !== id),
      // An expense keeps its own life; it just stops pointing at a gap.
      expenses: db.expenses.map((expense) =>
        expense.schedule_id === id ? { ...expense, schedule_id: null } : expense,
      ),
    })
    void deleteFiles(existing.attachments.map((file) => file.id))
  },
}

// ----------------------------------------------------------------- expenses

export function useExpenses(): Expense[] {
  return useSyncExternalStore(subscribe, () => readDb().expenses)
}

/** Newest first — the order a spending list is actually read in. */
export const byNewest = (a: { date: string; id: number }, b: { date: string; id: number }) =>
  b.date.localeCompare(a.date) || b.id - a.id

function cleanExpenseDraft(draft: ExpenseDraft): ExpenseDraft {
  const title = draft.title.trim()
  if (!title) throw new Error('What was it for?')
  if (!isRealDate(draft.date)) throw new Error('That date is not a real date.')
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    throw new Error('Enter an amount above zero.')
  }
  return {
    date: draft.date,
    title,
    // Money is rounded once, here, so no total drifts by a fraction of a cent
    // that nobody can see but every sum can feel.
    amount: Math.round(draft.amount * 100) / 100,
    currency: draft.currency,
    category: draft.category ?? null,
    original_amount: draft.original_amount ?? null,
    original_currency: draft.original_currency ?? null,
    exchange_rate: draft.exchange_rate ?? null,
    schedule_id: draft.schedule_id ?? null,
    notes: draft.notes?.trim() || null,
    attachments: draft.attachments ?? [],
  }
}

export async function createExpense(draft: ExpenseDraft): Promise<Expense> {
  const db = readDb()
  const expense: Expense = { id: nextId(db.expenses), ...cleanExpenseDraft(draft) }
  await writeDb({ ...db, expenses: [...db.expenses, expense] })
  return expense
}

export async function updateExpense(id: number, draft: ExpenseDraft): Promise<Expense> {
  const db = readDb()
  const existing = db.expenses.find((expense) => expense.id === id)
  if (!existing) throw new Error('That expense no longer exists.')
  const updated: Expense = { id, ...cleanExpenseDraft(draft) }
  await writeDb({
    ...db,
    expenses: db.expenses.map((expense) => (expense.id === id ? updated : expense)),
  })
  void deleteFiles(orphaned(existing.attachments, updated.attachments))
  return updated
}

export async function deleteExpense(id: number): Promise<void> {
  const db = readDb()
  const existing = db.expenses.find((expense) => expense.id === id)
  if (!existing) throw new Error('That expense no longer exists.')
  await writeDb({ ...db, expenses: db.expenses.filter((expense) => expense.id !== id) })
  void deleteFiles(existing.attachments.map((file) => file.id))
}

// -------------------------------------------------------- tags & categories

export function useTags(): Tag[] {
  return useSyncExternalStore(subscribe, () => readDb().tags)
}

export function useCategories(): Tag[] {
  return useSyncExternalStore(subscribe, () => readDb().categories)
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
  if (!trimmed) throw new Error('Give it a name.')
  if (trimmed.length > 20) throw new Error('That name is too long for a chip.')
  return { label: trimmed, emoji: firstEmoji(emoji) }
}

/** Tags and expense categories are the same shape, so they share the editor. */
export type TagKind = 'tags' | 'categories'

export function createTag(label: string, emoji: string, kind: TagKind = 'tags'): Tag {
  const db = readDb()
  const clean = cleanTag(label, emoji)
  if (db[kind].some((tag) => tag.label.toLowerCase() === clean.label.toLowerCase())) {
    throw new Error(`There is already a "${clean.label}".`)
  }
  const tag: Tag = {
    id: makeTagId(
      clean.label,
      db[kind].map((row) => row.id),
    ),
    ...clean,
  }
  void writeDb({ ...db, [kind]: [...db[kind], tag] })
  return tag
}

export function updateTag(id: string, label: string, emoji: string, kind: TagKind = 'tags'): Tag {
  const db = readDb()
  const clean = cleanTag(label, emoji)
  if (db[kind].some((tag) => tag.id !== id && tag.label.toLowerCase() === clean.label.toLowerCase())) {
    throw new Error(`There is already a "${clean.label}".`)
  }
  const updated: Tag = { id, ...clean }
  void writeDb({ ...db, [kind]: db[kind].map((tag) => (tag.id === id ? updated : tag)) })
  return updated
}

/** How many records would lose their label if this one went. */
export function tagUsage(id: string, kind: TagKind = 'tags'): number {
  const db = readDb()
  return kind === 'tags'
    ? db.schedule.filter((item) => item.tag === id).length
    : db.expenses.filter((expense) => expense.category === id).length
}

/**
 * Delete a tag, and untag anything using it. The records themselves are never
 * deleted — losing an appointment because a label was tidied up would be a
 * nasty surprise.
 */
export function deleteTag(id: string, kind: TagKind = 'tags'): number {
  const db = readDb()
  let cleared = 0
  const next: DB = { ...db, [kind]: db[kind].filter((tag) => tag.id !== id) }

  if (kind === 'tags') {
    next.schedule = db.schedule.map((item) => {
      if (item.tag !== id) return item
      cleared += 1
      return { ...item, tag: null }
    })
  } else {
    next.expenses = db.expenses.map((expense) => {
      if (expense.category !== id) return expense
      cleared += 1
      return { ...expense, category: null }
    })
  }

  void writeDb(next)
  return cleared
}

// ---------------------------------------------------------------- reminders

export function useReminders(): Reminder[] {
  return useSyncExternalStore(subscribe, () => readDb().reminders)
}

function cleanReminderDraft(draft: ReminderDraft): ReminderDraft {
  const title = draft.title.trim()
  if (!title) throw new Error('Please give this a title.')
  if (!isRealDate(draft.date)) throw new Error('That date is not a real date.')
  if (!isTime(draft.time)) throw new Error('The time needs to look like 18:30.')

  const endDate = draft.end_date && draft.end_date !== draft.date ? draft.end_date : null
  if (endDate) {
    if (!isRealDate(endDate)) throw new Error('That until date is not a real date.')
    if (endDate < draft.date) throw new Error('The until date is before the start date.')
  }
  const endTime = draft.end_time || null
  if (endTime && !isTime(endTime)) throw new Error('The until time needs to look like 18:30.')
  if (!endDate && endTime && endTime < draft.time) {
    throw new Error('The until time is before the start time.')
  }
  // Repeating with nothing to stop it is how a reminder becomes noise. Every
  // repeat needs a last day.
  if (draft.repeat !== 'none' && !endDate) {
    throw new Error('A repeating reminder needs an until date.')
  }

  return {
    title,
    date: draft.date,
    time: draft.time,
    end_date: endDate,
    end_time: endTime,
    repeat: draft.repeat,
    notes: draft.notes?.trim() || null,
  }
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
  void writeDb({ ...db, reminders: [...db.reminders, reminder] })
  return reminder
}

export function updateReminder(id: number, draft: ReminderDraft): Reminder {
  const db = readDb()
  const existing = db.reminders.find((reminder) => reminder.id === id)
  if (!existing) throw new Error('That reminder no longer exists.')
  const updated: Reminder = { ...existing, ...cleanReminderDraft(draft) }
  void writeDb({
    ...db,
    reminders: db.reminders.map((reminder) => (reminder.id === id ? updated : reminder)),
  })
  return updated
}

export function toggleReminder(id: number): void {
  const db = readDb()
  void writeDb({
    ...db,
    reminders: db.reminders.map((reminder) =>
      reminder.id === id ? { ...reminder, done: !reminder.done } : reminder,
    ),
  })
}

export function deleteReminder(id: number): void {
  const db = readDb()
  void writeDb({ ...db, reminders: db.reminders.filter((reminder) => reminder.id !== id) })
}

// -------------------------------------------------------------- bill splits

export function useSplits(): BillSplit[] {
  return useSyncExternalStore(subscribe, () => readDb().splits)
}

export function saveSplit(split: BillSplit): BillSplit {
  const db = readDb()
  const exists = db.splits.some((row) => row.id === split.id)
  void writeDb({
    ...db,
    splits: exists ? db.splits.map((row) => (row.id === split.id ? split : row)) : [...db.splits, split],
  })
  return split
}

export function newSplitId(): number {
  return nextId(readDb().splits)
}

export function deleteSplit(id: number): void {
  const db = readDb()
  void writeDb({ ...db, splits: db.splits.filter((split) => split.id !== id) })
}

// ----------------------------------------------------------------- wishlist

export function useWishlist(): WishPlace[] {
  return useSyncExternalStore(subscribe, () => readDb().wishlist)
}

export async function saveWish(
  wish: Omit<WishPlace, 'id'> & { id?: number },
): Promise<WishPlace> {
  const db = readDb()
  const name = wish.name.trim()
  if (!name) throw new Error('Give the place a name.')
  if (!wish.country) throw new Error('Pick a country.')

  const existing = wish.id ? db.wishlist.find((row) => row.id === wish.id) : undefined
  const saved: WishPlace = {
    id: existing?.id ?? nextId(db.wishlist),
    name,
    country: wish.country.toUpperCase(),
    note: wish.note?.trim() || null,
    photo: wish.photo ?? null,
  }
  await writeDb({
    ...db,
    wishlist: existing
      ? db.wishlist.map((row) => (row.id === saved.id ? saved : row))
      : [...db.wishlist, saved],
  })
  if (existing?.photo && existing.photo.id !== saved.photo?.id) {
    void deleteFiles([existing.photo.id])
  }
  return saved
}

/**
 * Take a place off the wishlist.
 *
 * `keepPhoto` is for the one case where the picture is not going anywhere:
 * marking a wish as visited hands the photo to the schedule item it becomes,
 * so letting the bytes go here would leave that item pointing at nothing.
 */
export async function deleteWish(id: number, keepPhoto = false): Promise<void> {
  const db = readDb()
  const existing = db.wishlist.find((row) => row.id === id)
  if (!existing) return
  await writeDb({ ...db, wishlist: db.wishlist.filter((row) => row.id !== id) })
  if (existing.photo && !keepPhoto) void deleteFiles([existing.photo.id])
}

// ----------------------------------------------------------------- settings

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => readDb().settings)
}

export function readSettings(): Settings {
  return readDb().settings
}

export function updateSettings(patch: Partial<Settings>): void {
  const db = readDb()
  void writeDb({ ...db, settings: { ...db.settings, ...patch } })
}

// ------------------------------------------------------------------- backup

/** Everything except attachment bytes. Cheap, and enough for counts. */
export function snapshot(): Snapshot {
  const db = readDb()
  return {
    ...toDocument(db),
    schedule: [...db.schedule].sort(byTimeline),
    reminders: [...db.reminders].sort(byDue),
  }
}

function attachmentIds(data: Pick<Snapshot, 'schedule' | 'expenses' | 'wishlist'>): string[] {
  const ids = new Set<string>()
  for (const item of data.schedule ?? []) {
    for (const file of item.attachments ?? []) ids.add(file.id)
  }
  for (const expense of data.expenses ?? []) {
    for (const file of expense.attachments ?? []) ids.add(file.id)
  }
  for (const wish of data.wishlist ?? []) {
    if (wish.photo) ids.add(wish.photo.id)
  }
  return [...ids]
}

/**
 * Everything, attachments included, for Export and the Drive copy.
 *
 * The bytes are inlined as data URLs. That makes the file bigger than the sum
 * of its photos — base64 costs a third — but it keeps the promise a backup
 * makes: one file is the whole notebook, and restoring it needs nothing else.
 */
export async function fullSnapshot(): Promise<Snapshot> {
  const data = snapshot()
  const files: FilePayload[] = []
  for (const id of attachmentIds(data)) {
    const dataUrl = await readFileAsDataUrl(id)
    if (dataUrl) files.push({ id, dataUrl })
  }
  return { ...data, files }
}

export function itemCount(): number {
  const db = readDb()
  return db.schedule.length + db.reminders.length + db.expenses.length
}

export function countIn(data: Partial<Snapshot>): number {
  return (data.schedule?.length ?? 0) + (data.reminders?.length ?? 0) + (data.expenses?.length ?? 0)
}

/**
 * Replace everything with a snapshot. Replace rather than merge: merging two
 * notebooks means guessing which entries are the same, and guessing wrong
 * quietly duplicates a day. The caller is expected to have said so first.
 */
export async function restore(candidate: unknown): Promise<number> {
  const data = candidate as Partial<Snapshot> | null
  if (!data || typeof data !== 'object' || !Array.isArray(data.schedule)) {
    throw new Error("That file isn't a SchedulePlan backup.")
  }
  if (data.format && data.format !== FORMAT) {
    throw new Error(`That file is a ${data.format} backup, not a SchedulePlan one.`)
  }

  for (const [index, raw] of data.schedule.entries()) {
    const item = raw as Partial<ScheduleItem>
    if (!item || typeof item.title !== 'string' || typeof item.date !== 'string') {
      throw new Error(`Entry ${index + 1} in that file is missing a title or a date.`)
    }
  }

  // Bytes first. A record pointing at an attachment that failed to land is a
  // broken thumbnail forever, so fail before anything is replaced.
  for (const file of data.files ?? []) {
    if (file?.id && typeof file.dataUrl === 'string') {
      await writeFileFromDataUrl(file.id, file.dataUrl)
    }
  }

  const next = coerce(data)
  next.schedule = next.schedule.sort(byTimeline)
  next.reminders = next.reminders.sort(byDue)

  await writeDb(next)
  return countIn(next)
}
