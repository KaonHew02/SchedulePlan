import gazette from './holidays-my.json'

/**
 * Malaysia's public holidays, as the government gazettes them, state by state.
 *
 * Every other country comes out of the date-holidays library, which works the
 * dates out. For Malaysia that is not good enough. Its Muslim holidays follow
 * Malaysia's own moon sighting, which the library does not know, and for 2027
 * it put Hari Raya Aidilfitri, Hari Raya Haji and Maulidur Rasul a day early.
 * It also has no Wesak or Thaipusam after 2026. Nobody forgives a calendar
 * that has Raya on the wrong day.
 *
 * So the dates come from the government's own list, in holidays-my.json.
 * **Nobody types it in.** scripts/holidays.mjs reads the Prime Minister's
 * Department's PDF for every year it publishes, and adds the extra days a
 * Prime Minister announces later (20 March 2026 for Raya); a GitHub workflow
 * runs it every day and publishes the site when anything changed. A year the
 * government has not published yet falls back to the library, and is marked
 * as not confirmed.
 *
 * **Replacement days are not in the file.** They follow one rule, worked out
 * in `replacements` below: a holiday on the weekly rest day — Sunday, or Friday
 * where the weekend is Friday and Saturday — gives the next working day that
 * is not already a holiday. That is how 23 March 2026 came to be off almost
 * everywhere and 24 March in Johor and Melaka.
 */

interface GazettedDay {
  date: string
  name: string
  /** '*' for every state, or the states' short codes as the gazette's columns. */
  states: string | string[]
}

const GAZETTE = gazette as {
  years: Record<string, { pdf: string; holidays: GazettedDay[] }>
  extras: GazettedDay[]
}

/** The gazette's short codes, to ISO 3166-2:MY — the codes the library keys states by. */
const CODES: Record<string, string> = {
  JHR: '01',
  KDH: '02',
  KTN: '03',
  MLK: '04',
  NSN: '05',
  PHG: '06',
  PNG: '07',
  PRK: '08',
  PLS: '09',
  SGR: '10',
  TRG: '11',
  SBH: '12',
  SWK: '13',
  KUL: '14',
  LBN: '15',
  PJY: '16',
}

/** For the state picker, in the order a Malaysian would look for them. */
export const MALAYSIAN_STATES: [code: string, name: string][] = [
  ['01', 'Johor'],
  ['02', 'Kedah'],
  ['03', 'Kelantan'],
  ['04', 'Melaka'],
  ['05', 'Negeri Sembilan'],
  ['06', 'Pahang'],
  ['07', 'Penang'],
  ['08', 'Perak'],
  ['09', 'Perlis'],
  ['12', 'Sabah'],
  ['13', 'Sarawak'],
  ['10', 'Selangor'],
  ['11', 'Terengganu'],
  ['14', 'Kuala Lumpur'],
  ['15', 'Labuan'],
  ['16', 'Putrajaya'],
]

/**
 * Where the weekend is Friday and Saturday, so Friday is the rest day a
 * holiday has to be given back for. Johor went back to Saturday and Sunday at
 * the start of 2025, which is why it is not here.
 */
const FRIDAY_WEEKEND = new Set(['02', '03', '11'])

/** The years the government's own list covers, for saying where it stops. */
const YEARS = Object.keys(GAZETTE.years).map(Number)
export const MALAYSIA_YEARS = { first: Math.min(...YEARS), last: Math.max(...YEARS) }

/**
 * Does a holiday belong to this state? Null is the country as a whole, which
 * gets the ones most of it has off — New Year's Day is missing in five states
 * and is still the first of January to everyone — and not the ones a few
 * states keep, like Thaipusam. Picking a state shows those.
 */
function covers(states: GazettedDay['states'], state: string | null): boolean {
  if (!Array.isArray(states)) return true // '*'
  if (state === null) return states.length > Object.keys(CODES).length / 2
  return states.some((code) => CODES[code] === state)
}

export interface MalaysianDay {
  date: string
  name: string
  replacement: boolean
}

/** 0 is Sunday, as `Date.getDay` counts. */
function weekdayOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

function nextDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * The days given back for holidays that fell on the rest day.
 *
 * Taken in date order, each one claiming the next free working day, so two
 * holidays on one Sunday — Thaipusam and Federal Territory Day in 2026 — give
 * Monday and then Tuesday rather than both landing on Monday.
 */
function replacements(days: MalaysianDay[], state: string | null): MalaysianDay[] {
  const fridays = state !== null && FRIDAY_WEEKEND.has(state)
  const rest = fridays ? 5 : 0
  const weekend = fridays ? [5, 6] : [6, 0]
  const taken = new Set(days.map((day) => day.date))
  const given: MalaysianDay[] = []
  for (const day of days) {
    if (weekdayOf(day.date) !== rest) continue
    let next = nextDay(day.date)
    while (weekend.includes(weekdayOf(next)) || taken.has(next)) next = nextDay(next)
    taken.add(next)
    given.push({ date: next, name: day.name, replacement: true })
  }
  return given
}

/**
 * A year's holidays for one state, or for the country as a whole when no
 * state is given. Null for a year the government has not published.
 */
export function malaysianHolidays(year: number, state: string | null): MalaysianDay[] | null {
  const published = GAZETTE.years[year]
  if (!published) return null
  const days: MalaysianDay[] = [
    ...published.holidays,
    ...GAZETTE.extras.filter((extra) => extra.date.startsWith(`${year}-`)),
  ]
    .filter((day) => covers(day.states, state))
    .map((day) => ({ date: day.date, name: day.name, replacement: false }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return [...days, ...replacements(days, state)].sort((a, b) => a.date.localeCompare(b.date))
}
