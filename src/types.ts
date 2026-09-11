/** A tag's id. The seven built-in ones keep readable ids so old backups still match. */
export type TagId = string

export interface Tag {
  id: TagId
  label: string
  emoji: string
}

/**
 * A file hanging off a schedule item or an expense. The bytes live in
 * IndexedDB under `id`; only this much travels with the record.
 */
export interface Attachment {
  /** Also the key into the files store. */
  id: string
  name: string
  /** MIME type, as the browser reported it. */
  type: string
  size: number
  /** How it got here, which is what the thumbnail and the actions key off. */
  kind: 'image' | 'scan' | 'file'
  addedAt: string
  /** Text OCR found in it. Null when it was never scanned. */
  text: string | null
}

export interface ScheduleItem {
  id: number
  /** YYYY-MM-DD — the first day. */
  date: string
  /** The last day, for something spanning more than one. Null means same day. */
  end_date: string | null
  /** Whole-day items ignore the times entirely. */
  all_day: boolean
  /** HH:MM */
  start_time: string
  /** HH:MM */
  end_time: string | null
  title: string
  location: string | null
  notes: string | null
  tag: TagId | null
  attachments: Attachment[]
}

/** What the form sends when creating or editing an item. */
export interface ScheduleDraft {
  date: string
  end_date: string | null
  all_day: boolean
  start_time: string
  end_time: string | null
  title: string
  location: string | null
  notes: string | null
  tag: TagId | null
  attachments: Attachment[]
}

/** How often a reminder comes back between its start and its until date. */
export type Repeat = 'none' | 'daily' | 'weekly'

export interface Reminder {
  id: number
  title: string
  /** YYYY-MM-DD — when it starts. */
  date: string
  /** HH:MM */
  time: string
  /** The last day it applies to. Null means the one day. */
  end_date: string | null
  /** HH:MM on the last day. Null falls back to `time`. */
  end_time: string | null
  repeat: Repeat
  notes: string | null
  done: boolean
}

export interface ReminderDraft {
  title: string
  date: string
  time: string
  end_date: string | null
  end_time: string | null
  repeat: Repeat
  notes: string | null
}

export interface Expense {
  id: number
  /** YYYY-MM-DD */
  date: string
  title: string
  /** Always in `currency` — what this actually cost you. */
  amount: number
  /** The home currency this was recorded in. Never re-derived later. */
  currency: string
  category: TagId | null
  /**
   * Set only when it was paid in something else. These four are frozen at the
   * moment of saving: a rate that moves tomorrow must not move this expense.
   */
  original_amount: number | null
  original_currency: string | null
  exchange_rate: number | null
  /** The schedule item this belongs to, if any. */
  schedule_id: number | null
  notes: string | null
  attachments: Attachment[]
}

export interface ExpenseDraft {
  date: string
  title: string
  amount: number
  currency: string
  category: TagId | null
  original_amount: number | null
  original_currency: string | null
  exchange_rate: number | null
  schedule_id: number | null
  notes: string | null
  attachments: Attachment[]
}

export interface SplitPerson {
  id: string
  name: string
}

export interface SplitEntry {
  id: string
  label: string
  amount: number
  /** Person id who actually paid. */
  paidBy: string
  /** Person ids sharing it. Empty means everyone. */
  shares: string[]
  /** Exact per-person amounts, when it is not split evenly. */
  custom: Record<string, number> | null
}

export interface BillSplit {
  id: number
  title: string
  date: string
  currency: string
  people: SplitPerson[]
  entries: SplitEntry[]
}

/** A day's rates, cached so the converter works offline and expenses stay put. */
export interface RateTable {
  base: string
  /** The date the provider says the rates are from. */
  date: string
  fetchedAt: string
  rates: Record<string, number>
}

export interface Settings {
  /** What amounts are shown and totalled in. */
  currency: string
  /** Save to Drive automatically after a change. */
  autoDrive: boolean
  /** ISO timestamp of the last successful Drive write. */
  lastDriveSync: string | null
  /** Rates the user typed in by hand, which beat any fetched table. */
  manualRates: Record<string, number>
}

export type ViewMode = 'day' | 'week' | 'month'
export type Screen = 'schedule' | 'expenses' | 'reminders' | 'more'
/** The tools that live behind More rather than in the nav. */
export type Tool = 'currency' | 'split' | 'scan' | 'tags' | 'data'
