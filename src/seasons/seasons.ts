import { useEffect, useMemo, useState } from 'react'
import { addDays } from '../lib/date'
import eventsFile from './events.json'

/**
 * The travel calendar: where in the world is at its best in which month.
 *
 * Two kinds of knowledge, kept in two files because they age differently.
 *
 * `destinations.json` is what holds from one year to the next — the weather,
 * the rains, when the lavender is out — 242 places, each rated month by month.
 * It is written once and read through once a year (see docs/SEASONS.md).
 *
 * `events.json` is what belongs to one year only — an Olympics, an eclipse —
 * filed under that year, so next year's calendar does not carry this year's
 * World Cup.
 *
 * Between the two sit the festivals that come every year on a different day:
 * Chinese New Year, Ramadan, Easter and everything hung off them. A date
 * written down for those is right once. So they carry a *rule* instead —
 * `chinese 01-0-01`, `1 Shawwal`, `easter -47` — and the dates are worked out
 * on the phone for whichever year is on screen, by the same date-holidays
 * library that puts public holidays on the calendar. That is what lets the
 * calendar turn the year by itself.
 */

/** 3 best, 2 good, 1 possible but not the time, 0 not advisable. */
export type Rating = 0 | 1 | 2 | 3

export interface Highlight {
  /** The months it falls in, in a usual year. The answer until a rule gives a better one. */
  m: number[]
  t: string
  /**
   * For something that follows a calendar other than this one — the moon,
   * Easter, the Hijri year: a date-holidays rule, worked out for the year
   * being looked at.
   */
  rule?: string
  /** Days from the rule's date to the first day: a flower fair before New Year is -3. */
  offset?: number
  /** How many days it runs. One when left out. */
  days?: number
}

export interface Destination {
  id: string
  area: string
  /** As a reader names it: 日本, 卢旺达·乌干达. */
  country: string
  region: string
  /**
   * ISO codes, for the badge, the wishlist and the public holidays. Several
   * when one entry crosses borders — Victoria Falls is Zimbabwe and Zambia.
   * Empty for Antarctica, which keeps no holidays.
   */
  countries: string[]
  places: string
  summary: string
  climate: string
  /** January first. */
  ratings: Rating[]
  /** One line per month, January first. */
  notes: string[]
  highlights: Highlight[]
  avoid: string
  tips: string
}

/** Something that happens in one year only. */
export interface YearEvent {
  ids: string[]
  m: number[]
  t: string
}

export interface Seasons {
  /** When the file was last read through, YYYY-MM. */
  reviewed: string
  destinations: Destination[]
}

export const AREAS = [
  '中国', '东亚', '东南亚', '南亚', '中亚·高加索', '中东',
  '欧洲', '非洲', '北美', '中南美', '大洋洲', '极地',
] as const

export const RATING_LABEL = ['不建议', '一般', '适合', '最佳'] as const

/** Background and text for a rating, the one place the four colours are chosen. */
export const RATING_TINT = [
  'bg-rose-400 text-white',
  'bg-neutral-200 text-neutral-600',
  'bg-emerald-200 text-emerald-900',
  'bg-emerald-600 text-white',
] as const

const EVENTS = eventsFile as Record<string, YearEvent[]>

export function eventsIn(year: number): YearEvent[] {
  return EVENTS[String(year)] ?? []
}

/** The years events.json has anything for, for saying how far ahead it reaches. */
export const EVENT_YEARS = Object.keys(EVENTS).map(Number)

// ------------------------------------------------------------------ loading

/*
 * The destinations are 600 KB of Chinese, so they are not in the bundle the
 * app opens with. They arrive the first time this screen is opened — from the
 * offline copy like everything else, so a plane is no obstacle — and stay for
 * as long as the app is open.
 */
let loaded: Seasons | null = null
let loading: Promise<Seasons> | null = null

function load(): Promise<Seasons> {
  loading ??= import('./destinations.json').then((module) => {
    loaded = module.default as Seasons
    return loaded
  })
  return loading
}

