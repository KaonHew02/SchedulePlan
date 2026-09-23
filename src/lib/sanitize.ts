/**
 * Making a notebook that arrived from outside safe to keep.
 *
 * Everything typed into a form goes through store.ts's `clean*` functions on
 * the way in. A backup file does not: it is JSON that anybody can write, by
 * hand or by script, and Import is *meant* for files other people hand you —
 * an itinerary a friend prepared, a trip off another device. Whatever is in
 * it lands in IndexedDB and is drawn on every open after that. Two kinds of
 * bad value matter, and both are dealt with here, once, for every way in:
 *
 * - **The wrong type.** A title that is an object, a tag that is null, a city
 *   that is a number. None of these fail on import. They fail on the next
 *   render, and on every render after it, because they are in the notebook
 *   now — a white page every time the app opens, until the site data (and
 *   the notebook with it) is cleared. So every field is coerced to the shape
 *   the screens expect, and anything that cannot be is dropped.
 * - **The right type, the wrong kind.** A `javascript:` link, an attachment
 *   whose id is somebody else's file, a rate of minus infinity. Those are
 *   where a file could do something rather than merely say something, and
 *   they are refused outright.
 *
 * Nothing here trusts a value because the app wrote it. The same functions
 * read the notebook back off disk at startup, so a notebook that picked up a
 * bad value before these checks existed is repaired on the next open rather
 * than carried forward.
 */

import { safeUrl } from './links'
import type {
  Attachment,
  Phrase,
  RepeatUnit,
  ScheduleRepeat,
  SplitLine,
  SplitPerson,
  Tag,
  TripLink,
} from '../types'

/** A plain JSON object, as opposed to null, an array or a primitive. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

export const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

/** A record number: a whole number above zero that JSON can carry exactly. */
export const positiveId = (value: unknown): number | null =>
  Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : null

export const finite = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Rejects 31 February and friends, which a regex alone lets through.
 *
 * Not a nicety: every date on screen goes through `Intl.DateTimeFormat`,
 * which throws on a date that does not exist, so one bad date in the notebook
 * is a screen that cannot be drawn.
 */
export function isRealDate(iso: unknown): iso is string {
  if (typeof iso !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)

export const dateOrNull = (value: unknown): string | null => (isRealDate(value) ? value : null)

export const time = (value: unknown, fallback: string): string => (isTime(value) ? value : fallback)

export const timeOrNull = (value: unknown): string | null => (isTime(value) ? value : null)

/** ISO 3166-1 alpha-2, upper case. It ends up in a flag's file path. */
export function countryCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null
}

/** ISO 4217, upper case. It ends up in a rate provider's URL. */
export function currencyCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value) ? value.toUpperCase() : null
}

/** 'vi', 'zh-CN', 'fil'. It ends up in a translator's URL. */
export function languageCode(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value) ? value : null
}

// ------------------------------------------------------------- attachments

/**
 * What an attachment id may look like: a UUID, or the `f<time>-<random>`
 * fallback `newFileId` makes where there is no `crypto.randomUUID`. The id is
 * the key into the file store, so anything looser is a way to name a key the
 * app never made.
 */
export const isFileId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(value)

const KINDS: Attachment['kind'][] = ['image', 'scan', 'file']

export function attachment(value: unknown): Attachment | null {
  if (!isRecord(value) || !isFileId(value.id)) return null
  const type = text(value.type).toLowerCase()
  return {
    id: value.id,
    name: text(value.name) || 'Attachment',
    // A MIME type is two tokens and a slash. Anything else is not a type the
    // viewer should be choosing how to draw from.
    type: /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type : 'application/octet-stream',
    size: Math.max(0, finite(value.size)),
    kind: KINDS.includes(value.kind as Attachment['kind']) ? (value.kind as Attachment['kind']) : 'file',
    addedAt: text(value.addedAt),
    text: textOrNull(value.text),
  }
}

export function attachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const kept: Attachment[] = []
  for (const raw of value) {
    const file = attachment(raw)
    if (file && !seen.has(file.id)) {
      seen.add(file.id)
      kept.push(file)
    }
  }
  return kept
}

/**
 * A `data:` URL and nothing else.
 *
 * The bytes in a backup are fetched back out of their data URLs, and `fetch`
 * will just as happily fetch `https://somebody.example/you-opened-it` — which
 * would make importing a file a way to tell a stranger when, and from where,
 * it was opened.
 */
export const isDataUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^data:[^,]*,/i.test(value)

// ------------------------------------------------------------------- links

/**
 * Links through the same gate the forms use.
 *
 * The README has always promised a stored link is http or https, "because a
 * notebook is a file that gets exported and imported again" — and until this
 * existed, the one way in that skipped the check was that import.
 */
