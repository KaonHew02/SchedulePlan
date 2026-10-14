import { useEffect, useMemo, useState } from 'react'
import { addDays } from '../lib/date'
import { isZh, useLang, type Lang } from '../lib/i18n'
import airportsFile from './airports.json'
import airportsEnFile from './airports.en.json'
import areasFile from './areas.json'
import eventsFile from './events.json'
import eventsEnFile from './events.en.json'
import flightsFile from './flights.json'
import placesUrl from './places.json?url'

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
 *
 * And getting there: every destination names the airports it is flown to,
 * which do not move, and `flights.json` says which of them Kuala Lumpur flies
 * to without a change of plane, which does — so it is a file of its own, read
 * through with the rest.
 *
 * The calendar was written in Chinese, and Chinese is still the original:
 * the ratings, the months, the rules and the airports live in the Chinese
 * files only. The English is a second layer of words laid over the same
 * places — `destinations.en.json`, `events.en.json`, `airports.en.json` — and
 * changes nothing but what is read. `npm run seasons` checks the two say the
 * same number of things in the same order, which is what lets a highlight's
 * English sit on the Chinese highlight's months.
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
  /**
   * 地区: 海南, 北海道, 苏格兰 — the part of the country, as a trip in Travel
   * would name it. The country again for somewhere that is one place.
   */
  region: string
  /**
   * Which stretch of the region, for one with several entries: 四川 is 成都及周边,
   * 九寨沟黄龙 and 川西高原. Left out where the region is the whole entry.
   */
  part?: string
  /** 地方: the towns a trip there is made of — 三亚, 海口, 万宁 in 海南. */
  cities: string[]
  /**
   * ISO codes, for the badge, the wishlist and the public holidays. Several
   * when one entry crosses borders — Victoria Falls is Zimbabwe and Zambia.
   * Empty for Antarctica, which keeps no holidays.
   */
  countries: string[]
  /**
   * The state or province inside the first country, for the holidays only it
   * keeps: Kaamatan in Sabah, Mardi Gras in Louisiana, St Andrew's Day in
   * Scotland. The codes date-holidays uses (and Malaysia's gazette, which
   * uses the same ones). Left out, the sheet shows the country's own.
   */
  holidayRegion?: string
  /**
   * The airports it is flown to, as IATA codes: CTS for Hokkaido, NRT and HND
   * for Tokyo. Empty for somewhere with none, or none anyone can fly to now.
   */
  airports: string[]
  /**
   * Where the usual way in is by land or sea from a bigger airport — Huangshan
   * by train from Hangzhou, Kyrgyzstan by road from Almaty — that airport,
   * and how to go on from it.
   */
  via?: Via
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

