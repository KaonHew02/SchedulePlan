/**
 * Seasons: check the travel calendar, and say what a year holds.
 *
 *   npm run seasons                  check, then the report for next year
 *   npm run seasons -- --year 2028   check, then the report for 2028
 *   npm run seasons -- --check       check only — `npm run build` runs this
 *   npm run seasons -- --review      the sentences that go out of date
 *   npm run seasons -- --flights     where there is a direct flight to, and where not
 *   npm run seasons -- --format      check, then rewrite the files in the house layout
 *
 * The calendar is two files. src/seasons/destinations.json is the part that
 * holds from one year to the next — the weather, the ratings, the flowers —
 * and src/seasons/events.json is the part that does not: the Olympics, an
 * eclipse, a World Cup, filed under the year they happen in.
 *
 * Festivals that follow the moon or Easter carry a rule instead of a date,
 * and the app works the date out for whichever year is on screen, with the
 * same date-holidays library the calendar already uses for public holidays.
 * So nothing in destinations.json may name a year. A "2027年" written into a
 * sentence is right for one year and wrong for every one after it, and the
 * check below refuses it: a date that belongs to one year goes in events.json,
 * and one that comes round every year goes in a rule.
 *
 * Getting there is two files more. src/seasons/airports.json names the
 * airports every destination is reached by, which do not move, and
 * src/seasons/flights.json lists the places Kuala Lumpur flies to without a
 * change of plane, which moves every few months and is read through with the
 * rest.
 *
 * Every one of those is written in Chinese, and has an English twin for when
 * the app is in English: destinations.en.json, events.en.json and
 * airports.en.json. The English is words only — the ratings, months, rules
 * and airports are the Chinese files' — so the check makes sure each twin says
 * the same number of things in the same order, has no Chinese left in it, and
 * names no year either.
 *
 * The check runs before every build, so a file that would draw a broken
 * screen is never published. See docs/SEASONS.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import Holidays from 'date-holidays'

// Found from this file rather than from wherever the command was typed, so
// `node scripts/seasons.mjs` works from any folder in the repository.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DESTINATIONS = join(ROOT, 'src/seasons/destinations.json')
const EVENTS = join(ROOT, 'src/seasons/events.json')
const AREAS_FILE = join(ROOT, 'src/seasons/areas.json')
const AIRPORTS = join(ROOT, 'src/seasons/airports.json')
const FLIGHTS = join(ROOT, 'src/seasons/flights.json')
const DESTINATIONS_EN = join(ROOT, 'src/seasons/destinations.en.json')
const EVENTS_EN = join(ROOT, 'src/seasons/events.en.json')
const AIRPORTS_EN = join(ROOT, 'src/seasons/airports.en.json')
const PLACES = join(ROOT, 'src/seasons/places.json')
const shown = (path) => relative(ROOT, path).replaceAll('\\', '/')

/** The same list the screen groups by, so the two cannot disagree. */
const AREAS = JSON.parse(readFileSync(AREAS_FILE, 'utf8'))

/*
 * Every key each kind of record may have. Anything else is a typo — "offest"
 * for "offset" — and is refused: the app would ignore it, and --format,
 * which writes only these, would quietly drop it.
 */
const DESTINATION_KEYS = [
  'id', 'area', 'country', 'region', 'part', 'countries', 'holidayRegion', 'airports', 'via',
  'cities', 'places', 'summary', 'climate', 'ratings', 'notes', 'highlights', 'avoid', 'tips',
]
const HIGHLIGHT_KEYS = ['m', 't', 'rule', 'offset', 'days']
const EVENT_KEYS = ['ids', 'm', 't']
const VIA_KEYS = ['airports', 't']
const FLIGHT_KEYS = ['checked', 'from', 'home', 'direct', 'stop', 'seasonal', 'charter']
/** The kinds of flight in flights.json, best first — the order the app picks in. */
const ROUTE_KINDS = ['direct', 'stop', 'seasonal', 'charter']

const TEXT_FIELDS = ['id', 'area', 'country', 'region', 'places', 'summary', 'climate', 'avoid', 'tips']

/** What an English destination may say, in the order --format writes it. */
const ENGLISH_KEYS = [
  'country', 'region', 'part', 'cities', 'places', 'summary', 'climate', 'notes', 'highlights', 'via', 'avoid', 'tips',
]
const ENGLISH_TEXT = ['country', 'region', 'places', 'summary', 'climate', 'avoid', 'tips']

/**
 * A year in an English sentence: 2027 standing alone. A height or a count of
 * 1,000 and over is written with a comma — 2,050 m — and is not one.
 */
const A_YEAR_EN = /(?<![\d,.])20[2-9]\d(?![\d,])/

/** Chinese left behind in the English: characters, or full-width punctuation. */
const CHINESE = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/

/**
 * A year written into a sentence: 2027年, or 2027 年. Only 2020 onwards and
 * only with the 年 — 拥有2000年历史 is an age, 1987年列入世界遗产 is history
 * that stays true, and a bare 2000 is as likely to be metres above the sea.
 */
