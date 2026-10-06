/**
 * Keeps Malaysia's public holidays current, in src/lib/holidays-my.json.
 *
 * Run every day by .github/workflows/holidays.yml, and by hand with
 * `npm run holidays`. Nobody has to remember to do anything when a year turns:
 *
 * 1. **The government's list.** The Prime Minister's Department publishes
 *    each year's holidays, federal and state, as a PDF on
 *    kabinet.gov.my/hari-kelepasan-am, usually in August for the year after.
 *    Every PDF linked there is read (holidays-pdf.mjs) and replaces what the
 *    file had for that year. A year that cannot be read keeps what it had.
 *
 * 2. **The days announced later.** A Prime Minister can give the country an
 *    extra day — 20 March 2026, for Raya — long after the PDF is printed, and
 *    the PDF is not reprinted for it. Google's public holiday calendar for
 *    Malaysia picks those up within days, so a day it lists as a holiday for
 *    the whole country, on a date the government's list has nothing, is added
 *    as an extra. Only for the whole country, and only confirmed ones: Google
 *    leaves out the single-state holidays and guesses the moon a year ahead,
 *    so it is a way of hearing about late additions and nothing more.
 *
 * Replacement days (a Sunday holiday's Monday) are not written here at all.
 * They follow a rule, and the app works them out — see lib/holidays-my.ts.
 *
 * The file changes only when the holidays do: no timestamps, nothing that
 * moves on a day when nothing happened. The workflow commits it when it does.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { COLUMNS, readGazette } from './holidays-pdf.mjs'

const PAGE = 'https://www.kabinet.gov.my/hari-kelepasan-am/'
const GOOGLE =
  'https://calendar.google.com/calendar/ical/en.malaysia%23holiday%40group.v.calendar.google.com/public/basic.ics'
const OUT = 'src/lib/holidays-my.json'

/**
 * The gazette's Malay names, as a Malaysian would say them in English.
 * First match wins, so the second and third days come before the first.
 * Anything not here keeps the gazette's own name, which is still right.
 */
const NAMES = [
  // "Baharu" since 2024, "Baru" before.
  [/^Tahun Ba(ha)?ru Cina \(Hari Kedua\)/i, 'Chinese New Year (2nd day)'],
  [/^Tahun Ba(ha)?ru Cina/i, 'Chinese New Year'],
  [/^Tahun Ba(ha)?ru/i, "New Year's Day"],
  [/^Israk (dan|&) Mikraj/i, 'Israk & Mikraj'],
  [/Yang di-Pertuan Besar Negeri Sembilan/i, 'Birthday of the Yang di-Pertuan Besar'],
  [/Thaipusam/i, 'Thaipusam'],
  [/Wilayah Persekutuan/i, 'Federal Territory Day'],
  [/^Awal Ramadh?an/i, 'Awal Ramadan'],
  [/Pengisytiharan Tarikh Kemerdekaan/i, 'Melaka Independence Declaration Day'],
  [/Bandaraya Bersejarah/i, 'Melaka Historic City Day'],
  [/Nuzul Al-?Quran/i, 'Nuzul Al-Quran'],
  [/Pertabalan Sultan Terengganu/i, "Sultan of Terengganu's Installation Day"],
  [/^Hari Raya (Puasa|Aidilfitri) \(Hari Ketiga\)/i, 'Hari Raya Aidilfitri (3rd day)'],
  [/^Hari Raya (Puasa|Aidilfitri) \(Hari Kedua\)/i, 'Hari Raya Aidilfitri (2nd day)'],
  [/^Hari Raya (Puasa|Aidilfitri)/i, 'Hari Raya Aidilfitri'],
  [/Keputeraan Sultan Johor/i, "Sultan of Johor's Birthday"],
  [/Good Friday/i, 'Good Friday'],
  [/Pertua Negeri Sabah/i, "Sabah Governor's Birthday"],
  [/Keputeraan Sultan Terengganu/i, "Sultan of Terengganu's Birthday"],
  [/^Hari Pekerja/i, 'Labour Day'],
  [/^Hari Arafah/i, 'Hari Arafah'],
  [/Raja Perlis/i, "Raja of Perlis's Birthday"],
  [/^Hari Raya (Qurban|Haji) \(Hari Kedua\)/i, 'Hari Raya Haji (2nd day)'],
  [/^Hari Raya (Qurban|Haji)/i, 'Hari Raya Haji'],
  [/Wesak/i, 'Wesak Day'],
  [/Hol .*Sultan Ahmad Shah|Hol Pahang/i, 'Hari Hol of Pahang'],
  [/Kaamatan/i, 'Pesta Kaamatan'],
  [/Gawai/i, 'Hari Gawai'],
  [/Awal Muharr?am/i, 'Awal Muharram'],
  [/Yang di-Pertuan Agong/i, "Agong's Birthday"],
  [/Keputeraan Sultan Kedah/i, "Sultan of Kedah's Birthday"],
  [/Tapak Warisan Dunia/i, 'George Town World Heritage Day'],
  [/Pertua Negeri Pulau Pinang/i, "Penang Governor's Birthday"],
  [/Hol .*Sultan Iskandar/i, 'Hari Hol of Sultan Iskandar'],
  [/Kemerdekaan Sarawak|^Hari Sarawak/i, 'Sarawak Day'],
  [/Keputeraan Sultan Pahang/i, "Sultan of Pahang's Birthday"],
  [/Maulidur Rasul/i, 'Maulidur Rasul'],
  [/Pertua Negeri Melaka/i, "Melaka Governor's Birthday"],
  [/^Hari Kebangsaan/i, 'National Day'],
  [/^Hari Malaysia/i, 'Malaysia Day'],
  [/Keputeraan Sultan Kelantan/i, "Sultan of Kelantan's Birthday"],
  [/Pertua Negeri Sarawak/i, "Sarawak Governor's Birthday"],
  [/Deepavali/i, 'Deepavali'],
  [/Keputeraan Sultan Perak/i, "Sultan of Perak's Birthday"],
  [/Keputeraan Sultan Selangor/i, "Sultan of Selangor's Birthday"],
  [/Christmas Eve/i, 'Christmas Eve'],
  [/Krismas|Christmas/i, 'Christmas Day'],
]