export function links(value: unknown): TripLink[] {
  if (!Array.isArray(value)) return []
  const kept: TripLink[] = []
  const used = new Set<number>()
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const url = safeUrl(text(raw.url))
    if (!url) continue
    let id = positiveId(raw.id)
    if (id === null || used.has(id)) id = Math.max(0, ...used) + 1
    used.add(id)
    kept.push({ id, label: text(raw.label), url })
  }
  return kept
}

// ------------------------------------------------------------------ repeat

const REPEAT_UNITS: readonly RepeatUnit[] = ['day', 'week', 'month', 'year']

/** The most units apart a repeat can be. Past this it is a date, not a rhythm. */
export const MAX_EVERY = 99

/**
 * A schedule item's repeat rule, or null when there is not a usable one.
 *
 * `date` is the item's own first day. A rule whose until date is before it
 * never comes round at all, and an item that never comes round is a row the
 * notebook holds and no screen shows — so it is read as happening once, which
 * is the most the file can have meant. Skipped days outside the run are only
 * clutter and go.
 */
export function repeat(value: unknown, date: string): ScheduleRepeat | null {
  if (!isRecord(value) || !REPEAT_UNITS.includes(value.unit as RepeatUnit)) return null
  const unit = value.unit as RepeatUnit
  const until = dateOrNull(value.until)
  if (until && until < date) return null
  const every =
    Number.isSafeInteger(value.every) && (value.every as number) >= 1
      ? Math.min(value.every as number, MAX_EVERY)
      : 1
  const weekdays =
    unit === 'week' && Array.isArray(value.weekdays)
      ? [
          ...new Set(
            value.weekdays.filter(
              (day): day is number => Number.isInteger(day) && day >= 0 && day <= 6,
            ),
          ),
        ].sort((a, b) => a - b)
      : []
  const skip = Array.isArray(value.skip)
    ? [
        ...new Set(
          value.skip.filter(
            (day): day is string => isRealDate(day) && day >= date && (!until || day <= until),
          ),
        ),
      ].sort()
    : []
  return { unit, every, weekdays, until, skip }
}

// -------------------------------------------------------------------- tags

/** Tags or categories. An empty or unusable list falls back to the defaults. */
export function tags(value: unknown, fallback: Tag[]): Tag[] {
  if (!Array.isArray(value)) return fallback
  const seen = new Set<string>()
  const kept: Tag[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const id = text(raw.id)
    const label = text(raw.label)
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    kept.push({ id, label, emoji: text(raw.emoji) || '📌' })
  }
  return kept.length ? kept : fallback
}

// ----------------------------------------------------------------- phrases

export function phrases(value: unknown): Phrase[] {
  if (!Array.isArray(value)) return []
  const kept: Phrase[] = []
  for (const [index, raw] of value.entries()) {
    if (!isRecord(raw)) continue
    const from = languageCode(raw.from)
    const to = languageCode(raw.to)
    const source = text(raw.source)
    const result = text(raw.result)
    if (!from || !to || !source.trim() || !result.trim()) continue
    kept.push({
      id: positiveId(raw.id) ?? index + 1,
      from,
      to,
      source,
      result,
      starred: raw.starred === true,
      savedAt: text(raw.savedAt),
    })
  }
  return kept
}

// ------------------------------------------------------------------ splits

export function splitPeople(value: unknown): SplitPerson[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const kept: SplitPerson[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const id = text(raw.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    kept.push({ id, name: text(raw.name) })
  }
  return kept
}

export function splitLines(value: unknown): SplitLine[] {
  if (!Array.isArray(value)) return []
  const kept: SplitLine[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const id = text(raw.id)
    if (!id) continue
    kept.push({
      id,
      label: text(raw.label),
      amount: finite(raw.amount),
      person: textOrNull(raw.person),
    })
  }
  return kept
}

// ---------------------------------------------------------------- settings

/**
 * Per-currency numbers — hand-typed rates, quote lots.
 *
 * Keys must be currency codes and values must be usable divisors: a rate of
 * zero or Infinity turns every conversion on the screen into nonsense, and
 * the keys go straight into lookups where `__proto__` has no business being.
 */
export function rateMap(value: unknown): Record<string, number> {
  const kept: Record<string, number> = {}
  if (!isRecord(value)) return kept
  for (const [key, raw] of Object.entries(value)) {
    const code = currencyCode(key)
    if (code && typeof raw === 'number' && Number.isFinite(raw) && raw > 0) kept[code] = raw
  }
  return kept
}

/**
 * A goal: at least one, and not absurd. Not required to be whole — the goal
 * box itself saves whatever number was typed, and this must not quietly reset
 * a goal the app wrote.
 */
export const goal = (value: unknown, fallback: number): number =>
  typeof value === 'number' && value >= 1 && value <= 100_000 ? value : fallback
