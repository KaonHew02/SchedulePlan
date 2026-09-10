/** A tag's id. The seven built-in ones keep readable ids so old backups still match. */
export type TagId = string

export interface Tag {
  id: TagId
  label: string
  emoji: string
}

export interface ScheduleItem {
  id: number
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  start_time: string
  /** HH:MM */
  end_time: string | null
  title: string
  location: string | null
  notes: string | null
  tag: TagId | null
}

/** What the form sends when creating or editing an item. */
export interface ScheduleDraft {
  date: string
  start_time: string
  end_time: string | null
  title: string
  location: string | null
  notes: string | null
  tag: TagId | null
}

export interface Reminder {
  id: number
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  notes: string | null
  done: boolean
}

export interface ReminderDraft {
  title: string
  date: string
  time: string
  notes: string | null
}

export type ViewMode = 'day' | 'week' | 'month'
export type Screen = 'schedule' | 'expenses' | 'reminders' | 'more'