export interface Via {
  airports: string[]
  /** 杭州坐高铁到黄山北站约1.5小时. */
  t: string
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

/**
 * One destination's words in English: everything a reader reads, nothing a
 * program works out. Highlights are the texts only, in the Chinese order —
 * each takes its months and its rule from the Chinese one in its place.
 */
interface English {
  country: string
  region: string
  part?: string
  cities: string[]
  places: string
  summary: string
  climate: string
  notes: string[]
  highlights: string[]
  via?: string
  avoid: string
  tips: string
}

/**
 * The parts of the world, in the order the screen shows them. Kept in a file
 * of their own so scripts/seasons.mjs checks against the same list: an area
 * known to one and not the other would quietly drop its destinations.
 */
export const AREAS: readonly string[] = areasFile

/**
 * The areas in English. The Chinese names stay the keys — they are what
 * every destination is filed under and what a filter remembers — and this
 * is only what is printed.
 */
const AREA_EN: Record<string, string> = {
  中国: 'China',
  东亚: 'East Asia',
  东南亚: 'Southeast Asia',
  南亚: 'South Asia',
  '中亚·高加索': 'Central Asia & Caucasus',
  中东: 'Middle East',
  欧洲: 'Europe',
  非洲: 'Africa',
  北美: 'North America',
  中南美: 'Latin America',
  大洋洲: 'Oceania',
  极地: 'Polar Regions',
}

/** An area as it is printed, in the app's language. */
export const areaName = (area: string): string => (isZh() ? area : (AREA_EN[area] ?? area))

const RATING_ZH = ['不建议', '一般', '适合', '最佳'] as const
const RATING_EN = ['Avoid', 'Fair', 'Good', 'Best'] as const

/** 最佳 or Best — what a rating is called on a badge and in the legend. */
export const ratingLabel = (rating: Rating): string => (isZh() ? RATING_ZH : RATING_EN)[rating]

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 3月 or Mar. */
export const monthLabel = (month: number): string => (isZh() ? `${month}月` : MONTH_EN[month - 1])

/** Background and text for a rating, the one place the four colours are chosen. */
export const RATING_TINT = [
  'bg-rose-400 text-white',
  'bg-neutral-200 text-neutral-600',
  'bg-emerald-200 text-emerald-900',
  'bg-emerald-600 text-white',
] as const

const EVENTS = eventsFile as Record<string, YearEvent[]>

/** Each year's events in English, in the same order as the Chinese — the text only. */
const EVENTS_EN = eventsEnFile as Record<string, string[]>

/** The English events, made once each, so a memo keyed on a year's list holds. */
const EVENTS_IN_ENGLISH: Record<string, YearEvent[]> = Object.fromEntries(
  Object.entries(EVENTS).map(([year, list]) => [
    year,
    list.map((event, i) => ({ ...event, t: EVENTS_EN[year]?.[i] ?? event.t })),
  ]),
)

/** One empty list for every year with no events, so a memo keyed on it holds. */
const NONE: YearEvent[] = []

export function eventsIn(year: number): YearEvent[] {
  return (isZh() ? EVENTS : EVENTS_IN_ENGLISH)[String(year)] ?? NONE
}

/** The years events.json has anything for, for saying how far ahead it reaches. */
export const EVENT_YEARS = Object.keys(EVENTS).map(Number)

// ------------------------------------------------------------------ loading

/*
 * The destinations are 600 KB of Chinese, so they are not in the bundle the
 * app opens with. They arrive the first time this screen is opened — from the
 * offline copy like everything else, so a plane is no obstacle — and stay for
 * as long as the app is open.
 *
 * The English is as big again and is fetched only by someone reading in
 * English, then laid over the Chinese: each place keeps its own ratings,
 * months, rules and airports, and takes its words from the English file.
 */
const loaded: Record<Lang, Seasons | null> = { zh: null, en: null }
const loading: Record<Lang, Promise<Seasons> | null> = { zh: null, en: null }

/** The Chinese destinations by id, once they are in — for finding a wish saved under the other language's name. */
const chineseById = new Map<string, Destination>()

function loadChinese(): Promise<Seasons> {
  loading.zh ??= import('./destinations.json').then((module) => {
    const data = module.default as Seasons
    for (const d of data.destinations) chineseById.set(d.id, d)
    return (loaded.zh = data)
  })
  return loading.zh
}

function inEnglish(d: Destination, en: English | undefined): Destination {
  // A place with no English yet is shown in Chinese rather than left out.
  // The check before every build keeps this from happening on the live site.
  if (!en) return d
  return {
    ...d,
    country: en.country,
    region: en.region,
    ...(d.part !== undefined ? { part: en.part ?? d.part } : {}),
    cities: en.cities,
    places: en.places,
    summary: en.summary,
    climate: en.climate,
    notes: en.notes,
    highlights: d.highlights.map((h, i) => ({ ...h, t: en.highlights[i] ?? h.t })),
    ...(d.via ? { via: { ...d.via, t: en.via ?? d.via.t } } : {}),
    avoid: en.avoid,
    tips: en.tips,
  }
}

function load(lang: Lang): Promise<Seasons> {
  if (lang === 'zh') return loadChinese()
  loading.en ??= Promise.all([loadChinese(), import('./destinations.en.json')]).then(([zh, module]) => {
    const words = module.default as Record<string, English>
    return (loaded.en = { ...zh, destinations: zh.destinations.map((d) => inEnglish(d, words[d.id])) })
  })
  return loading.en
}

/** The destinations in the app's language. Null while they are on their way. */
export function useSeasons(): { data: Seasons | null; failed: boolean } {
  const lang = useLang()
  const [, setArrived] = useState(0)
  const [failed, setFailed] = useState(false)
  const data = loaded[lang]
  useEffect(() => {
    if (data) return
    let live = true
    setFailed(false)
    load(lang)
      .then(() => live && setArrived((n) => n + 1))
      .catch(() => {
        // Let the next visit try again rather than remembering the failure.
        loading[lang] = null
        if (!loaded.zh) loading.zh = null
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [data, lang])
  return { data, failed }
}

/**
 * Every name a destination goes by, in both languages: 九寨沟黄龙 and
 * "Jiuzhaigou & Huanglong". A wish saved from this screen keeps the name it
 * was saved under, and switching language should not offer to save it twice.
 */
export function namesOf(d: Destination): string[] {
  const zh = chineseById.get(d.id)
  const names = [nameOf(d), d.part ?? '']
  if (zh) names.push(zh.part ?? '', zh.region === zh.country ? zh.country : zh.part ? `${zh.region}·${zh.part}` : zh.region)
  return [...new Set(names.filter(Boolean))]
}

// -------------------------------------------------------------- rule dates

type Library = typeof import('../lib/holiday-rules').default

/*
 * The library, once it has arrived. Kept rather than imported again on every
 * turn of the year: an import() is never synchronous, even for a module that
 * is already loaded, and that one tick showed the usual months for a frame
 * before the year's real dates replaced them.
 */
let library: Library | null = null
let fetching: Promise<Library> | null = null

function loadLibrary(): Promise<Library> {
  fetching ??= import('../lib/holiday-rules').then((module) => (library = module.default))
  return fetching
}

/** Each rule's dates in one calendar year. A Hijri date can come round twice in one. */
const singleYears = new Map<number, Map<string, string[]>>()
/** The same, for a year and the one either side of it — see `datesAround`. */
const windows = new Map<number, Map<string, string[]>>()

function datesOfYear(Holidays: Library, rules: string[], year: number): Map<string, string[]> {
  const known = singleYears.get(year)
  if (known) return known
  const calendar = new Holidays()
  for (const rule of rules) calendar.setHoliday(rule, { name: { en: rule }, type: 'public' })
  const dates = new Map<string, string[]>()
  for (const holiday of calendar.getHolidays(year) || []) {
    const list = dates.get(holiday.name) ?? []
    list.push(holiday.date.slice(0, 10))
    dates.set(holiday.name, list)
  }
  singleYears.set(year, dates)
  return dates
}

/**
 * The rules' dates from the year before to the year after.
 *
 * The library answers for one calendar year at a time, and a festival does
 * not stop at New Year: Ramadan that begins on 26 December 2030 is most of
 * January 2031, and asked only about 2031 the library has never heard of it.
 * So a year is looked at with its neighbours, and `spansOf` keeps whatever
 * touches the year itself.
 */
function datesAround(Holidays: Library, rules: string[], year: number): Map<string, string[]> {
  const known = windows.get(year)
  if (known) return known
  const merged = new Map<string, string[]>()
  for (const y of [year - 1, year, year + 1]) {
    for (const [rule, list] of datesOfYear(Holidays, rules, y)) {
      merged.set(rule, [...(merged.get(rule) ?? []), ...list])
    }
  }
  windows.set(year, merged)
  return merged
}

/**
 * The dates every rule in the data falls on around a year. Null until the
 * library is in — the moment it takes to fetch it from the offline copy the
 * first time — and the usual months stand in until then. After that a year is
 * worked out as it is turned to, in the same frame.
 */
export function useRuleDates(data: Seasons | null, year: number): Map<string, string[]> | null {
  const rules = useMemo(() => {
    const set = new Set<string>()
    for (const d of data?.destinations ?? []) for (const h of d.highlights) if (h.rule) set.add(h.rule)
    return [...set]
  }, [data])
  // Bumped once, when the library arrives, so the memo below runs again.
  const [arrived, setArrived] = useState(library !== null)

  useEffect(() => {
    if (arrived || rules.length === 0) return
    let live = true
    loadLibrary()
      .then(() => live && setArrived(true))
      // With no library there is nothing better than the usual months, which
      // is what a null already shows. The next visit tries again.
      .catch(() => {
        fetching = null
      })
    return () => {
      live = false
    }
  }, [arrived, rules])

  return useMemo(
    () => (arrived && library && rules.length > 0 ? datesAround(library, rules, year) : null),
    [arrived, rules, year],
  )
}

/** One time a highlight happens: its first and last day. */
export interface Span {
  start: string
  end: string
}

/**
 * The times a highlight with a rule touches `year`, or null for one without
 * a rule (or before the dates are in). Includes one that began the December
 * before, or runs on into the January after.
 */
export function spansOf(
  highlight: Highlight,
  dates: Map<string, string[]> | null,
  year: number,
): Span[] | null {
  if (!highlight.rule || !dates) return null
  return (dates.get(highlight.rule) ?? [])
    .map((date) => {
      const start = addDays(date, highlight.offset ?? 0)
      return { start, end: addDays(start, (highlight.days ?? 1) - 1) }
    })
    .filter((span) => span.end >= `${year}-01-01` && span.start <= `${year}-12-31`)
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
  return spansOf(highlight, dates, year)?.find(
    (span) => span.start <= `${year}-${mm}-31` && span.end >= `${year}-${mm}-01`,
  )
}

/** The months a highlight falls in this year: worked out when it has a rule, as written when not. */
export function highlightMonths(
  highlight: Highlight,
  dates: Map<string, string[]> | null,
  year: number,
): number[] {
  const spans = spansOf(highlight, dates, year)
  if (!spans || spans.length === 0) return highlight.m
  return [...new Set(spans.flatMap((span) => monthsOf(span, year)))]
}

/**
 * Moon-sighted: the Hijri dates are worked out by arithmetic and the day
 * itself is declared by whoever sees the moon, which can be a day either side.
 * So those say 约. Chinese New Year and Easter are computed exactly.
 */
const SIGHTED = /Ramadan|Shawwal|Dhu al-Hijjah|Muharram|Rajab|Rabi/

/**
 * 2月6日, 2月6–20日, 1月26日–2月9日 — and 12月26日–2031年1月24日 for one that
 * runs into the next year, which would otherwise read as going backwards.
 * In English: 6 Feb, 6–20 Feb, 26 Jan – 9 Feb, 26 Dec – 24 Jan 2031.
 */
export function spanLabel(span: Span, rule?: string): string {
  const [y1, m1, d1] = span.start.split('-').map(Number)
  const [y2, m2, d2] = span.end.split('-').map(Number)
  const sighted = Boolean(rule && SIGHTED.test(rule))
  if (!isZh()) {
    const text =
      span.start === span.end
        ? `${d1} ${MONTH_EN[m1 - 1]}`
        : y1 !== y2
          ? `${d1} ${MONTH_EN[m1 - 1]} – ${d2} ${MONTH_EN[m2 - 1]} ${y2}`
          : m1 === m2
            ? `${d1}–${d2} ${MONTH_EN[m1 - 1]}`
            : `${d1} ${MONTH_EN[m1 - 1]} – ${d2} ${MONTH_EN[m2 - 1]}`
    return sighted ? `about ${text}` : text
  }
  const text =
    span.start === span.end
      ? `${m1}月${d1}日`
      : y1 !== y2
        ? `${m1}月${d1}日–${y2}年${m2}月${d2}日`
        : m1 === m2
          ? `${m1}月${d1}–${d2}日`
          : `${m1}月${d1}日–${m2}月${d2}日`
  return sighted ? `约${text}` : text
}

/**
 * The same with its year, for the sheet, where a festival can come round
 * twice and each time says which year it is: 2027年2月6日 · 6 Feb 2027,
 * and 26 Dec 2030 – 24 Jan 2031 for one that crosses New Year.
 */
export function datedSpanLabel(span: Span, rule?: string): string {
  const year = span.start.slice(0, 4)
  if (isZh()) return `${year}年${spanLabel(span, rule)}`
  if (year !== span.end.slice(0, 4)) {
    const [, m1, d1] = span.start.split('-').map(Number)
    const sighted = Boolean(rule && SIGHTED.test(rule))
    return `${sighted ? 'about ' : ''}${d1} ${MONTH_EN[m1 - 1]} ${year} – ${spanLabel(span).split(' – ')[1]}`
  }
  return `${spanLabel(span, rule)} ${year}`
}

// ----------------------------------------------------------------- flights

/**
 * How a flight from home gets there, best first. A stop is the same plane all
 * the way with a landing on the way: Lanzhou by way of Kunming, Addis Ababa by
 * way of Singapore — and in China everyone gets off at the first landing for
 * immigration. Seasonal flies some months only; a charter is sold mostly with
 * a tour.
 */
export type FlightKind = 'direct' | 'stop' | 'seasonal' | 'charter'

const KINDS: FlightKind[] = ['direct', 'stop', 'seasonal', 'charter']

interface Flights {
  /** When the routes were last read through, YYYY-MM. */
  checked: string
  /** The city they are flown from: 吉隆坡. */
  from: string
  /** Its airports: KLIA and Subang. */
  home: string[]
  direct: string[]
  /** Each stopping flight, with the city it stops in. */
  stop: Record<string, string>
  seasonal: string[]
  charter: string[]
}

export const FLIGHTS = flightsFile as Flights

const AIRPORT_NAMES = airportsFile as Record<string, string>
const AIRPORT_NAMES_EN = airportsEnFile as Record<string, string>

/** An airport's name in the app's language, 东京·成田 or Tokyo·Narita. A code with no name is itself. */
const named = (code: string): string => (isZh() ? AIRPORT_NAMES[code] : AIRPORT_NAMES_EN[code]) ?? code

/** The city home is, in the app's language: 吉隆坡, or Kuala Lumpur — the city of its first airport. */
export const homeName = (): string => (isZh() ? FLIGHTS.from : citiesOf(FLIGHTS.home.slice(0, 1)))

/**
 * The city a stopping flight lands in on the way, in the app's language.
 * flights.json names it in Chinese; the English is that city's airport's
 * English name, which is why the check insists every stop is a city some
 * airport in airports.json is in.
 */
export function stopName(code: string): string {
  const city = FLIGHTS.stop[code]
  if (isZh() || !city) return city ?? ''
  const airport = Object.keys(AIRPORT_NAMES).find((at) => AIRPORT_NAMES[at].split('·')[0] === city)
  return airport && AIRPORT_NAMES_EN[airport] ? AIRPORT_NAMES_EN[airport].split('·')[0] : city
}

const KIND_OF = new Map<string, FlightKind>()
for (const kind of KINDS) {
  for (const code of kind === 'stop' ? Object.keys(FLIGHTS.stop) : FLIGHTS[kind]) KIND_OF.set(code, kind)
}

export const kindOf = (code: string): FlightKind | undefined => KIND_OF.get(code)

/**
 * How a destination is got to from home.
 *
 * Home itself, or a drive from it. Otherwise the best flight there is: one
 * without a stop before one with, before a seasonal one, before a charter —
 * and to the place itself before one a train ride away. Otherwise a change
 * of plane somewhere.
 */
export type Reach =
  | { kind: 'home'; overland: boolean }
  | { kind: FlightKind; codes: string[]; overland: boolean }
  | { kind: 'connect' }

const reaches = new WeakMap<Destination, Reach>()

export function reachOf(d: Destination): Reach {
  const known = reaches.get(d)
  if (known) return known
  const via = d.via?.airports ?? []
  const atHome = (codes: string[]) => codes.some((code) => FLIGHTS.home.includes(code))
  let reach: Reach = { kind: 'connect' }
  if (atHome(d.airports) || atHome(via)) {
    reach = { kind: 'home', overland: !atHome(d.airports) }
  } else {
    search: for (const kind of KINDS) {
      for (const [codes, overland] of [[d.airports, false], [via, true]] as const) {
        const hits = codes.filter((code) => KIND_OF.get(code) === kind)
        if (hits.length) {
          reach = { kind, codes: hits, overland }
          break search
        }
      }
    }
  }
  reaches.set(d, reach)
  return reach
}

/** Got to without changing planes: a flight of any kind, or no flight at all. */
export const noChange = (d: Destination) => reachOf(d).kind !== 'connect'

/** 东京·成田 is 东京成田 written out, Tokyo·Narita is Tokyo Narita. An airport with no name keeps its code. */
export const airportName = (code: string) => named(code).replace('·', isZh() ? '' : ' ')

/** The cities some airports are in, each once: 成田 and 羽田 are both 东京. */
export function citiesOf(codes: string[]): string {
  const cities = codes.map((code) => named(code).split('·')[0])
  return cities.filter((city, i) => cities.indexOf(city) === i).join(isZh() ? '、' : ', ')
}

/** The line on a card: 直飞东京, 直飞杭州，再坐车, 要转机 — Direct to Tokyo, Direct to Hangzhou, then overland, Connecting flight. */
export function reachLabel(reach: Reach): string {
  const from = homeName()
  if (!isZh()) {
    if (reach.kind === 'connect') return 'Connecting flight'
    if (reach.kind === 'home') return reach.overland ? `A drive from ${from}` : `Right here in ${from}`
    const cities = citiesOf(reach.codes)
    const flight = {
      direct: `Direct to ${cities}`,
      stop: `One stop to ${cities}`,
      seasonal: `Seasonal direct to ${cities}`,
      charter: `Charter flight to ${cities}`,
    }[reach.kind]
    return reach.overland ? `${flight}, then overland` : flight
  }
  if (reach.kind === 'connect') return '要转机'
  if (reach.kind === 'home') return reach.overland ? `${from}开车可到` : `就在${from}`
  const cities = citiesOf(reach.codes)
  const flight = {
    direct: `直飞${cities}`,
    stop: `经停航班到${cities}`,
    seasonal: `季节性直飞${cities}`,
    charter: `包机直飞${cities}`,
  }[reach.kind]
  return reach.overland ? `${flight}，再坐车` : flight
}

// ----------------------------------------------------------------- reading

/** 3–5月、9–11月 — a list of months as a reader would say it. Mar–May, Sep–Nov in English. */
export function monthsLabel(months: number[]): string {
  const unique = months.filter((m, i) => months.indexOf(m) === i)
  if (unique.length === 0) return ''
  if (unique.length >= 12) return isZh() ? '全年' : 'All year'
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
  // Months counted up from January leave a winter in two pieces — 1–3月 at
  // the front, 11–12月 at the back. It is one season, 11–3月.
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
    runs[0] = [...runs.pop()!, ...runs[0]]
  }
  if (!isZh()) {
    return runs
      .map((r) => (r.length === 1 ? MONTH_EN[r[0] - 1] : `${MONTH_EN[r[0] - 1]}–${MONTH_EN[r[r.length - 1] - 1]}`))
      .join(', ')
  }
  return runs
    .map((r) => (r.length === 1 ? `${r[0]}月` : `${r[0]}–${r[r.length - 1]}月`))
    .join('、')
}

/** 北半球秋季 · 南半球春季: the same month is two seasons. */
export function seasonsOf(month: number): string {
  const north = month >= 3 && month <= 5 ? '春' : month <= 8 && month >= 6 ? '夏' : month >= 9 && month <= 11 ? '秋' : '冬'
  const south = { 春: '秋', 夏: '冬', 秋: '春', 冬: '夏' }[north]
  if (!isZh()) {
    const en: Record<string, string> = { 春: 'Spring', 夏: 'Summer', 秋: 'Autumn', 冬: 'Winter' }
    return `${en[north]} in the north · ${en[south].toLowerCase()} in the south`
  }
  return `北半球${north}季 · 南半球${south}季`
}

/**
 * What a destination is called on its own: 海南, 四川·九寨沟黄龙 — or the
 * country, when it is one place. Sichuan · Jiuzhaigou & Huanglong in English.
 */
export const nameOf = (d: Destination) =>
  d.region === d.country ? d.country : d.part ? `${d.region}${isZh() ? '·' : ' · '}${d.part}` : d.region

/**
 * Whether the country is already said by the area heading it sits under —
 * 中国 under 中国 — so it need not be said again under the name.
 */
export const countryIsArea = (d: Destination) => d.country === areaName(d.area)

/** The first few of a list written in the app's way: 、 in Chinese, a comma in English. */
export const firstOf = (list: string, count: number): string[] =>
  list.split(isZh() ? '、' : ', ').slice(0, count)

/** Joins a list the way the app's language does. */
export const joinList = (items: string[]): string => items.join(isZh() ? '、' : ', ')

/** Its 地区 for Travel — 海南, 四川 — or null for a country that is one place. */
export const regionOf = (d: Destination): string | null => (d.region === d.country ? null : d.region)

/** The towns worth saying under the name: none when the only one is the name over again. */
export const townsOf = (d: Destination): string[] =>
  d.cities.length === 1 && d.cities[0] === nameOf(d) ? [] : d.cities

/** Everything a search can match, lower-cased once. */
const haystacks = new WeakMap<Destination, string>()

/** The words of a search a card's own text does not have — none when it matches. */
export function termsLeft(d: Destination, query: string): string[] {
  if (!query) return []
  let hay = haystacks.get(d)
  if (hay === undefined) {
    hay = [
      d.area,
      areaName(d.area),
      d.country,
      d.region,
      d.part ?? '',
      ...d.cities,
      d.places,
      d.summary,
      d.countries.join(' '),
      ...d.highlights.map((h) => h.t),
    ]
      .join(' ')
      .toLowerCase()
    haystacks.set(d, hay)
  }
  const text = hay
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !text.includes(term))
}

/*
 * Every other place, for the search: each province, state, city and district
 * that is not one of a card's own towns, filed under the card it is on — 顺德区
 * under 广东, 海淀区 under 北京 — or under the nearest card when its part of the
 * country has none, as Chicago is under New York and the Northeast. Some
 * 35,000 of them, so the file comes only when something is typed in the
 * search, and the cards never wait for it. scripts/places.mjs writes it.
 */

/** As places.json keeps one: [中文, English, parent, flags], names a|b. */
type PlaceRow = [string, string, number?, number?]

interface Place {
  zh: string
  en: string
  parent: number
  /** Only the nearest card, not the one it is on. */
  near: boolean
  /** There only to name a place under it, as 昆明市 is on the card with 东川. */
  context: boolean
  /** The card's own province, 广东省 on 广东: never named in front of a place. */
  root: boolean
  /** Its own names, lower-cased. */
  own: string
  /** Its own names and those of every place it is in, so 广东 佛山 顺德 finds 顺德区. */
  hay: string
}

let places: Map<string, Place[]> | null = null
let placesLoading: Promise<void> | null = null

function loadPlaces(): Promise<void> {
  // Fetched as a file rather than imported: TypeScript would otherwise read
  // all 35,000 to work out their type, on every build.
  placesLoading ??= fetch(placesUrl).then(async (response) => {
    if (!response.ok) throw new Error(`places: ${response.status}`)
    const rows = ((await response.json()) as { places: Record<string, PlaceRow[]> }).places
    const map = new Map<string, Place[]>()
    for (const [id, list] of Object.entries(rows)) {
      const built: Place[] = []
      for (const [zh, en, parent = -1, flags = 0] of list) {
        const own = `${zh}|${en}`.toLowerCase()
        built.push({
          zh,
          en,
          parent,
          near: (flags & 1) !== 0,
          context: (flags & 2) !== 0,
          root: (flags & 4) !== 0,
          own,
          hay: parent >= 0 ? `${own}|${built[parent].hay}` : own,
        })
      }
      map.set(id, built)
    }
    places = map
  })
  return placesLoading
}

/**
 * The places, once they are in; null before. Asked for only while there is
 * a search. When they cannot be fetched — offline before the file was ever
 * kept — failed says so, and the search makes do with the cards' own words.
 */
export function usePlaces(wanted: boolean): { places: Map<string, Place[]> | null; failed: boolean } {
  const [, setArrived] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!wanted || places) return
    let live = true
    setFailed(false)
    loadPlaces()
      .then(() => live && setArrived((n) => n + 1))
      .catch(() => {
        // Let the next search try again rather than remembering the failure.
        placesLoading = null
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [wanted])
  return { places, failed }
}

/** A card found by a place rather than its own words, and which places. */
export interface Found {
  /** 佛山市 · 顺德区 — at most two. */
  names: string[]
  /** How many more there are. */
  more: number
  /** Every one shown is only nearest this card. */
  near: boolean
}

const firstName = (names: string) => names.split('|')[0]
const placeName = (p: Place) => (isZh() && p.zh ? firstName(p.zh) : firstName(p.en))

/** 朝阳 is 朝阳区 and 朝阳市: the name without the word for what kind of place it is. */
const KIND = /(特别行政区|自治区|自治州|自治县|地区|省|市|区|县|州|盟|旗)$/

/**
 * Whether a word of the search starts a word in these names. Chicago is in
 * East Chicago, but 佛山 is not in 史丹佛山 (Stamford Hill, in Cantonese):
 * Chinese has no spaces, so there it has to start the name.
 */
function startsIn(text: string, term: string): boolean {
  for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + 1)) {
    if (at === 0 || /[|\s\-('’/]/.test(text[at - 1])) return true
  }
  return false
}

/**
 * How well a place answers a search: 0 named exactly that (Chicago, 朝阳区
 * for 朝阳), 1 a name that starts with it (Chicago Heights), 2 a later word
 * of its name (East Chicago), 3 only the place it is in (佛山's districts).
 */
function rankOf(p: Place, terms: string[]): number {
  const names = p.own.split('|')
  if (terms.some((term) => names.some((name) => name === term || name.replace(KIND, '') === term))) return 0
  if (terms.some((term) => names.some((name) => name.startsWith(term)))) return 1
  if (terms.some((term) => startsIn(p.own, term))) return 2
  return 3
}

/**
 * The places on a card a search is about. Only the best of them are named —
 * Chicago, not Chicago Lawn and East Chicago with it — and the ones on the
 * card before the ones it is only nearest to. A place named with the whole
 * of what was typed comes first, so East Chicago is East Chicago even on a
 * card whose own name has "east" in it.
 */
export function foundOn(id: string, terms: string[], all: Map<string, Place[]> | null, query = ''): Found | null {
  const list = all?.get(id)
  if (!list || terms.length === 0) return null
  const phrase = query.toLowerCase().trim().replace(/\s+/g, ' ')
  const hits: { p: Place; rank: number }[] = []
  for (const p of list) {
    if (p.context || !terms.every((term) => startsIn(p.hay, term))) continue
    const whole = phrase.includes(' ') && p.own.split('|').some((name) => name.startsWith(phrase))
    hits.push({ p, rank: (whole ? -1 : rankOf(p, terms)) + (p.near ? 5 : 0) })
  }
  if (hits.length === 0) return null
  // Stable, so places of one rank stay in the file's order: divisions, then towns by size.
  hits.sort((a, b) => a.rank - b.rank)
  const best = hits.filter((hit) => hit.rank === hits[0].rank)
  const shown = best.slice(0, 2)
  return {
    names: shown.map(({ p }) => {
      const parent = p.parent >= 0 ? list[p.parent] : null
      return parent && !parent.root ? `${placeName(parent)} · ${placeName(p)}` : placeName(p)
    }),
    more: best.length - shown.length,
    near: shown.every(({ p }) => p.near),
  }
}