const A_YEAR = /(?<!\d)20[2-9]\d\s*年/

/**
 * Words that mark a sentence as something a government or a park can change
 * by next season: visas, fees, permits, bookings, closures. `--review` lists
 * every sentence with one in it, which is the yearly read-through.
 */
const CHANGEABLE = /签证|免签|电子签|入境|许可|门票|收费|费用|税|预约|限流|限额|开放|关闭|封闭|停办|停运|暂停|翻修|新规|规定|政策|以最新|以官方|以当年|近年/

// ------------------------------------------------------------------ dates

const pad = (n) => String(n).padStart(2, '0')

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Every rule's dates in one calendar year. A Hijri rule can fall twice in one. */
export function ruleDates(rules, year) {
  const calendar = new Holidays()
  for (const rule of rules) calendar.setHoliday(rule, { name: { en: rule }, type: 'public' })
  const dates = new Map()
  for (const holiday of calendar.getHolidays(year) || []) {
    const list = dates.get(holiday.name) ?? []
    list.push(holiday.date.slice(0, 10))
    dates.set(holiday.name, list)
  }
  return dates
}

/**
 * When a highlight happens in `year`: its spans, from the year before to the
 * year after, kept where they touch the year — Ramadan that begins on 26
 * December is mostly January's. The same as `spansOf` in src/seasons/seasons.ts.
 */
function spansIn(highlight, around, year) {
  const spans = []
  for (const dates of around) {
    for (const date of dates.get(highlight.rule) ?? []) {
      const start = addDays(date, highlight.offset ?? 0)
      const end = addDays(start, (highlight.days ?? 1) - 1)
      if (end >= `${year}-01-01` && start <= `${year}-12-31`) spans.push({ start, end })
    }
  }
  return spans
}

const label = (start, end) => {
  const [y1, m1, d1] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  if (start === end) return `${m1}月${d1}日`
  if (y1 !== y2) return `${y1}年${m1}月${d1}日–${y2}年${m2}月${d2}日`
  return m1 === m2 ? `${m1}月${d1}–${d2}日` : `${m1}月${d1}日–${m2}月${d2}日`
}

// ----------------------------------------------------------------- layout

/**
 * One destination per block, a note per line and a highlight per line.
 *
 * Plain JSON.stringify puts every number of the ratings on a line of its own
 * and splits each highlight over five, which makes a change to one month's
 * note a diff nobody can read. This is the layout the files are kept in.
 */
function formatDestination(d) {
  const s = JSON.stringify
  const highlight = (h) =>
    `{ ${HIGHLIGHT_KEYS.filter((key) => h[key] !== undefined)
      .map((key) => `${s(key)}: ${key === 'm' ? `[${h.m.join(', ')}]` : s(h[key])}`)
      .join(', ')} }`
  return [
    '    {',
    ...['id', 'area', 'country', 'region'].map((key) => `      ${s(key)}: ${s(d[key])},`),
    ...(d.part !== undefined ? [`      "part": ${s(d.part)},`] : []),
    `      "countries": [${d.countries.map((c) => s(c)).join(', ')}],`,
    ...(d.holidayRegion !== undefined ? [`      "holidayRegion": ${s(d.holidayRegion)},`] : []),
    `      "airports": [${d.airports.map((c) => s(c)).join(', ')}],`,
    ...(d.via !== undefined
      ? [`      "via": { "airports": [${d.via.airports.map((c) => s(c)).join(', ')}], "t": ${s(d.via.t)} },`]
      : []),
    `      "cities": [${d.cities.map((c) => s(c)).join(', ')}],`,
    ...['places', 'summary', 'climate'].map((key) => `      ${s(key)}: ${s(d[key])},`),
    `      "ratings": [${d.ratings.join(', ')}],`,
    '      "notes": [',
    d.notes.map((note) => `        ${s(note)}`).join(',\n'),
    '      ],',
    '      "highlights": [',
    d.highlights.map((h) => `        ${highlight(h)}`).join(',\n'),
    '      ],',
    `      "avoid": ${s(d.avoid)},`,
    `      "tips": ${s(d.tips)}`,
    '    }',
  ].join('\n')
}

export function formatDestinations(file) {
  return (
    `{\n  "reviewed": ${JSON.stringify(file.reviewed)},\n  "destinations": [\n` +
    file.destinations.map(formatDestination).join(',\n') +
    '\n  ]\n}\n'
  )
}

export function formatEvents(events) {
  const years = Object.keys(events).sort()
  return (
    '{\n' +
    years
      .map(
        (year) =>
          `  ${JSON.stringify(year)}: [\n` +
          events[year]
            .map(
              (e) =>
                `    { "ids": [${e.ids.map((id) => JSON.stringify(id)).join(', ')}], "m": [${e.m.join(', ')}], "t": ${JSON.stringify(e.t)} }`,
            )
            .join(',\n') +
          '\n  ]',
      )
      .join(',\n') +
    '\n}\n'
  )
}

