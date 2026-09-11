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

/**
 * Where on earth something happened.
 *
 * This hangs off a schedule item exactly the way a location or an attachment
 * does — it is deliberately NOT a Trip object. A trip in SchedulePlan is still
 * just a schedule item that runs across several days; giving it a place is
 * what lets the Travel screen count countries without inventing a second kind
 * of record for the whole app to know about.
 */
export interface Place {
  /** ISO 3166-1 alpha-2. The flag, the continent and the globe all key off it. */
  country: string
  /** Free text: 'Da Nang', 'Kyoto'. Null when only the country is known. */
  city: string | null
}

/** Somewhere you have not been yet. */
export interface WishPlace {
  id: number
  name: string
  country: string
  note: string | null
  photo: Attachment | null
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
  place: Place | null
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
  place: Place | null
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

/**
 * One thing somebody had.
 *
 * The line sits **under the person who had it**, which is the whole model:
 * a bill is not a list of items to be divided, it is a list of what each
 * person ate. That is why there is no split-method anywhere and no total
 * field on the form — an even split is the same figure on every row, a lump
 * per person is one unlabelled line each, and the total is the sum of these.
 */
export interface SplitLine {
  id: string
  /** Optional. Somebody who will not itemise their meal is one bare figure. */
  label: string
  amount: number
  /** Whose it was. Null means the Shared by everyone card. */
  person: string | null
}

export interface BillSplit {
  id: number
  title: string
  date: string
  currency: string
  /** The first one is you: the hero figures and the expense are measured off it. */
  people: SplitPerson[]
  lines: SplitLine[]
  /** Who put the money down for the whole bill. */
  paidBy: string
  /**
   * The expense this split's own share was pushed into, once it has been.
   * Held so a second tap updates that expense instead of adding a duplicate —
   * a split grows an item at a time, and its share with it.
   */
  expense_id: number | null
  /** Whose share gets pushed. A person id; null until one has been chosen. */
  expense_person: string | null
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
  /** How many countries you are aiming for. Drives the Travel progress bar. */
  travelGoal: number
}

export type ViewMode = 'day' | 'week' | 'month'
export type Screen = 'schedule' | 'travel' | 'expenses' | 'reminders' | 'currency' | 'more'
/** Which half of the Expenses module is showing. */
export type ExpensesTab = 'spending' | 'splits'
/** The tools that still live behind More rather than in the nav. */
export type Tool = 'scan' | 'tags' | 'data'
