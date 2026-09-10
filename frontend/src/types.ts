export type Tag = 'personal' | 'work' | 'travel' | 'food' | 'sports' | 'event' | 'other'

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
  tag: Tag | null
}

/** What the form sends when creating or editing an item. */
export interface ScheduleDraft {
  date: string
  start_time: string
  end_time: string | null
  title: string
  location: string | null
  notes: string | null
  tag: Tag | null
}

export type ViewMode = 'day' | 'week' | 'month'
export type Screen = 'schedule' | 'expenses' | 'more'