/**
 * The English twin in the same layout as the Chinese: a destination a block,
 * a note a line and a highlight a line, so a change to one month is a change
 * to one line.
 */
export function formatEnglish(english) {
  const s = JSON.stringify
  const block = ([id, e]) =>
    [
      `  ${s(id)}: {`,
      ...['country', 'region'].map((key) => `    ${s(key)}: ${s(e[key])},`),
      ...(e.part !== undefined ? [`    "part": ${s(e.part)},`] : []),
      `    "cities": [${e.cities.map((c) => s(c)).join(', ')}],`,
      ...['places', 'summary', 'climate'].map((key) => `    ${s(key)}: ${s(e[key])},`),
      '    "notes": [',
      e.notes.map((note) => `      ${s(note)}`).join(',\n'),
      '    ],',
      '    "highlights": [',
      e.highlights.map((h) => `      ${s(h)}`).join(',\n'),
      '    ],',
      ...(e.via !== undefined ? [`    "via": ${s(e.via)},`] : []),
      `    "avoid": ${s(e.avoid)},`,
      `    "tips": ${s(e.tips)}`,
      '  }',
    ].join('\n')
  return `{\n${Object.entries(english).map(block).join(',\n')}\n}\n`
}

export function formatEventsEnglish(events) {
  const years = Object.keys(events).sort()
  return (
    '{\n' +
    years
      .map((year) => `  ${JSON.stringify(year)}: [\n${events[year].map((t) => `    ${JSON.stringify(t)}`).join(',\n')}\n  ]`)
      .join(',\n') +
    '\n}\n'
  )
}

/** One airport a line, in code order. */
export function formatAirports(names) {
  const lines = Object.keys(names)
    .sort()
    .map((code) => `  ${JSON.stringify(code)}: ${JSON.stringify(names[code])}`)
  return `{\n${lines.join(',\n')}\n}\n`
}

/**
 * The routes in code order, a line for each first letter: a route opened or
 * dropped changes that one line, not every line after it.
 */
export function formatFlights(flights) {
  const s = JSON.stringify
  const codes = (list) => {
    const sorted = [...list].sort()
    // A handful reads best on one line, as the file's short lists always have.
    if (sorted.length <= 8) return `[${sorted.map(s).join(', ')}]`
    const lines = new Map()
    for (const code of sorted) lines.set(code[0], [...(lines.get(code[0]) ?? []), s(code)])
    return `[\n    ${[...lines.values()].map((row) => row.join(', ')).join(',\n    ')}\n  ]`
  }
  const stops = Object.keys(flights.stop).sort()
  return [
    '{',
    `  "checked": ${s(flights.checked)},`,
    `  "from": ${s(flights.from)},`,
    `  "home": ${codes(flights.home)},`,
    `  "direct": ${codes(flights.direct)},`,
    `  "stop": { ${stops.map((code) => `${s(code)}: ${s(flights.stop[code])}`).join(', ')} },`,
    `  "seasonal": ${codes(flights.seasonal)},`,
    `  "charter": ${codes(flights.charter)}`,
    '}',
    '',
  ].join('\n')
}

// ------------------------------------------------------------------ check

const isCode = (code) => typeof code === 'string' && /^[A-Z]{3}$/.test(code)

/** Each route's kinds. More than one is a mistake: a flight is one or the other. */
function routeKinds(flights) {
  const kinds = new Map()
  for (const kind of ROUTE_KINDS) {
    const codes = kind === 'stop' ? Object.keys(flights.stop ?? {}) : (flights[kind] ?? [])
    for (const code of codes) kinds.set(code, [...(kinds.get(code) ?? []), kind])
  }
  return kinds
}

export function checkFlights(flights, names) {
  const problems = []
  const say = (what) => problems.push(`${shown(FLIGHTS)}: ${what}`)
  for (const key of unknownKeys(flights, FLIGHT_KEYS)) say(`unknown key "${key}" — a typo?`)
  if (!/^\d{4}-\d{2}$/.test(flights.checked ?? '')) say('checked should be YYYY-MM')
  if (typeof flights.from !== 'string' || !flights.from.trim()) say('from should name the city')
  if (!Array.isArray(flights.home) || flights.home.length === 0 || !flights.home.every(isCode)) {
    say('home should be the airports of the city flown from, like ["KUL"]')
  }
  for (const kind of ['direct', 'seasonal', 'charter']) {
    if (!Array.isArray(flights[kind]) || !flights[kind].every(isCode)) say(`${kind} should be a list of airport codes`)
  }
  if (typeof flights.stop !== 'object' || flights.stop === null || Array.isArray(flights.stop)) {
    say('stop should map each airport code to the city the flight stops in')
  } else {
    for (const [code, city] of Object.entries(flights.stop)) {
      if (!isCode(code) || typeof city !== 'string' || !city.trim()) say(`stop "${code}" should name the city it stops in`)
    }
  }
  if (problems.length) return problems

  for (const [code, kinds] of routeKinds(flights)) {
    if (kinds.length > 1) say(`${code} is under ${kinds.join(' and ')} — it can only be one`)
    if (flights.home.includes(code)) say(`${code} is home, not somewhere to fly to`)
  }
  // A names file that is not a list of names is the other check's to say.
  const named = typeof names === 'object' && names !== null ? names : {}
  for (const code of flights.home) if (!named[code]) say(`home airport ${code} has no name in ${shown(AIRPORTS)}`)
  return problems
}

