import { useMemo, useSyncExternalStore } from 'react'
import { MALAYSIAN_STATES, malaysianHolidays } from './holidays-my'
import { lastDay, useSettings } from './store'
import type { ScheduleItem } from '../types'

/**
 * Public holidays on the calendar.
 *
 * Two countries' worth, at most, on any one day. The one in settings — home,
 * normally — shows everywhere. And on the days of a trip abroad, the country
 * the trip is in shows too: the day the shops in Hanoi are shut for Tết is
 * worth knowing before you fly, and it is not on anybody's calendar at home.
 *
 * The dates are worked out on the phone, not fetched. Holidays are the thing
 * you look up on a plane, and the date-holidays library carries the rules for
 * about two hundred countries — Easter, the Chinese and Islamic calendars,
 * a Monday given back for a Sunday — in about 210 KB that the offline copy
 * keeps with everything else. It is loaded only when a calendar needs a
 * country, or a year, that the government's own Malaysian list does not
 * cover, which is most days none at all.
 */

export interface Holiday {
  /** YYYY-MM-DD */
  date: string
  name: string
  /** Whose holiday: ISO 3166-1 alpha-2. */
  country: string
  /** A working day given back because the holiday itself fell on a rest day. */
  replacement: boolean
  /**
   * Worked out, not published: a Malaysian year the government has not
   * listed yet. The moon-sighted ones among them can still move by a day.
   */
  estimated?: boolean
}

type Library = typeof import('./holiday-rules').default

let library: Promise<Library> | null = null

function loadLibrary(): Promise<Library> {
  library ??= import('./holiday-rules').then((module) => module.default)
  return library
}

// ------------------------------------------------------------------ the cache

/** A year of one country (and region), once worked out. */
const years = new Map<string, Holiday[]>()
const pending = new Set<string>()

let version = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function changed(): void {
  version += 1
  listeners.forEach((listener) => listener())
}