const englishName = (official) =>
  NAMES.find(([pattern]) => pattern.test(official))?.[1] ?? official.replace(/\s+\d{4}$/, '')

const allStates = (states) => (states.length === COLUMNS.length ? '*' : states)

async function fetchOk(url, as) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'SchedulePlan holiday updater (github.com/KaonHew02/SchedulePlan)' },
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return as === 'bytes' ? new Uint8Array(await response.arrayBuffer()) : response.text()
}

/** The PDFs the page links to, by year. A later link for a year wins: an amended list. */
async function gazettes() {
  const html = await fetchOk(PAGE)
  const found = new Map()
  for (const match of html.matchAll(/href="([^"]*?hka[_-]?(\d{4})[^"]*?\.pdf)"/gi)) {
    found.set(Number(match[2]), new URL(match[1], PAGE).href)
  }
  if (!found.size) throw new Error(`No holiday PDFs are linked from ${PAGE} any more.`)
  return found
}

/** One year's rows, merged into holidays: a row per day per name, states joined. */
function holidaysOf(rows) {
  const byKey = new Map()
  for (const row of rows) {
    const name = englishName(row.official)
    const key = `${row.date}|${name}`
    const known = byKey.get(key)
    if (known) for (const state of row.states) known.states.add(state)
    else byKey.set(key, { date: row.date, name, states: new Set(row.states) })
  }
  const list = [...byKey.values()]
    .map((one) => ({ ...one, states: COLUMNS.filter((state) => one.states.has(state)) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))

  // Two days in a row with one name — Kaamatan, Gawai, the Sultan of
  // Kelantan's birthday — print the same name twice. The second is the 2nd day.
  for (const one of list) {
    const before = list.find(
      (other) =>
        other.name === one.name &&
        other.states.join() === one.states.join() &&
        daysBetween(other.date, one.date) === 1,
    )
    if (before) one.name = `${one.name} (2nd day)`
  }
  return list.map((one) => ({ date: one.date, name: one.name, states: allStates(one.states) }))
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** Google's public holidays for Malaysia, confirmed ones only. */
async function googleHolidays() {
  const text = (await fetchOk(GOOGLE)).replace(/\r?\n[ \t]/g, '')
  const events = []
  for (const block of text.split('BEGIN:VEVENT').slice(1)) {
    const field = (name) =>
      block
        .match(new RegExp(`^${name}[^:\\n]*:(.*)$`, 'm'))?.[1]
        ?.replace(/\\,/g, ',')
        .replace(/\\n/g, '\n')
        .trim()
    const start = field('DTSTART')
    const description = field('DESCRIPTION') ?? ''
    if (!start || !/^Public holiday/.test(description) || /tentative/i.test(description)) continue
    events.push({
      date: `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`,
      name: (field('SUMMARY') ?? '').replace(/\s*\((regional holiday|tentative)\)/gi, '').trim(),
      // "Public holiday" alone; a state's says "Public holiday in Johor, …".
      nationwide: !/^Public holiday in /.test(description),
    })
  }
  return events
}

/** The file as it was, or an empty one. */
function previous() {
  if (!existsSync(OUT)) return { source: PAGE, years: {}, extras: [] }
  return JSON.parse(readFileSync(OUT, 'utf8'))
}

/** One holiday per line, so a change to one is a one-line diff. */
function stringify(data) {
  const row = (one) => `        ${JSON.stringify(one)}`
  const years = Object.entries(data.years)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(
      ([year, { pdf, holidays }]) =>
        `    "${year}": {\n      "pdf": ${JSON.stringify(pdf)},\n      "holidays": [\n` +
        holidays.map(row).join(',\n') +
        '\n      ]\n    }',
    )
  const extras = data.extras.map((one) => `    ${JSON.stringify(one)}`)
  return (
    '{\n' +
    `  "source": ${JSON.stringify(data.source)},\n` +
    `  "years": {\n${years.join(',\n')}\n  },\n` +
    `  "extras": [${extras.length ? `\n${extras.join(',\n')}\n  ` : ''}]\n` +
    '}\n'
  )
}

const report = []
const problems = []
const say = (line) => {
  console.log(line)
  report.push(line)
}

const before = previous()
const next = { source: PAGE, years: { ...before.years }, extras: [...(before.extras ?? [])] }

// A day the site is down is not worth an email: tomorrow's run will get it.
// What is worth one is the list staying missing, which is checked at the end.
let linked = new Map()
try {
  linked = await gazettes()
} catch (error) {
  say(`Could not read the government's holiday page — ${error.message}`)
}

// Every year is read again every time, gone-by ones too: it is a few MB on
// GitHub's machines, and it means a better reading of the PDFs reaches all of
// them. A year that fails keeps what it had.
for (const [year, url] of [...linked].sort(([a], [b]) => a - b)) {
  const had = before.years[year]
  try {
    const holidays = holidaysOf(await readGazette(await fetchOk(url, 'bytes'), year))
    next.years[year] = { pdf: url, holidays }
    if (JSON.stringify(had) !== JSON.stringify(next.years[year])) {
      say(`${year}: ${had ? 'updated' : 'added'} — ${holidays.length} holidays, from ${url}`)
    }
  } catch (error) {
    // Keep what the year had. Only a year with nothing at all is a failure:
    // that is the new year's list arriving in a shape this cannot read.
    const message = `${year}: could not read ${url} — ${error.message}`
    if (had) say(`${message}. Kept the list it had.`)
    else problems.push(message)
  }
}

try {
  for (const event of await googleHolidays()) {
    const year = event.date.slice(0, 4)
    const official = next.years[year]?.holidays
    if (!official || !event.nationwide) continue
    if (/\bobserved\b|day off/i.test(event.name)) continue
    const taken = official.some((one) => one.date === event.date)
    const known = next.extras.some((one) => one.date === event.date)
    if (taken || known) continue
    const name = /raya puasa|aidilfitri/i.test(event.name)
      ? 'Hari Raya Aidilfitri (extra holiday)'
      : `${event.name.replace(/\s+holiday$/i, '')} (extra holiday)`
    next.extras.push({ date: event.date, name, states: '*', from: 'Google Calendar' })
    say(`${event.date}: added ${name}, announced after the government's list was printed`)
  }
  next.extras.sort((a, b) => a.date.localeCompare(b.date))
} catch (error) {
  // Extras are a bonus. The government's list is the thing that matters.
  say(`Could not check Google's calendar for late additions — ${error.message}`)
}

const text = stringify(next)
const changed = !existsSync(OUT) || readFileSync(OUT, 'utf8') !== text
if (changed) writeFileSync(OUT, text)

// The one failure that matters, however it came about — the page moved, the
// site turned GitHub away, the PDF changed shape: the list for the year
// ahead still missing in December. The government has always published it
// by November.
const now = new Date()
const due = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
if (!next.years[due]) {
  problems.push(
    `There is no official list for ${due} yet, and by now there always has been. ` +
      `Check ${PAGE} — the app shows ${due} as "not confirmed yet" until this is fixed.`,
  )
}

const years = Object.keys(next.years)
say(
  changed
    ? `Wrote ${OUT}: official lists for ${years[0]}–${years[years.length - 1]}.`
    : `No change. Official lists for ${years[0]}–${years[years.length - 1]}.`,
)
for (const problem of problems) console.error(problem)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Malaysian public holidays\n\n${[...report, ...problems].map((line) => `- ${line}`).join('\n')}\n`,
  )
}

// Fail loudly so the workflow shows red and its owner is emailed. The file
// keeps the years that did read, and the app shows the rest as estimates.
if (problems.length) process.exitCode = 1