export function useSeasons(): { data: Seasons | null; failed: boolean } {
  const [data, setData] = useState(loaded)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (data) return
    let live = true
    load()
      .then((value) => live && setData(value))
      .catch(() => {
        // Let the next visit try again rather than remembering the failure.
        loading = null
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [data])
  return { data, failed }
}

// -------------------------------------------------------------- rule dates

type Library = typeof import('../lib/holiday-rules').default

/** Each rule's dates, by year. A Hijri date can come round twice in one year. */
const ruleYears = new Map<number, Map<string, string[]>>()

function work(Holidays: Library, rules: string[], year: number): Map<string, string[]> {
  const calendar = new Holidays()
  for (const rule of rules) calendar.setHoliday(rule, { name: { en: rule }, type: 'public' })
  const dates = new Map<string, string[]>()
  for (const holiday of calendar.getHolidays(year) || []) {
    const list = dates.get(holiday.name) ?? []
    list.push(holiday.date.slice(0, 10))
    dates.set(holiday.name, list)
  }
  return dates
}

/**
 * The year's dates for every rule in the data. Null until the library is in,
 * which is the moment it takes to fetch it from the offline copy the first
 * time; the usual months stand in until then.
 */
export function useRuleDates(data: Seasons | null, year: number): Map<string, string[]> | null {
  const rules = useMemo(() => {
    const set = new Set<string>()
    for (const d of data?.destinations ?? []) for (const h of d.highlights) if (h.rule) set.add(h.rule)
    return [...set]
  }, [data])
  // Only a nudge to draw again. The answer itself is read from the cache by
  // year, so turning the year never shows one frame of last year's dates.
  const [, setWorked] = useState(0)

  useEffect(() => {
    if (ruleYears.has(year) || rules.length === 0) return
    let live = true
    import('../lib/holiday-rules')
      .then((module) => {
        ruleYears.set(year, work(module.default, rules, year))
        if (live) setWorked((count) => count + 1)
      })
      // With no library there is nothing better than the usual months, which
      // is what a null already shows.
      .catch(() => {})
    return () => {
      live = false
    }
  }, [rules, year])

  return ruleYears.get(year) ?? null
}

/** One time a highlight happens: its first and last day. */
export interface Span {
  start: string
  end: string
}

/** Where a highlight with a rule falls in a year, or null for one without. */
export function spansOf(highlight: Highlight, dates: Map<string, string[]> | null): Span[] | null {
  if (!highlight.rule || !dates) return null
  return (dates.get(highlight.rule) ?? []).map((date) => {
    const start = addDays(date, highlight.offset ?? 0)
    return { start, end: addDays(start, (highlight.days ?? 1) - 1) }
  })
}

/** The months of `year` a span touches. */
function monthsOf(span: Span, year: number): number[] {
  const months: number[] = []
  for (let m = 1; m <= 12; m += 1) {
    const first = `${year}-${String(m).padStart(2, '0')}-01`
    const last = `${year}-${String(m).padStart(2, '0')}-31`
    if (span.start <= last && span.end >= first) months.push(m)
  }
  return months
}

/** The time a highlight with a rule touches one month of one year, if it does. */
export function spanIn(
  highlight: Highlight,
  dates: Map<string, string[]> | null,
  year: number,
  month: number,
): Span | undefined {
  const mm = String(month).padStart(2, '0')
  return spansOf(highlight, dates)?.find(
    (span) => span.start <= `${year}-${mm}-31` && span.end >= `${year}-${mm}-01`,
  )
}

/** The months a highlight falls in this year: worked out when it has a rule, as written when not. */
export function highlightMonths(
  highlight: Highlight,
  dates: Map<string, string[]> | null,
  year: number,
): number[] {
  const spans = spansOf(highlight, dates)
  if (!spans || spans.length === 0) return highlight.m
  return [...new Set(spans.flatMap((span) => monthsOf(span, year)))]
}

/**
 * Moon-sighted: the Hijri dates are worked out by arithmetic and the day
 * itself is declared by whoever sees the moon, which can be a day either side.
 * So those say 约. Chinese New Year and Easter are computed exactly.
 */
const SIGHTED = /Ramadan|Shawwal|Dhu al-Hijjah|Muharram|Rajab|Rabi/

/** 2月6日, 2月6–20日, 1月26日–2月9日. */
export function spanLabel(span: Span, rule?: string): string {
  const [, m1, d1] = span.start.split('-').map(Number)
  const [, m2, d2] = span.end.split('-').map(Number)
  const text =
    span.start === span.end
      ? `${m1}月${d1}日`
      : m1 === m2
        ? `${m1}月${d1}–${d2}日`
        : `${m1}月${d1}日–${m2}月${d2}日`
  return rule && SIGHTED.test(rule) ? `约${text}` : text
}

// ----------------------------------------------------------------- reading

/** 3–5月、9–11月 — a list of months as a reader would say it. */
export function monthsLabel(months: number[]): string {
  const unique = months.filter((m, i) => months.indexOf(m) === i)
  if (unique.length === 0) return ''
  if (unique.length >= 12) return '全年'
  const runs: number[][] = []
  let run = [unique[0]]
  for (const m of unique.slice(1)) {
    if (m === (run[run.length - 1] % 12) + 1) run.push(m)
    else {
      runs.push(run)
      run = [m]
    }
  }
  runs.push(run)
  return runs
    .map((r) => (r.length === 1 ? `${r[0]}月` : `${r[0]}–${r[r.length - 1]}月`))
    .join('、')
}

/** 北半球秋季 · 南半球春季: the same month is two seasons. */
export function seasonsOf(month: number): string {
  const north = month >= 3 && month <= 5 ? '春' : month <= 8 && month >= 6 ? '夏' : month >= 9 && month <= 11 ? '秋' : '冬'
  const south = { 春: '秋', 夏: '冬', 秋: '春', 冬: '夏' }[north]
  return `北半球${north}季 · 南半球${south}季`
}

/** What a destination is called on its own: the region, or the country when they are one. */
export const nameOf = (d: Destination) => (d.region === d.country ? d.country : d.region)

/** Everything a search can match, lower-cased once. */
const haystacks = new WeakMap<Destination, string>()

export function matches(d: Destination, query: string): boolean {
  if (!query) return true
  let hay = haystacks.get(d)
  if (hay === undefined) {
    hay = [d.area, d.country, d.region, d.places, d.summary, d.countries.join(' '), ...d.highlights.map((h) => h.t)]
      .join(' ')
      .toLowerCase()
    haystacks.set(d, hay)
  }
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term))
}
