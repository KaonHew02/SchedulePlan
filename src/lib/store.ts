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
import { DB_KEY, FILES, RECORDS, idbGet, idbKeys, idbPut, persist } from './idb'
import { deleteFiles, readFileAsDataUrl, writeFileFromDataUrl } from './files'
import { safeUrl } from './links'
import { firstOccurrence, unitName, unroll } from './repeat'
import * as safe from './sanitize'
import { divideCents } from './split'
import { DEFAULT_CATEGORIES, DEFAULT_TAGS, TRAVEL_TAG, makeTagId } from './tags'
import type {
  Attachment,
  BillSplit,
  Expense,
  ExpenseDraft,
  Phrase,
  Reminder,
  ReminderDraft,
  ScheduleDraft,
  ScheduleItem,
  ScheduleRepeat,
  Settings,
  SplitLine,
  SplitPerson,
  Tag,
  TripLink,
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
  phrases: Phrase[]
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
  phrases: Phrase[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'MYR',
  autoDrive: false,
  lastDriveSync: null,
  manualRates: {},
  quoteUnits: {},
  travelGoal: 50,
  placeGoal: 100,
}

const EMPTY: DB = {
  schedule: [],
  expenses: [],
  tags: DEFAULT_TAGS,
  categories: DEFAULT_CATEGORIES,
  reminders: [],
  splits: [],
  wishlist: [],
  phrases: [],
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

/*
 * Every fill* below reads a row that may have come from a file somebody else
 * wrote, so each field is checked for its type rather than trusted for it —
 * see sanitize.ts for why a wrong type is worse than a missing one.
 */

/**
 * Backups written before multi-day items existed have no end_date and no
 * all_day. Reading one must not produce an item the rest of the app then has
 * to null-check forever, so the gaps are filled here, once.
 */
function fillItem(raw: Partial<ScheduleItem>, index = 0): ScheduleItem {
  const place = raw.place as unknown
  const country = safe.isRecord(place) ? safe.countryCode(place.country) : null
  const date = safe.text(raw.date)
  return {
    id: safe.positiveId(raw.id) ?? index + 1,
    date,
    end_date: safe.dateOrNull(raw.end_date),
    all_day: raw.all_day === true,
    start_time: safe.time(raw.start_time, '00:00'),
    end_time: safe.timeOrNull(raw.end_time),
    title: safe.text(raw.title),
    location: safe.textOrNull(raw.location),
    notes: safe.textOrNull(raw.notes),
    tag: safe.textOrNull(raw.tag),
    // Backups from before Travel existed have no place at all.
    place: country && safe.isRecord(place) ? { country, city: safe.textOrNull(place.city) } : null,
    attachments: safe.attachments(raw.attachments),
    // All absent from every backup written before the trip page existed.
    plan: safe.textOrNull(raw.plan),
    links: safe.links(raw.links),
    trip_id: safe.positiveId(raw.trip_id),
    // Absent from everything written before items could repeat.
    repeat: safe.repeat(raw.repeat, date),
  }
}

function fillReminder(raw: Partial<Reminder>, index = 0): Reminder {
  return {
    id: safe.positiveId(raw.id) ?? index + 1,
    title: safe.text(raw.title),
    date: safe.text(raw.date),
    time: safe.time(raw.time, '09:00'),
    end_date: safe.dateOrNull(raw.end_date),
    end_time: safe.timeOrNull(raw.end_time),
    repeat: raw.repeat === 'daily' || raw.repeat === 'weekly' ? raw.repeat : 'none',
    notes: safe.textOrNull(raw.notes),
    done: raw.done === true,
  }
}

function fillExpense(raw: Partial<Expense>, index = 0): Expense {
  return {
    id: safe.positiveId(raw.id) ?? index + 1,
    date: safe.text(raw.date),
    title: safe.text(raw.title),
    amount: safe.finite(raw.amount),
    currency: safe.currencyCode(raw.currency) ?? DEFAULT_SETTINGS.currency,
    category: safe.textOrNull(raw.category),
    original_amount: typeof raw.original_amount === 'number' ? safe.finite(raw.original_amount) : null,
    original_currency: safe.currencyCode(raw.original_currency),
    exchange_rate: safe.finite(raw.exchange_rate) > 0 ? safe.finite(raw.exchange_rate) : null,
    schedule_id: safe.positiveId(raw.schedule_id),
    notes: safe.textOrNull(raw.notes),
    attachments: safe.attachments(raw.attachments),
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
  const people: SplitPerson[] = safe.splitPeople(raw.people)
  const ids = people.map((person) => person.id)

  let lines: SplitLine[] = safe.splitLines(raw.lines)
  let paidBy = safe.text(raw.paidBy)

  if (!Array.isArray(raw.lines) && Array.isArray(raw.entries)) {
    const converted: SplitLine[] = []
    const fronted = new Map<string, number>()
    let next = 1
    const push = (label: string, amount: number, person: string | null) => {
      converted.push({ id: `l${next++}`, label, amount, person })
    }

    for (const entry of raw.entries) {
      if (!safe.isRecord(entry)) continue
      const amount = safe.finite(Number(entry.amount))
      const label = safe.text(entry.label)
      if (typeof entry.paidBy === 'string') {
        fronted.set(entry.paidBy, (fronted.get(entry.paidBy) ?? 0) + amount)
      }

      if (safe.isRecord(entry.custom)) {
        for (const [id, value] of Object.entries(entry.custom)) {
          if (ids.includes(id) && value) push(label, safe.finite(Number(value)), id)
        }
        continue
      }

      const sharers = Array.isArray(entry.shares) && entry.shares.length
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
    id: safe.positiveId(raw.id) ?? index + 1,
    title: safe.text(raw.title),
    date: safe.text(raw.date),
    currency: safe.currencyCode(raw.currency) ?? DEFAULT_SETTINGS.currency,
    people,
    lines,
    paidBy: ids.includes(paidBy) ? paidBy : (ids[0] ?? ''),
    expense_id: safe.positiveId(raw.expense_id),
    expense_person: safe.textOrNull(raw.expense_person),
  }
}

/**
 * Wishes written before a place could hold more than a picture.
 *
 * Notes, links and files are all missing from those rows, and the form, the
 * card and the file sweep each read them as lists rather than null-checking
 * every one. Filled here, once, the way `fillItem` does it.
 */
function fillWish(raw: Partial<WishPlace>, index = 0): WishPlace {
  return {
    id: safe.positiveId(raw.id) ?? index + 1,
    name: safe.text(raw.name),
    country: safe.countryCode(raw.country) ?? '',
    note: safe.textOrNull(raw.note),
    photo: safe.attachment(raw.photo),
    attachments: safe.attachments(raw.attachments),
    links: safe.links(raw.links),
  }
}

/**
 * Settings field by field. Spreading the file's object over the defaults, as
 * this used to, kept whatever types the file had — a home currency of `{}`
 * was one bad import away from a converter that could not draw.
 */
function fillSettings(raw: unknown): Settings {
  const given = safe.isRecord(raw) ? raw : {}
  return {
    currency: safe.currencyCode(given.currency) ?? DEFAULT_SETTINGS.currency,
    autoDrive: given.autoDrive === true,
    lastDriveSync: safe.textOrNull(given.lastDriveSync),
    manualRates: safe.rateMap(given.manualRates),
    quoteUnits: safe.rateMap(given.quoteUnits),
    travelGoal: safe.goal(given.travelGoal, DEFAULT_SETTINGS.travelGoal),
    placeGoal: safe.goal(given.placeGoal, DEFAULT_SETTINGS.placeGoal),
  }
}

/** The rows of a list that are objects at all, each filled; a bare `null` row is dropped. */
function rows<T>(value: unknown, fill: (raw: never, index: number) => T): T[] {
  if (!Array.isArray(value)) return []
  const kept: T[] = []
  value.forEach((raw, index) => {
    if (safe.isRecord(raw)) kept.push(fill(raw as never, index))
  })
  return kept
}

function coerce(parsed: Partial<Snapshot> | null): DB {
  return {
    schedule: rows(parsed?.schedule, fillItem),
    expenses: rows(parsed?.expenses, fillExpense),
    tags: safe.tags(parsed?.tags, DEFAULT_TAGS),
    categories: safe.tags(parsed?.categories, DEFAULT_CATEGORIES),
    reminders: rows(parsed?.reminders, fillReminder),
    splits: rows(parsed?.splits, fillSplit),
    wishlist: rows(parsed?.wishlist, fillWish),
    // Absent from every backup written before the translator existed, which
    // is the whole reason this reads defensively rather than trusting it.
    phrases: safe.phrases(parsed?.phrases),
    settings: fillSettings(parsed?.settings),
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
    phrases: db.phrases,
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

const { isRealDate, isTime } = safe

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
}

const orphaned = (before: Attachment[], after: Attachment[]): string[] => {
  const kept = new Set(after.map((file) => file.id))
  return before.filter((file) => !kept.has(file.id)).map((file) => file.id)
}

/**
 * Every file a wish owns. The cover picture is one of them — it is a separate
 * field because the card needs to know which one it is, not because its bytes
 * live anywhere else.
 */
const wishFiles = (wish: WishPlace | undefined): Attachment[] =>
  wish ? [...(wish.photo ? [wish.photo] : []), ...(wish.attachments ?? [])] : []

// ----------------------------------------------------------------- schedule

/** The last day an item covers — its own date when it does not span. */
export const lastDay = (item: ScheduleItem): string => item.end_date ?? item.date

/**
 * Somewhere you actually went: tagged Travel, with a country on it.
 *
 * This is what the counters and the globe are made of. It counts legs as well
 * as trips, because Hoi An is a place you have been whether it is its own row
 * in Travel or the middle three days of the Vietnam one.
 */
export const isVisit = (item: ScheduleItem): boolean =>
  Boolean(item.place?.country && item.tag === TRAVEL_TAG)

/**
 * A trip in its own right rather than a leg of one — one row in Travel.
 *
 * A leg whose trip has gone missing counts as its own trip again, which
 * `deleteSchedule` already makes sure of; this is the belt to that braces,
 * because a notebook can also arrive from a file.
 */
export const isTrip = (item: ScheduleItem, schedule: ScheduleItem[]): boolean =>
  isVisit(item) &&
  (item.trip_id === null ||
    item.trip_id === undefined ||
    !schedule.some((other) => other.id === item.trip_id))

/**
 * The whole stretch a trip covers, legs included.
 *
 * A trip row used to show its own two dates. Once Hoi An and the second
 * Danang leg hang off it, '16 – 17 Sep' is the first three days of a five-day
 * journey, which reads as a mistake rather than as a detail.
 */
export function spanOf(
  trip: ScheduleItem,
  legs: ScheduleItem[],
): { start: string; end: string } {
  let start = trip.date
  let end = lastDay(trip)
  for (const leg of legs) {
    if (leg.date < start) start = leg.date
    if (lastDay(leg) > end) end = lastDay(leg)
  }
  return { start, end }
}

/** What is bound to a trip, earliest first. */
export const legsOf = (schedule: ScheduleItem[], tripId: number): ScheduleItem[] =>
  schedule.filter((item) => item.trip_id === tripId).sort(byTimeline)

/** Does this item sit on this day at all? True for every day a trip covers. */
export const occupies = (item: ScheduleItem, day: string): boolean =>
  item.date <= day && lastDay(item) >= day

export const spansDays = (item: ScheduleItem): boolean =>
  item.end_date !== null && item.end_date > item.date

/**
 * Links as they should be stored.
 *
 * The scheme gate lives here rather than in the form, for the reason `safeUrl`
 * gives: a stored link ends up in an `href`, and the notebook it is stored in
 * travels. The form checks too, so this is the backstop rather than the first
 * word — but it is the one that every path in has to go through.
 *
 * Ids are handed out here as well. A link added in a form has never been near
 * the notebook, and two of them added in the same sitting can only agree on
 * their numbering by asking the same counter, which is this one.
 */
function cleanLinks(links: TripLink[]): TripLink[] {
  const clean: TripLink[] = []
  for (const link of links) {
    const url = safeUrl(link.url)
    if (!url) throw new Error(`"${link.url}" does not look like a link.`)
    clean.push({ id: nextId(clean), label: link.label.trim(), url })
  }
  return clean
}

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

/**
 * A repeat as the form sent it. The form keeps these in range already; this
 * is the check every way in has to get past, and it says what was wrong
 * where `safe.repeat` would quietly make do.
 */
function cleanRepeat(rule: ScheduleRepeat | null, date: string): ScheduleRepeat | null {
  if (!rule) return null
  if (!Number.isInteger(rule.every) || rule.every < 1 || rule.every > safe.MAX_EVERY) {
    throw new Error(`A repeat can be every 1 to ${safe.MAX_EVERY} ${unitName(rule.unit, 2)}.`)
  }
  if (rule.until && !isRealDate(rule.until)) throw new Error('That repeat end is not a real date.')
  if (rule.until && rule.until < date) throw new Error('The repeat ends before it starts.')
  return safe.repeat(rule, date)
}

/**
 * Refuse a row that no screen would ever show: a repeat on Mondays and
 * Wednesdays that starts on a Tuesday and stops the same day never comes
 * round at all, and saving it would look like the Save button ate it.
 */
function mustOccur(item: ScheduleItem): ScheduleItem {
  if (item.repeat && !firstOccurrence(item)) {
    throw new Error('That repeat never lands on a day before it ends.')
  }
  return item
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

/**
 * Items touching a date range, in the order the timeline shows them.
 *
 * A repeating item comes back once for every time it lands in the range, each
 * a copy moved to that date (see repeat.ts). So the same id can be in here
 * more than once, and a list keyed on it needs the date as well.
 */
export function inRange(items: ScheduleItem[], start: string, end: string): ScheduleItem[] {
  return items.flatMap((item) => unroll(item, start, end)).sort(byTimeline)
}

/**
 * Items on one day, spanning ones included, in timeline order.
 *
 * Safe to hand either the notebook or what `inRange` already returned: a copy
 * is never unrolled twice.
 */
export function onDay(items: ScheduleItem[], day: string): ScheduleItem[] {
  return inRange(items, day, day)
}

/** The row itself, for a copy `inRange` made of it. Editing always edits the series. */
export function storedItem(item: ScheduleItem): ScheduleItem {
  return readDb().schedule.find((row) => row.id === item.id) ?? item
}

export const store = {
  async createSchedule(draft: ScheduleDraft): Promise<ScheduleItem> {
    const db = readDb()
    const clean = cleanScheduleDraft(draft)
    // The plan is the trip page's alone; links can come from either.
    const item: ScheduleItem = mustOccur({
      id: nextId(db.schedule),
      ...clean,
      plan: null,
      links: cleanLinks(draft.links ?? []),
      trip_id: draft.trip_id ?? null,
      repeat: cleanRepeat(draft.repeat ?? null, clean.date),
    })
    await writeDb({ ...db, schedule: [...db.schedule, item] })
    return item
  },

  async updateSchedule(id: number, draft: ScheduleDraft): Promise<ScheduleItem> {
    const db = readDb()
    const existing = db.schedule.find((item) => item.id === id)
    if (!existing) throw new Error('That schedule item no longer exists.')
    const clean = cleanScheduleDraft(draft)
    const updated: ScheduleItem = mustOccur({
      id,
      ...clean,
      // The form has no field for the plan, so saving it must not erase it:
      // changing the time of a trip should not empty its itinerary. Links it
      // does have — but a draft that leaves them out is saying nothing about
      // them, which is not the same as saying there are none.
      plan: existing.plan,
      links: draft.links ? cleanLinks(draft.links) : existing.links,
      trip_id: draft.trip_id ?? null,
      // The same goes for the repeat. It is read against the new date either
      // way, because moving the start can leave an until date behind it.
      repeat:
        draft.repeat === undefined
          ? safe.repeat(existing.repeat, clean.date)
          : cleanRepeat(draft.repeat, clean.date),
    })
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
      // Deleting a trip sets its legs free rather than leaving them pointing
      // at a number nothing answers to. They go back to being trips of their
      // own, which is what they were before they were joined.
      schedule: db.schedule
        .filter((item) => item.id !== id)
        .map((item) => (item.trip_id === id ? { ...item, trip_id: null } : item)),
      // An expense keeps its own life; it just stops pointing at a gap.
      expenses: db.expenses.map((expense) =>
        expense.schedule_id === id ? { ...expense, schedule_id: null } : expense,
      ),
    })
    void deleteFiles(existing.attachments.map((file) => file.id))
  },

  /**
   * Take one day out of a repeat and leave the rest of it alone — the week
   * the class is off. Nothing is deleted: the row, its files and its expenses
   * all belong to the series, and the series is still on.
   */
  async skipDay(id: number, day: string): Promise<void> {
    const db = readDb()
    const existing = db.schedule.find((item) => item.id === id)
    if (!existing) throw new Error('That schedule item no longer exists.')
    const rule = existing.repeat
    if (!rule) throw new Error('That item does not repeat.')
    await writeDb({
      ...db,
      schedule: db.schedule.map((item) =>
        item.id === id
          ? { ...item, repeat: { ...rule, skip: [...new Set([...rule.skip, day])].sort() } }
          : item,
      ),
    })
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
    attachments: wish.attachments ?? [],
    // Through the same gate a schedule item's links go through, and for the
    // same reason: this is where ids are handed out.
    links: cleanLinks(wish.links ?? []),
  }
  await writeDb({
    ...db,
    wishlist: existing
      ? db.wishlist.map((row) => (row.id === saved.id ? saved : row))
      : [...db.wishlist, saved],
  })
  // Anything the edit dropped — a replaced picture as much as a removed file
  // — is unreachable now, so let the bytes go.
  void deleteFiles(orphaned(wishFiles(existing), wishFiles(saved)))
  return saved
}

/**
 * Take a place off the wishlist.
 *
 * `keepFiles` is for the one case where they are not going anywhere: marking
 * a wish as visited hands its picture and everything attached to it over to
 * the schedule item it becomes, so letting the bytes go here would leave that
 * item pointing at nothing.
 */
export async function deleteWish(id: number, keepFiles = false): Promise<void> {
  const db = readDb()
  const existing = db.wishlist.find((row) => row.id === id)
  if (!existing) return
  await writeDb({ ...db, wishlist: db.wishlist.filter((row) => row.id !== id) })
  if (!keepFiles) void deleteFiles(wishFiles(existing).map((file) => file.id))
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
    for (const file of wishFiles(wish)) ids.add(file.id)
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
/** Everything both ways in are agreed on: it is a backup, and it is readable. */
function validateSnapshot(candidate: unknown): Partial<Snapshot> {
  if (!safe.isRecord(candidate) || !Array.isArray(candidate.schedule)) {
    throw new Error("That file isn't a SchedulePlan backup.")
  }
  const data = candidate as Partial<Snapshot>
  if (data.format && data.format !== FORMAT) {
    throw new Error(`That file is a ${String(data.format)} backup, not a SchedulePlan one.`)
  }

  for (const [index, raw] of data.schedule!.entries()) {
    const item = raw as unknown
    if (!safe.isRecord(item) || typeof item.title !== 'string' || typeof item.date !== 'string') {
      throw new Error(`Entry ${index + 1} in that file is missing a title or a date.`)
    }
    // Refused rather than repaired: there is no guessing which day was meant,
    // and a date that does not exist stops every screen that draws it.
    if (!isRealDate(item.date)) {
      throw new Error(`Entry ${index + 1} in that file has "${item.date}" as its date.`)
    }
  }
  for (const [index, raw] of (Array.isArray(data.reminders) ? data.reminders : []).entries()) {
    const reminder = raw as unknown
    if (safe.isRecord(reminder) && !isRealDate(reminder.date)) {
      throw new Error(`Reminder ${index + 1} in that file has no real date.`)
    }
  }
  for (const [index, raw] of (Array.isArray(data.expenses) ? data.expenses : []).entries()) {
    const expense = raw as unknown
    if (safe.isRecord(expense) && !isRealDate(expense.date)) {
      throw new Error(`Expense ${index + 1} in that file has no real date.`)
    }
  }
  if (data.files !== undefined && !Array.isArray(data.files)) {
    throw new Error("That file's attachments aren't readable.")
  }
  return data
}

/**
 * The attachment bytes a backup carries, checked before any are written.
 *
 * Only `data:` URLs are fetched — see `isDataUrl` — and only under an id the
 * app could have made. `overwrite` is false for Import: a file you are handed
 * adds to the notebook, and that includes never putting new bytes under an id
 * that already has some. Every attachment id is printed in every export, so
 * without this, a file built from one of your old backups could swap a photo
 * already in your notebook for a different picture under the same name.
 */
async function writeIncomingFiles(files: unknown, overwrite: boolean): Promise<void> {
  if (!Array.isArray(files)) return
  const existing = overwrite ? new Set<string>() : new Set(await idbKeys(FILES).catch(() => []))
  for (const file of files) {
    if (!safe.isRecord(file) || !safe.isFileId(file.id) || !safe.isDataUrl(file.dataUrl)) continue
    if (existing.has(file.id)) continue
    await writeFileFromDataUrl(file.id, file.dataUrl)
  }
}

export async function restore(candidate: unknown): Promise<number> {
  const data = validateSnapshot(candidate)

  // Bytes first. A record pointing at an attachment that failed to land is a
  // broken thumbnail forever, so fail before anything is replaced.
  await writeIncomingFiles(data.files, true)

  const next = coerce(data)
  next.schedule = next.schedule.sort(byTimeline)
  next.reminders = next.reminders.sort(byDue)

  await writeDb(next)
  return countIn(next)
}

/**
 * Add a file's contents to the notebook instead of replacing it.
 *
 * This is what Import does now. Replacing was the honest thing when the only
 * file you could be holding was your own backup, and it stopped being honest
 * the moment a file could be *part* of a notebook — an itinerary somebody
 * prepared for you, a trip off another device. Replace meant the only way to
 * accept five new rows was to lose everything else.
 *
 * Identical rows are skipped rather than doubled, which is what makes the old
 * use still work: importing your own backup over your own notebook now finds
 * everything already there and changes nothing, rather than giving you two of
 * every day. "Identical" is deliberately shallow — same day, same title, same
 * time — because two dinners called Dinner on the same evening at the same
 * hour are one dinner written twice, and a deep compare would keep both
 * because one of them picked up a photo.
 *
 * Ids are reassigned on the way in. The incoming file's ids mean nothing here
 * and half of them will already be taken.
 *
 * Settings and labels are the notebook's own. A file that carries a home
 * currency should not change yours on the way past; the only time its settings
 * are taken is when there is nothing here to overrule them.
 */
export async function mergeIn(candidate: unknown): Promise<{ added: number; skipped: number }> {
  const data = validateSnapshot(candidate)

  // Bytes first, as in `restore`: a record pointing at an attachment that
  // failed to land is a broken thumbnail forever.
  await writeIncomingFiles(data.files, false)

  const db = readDb()
  const incoming = coerce(data)
  const empty =
    db.schedule.length === 0 &&
    db.expenses.length === 0 &&
    db.reminders.length === 0 &&
    db.wishlist.length === 0 &&
    db.phrases.length === 0

  let added = 0
  let skipped = 0

  /** Add the rows that are not already here, renumbering as they land. */
  function absorb<T extends { id: number }>(
    mine: T[],
    theirs: T[],
    fingerprint: (row: T) => string,
  ): T[] {
    const seen = new Set(mine.map(fingerprint))
    let nextNumber = mine.reduce((top, row) => Math.max(top, row.id), 0) + 1
    const kept = [...mine]
    for (const row of theirs) {
      const print = fingerprint(row)
      if (seen.has(print)) {
        skipped += 1
        continue
      }
      seen.add(print)
      kept.push({ ...row, id: nextNumber })
      nextNumber += 1
      added += 1
    }
    return kept
  }

  const next: DB = {
    ...db,
    schedule: absorb(
      db.schedule,
      incoming.schedule,
      (row) => `${row.date}|${row.end_date ?? ''}|${row.start_time}|${row.title.trim().toLowerCase()}`,
    ).sort(byTimeline),
    expenses: absorb(
      db.expenses,
      incoming.expenses,
      (row) => `${row.date}|${row.amount}|${row.currency}|${row.title.trim().toLowerCase()}`,
    ),
    reminders: absorb(
      db.reminders,
      incoming.reminders,
      (row) => `${row.date}|${row.time}|${row.title.trim().toLowerCase()}`,
    ).sort(byDue),
    splits: absorb(
      db.splits,
      incoming.splits,
      (row) => `${row.date}|${row.title.trim().toLowerCase()}`,
    ),
    wishlist: absorb(
      db.wishlist,
      incoming.wishlist,
      (row) => `${row.country}|${row.name.trim().toLowerCase()}`,
    ),
    phrases: absorb(
      db.phrases,
      incoming.phrases,
      (row) => `${row.from}|${row.to}|${row.source.trim().toLowerCase()}`,
    ),
    // Labels are added, never replaced: a file's tag list should not take
    // yours away, and an item pointing at a tag id nobody has is a blank chip.
    tags: [...db.tags, ...incoming.tags.filter((tag) => !db.tags.some((mine) => mine.id === tag.id))],
    categories: [
      ...db.categories,
      ...incoming.categories.filter((tag) => !db.categories.some((mine) => mine.id === tag.id)),
    ],
    settings: empty ? incoming.settings : db.settings,
  }

  await writeDb(next)
  return { added, skipped }
}

// ------------------------------------------------------------------ phrases

export function usePhrases(): Phrase[] {
  return useSyncExternalStore(subscribe, () => readDb().phrases)
}

/**
 * Keep a phrase, or move an identical one back to the top.
 *
 * Translating the same thing twice is what happens when you forget you already
 * have it, and it should leave one row rather than two — so a repeat is dated
 * forward instead of added, and keeps whatever star it already had.
 */
export async function savePhrase(
  phrase: Omit<Phrase, 'id' | 'savedAt' | 'starred'> & { starred?: boolean },
): Promise<Phrase> {
  const db = readDb()
  const source = phrase.source.trim()
  const result = phrase.result.trim()
  if (!source || !result) throw new Error('Nothing to keep.')

  const same = db.phrases.find(
    (row) => row.from === phrase.from && row.to === phrase.to && row.source === source,
  )
  const saved: Phrase = {
    id: same?.id ?? nextId(db.phrases),
    from: phrase.from,
    to: phrase.to,
    source,
    result,
    starred: phrase.starred ?? same?.starred ?? false,
    savedAt: new Date().toISOString(),
  }
  await writeDb({
    ...db,
    phrases: same
      ? db.phrases.map((row) => (row.id === saved.id ? saved : row))
      : [...db.phrases, saved],
  })
  return saved
}

export async function togglePhraseStar(id: number): Promise<void> {
  const db = readDb()
  await writeDb({
    ...db,
    phrases: db.phrases.map((row) =>
      row.id === id ? { ...row, starred: !row.starred } : row,
    ),
  })
}

export async function deletePhrase(id: number): Promise<void> {
  const db = readDb()
  await writeDb({ ...db, phrases: db.phrases.filter((row) => row.id !== id) })
}

// --------------------------------------------------------------- trip page

/** The itinerary. Written from the trip page, which is the only reader. */
export async function saveTripPlan(id: number, plan: string): Promise<void> {
  const db = readDb()
  const text = plan.trim()
  await writeDb({
    ...db,
    schedule: db.schedule.map((item) =>
      item.id === id ? { ...item, plan: text || null } : item,
    ),
  })
}

/**
 * Add or replace a link on a trip.
 *
 * The url is normalised and checked before it is stored rather than before it
 * is rendered: an `href` is a place scripts can run from, so the one thing a
 * saved link must be is http or https.
 */
export async function saveTripLink(
  id: number,
  link: { id?: number; label: string; url: string },
): Promise<void> {
  const db = readDb()
  const item = db.schedule.find((row) => row.id === id)
  if (!item) throw new Error('That trip no longer exists.')

  const url = safeUrl(link.url)
  if (!url) throw new Error('That does not look like a link.')

  const saved: TripLink = {
    id: link.id ?? nextId(item.links),
    label: link.label.trim(),
    url,
  }
  const links = item.links.some((row) => row.id === saved.id)
    ? item.links.map((row) => (row.id === saved.id ? saved : row))
    : [...item.links, saved]

  await writeDb({
    ...db,
    schedule: db.schedule.map((row) => (row.id === id ? { ...row, links } : row)),
  })
}

/**
 * Replace a trip's files.
 *
 * Straight through to the notebook, the way the plan and the links go: the
 * trip page has no Save button and adding a boarding pass to it should not be
 * the one thing on the page that needs one. Bytes for anything dropped are
 * released, exactly as editing the item through the form would.
 */
export async function saveTripFiles(id: number, attachments: Attachment[]): Promise<void> {
  const db = readDb()
  const existing = db.schedule.find((item) => item.id === id)
  if (!existing) throw new Error('That trip no longer exists.')

  await writeDb({
    ...db,
    schedule: db.schedule.map((item) => (item.id === id ? { ...item, attachments } : item)),
  })
  void deleteFiles(orphaned(existing.attachments, attachments))
}

export async function deleteTripLink(id: number, linkId: number): Promise<void> {
  const db = readDb()
  await writeDb({
    ...db,
    schedule: db.schedule.map((item) =>
      item.id === id ? { ...item, links: item.links.filter((row) => row.id !== linkId) } : item,
    ),
  })
}