/**
 * The English twins against the Chinese. Each English destination has the
 * same id, the same number of towns, notes and highlights, a part and a via
 * exactly where the Chinese has one, and names the place the same way round —
 * a country that is one place (新加坡 in 新加坡) is Singapore in Singapore.
 */
export function checkEnglish(file, english, events, eventsEnglish, names, namesEnglish, flights) {
  const problems = []
  const say = (where, what) => problems.push(`${where}: ${what}`)
  const text = (where, value) => {
    if (typeof value !== 'string' || !value.trim()) return say(where, 'is missing')
    if (CHINESE.test(value)) say(where, `still has Chinese ("${value.match(/.{0,10}[\u3400-\u9fff\u3000-\u303f\uff00-\uffef].{0,10}/)?.[0]}")`)
    if (A_YEAR_EN.test(value)) say(where, `names a year ("${value.match(/.{0,12}20[2-9]\d.{0,12}/)?.[0]}") — write a height as 2,050 m`)
  }

  const en = shown(DESTINATIONS_EN)
  if (typeof english !== 'object' || english === null || Array.isArray(english)) {
    say(en, 'should map each destination id to its English')
    english = {}
  }
  const ids = new Set(file.destinations.map((d) => d.id))
  for (const id of Object.keys(english)) if (!ids.has(id)) say(en, `"${id}" is not a destination in ${shown(DESTINATIONS)}`)

  for (const d of file.destinations) {
    const e = english[d.id]
    const at = `${en} ${d.id}`
    if (!e) {
      say(at, 'has no English')
      continue
    }
    for (const key of unknownKeys(e, ENGLISH_KEYS)) say(at, `unknown key "${key}" — a typo?`)
    for (const key of ENGLISH_TEXT) text(`${at} ${key}`, e[key])
    if ((d.region === d.country) !== (e.region === e.country)) {
      say(at, d.region === d.country ? 'region should be the country again, as in the Chinese' : 'region is the country again, but not in the Chinese')
    }
    if ((d.part === undefined) !== (e.part === undefined)) say(at, d.part === undefined ? 'has a part the Chinese has not' : 'part is missing')
    else if (e.part !== undefined) text(`${at} part`, e.part)
    if ((d.via === undefined) !== (e.via === undefined)) say(at, d.via === undefined ? 'has a via the Chinese has not' : 'via is missing')
    else if (e.via !== undefined) text(`${at} via`, e.via)

    if (!Array.isArray(e.cities) || e.cities.length !== d.cities.length) {
      say(at, `cities should be ${d.cities.length}, as in the Chinese`)
    } else {
      e.cities.forEach((city, i) => text(`${at} city ${i + 1}`, city))
      d.cities.forEach((city, i) => {
        if (city === d.region && e.cities[i] !== e.region) say(at, `city ${i + 1} is the region in Chinese, so should be "${e.region}"`)
      })
      if (new Set(e.cities).size !== e.cities.length) say(at, 'a city is listed twice')
    }
    if (!Array.isArray(e.notes) || e.notes.length !== 12) say(at, 'notes should be twelve, January first')
    else e.notes.forEach((note, i) => text(`${at} note ${i + 1}`, note))
    if (!Array.isArray(e.highlights) || e.highlights.length !== d.highlights.length) {
      say(at, `highlights should be ${d.highlights.length}, in the Chinese order`)
    } else {
      e.highlights.forEach((h, i) => text(`${at} highlight ${i + 1}`, h))
    }
  }

  const ev = shown(EVENTS_EN)
  if (typeof eventsEnglish !== 'object' || eventsEnglish === null || Array.isArray(eventsEnglish)) {
    say(ev, 'should be an object of years')
  } else {
    for (const year of Object.keys(eventsEnglish)) if (!events[year]) say(ev, `${year} has no events in ${shown(EVENTS)}`)
    for (const [year, list] of Object.entries(events)) {
      const words = eventsEnglish[year]
      if (!Array.isArray(words) || words.length !== list.length) say(`${ev} ${year}`, `should be ${list.length} lines, in the Chinese order`)
      else words.forEach((t, i) => text(`${ev} ${year} #${i + 1}`, t))
    }
  }

  const ap = shown(AIRPORTS_EN)
  if (typeof namesEnglish !== 'object' || namesEnglish === null || Array.isArray(namesEnglish)) {
    say(ap, 'should map each airport code to its English name')
  } else {
    for (const code of Object.keys(namesEnglish)) if (!(code in names)) say(ap, `${code} is not in ${shown(AIRPORTS)}`)
    for (const [code, name] of Object.entries(names)) {
      const english = namesEnglish[code]
      text(`${ap} ${code}`, english)
      // 东京·成田 is the city and which of its airports: Tokyo·Narita.
      if (typeof english === 'string' && name.includes('·') !== english.includes('·')) {
        say(`${ap} ${code}`, `"${english}" should split into city·airport exactly where "${name}" does`)
      }
    }
  }

  // flights.json names a stop's city in Chinese; the English is found through
  // the airport in that city, so there has to be one.
  const cities = new Set(Object.values(names).map((name) => name.split('·')[0]))
  for (const [code, city] of Object.entries(flights.stop ?? {})) {
    if (!cities.has(city)) say(shown(FLIGHTS), `the stop for ${code}, ${city}, is no airport's city in ${shown(AIRPORTS)} — its English name cannot be found`)
  }
  return problems
}

