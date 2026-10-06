/**
 * Seasons: check the travel calendar, and say what a year holds.
 *
 *   npm run seasons                  check, then the report for next year
 *   npm run seasons -- --year 2028   check, then the report for 2028
 *   npm run seasons -- --check       check only — `npm run build` runs this
 *   npm run seasons -- --review      the sentences that go out of date
 *   npm run seasons -- --format      rewrite both files in the house layout
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
 * The check runs before every build, so a file that would draw a broken
 * screen is never published. See docs/SEASONS.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import Holidays from 'date-holidays'

const DESTINATIONS = 'src/seasons/destinations.json'
const EVENTS = 'src/seasons/events.json'

export const AREAS = [
  '中国', '东亚', '东南亚', '南亚', '中亚·高加索', '中东',
  '欧洲', '非洲', '北美', '中南美', '大洋洲', '极地',
]

const TEXT_FIELDS = ['id', 'area', 'country', 'region', 'places', 'summary', 'climate', 'avoid', 'tips']

/**
 * A year written into a sentence: 2027年. Only with the 年 — a bare 2000 is as
 * likely to be metres above the sea, and Lhasa is not a date.
 */
const A_YEAR = /(?<!\d)(?:19|20)\d\d年/

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

/** Every rule's dates in one year. A Hijri rule can fall twice in one. */
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