/** The library's answer, in this app's shape. */
function fromLibrary(
  Holidays: Library,
  country: string,
  region: string | null,
  year: number,
): Holiday[] {
  const options = { languages: ['en'] }
  const calendar = region
    ? new Holidays(country, region, options)
    : new Holidays(country, options)
  const days: Holiday[] = []
  const stretches: Holiday[] = []
  for (const holiday of calendar.getHolidays(year) || []) {
    // Observances (Mother's Day, Valentine's) and the bank- and school-only
    // ones are left out: red on the calendar should mean the day is off.
    if (holiday.type !== 'public') continue
    const first = holiday.date.slice(0, 10)
    const one = {
      name: holiday.name.replace(/\s*\(substitute day\)$/i, ''),
      country,
      replacement: Boolean(holiday.substitute),
    }
    // A few run for several days — Tết is five. The library gives the first
    // day and an end, and the calendar needs each of them.
    const length = Math.round((holiday.end.getTime() - holiday.start.getTime()) / 86_400_000)
    if (length <= 1) {
      days.push({ ...one, date: first })
      continue
    }
    for (let offset = 0; offset < length; offset += 1) {
      stretches.push({ ...one, date: shift(first, offset) })
    }
  }
  // The stretch is the holiday period around a day that has a name of its
  // own — "Vietnamese New Year Holidays" around "Vietnamese New Year" — so
  // where the two meet, the day's own name is the one worth showing.
  const named = new Set(days.map((day) => day.date))
  return [...days, ...stretches.filter((day) => !named.has(day.date))].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

function shift(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * One year of holidays, if it is ready. Starts the work when it is not, and
 * the hook below draws again when it lands.
 */
function yearOf(country: string, region: string | null, year: number): Holiday[] {
  const key = `${country}|${region ?? ''}|${year}`
  const known = years.get(key)
  if (known) return known

  if (country === 'MY') {
    const written = malaysianHolidays(year, region)
    if (written) {
      const days = written.map((day) => ({ ...day, country }))
      years.set(key, days)
      return days
    }
  }

  if (!pending.has(key)) {
    pending.add(key)
    loadLibrary()
      .then((Holidays) => {
        const days = fromLibrary(Holidays, country, region, year)
        // Malaysia only reaches the library for a year with no official list.
        years.set(key, country === 'MY' ? days.map((day) => ({ ...day, estimated: true })) : days)
      })
      .catch(() => {
        // Kept as none, not retried: with no signal and no offline copy yet,
        // retrying on every draw would be a loop of failed downloads. The next
        // time the app is opened it tries again.
        years.set(key, [])
        library = null
      })
      .finally(() => {
        pending.delete(key)
        changed()
      })
  }
  return []
}

// ------------------------------------------------------------------- the hook

/**
 * Holidays by day, between two dates.
 *
 * `items` is what is on the calendar over the same days, for finding trips:
 * anything with a place in another country brings that country's holidays
 * with it, for the days it covers and no others.
 */
export function useHolidays(
  start: string,
  end: string,
  items: ScheduleItem[],
): Map<string, Holiday[]> {
  const { holidayCountry: home, holidayRegion: region } = useSettings()
  const ready = useSyncExternalStore(subscribe, () => version)

  return useMemo(() => {
    const byDay = new Map<string, Holiday[]>()
    const seen = new Set<string>()

    function add(holiday: Holiday) {
      const key = `${holiday.date}|${holiday.country}|${holiday.name}`
      if (seen.has(key)) return
      seen.add(key)
      const list = byDay.get(holiday.date)
      if (list) list.push(holiday)
      else byDay.set(holiday.date, [holiday])
    }

    function addBetween(country: string, area: string | null, from: string, to: string) {
      for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
        for (const holiday of yearOf(country, area, year)) {
          if (holiday.date >= from && holiday.date <= to) add(holiday)
        }
      }
    }

    if (home) addBetween(home, region, start, end)

    for (const item of items) {
      const abroad = item.place?.country
      if (!abroad || abroad === home) continue
      const from = item.date > start ? item.date : start
      const last = lastDay(item)
      const to = last < end ? last : end
      if (from <= to) addBetween(abroad, null, from, to)
    }

    // Home first on a day that has both: it is the one that decides whether
    // you are at work.
    for (const list of byDay.values()) {
      list.sort((a, b) => Number(b.country === home) - Number(a.country === home))
    }
    return byDay
    // `ready` is how a year that finished loading reaches this list.
  }, [ready, home, region, start, end, items])
}

/**
 * A whole year of holidays, for one or more places.
 *
 * The calendar asks for a stretch of days; the travel calendar asks for a
 * year, for a destination that may cross a border (Victoria Falls is two
 * countries) and may sit in a state with days of its own (Kaamatan is Sabah's,
 * Mardi Gras is Louisiana's). Each place is a country and, optionally, its
 * region in the codes the settings already use. Same cache and same sources —
 * Malaysia still from the gazette — so a year worked out for one screen is
 * ready for the other.
 */
export function useHolidayYear(places: [country: string, region: string | null][], year: number): Holiday[] {
  const ready = useSyncExternalStore(subscribe, () => version)
  // The places as one string, so a new array with the same places in it is
  // not a reason to work anything out again.
  const key = places.map(([country, region]) => `${country}:${region ?? ''}`).join(',')

  return useMemo(
    () =>
      key
        .split(',')
        .filter(Boolean)
        .flatMap((place) => {
          const [country, region] = place.split(':')
          return yearOf(country, region || null, year)
        }),
    // `ready` is how a year that finished loading reaches this list.
    [ready, key, year],
  )
}

// ---------------------------------------------------------------- for settings

export interface HolidayCountry {
  /** Whether there is a list for this country at all. */
  supported: boolean
  /** Its states or regions, where some keep holidays of their own. */
  regions: [code: string, name: string][]
}

/**
 * What the settings need to know about a country: whether it has holidays
 * here, and its states. Malaysia's are known without the library.
 */
export async function aboutCountry(country: string): Promise<HolidayCountry> {
  if (country === 'MY') return { supported: true, regions: MALAYSIAN_STATES }
  const Holidays = await loadLibrary()
  const lookup = new Holidays()
  const supported = Boolean(lookup.getCountries('en')[country])
  const regions = supported ? Object.entries(lookup.getStates(country, 'en') ?? {}) : []
  return {
    supported,
    regions: regions.sort((a, b) => a[1].localeCompare(b[1])),
  }
}