const isMonth = (m) => Number.isInteger(m) && m >= 1 && m <= 12
const isMonths = (list) => Array.isArray(list) && list.length > 0 && list.every(isMonth)
const unknownKeys = (record, allowed) => Object.keys(record ?? {}).filter((key) => !allowed.includes(key))

export function check(file, events, names, home) {
  const problems = []
  const say = (where, what) => problems.push(`${where}: ${what}`)

  if (typeof names !== 'object' || names === null || Array.isArray(names)) {
    say(shown(AIRPORTS), 'should map each airport code to its name')
    names = {}
  }
  for (const [code, name] of Object.entries(names)) {
    if (!isCode(code)) say(shown(AIRPORTS), `"${code}" is not a three-letter airport code`)
    if (typeof name !== 'string' || !name.trim()) say(shown(AIRPORTS), `${code} has no name`)
  }

  for (const key of unknownKeys(file, ['reviewed', 'destinations'])) say(shown(DESTINATIONS), `unknown key "${key}"`)
  if (!/^\d{4}-\d{2}$/.test(file.reviewed ?? '')) say('reviewed', 'should be YYYY-MM')
  if (!Array.isArray(file.destinations)) {
    say('destinations', 'is not a list')
    return problems
  }

  const library = new Holidays()
  const ids = new Set()
  const rules = new Set()
  for (const d of file.destinations) {
    const at = d.id ?? '(no id)'
    for (const key of unknownKeys(d, DESTINATION_KEYS)) say(at, `unknown key "${key}" — a typo?`)
    for (const key of TEXT_FIELDS) {
      if (typeof d[key] !== 'string' || !d[key].trim()) say(at, `${key} is missing`)
    }
    if (ids.has(d.id)) say(at, 'the id is used twice')
    ids.add(d.id)
    if (!AREAS.includes(d.area)) say(at, `area "${d.area}" is not one of ${AREAS.join(' ')}`)

    if (!Array.isArray(d.countries) || d.countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
      say(at, 'countries should be ISO codes like ["JP"]')
    } else if (new Set(d.countries).size !== d.countries.length) {
      say(at, 'a country is listed twice — its holidays would show twice')
    }
    if (d.holidayRegion !== undefined) {
      const states = d.countries?.[0] ? library.getStates(d.countries[0], 'en') ?? {} : {}
      if (typeof d.holidayRegion !== 'string' || !states[d.holidayRegion]) {
        say(at, `holidayRegion "${d.holidayRegion}" is not a region date-holidays knows for ${d.countries?.[0]}`)
      }
    }

    // 地方: the towns a trip there is logged as, at least one, each once. The
    // part is the stretch of a region with several entries — 四川's 九寨沟黄龙.
    if (
      !Array.isArray(d.cities) ||
      d.cities.length === 0 ||
      d.cities.some((city) => typeof city !== 'string' || !city.trim())
    ) {
      say(at, 'cities should name at least one town, like ["三亚", "海口"]')
    } else if (new Set(d.cities).size !== d.cities.length) {
      say(at, 'a city is listed twice')
    }
    if (d.part !== undefined && (typeof d.part !== 'string' || !d.part.trim())) {
      say(at, 'part should be the stretch of the region this covers, or left out')
    }

    // The airports it is flown to — none for somewhere nobody can fly to now —
    // and, where the usual way in is overland from a bigger one, that one.
    if (!Array.isArray(d.airports) || !d.airports.every(isCode)) {
      say(at, 'airports should be a list of codes like ["NRT", "HND"], or [] for none')
    } else if (new Set(d.airports).size !== d.airports.length) {
      say(at, 'an airport is listed twice')
    }
    if (d.via !== undefined && (typeof d.via !== 'object' || d.via === null || Array.isArray(d.via))) {
      say(`${at} via`, 'should be { "airports": [...], "t": "..." }')
    } else if (d.via !== undefined) {
      for (const key of unknownKeys(d.via, VIA_KEYS)) say(`${at} via`, `unknown key "${key}" — a typo?`)
      if (!Array.isArray(d.via.airports) || d.via.airports.length === 0 || !d.via.airports.every(isCode)) {
        say(`${at} via`, 'airports should name at least one airport')
      } else if (d.via.airports.some((code) => d.airports?.includes(code))) {
        say(`${at} via`, 'an airport is under both airports and via')
      }
      if (typeof d.via.t !== 'string' || !d.via.t.trim()) say(`${at} via`, 'should say how to go on from there')
    }
    const codes = [
      ...(Array.isArray(d.airports) ? d.airports : []),
      ...(Array.isArray(d.via?.airports) ? d.via.airports : []),
    ]
    for (const code of codes) {
      if (isCode(code) && !names[code]) say(at, `airport ${code} has no name in ${shown(AIRPORTS)}`)
    }

    if (
      !Array.isArray(d.ratings) ||
      d.ratings.length !== 12 ||
      d.ratings.some((r) => ![0, 1, 2, 3].includes(r))
    ) {
      say(at, 'ratings should be twelve numbers from 0 to 3')
    } else if (!d.ratings.includes(3)) {
      say(at, 'no month is rated 3 — every destination has a best time')
    }
    if (!Array.isArray(d.notes) || d.notes.length !== 12 || d.notes.some((n) => typeof n !== 'string' || !n.trim())) {
      say(at, 'notes should be twelve sentences, January first')
    }
    if (!Array.isArray(d.highlights)) say(at, 'highlights should be a list')
    for (const [i, h] of (d.highlights ?? []).entries()) {
      const where = `${at} highlight ${i + 1}`
      for (const key of unknownKeys(h, HIGHLIGHT_KEYS)) say(where, `unknown key "${key}" — a typo?`)
      if (typeof h.t !== 'string' || !h.t.trim()) say(where, 'has no text')
      if (!isMonths(h.m)) say(where, 'm should be months from 1 to 12')
      if (h.rule !== undefined) {
        if (typeof h.rule !== 'string') say(where, 'rule should be text')
        else rules.add(h.rule)
      }
      if (h.offset !== undefined && !Number.isInteger(h.offset)) say(where, 'offset should be whole days')
      if (h.days !== undefined && !(Number.isInteger(h.days) && h.days >= 1)) say(where, 'days should be 1 or more')
      if ((h.offset !== undefined || h.days !== undefined) && h.rule === undefined) {
        say(where, 'offset and days only mean something with a rule')
      }
    }

    const texts = [
      ...TEXT_FIELDS.map((key) => d[key]),
      ...(d.notes ?? []),
      ...(d.highlights ?? []).map((h) => h.t),
      d.via?.t,
      d.part,
      ...(Array.isArray(d.cities) ? d.cities : []),
    ]
    for (const text of texts) {
      if (typeof text === 'string' && A_YEAR.test(text)) {
        say(at, `names a year ("${text.match(/.{0,12}\d{4}\s*年.{0,12}/)?.[0]}") — put it in events.json, or give the highlight a rule`)
      }
    }
  }

  // A rule the library cannot read would quietly fall back to the usual
  // months for ever, so it is an error here rather than a surprise later.
  const thisYear = new Date().getFullYear()
  const probe = new Holidays()
  const quiet = console.error
  console.error = () => {}
  const unreadable = new Set()
  for (const rule of rules) {
    if (!probe.setHoliday(rule, { name: { en: rule }, type: 'public' })) {
      unreadable.add(rule)
      say(`rule "${rule}"`, 'date-holidays cannot read it')
    }
  }
  const readable = [...rules].filter((rule) => !unreadable.has(rule))
  const worked = ruleDates(readable, thisYear)
  const next = ruleDates(readable, thisYear + 1)
  console.error = quiet
  for (const rule of readable) {
    if (!worked.has(rule) && !next.has(rule)) say(`rule "${rule}"`, `gives no date in ${thisYear} or ${thisYear + 1}`)
  }

  if (typeof events !== 'object' || events === null || Array.isArray(events)) {
    say(shown(EVENTS), 'should be an object of years')
    return problems
  }
  for (const [year, list] of Object.entries(events)) {
    if (!/^\d{4}$/.test(year)) say(`events "${year}"`, 'should be a year')
    if (!Array.isArray(list)) {
      say(`events ${year}`, 'should be a list')
      continue
    }
    for (const [i, e] of list.entries()) {
      const where = `events ${year} #${i + 1}`
      for (const key of unknownKeys(e, EVENT_KEYS)) say(where, `unknown key "${key}" — a typo?`)
      if (typeof e.t !== 'string' || !e.t.trim()) say(where, 'has no text')
      if (!isMonths(e.m)) say(where, 'm should be months from 1 to 12')
      if (!Array.isArray(e.ids) || e.ids.length === 0) say(where, 'ids should name at least one destination')
      for (const id of e.ids ?? []) if (!ids.has(id)) say(where, `no destination has the id "${id}"`)
    }
  }

  // A name nothing uses is an airport taken out of a destination and left
  // behind. Kept out, so the file stays the list of the ones that matter.
  const list = (codes) => (Array.isArray(codes) ? codes : [])
  const used = new Set(file.destinations.flatMap((d) => [...list(d.airports), ...list(d.via?.airports)]))
  for (const code of Object.keys(names)) {
    if (!used.has(code) && !home.includes(code)) say(shown(AIRPORTS), `${code} is named but no destination uses it`)
  }

  return problems
}