const label = (start, end) => {
  const [, m1, d1] = start.split('-').map(Number)
  const [, m2, d2] = end.split('-').map(Number)
  if (start === end) return `${m1}月${d1}日`
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
    `{ ${['m', 't', 'rule', 'offset', 'days']
      .filter((key) => h[key] !== undefined)
      .map((key) => `${s(key)}: ${key === 'm' ? `[${h.m.join(', ')}]` : s(h[key])}`)
      .join(', ')} }`
  return [
    '    {',
    ...['id', 'area', 'country', 'region'].map((key) => `      ${s(key)}: ${s(d[key])},`),
    `      "countries": [${d.countries.map((c) => s(c)).join(', ')}],`,
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

// ------------------------------------------------------------------ check

const isMonth = (m) => Number.isInteger(m) && m >= 1 && m <= 12
const isMonths = (list) => Array.isArray(list) && list.length > 0 && list.every(isMonth)

export function check(file, events) {
  const problems = []
  const say = (where, what) => problems.push(`${where}: ${what}`)

  if (!/^\d{4}-\d{2}$/.test(file.reviewed ?? '')) say('reviewed', 'should be YYYY-MM')
  if (!Array.isArray(file.destinations)) {
    say('destinations', 'is not a list')
    return problems
  }

  const ids = new Set()
  const rules = new Set()
  for (const d of file.destinations) {
    const at = d.id ?? '(no id)'
    for (const key of TEXT_FIELDS) {
      if (typeof d[key] !== 'string' || !d[key].trim()) say(at, `${key} is missing`)
    }
    if (ids.has(d.id)) say(at, 'the id is used twice')
    ids.add(d.id)
    if (!AREAS.includes(d.area)) say(at, `area "${d.area}" is not one of ${AREAS.join(' ')}`)
    if (!Array.isArray(d.countries) || d.countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
      say(at, 'countries should be ISO codes like ["JP"]')
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
      if (typeof h.t !== 'string' || !h.t.trim()) say(`${at} highlight ${i + 1}`, 'has no text')
      if (!isMonths(h.m)) say(`${at} highlight ${i + 1}`, 'm should be months from 1 to 12')
      if (h.rule !== undefined) {
        if (typeof h.rule !== 'string') say(`${at} highlight ${i + 1}`, 'rule should be text')
        else rules.add(h.rule)
      }
      if (h.offset !== undefined && !Number.isInteger(h.offset)) say(`${at} highlight ${i + 1}`, 'offset should be whole days')
      if (h.days !== undefined && !(Number.isInteger(h.days) && h.days >= 1)) say(`${at} highlight ${i + 1}`, 'days should be 1 or more')
      if ((h.offset !== undefined || h.days !== undefined) && h.rule === undefined) {
        say(`${at} highlight ${i + 1}`, 'offset and days only mean something with a rule')
      }
    }

    const texts = [d.summary, d.climate, d.avoid, d.tips, ...(d.notes ?? []), ...(d.highlights ?? []).map((h) => h.t)]
    for (const text of texts) {
      if (typeof text === 'string' && A_YEAR.test(text)) {
        say(at, `names a year ("${text.match(/.{0,12}\d{4}年.{0,12}/)?.[0]}") — put it in events.json, or give the highlight a rule`)
      }
    }
  }

  // A rule the library cannot read would quietly fall back to the usual
  // months for ever, so it is an error here rather than a surprise later.
  const thisYear = new Date().getFullYear()
  const probe = new Holidays()
  const quiet = console.error
  console.error = () => {}
  for (const rule of rules) {
    if (!probe.setHoliday(rule, { name: { en: rule }, type: 'public' })) say(`rule "${rule}"`, 'date-holidays cannot read it')
  }
  console.error = quiet
  const worked = ruleDates([...rules], thisYear)
  const next = ruleDates([...rules], thisYear + 1)
  for (const rule of rules) {
    if (!worked.has(rule) && !next.has(rule)) say(`rule "${rule}"`, `gives no date in ${thisYear} or ${thisYear + 1}`)
  }

  for (const [year, list] of Object.entries(events)) {
    if (!/^\d{4}$/.test(year)) say(`events "${year}"`, 'should be a year')
    if (!Array.isArray(list)) {
      say(`events ${year}`, 'should be a list')
      continue
    }
    for (const [i, e] of list.entries()) {
      const where = `events ${year} #${i + 1}`
      if (typeof e.t !== 'string' || !e.t.trim()) say(where, 'has no text')
      if (!isMonths(e.m)) say(where, 'm should be months from 1 to 12')
      if (!Array.isArray(e.ids) || e.ids.length === 0) say(where, 'ids should name at least one destination')
      for (const id of e.ids ?? []) if (!ids.has(id)) say(where, `no destination has the id "${id}"`)
    }
  }

  return problems
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
  const dates = ruleDates([...rules], year)

  console.log(`\nSeasons in ${year}\n`)
  console.log(`${file.destinations.length} destinations, last read through ${file.reviewed}.`)

  const rows = []
  for (const { d, h } of ruled) {
    for (const date of dates.get(h.rule) ?? []) {
      const start = addDays(date, h.offset ?? 0)
      const end = addDays(start, (h.days ?? 1) - 1)
      const where = d.region === d.country ? d.country : `${d.country}·${d.region}`
      rows.push({ start, line: `  ${label(start, end).padEnd(14, '　')} ${where}  ${h.t}` })
    }
  }
  rows.sort((a, b) => a.start.localeCompare(b.start))
  console.log(`\nFestivals worked out for ${year} (${rows.length}):`)
  for (const row of rows) console.log(row.line)

  const once = events[year] ?? []
  console.log(`\nOne-off events in ${year} (${once.length}):`)
  if (once.length === 0) {
    console.log(`  None yet. Add the year's Olympics, eclipses and expos to ${EVENTS}.`)
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
      console.log(`  ${d.id}  ${d.country} · ${d.region}`)
      for (const line of lines) console.log(line)
    }
  }
  console.log(`\n${count} sentences to read again. Change what is out of date, then set "reviewed" in ${DESTINATIONS}.`)
}

// ------------------------------------------------------------------- main

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const yearArg = args.indexOf('--year')
const year = yearArg >= 0 ? Number(args[yearArg + 1]) : new Date().getFullYear() + 1

const file = JSON.parse(readFileSync(DESTINATIONS, 'utf8'))
const events = JSON.parse(readFileSync(EVENTS, 'utf8'))

if (flag('--format')) {
  writeFileSync(DESTINATIONS, formatDestinations(file))
  writeFileSync(EVENTS, formatEvents(events))
  console.log(`Rewrote ${DESTINATIONS} and ${EVENTS}.`)
}

const problems = check(file, events)
if (problems.length) {
  console.error(`Seasons: ${problems.length} problem${problems.length === 1 ? '' : 's'} in the data.\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

if (flag('--check')) {
  console.log(`Seasons: ${file.destinations.length} destinations, all well formed.`)
} else if (flag('--review')) {
  review(file)
} else if (!flag('--format')) {
  if (!Number.isInteger(year) || year < 1970) {
    console.error('--year needs a year, like --year 2028')
    process.exit(1)
  }
  report(file, events, year)
}
