import type { Tag } from '../types'

/** Optional tags. Order matters: this is the order the chips appear in. */
export const TAGS: { id: Tag; label: string; emoji: string }[] = [
  { id: 'personal', label: 'Personal', emoji: '🙂' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'food', label: 'Food', emoji: '🍽' },
  { id: 'sports', label: 'Sports', emoji: '🏸' },
  { id: 'event', label: 'Event', emoji: '🎫' },
  { id: 'other', label: 'Other', emoji: '📌' },
]

export const tagEmoji = (tag: Tag | null): string =>
  TAGS.find((t) => t.id === tag)?.emoji ?? '•'

export const tagLabel = (tag: Tag | null): string =>
  TAGS.find((t) => t.id === tag)?.label ?? ''