/** 中国·四川·九寨沟黄龙, 日本·北海道, 新加坡: a destination as the reports name it. */
const whereOf = (d) =>
  d.region === d.country ? d.country : [d.country, d.region, d.part].filter(Boolean).join('·')

// ---------------------------------------------------------------- flights

/**
 * How a destination is reached from home: the same as `reachOf` in
 * src/seasons/seasons.ts. Home itself, or reached by land from it; else the
 * best flight, nonstop before a stop before seasonal before a charter, and
 * at the place before one a train or a drive away; else a change of plane.
 */
export function reachOf(d, flights, kinds) {
  const via = d.via?.airports ?? []
  if ([...d.airports, ...via].some((code) => flights.home.includes(code))) return { kind: 'home' }
  for (const kind of ROUTE_KINDS) {
    for (const [codes, over] of [[d.airports, false], [via, true]]) {
      const hits = codes.filter((code) => kinds.get(code) === kind)
      if (hits.length) return { kind, codes: hits, via: over }
    }
  }
  return { kind: 'connect' }
}

function flightsReport(file, flights, names) {
  // The check has made sure each code is under one kind only.
  const kinds = new Map([...routeKinds(flights)].map(([code, list]) => [code, list[0]]))
  const groups = new Map()
  // A way in overland from an airport nothing flies to any more: the sheet
  // leaves it out, and it is worth a look — the route may come back, or a
  // better airport may have a flight now.
  const stranded = []
  for (const d of file.destinations) {
    const reach = reachOf(d, flights, kinds)
    const flown = (code) => kinds.has(code) || flights.home.includes(code)
    if (d.via && !d.via.airports.some(flown)) stranded.push(`  ${d.id}  via ${d.via.airports.join(' ')}`)
    const key = reach.kind === 'home' || reach.kind === 'connect' ? reach.kind : `${reach.kind}${reach.via ? ' then overland' : ''}`
    const where = whereOf(d)
    const codes = reach.codes ? `  ${reach.codes.map((code) => `${names[code]} ${code}`).join('、')}` : ''
    groups.set(key, [...(groups.get(key) ?? []), `  ${d.id.padEnd(30)} ${where}${codes}`])
  }
  console.log(`\nFrom ${flights.from}, routes checked ${flights.checked}\n`)
  const order = ['home', ...ROUTE_KINDS.flatMap((kind) => [kind, `${kind} then overland`]), 'connect']
  for (const key of order) {
    const lines = groups.get(key)
    if (!lines) continue
    console.log(`${key} (${lines.length}):`)
    for (const line of lines) console.log(line)
    console.log('')
  }
  if (stranded.length) {
    console.log(`Overland from an airport with no flight now (${stranded.length}):`)
    for (const line of stranded) console.log(line)
    console.log('')
  }
}

