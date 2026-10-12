import type { Tag } from '../types'
import { isZh } from './i18n'

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

/**
 * The tag Travel counts.
 *
 * An id and not a label, so renaming it to 'Trips' or swapping the aeroplane
 * for a suitcase keeps working — `updateTag` never regenerates an id, exactly
 * because things point at them. Delete the tag outright and Travel goes quiet,
 * which is the one thing the empty state has to be able to say.
 */
export const TRAVEL_TAG = 'travel'

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

/**
 * The built-in tags and categories in Chinese, by id.
 *
 * A label is the user's own words and is shown as typed — except that the
 * defaults were typed by this app, in English, on the day the notebook was
 * made. So a built-in one still wearing its first name is shown in the app's
 * language, and one renamed to anything at all keeps what it was renamed to.
 */
const DEFAULT_ZH: Record<string, { en: string; zh: string }> = Object.fromEntries(
  (
    [
      ['personal', '个人'],
      ['work', '工作'],
      ['travel', '旅行'],
      ['food', '美食'],
      ['sports', '运动'],
      ['event', '活动'],
      ['other', '其他'],
      ['food-drink', '餐饮'],
      ['transport', '交通'],
      ['stay', '住宿'],
      ['shopping', '购物'],
      ['tickets', '门票'],
      ['groceries', '日用品'],
      ['bills', '账单'],
      ['other-spend', '其他'],
    ] as const
  ).map(([id, zh]) => [
    id,
    { en: [...DEFAULT_TAGS, ...DEFAULT_CATEGORIES].find((tag) => tag.id === id)!.label, zh },
  ]),
)

/** What to call a tag or category on screen: its label, or the Chinese for a default left as it was. */
export function tagName(tag: Tag): string {
  const builtIn = DEFAULT_ZH[tag.id]
  return isZh() && builtIn && tag.label === builtIn.en ? builtIn.zh : tag.label
}

export const tagLabel = (tags: Tag[], id: string | null): string => {
  const tag = findTag(tags, id)
  return tag ? tagName(tag) : ''
}

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

/**
 * The pastel a tagged card is painted in.
 *
 * Colour here is decoration, not data — nothing depends on which tint a tag
 * lands on — so it is derived from the tag's id rather than stored. That way a
 * tag keeps its colour when tags are reordered, renamed or restored from a
 * backup, and a brand new tag gets one without anybody having to choose.
 */
export interface Tint {
  /** The card fill. */
  bg: string
  /** The bar down its left edge. */
  bar: string
  /** Readable on `bg`. */
  text: string
}

const TINTS: Tint[] = [
  { bg: 'bg-[#E9F1FE]', bar: 'bg-[#3B82F6]', text: 'text-[#1D4ED8]' },
  { bg: 'bg-[#FDECEF]', bar: 'bg-[#F43F5E]', text: 'text-[#BE123C]' },
  { bg: 'bg-[#FDF2E0]', bar: 'bg-[#F59E0B]', text: 'text-[#B45309]' },
  { bg: 'bg-[#E5F7EE]', bar: 'bg-[#10B981]', text: 'text-[#047857]' },
  { bg: 'bg-[#EEEBFD]', bar: 'bg-brand-500', text: 'text-brand-700' },
  { bg: 'bg-[#E3F5F9]', bar: 'bg-[#06B6D4]', text: 'text-[#0E7490]' },
  { bg: 'bg-[#FDEBE3]', bar: 'bg-[#FB7185]', text: 'text-[#9F1239]' },
]

/** Untagged things stay grey rather than borrowing somebody else's colour. */
const PLAIN: Tint = { bg: 'bg-neutral-50', bar: 'bg-neutral-300', text: 'text-neutral-500' }

export function tintFor(id: string | null, order?: readonly { id: string }[]): Tint {
  if (!id) return PLAIN

  // Position in the tag list first. Hashing alone gave two of the seven
  // built-in tags the same green — with seven tags and seven tints a
  // collision is more likely than not — and a colour scheme where Sports and
  // Personal look identical is doing nothing for anybody.
  const index = order?.findIndex((tag) => tag.id === id) ?? -1
  if (index >= 0) return TINTS[index % TINTS.length]

  // A tag the caller did not hand us still needs a stable colour. djb2, which
  // spreads short similar strings ('work' / 'walk') far better than summing
  // their character codes does.
  let hash = 5381
  for (let at = 0; at < id.length; at += 1) {
    hash = ((hash << 5) + hash + id.charCodeAt(at)) >>> 0
  }
  return TINTS[hash % TINTS.length]
}
