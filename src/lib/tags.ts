import type { Tag } from '../types'

/**
 * What a new install starts with. These are only defaults — every one can be
 * renamed, re-emoji'd or deleted in More > Tags, and new ones added.
 *
 * The ids are words rather than numbers because they end up in exported
 * backups, and because schedule items saved before tags became editable
 * already point at exactly these strings.
 */
export const DEFAULT_TAGS: Tag[] = [
  { id: 'personal', label: 'Personal', emoji: '🙂' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'food', label: 'Food', emoji: '🍽' },
  { id: 'sports', label: 'Sports', emoji: '🏸' },
  { id: 'event', label: 'Event', emoji: '🎫' },
  { id: 'other', label: 'Other', emoji: '📌' },
]

/**
 * What the Expenses screen starts with. Same shape as tags, same rules — every
 * one can be renamed, re-emoji'd or deleted in More > Categories.
 */
export const DEFAULT_CATEGORIES: Tag[] = [
  { id: 'food-drink', label: 'Food & drink', emoji: '🍽' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'stay', label: 'Stay', emoji: '🏨' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍' },
  { id: 'tickets', label: 'Tickets', emoji: '🎫' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'bills', label: 'Bills', emoji: '🧾' },
  { id: 'other-spend', label: 'Other', emoji: '📌' },
]

/** Shown as one-tap choices when naming a tag. Any other emoji can be typed. */
export const EMOJI_CHOICES = [
  '🙂', '💼', '✈️', '🍽', '🏸', '🎫', '📌', '🏠',
  '🚗', '💊', '🎓', '🎬', '🛒', '☕', '🏋️', '🎵',
  '💰', '📞', '🐶', '🌙', '⚽', '🎂', '💡', '🧾',
]

/** The dot used when an item has no tag, or points at a deleted one. */
export const NO_TAG = '•'

export const findTag = (tags: Tag[], id: string | null): Tag | undefined =>
  id ? tags.find((tag) => tag.id === id) : undefined

export const tagEmoji = (tags: Tag[], id: string | null): string =>
  findTag(tags, id)?.emoji ?? NO_TAG

export const tagLabel = (tags: Tag[], id: string | null): string =>
  findTag(tags, id)?.label ?? ''

/** A readable, unique id for a new tag, so backups stay legible. */
export function makeTagId(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tag'
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