// ----------------------------------------------------------------- report

function report(file, events, year) {
  const ruled = []
  const rules = new Set()
  for (const d of file.destinations) {
    for (const h of d.highlights) {
      if (h.rule) {
        ruled.push({ d, h })
        rules.add(h.rule)
      }
    }
  }
  const around = [year - 1, year, year + 1].map((y) => ruleDates([...rules], y))

  console.log(`\nSeasons in ${year}\n`)
  console.log(`${file.destinations.length} destinations, last read through ${file.reviewed}.`)

  const rows = []
  for (const { d, h } of ruled) {
    for (const { start, end } of spansIn(h, around, year)) {
      const where = whereOf(d)
      rows.push({ start, line: `  ${label(start, end).padEnd(14, '　')} ${where}  ${h.t}` })
    }
  }
  rows.sort((a, b) => a.start.localeCompare(b.start))
  console.log(`\nFestivals worked out for ${year} (${rows.length}):`)
  for (const row of rows) console.log(row.line)

  const once = events[year] ?? []
  console.log(`\nOne-off events in ${year} (${once.length}):`)
  if (once.length === 0) {
    console.log(`  None yet. Add the year's Olympics, eclipses and expos to ${shown(EVENTS)}.`)
  }
  for (const e of once) console.log(`  ${e.m.join('、')}月  ${e.t}  [${e.ids.join(' ')}]`)
}

function review(file) {
  let count = 0
  for (const d of file.destinations) {
    const lines = []
    const fields = [['tips', d.tips], ['avoid', d.avoid], ...d.highlights.map((h, i) => [`highlight ${i + 1}`, h.t])]
    for (const [field, text] of fields) {
      for (const sentence of text.split(/(?<=[。；！？])/)) {
        if (CHANGEABLE.test(sentence)) lines.push(`    ${field}: ${sentence.trim()}`)
      }
    }
    if (lines.length) {
      count += lines.length
      console.log(`  ${d.id}  ${whereOf(d)}`)
      for (const line of lines) console.log(line)
    }
  }
  console.log(`\n${count} sentences to read again. Change what is out of date, then set "reviewed" in ${shown(DESTINATIONS)}.`)
  console.log(`Change the same sentence in ${shown(DESTINATIONS_EN)} — the English does not follow by itself.`)
}

/**
 * places.json, which scripts/places.mjs writes: a card renamed or taken out
 * here would leave its towns filed under nothing, so every id it names has
 * to be a card, and every place's parent has to come before it.
 */
function checkPlaces(file, places) {
  const problems = []
  const say = (what) => problems.push(`${shown(PLACES)}: ${what}`)
  const ids = new Set(file.destinations.map((d) => d.id))
  for (const [id, list] of Object.entries(places.places ?? {})) {
    if (!ids.has(id)) say(`${id} is no destination — run npm run places -- build again`)
    if (!Array.isArray(list)) {
      say(`${id} should be a list`)
      continue
    }
    list.forEach((row, i) => {
      const [zh, en, parent = -1, flags = 0] = Array.isArray(row) ? row : []
      if (typeof zh !== 'string' || typeof en !== 'string' || !en) say(`${id} place ${i + 1} should be [中文, English, …]`)
      if (!Number.isInteger(parent) || parent < -1 || parent >= i) say(`${id} place ${i + 1}'s parent should come before it`)
      if (!Number.isInteger(flags) || flags < 0 || flags > 7) say(`${id} place ${i + 1} has flags ${flags}`)
    })
  }
  return problems
}

// ------------------------------------------------------------------- main

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const yearArg = args.indexOf('--year')
const year = yearArg >= 0 ? Number(args[yearArg + 1]) : new Date().getFullYear() + 1

const file = JSON.parse(readFileSync(DESTINATIONS, 'utf8'))
const events = JSON.parse(readFileSync(EVENTS, 'utf8'))
const names = JSON.parse(readFileSync(AIRPORTS, 'utf8'))
const flights = JSON.parse(readFileSync(FLIGHTS, 'utf8'))
const english = JSON.parse(readFileSync(DESTINATIONS_EN, 'utf8'))
const eventsEnglish = JSON.parse(readFileSync(EVENTS_EN, 'utf8'))
const namesEnglish = JSON.parse(readFileSync(AIRPORTS_EN, 'utf8'))
const places = JSON.parse(readFileSync(PLACES, 'utf8'))

// Checked before anything is written, so --format never rewrites a file it
// would have refused.
const problems = [
  ...checkFlights(flights, names),
  ...check(file, events, names, Array.isArray(flights.home) ? flights.home : []),
  ...checkPlaces(file, places),
]
// The English is only worth comparing with Chinese that is itself sound.
if (problems.length === 0) {
  problems.push(...checkEnglish(file, english, events, eventsEnglish, names, namesEnglish, flights))
}
if (problems.length) {
  console.error(`Seasons: ${problems.length} problem${problems.length === 1 ? '' : 's'} in the data.\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

if (flag('--format')) {
  writeFileSync(DESTINATIONS, formatDestinations(file))
  writeFileSync(EVENTS, formatEvents(events))
  writeFileSync(AIRPORTS, formatAirports(names))
  writeFileSync(FLIGHTS, formatFlights(flights))
  // The English in the Chinese order, so the two files read side by side.
  const ordered = Object.fromEntries(file.destinations.map((d) => [d.id, english[d.id]]))
  writeFileSync(DESTINATIONS_EN, formatEnglish(ordered))
  writeFileSync(EVENTS_EN, formatEventsEnglish(eventsEnglish))
  writeFileSync(AIRPORTS_EN, formatAirports(namesEnglish))
  const written = [DESTINATIONS, EVENTS, AIRPORTS, FLIGHTS, DESTINATIONS_EN, EVENTS_EN, AIRPORTS_EN]
  console.log(`Rewrote ${written.map(shown).join(', ')}.`)
} else if (flag('--check')) {
  console.log(`Seasons: ${file.destinations.length} destinations, all well formed, in Chinese and English.`)
} else if (flag('--review')) {
  review(file)
} else if (flag('--flights')) {
  flightsReport(file, flights, names)
} else {
  if (!Number.isInteger(year) || year < 1970) {
    console.error('--year needs a year, like --year 2028')
    process.exit(1)
  }
  report(file, events, year)
}
