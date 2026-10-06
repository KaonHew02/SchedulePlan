/**
 * Reads one year's official holiday list — the PDF the Prime Minister's
 * Department publishes at kabinet.gov.my — into rows: a date, a name, and the
 * states that have it.
 *
 * The PDF is a table: a row per holiday and a column per state, sixteen of
 * them. Which states have a holiday is drawn, not written, and every year has
 * drawn it differently:
 *
 *   2023  a √ where the state has it, and a - where it does not
 *   2024  a - where it does not; the federal page broken into word fragments
 *   2025  a Wingdings tick (U+F0FC) where it has it, the state names in the header
 *   2026  a √ on the federal page, a - on the state pages, every word separate
 *   2027  a - where it does not; the ticks are pictures and not text at all
 *
 * So nothing here trusts a fixed position or a fixed symbol. Each row is found
 * by what it says — a day, a Malay month and the weekday, in that order — and
 * the weekday is checked against the date, which is how a misread date is
 * caught. The sixteen columns are found by where the marks fall. And at the
 * end a dozen things that are always true are checked: Federal Territory Day
 * belongs to the three federal territories and nowhere else, the Sultan of
 * Johor's birthday to Johor. If the columns were read in the wrong order, one
 * of those fails, and nothing is written. A wrong calendar is worse than an
 * old one.
 */

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const MONTHS = [
  'januari',
  'februari',
  'mac',
  'april',
  'mei',
  'jun',
  'julai',
  'ogos',
  'september',
  'oktober',
  'november',
  'disember',
]

const WEEKDAYS = { ahad: 0, isnin: 1, selasa: 2, rabu: 3, khamis: 4, jumaat: 5, sabtu: 6 }

/** The states, in the order the gazette's columns have always run. */
export const COLUMNS = [
  'KUL',
  'LBN',
  'PJY',
  'JHR',
  'KDH',
  'KTN',
  'MLK',
  'NSN',
  'PHG',
  'PRK',
  'PLS',
  'PNG',
  'SBH',
  'SWK',
  'SGR',
  'TRG',
]

/** For the years whose header names the columns in text. */
const HEADERS = [
  [/LUMPUR/, 'KUL'],
  [/LABUAN/, 'LBN'],
  [/PUTRAJAYA/, 'PJY'],
  [/JOHOR/, 'JHR'],
  [/KEDAH/, 'KDH'],
  [/KELANTAN/, 'KTN'],
  [/MELAKA/, 'MLK'],
  [/SEMBILAN/, 'NSN'],
  [/PAHANG/, 'PHG'],
  [/PERAK/, 'PRK'],
  [/PERLIS/, 'PLS'],
  [/PINANG/, 'PNG'],
  [/SABAH/, 'SBH'],
  [/SARAWAK/, 'SWK'],
  [/SELANGOR/, 'SGR'],
  [/TERENGGANU/, 'TRG'],
]

/**
 * Holidays that only ever belong to one place. If the columns were read in
 * the wrong order, these are what come out wrong.
 */
const ALWAYS = [
  [/Wilayah Persekutuan/i, ['KUL', 'LBN', 'PJY']],
  [/Yang di-Pertuan Besar Negeri Sembilan/i, ['NSN']],
  [/Keputeraan Sultan Johor/i, ['JHR']],
  [/Keputeraan Sultan Kedah/i, ['KDH']],
  [/Keputeraan Sultan Kelantan/i, ['KTN']],
  [/Pertua Negeri Melaka/i, ['MLK']],
  [/Keputeraan Sultan Pahang/i, ['PHG']],
  [/Keputeraan Sultan Perak/i, ['PRK']],
  [/Raja Perlis/i, ['PLS']],
  [/Pertua Negeri Pulau Pinang/i, ['PNG']],
  [/Pertua Negeri Sabah/i, ['SBH']],
  [/Gawai/i, ['SWK']],
  [/Keputeraan Sultan Selangor/i, ['SGR']],
  [/Keputeraan Sultan Terengganu/i, ['TRG']],
]

const isDash = (text) => /^[-–—]$/.test(text)
/** √, ✓, ✔, or a symbol font's tick in the private use area. */
const isTick = (text) => text.length <= 2 && !isDash(text) && !/[\p{L}\p{N}().,*:]/u.test(text)

/**
 * The text of a page as lines of words, each word with where it starts.
 *
 * pdf.js hands back runs of text, and how a PDF splits its text into runs is
 * up to whatever wrote it: 2024's federal page has "B", "ahag", "ian" for
 * "Bahagian". Runs that touch are one word; a gap is a space.
 */
function readLines(items) {
  const runs = items
    .filter((item) => item.str.trim() && item.transform[1] === 0 && item.transform[2] === 0)
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      end: item.transform[4] + item.width,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines = []
  for (const run of runs) {
    // Rows are about 18 points apart. Within 3 is one line: 2025 prints a
    // date 1.6 points above the rest of its row.
    const line = lines.find((one) => Math.abs(one.y - run.y) < 3)
    if (line) line.runs.push(run)
    else lines.push({ y: run.y, runs: [run] })
  }

  for (const line of lines) {
    line.runs.sort((a, b) => a.x - b.x)
    const words = []
    let previousEnd = -Infinity
    for (const run of line.runs) {
      // Touching, not overlapping: a name too long for its cell runs on under
      // the date, and "Abu Bakar" must not swallow the "22" printed over it.
      const gap = run.x - previousEnd
      const touches = gap < 0.8 && gap > -1
      const perChar = run.text.length ? (run.end - run.x) / run.text.length : 0
      let offset = 0
      for (const [index, part] of run.text.split(/(\s+)/).entries()) {
        if (!part) continue
        if (/^\s+$/.test(part)) {
          offset += part.length
          continue
        }
        const x = run.x + offset * perChar
        const last = words[words.length - 1]
        if (index === 0 && touches && last && !/^\s/.test(run.text)) last.text += part
        else words.push({ text: part, x })
        offset += part.length
      }
      previousEnd = /\s$/.test(run.text) ? -Infinity : run.end
    }
    line.words = words
    line.text = words.map((word) => word.text).join(' ')
  }
  return lines
}

/** The columns' rotated header labels, where a year writes them as text. */
function headerOrder(items) {
  const byX = new Map()
  for (const item of items) {
    if (!item.str.trim() || item.transform[1] === 0) continue
    const x = Math.round(item.transform[4])
    byX.set(x, (byX.get(x) ?? '') + item.str)
  }
  const found = []
  for (const [x, label] of byX) {
    const match = HEADERS.find(([pattern]) => pattern.test(label.toUpperCase()))
    if (match) found.push({ x, state: match[1] })
  }
  const states = [...new Set(found.map((one) => one.state))]
  if (states.length !== COLUMNS.length) return null
  return found.sort((a, b) => a.x - b.x).map((one) => one.state)
}

/** Marks' x positions, gathered into columns. */
function clusters(xs) {
  const sorted = [...xs].sort((a, b) => a - b)
  const groups = []
  for (const x of sorted) {
    const group = groups[groups.length - 1]
    if (group && x - group[group.length - 1] < 6) group.push(x)
    else groups.push([x])
  }
  return groups.map((group) => group.reduce((sum, x) => sum + x, 0) / group.length)
}

const marksIn = (words) =>
  words
    .filter((word) => isDash(word.text) || isTick(word.text))
    .map((word) => ({ x: word.x, tick: isTick(word.text) }))

/** The gazette's name, without the row number, the (P)/(N) or the footnote star. */
const cleanName = (text) =>
  text
    .replace(/^\d+\s*\.?\s*/, '')
    .replace(/\((P|N)\)/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** One table row: the date, the name, and the marks to the right of them. */
function readRow(line, year) {
  const { words } = line
  // Stray punctuation is the gazette's own: 2025 prints "29 September.".
  const bare = (word) => word.text.toLowerCase().replace(/^[.,]+|[.,]+$/g, '')
  for (let index = words.length - 3; index >= 0; index -= 1) {
    const day = Number(bare(words[index]))
    const month = MONTHS.indexOf(bare(words[index + 1]))
    const weekday = WEEKDAYS[bare(words[index + 2])]
    if (!Number.isInteger(day) || day < 1 || day > 31 || month === -1 || weekday === undefined) {
      continue
    }
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const actual = new Date(Date.UTC(year, month, day)).getUTCDay()
    if (actual !== weekday) {
      throw new Error(
        `${date} is printed as ${words[index + 2].text}, which it is not. The date was misread.`,
      )
    }
    return {
      date,
      y: line.y,
      dateX: words[index].x,
      name: words
        .slice(0, index)
        .map((word) => word.text)
        .join(' '),
      marks: marksIn(words.slice(index + 3)),
      wrapped: [],
    }
  }
  return null
}

/** The row whose middle is nearest `y`, if any is near enough. */
function nearest(rows, y, within, key = 'y') {
  let best = null
  for (const row of rows) {
    const distance = Math.abs(row[key] - y)
    if (distance < within && (!best || distance < Math.abs(best[key] - y))) best = row
  }
  return best
}

/**
 * Every holiday in one year's PDF.
 *
 * Returns rows of `{ date, official, states }`, `official` being the name as
 * the gazette prints it, in Malay. Throws when anything does not add up.
 */
export async function readGazette(bytes, year) {
  const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise
  const pages = []

  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number)
    const { items } = await page.getTextContent()
    const lines = readLines(items)

    const title = lines
      .map((line) => line.text.replace(/\s+/g, '').toUpperCase())
      .map((text) => text.match(/JADUALHARIKELEPASANAM(PERSEKUTUANDANNEGERI|PERSEKUTUAN|NEGERI)(\d{4})/))
      .find(Boolean)
    if (!title) continue
    if (Number(title[2]) !== year) {
      throw new Error(`Page ${number} is the table for ${title[2]}, not ${year}.`)
    }
    const kind = { PERSEKUTUAN: 'federal', NEGERI: 'state', PERSEKUTUANDANNEGERI: 'both' }[title[1]]

    const rows = []
    const loose = []
    for (const line of lines) {
      const row = readRow(line, year)
      if (row) rows.push(row)
      else loose.push(line)
    }
    if (!rows.length) continue
    const dateX = Math.min(...rows.map((row) => row.dateX))

    // A cell two lines tall — a name that wraps — has its date on one line
    // and its marks halfway between the two, on a line of their own. Those
    // marks go to the nearest row that has none on its own line.
    for (const line of loose) {
      const marks = marksIn(line.words.filter((word) => word.x > dateX))
      if (!marks.length) continue
      const row = nearest(
        rows.filter((one) => !one.marks.length && one.center === undefined),
        line.y,
        12,
      )
      if (!row) throw new Error(`Page ${number}: marks at y=${line.y.toFixed(1)} belong to no row.`)
      row.marks = marks
      row.center = line.y
    }
    for (const row of rows) row.center ??= row.y

    // And the wrapped lines of the name go to the cell whose middle they are
    // nearest. Not the date's line: in 2025 the date is on the bottom line of
    // the cell, as far from the top line as the row above is.
    const top = Math.max(...rows.map((row) => row.y)) + 15
    const bottom = Math.min(...rows.map((row) => row.y)) - 15
    for (const line of loose) {
      if (line.y > top || line.y < bottom || /catatan|dikeluarkan|:/i.test(line.text)) continue
      const words = line.words.filter((word) => word.x < dateX - 2 && !/^(\d+|\.)$/.test(word.text))
      if (!words.length) continue
      const row = nearest(rows, line.y, 15, 'center')
      if (row) row.wrapped.push({ y: line.y, text: words.map((word) => word.text).join(' ') })
    }
    for (const row of rows) {
      // Each part may start with the row number, which sits at the cell's
      // middle — on the date's line, or on a wrapped one.
      const parts = [...row.wrapped, { y: row.y, text: row.name }].sort((a, b) => b.y - a.y)
      row.name = cleanName(parts.map((part) => cleanName(part.text)).join(' '))
    }

    pages.push({
      number,
      kind,
      width: Math.round(page.view[2]),
      rows,
      header: headerOrder(items),
      columns: clusters(rows.flatMap((row) => row.marks.map((mark) => mark.x))),
    })
  }

  if (!pages.length) throw new Error(`No holiday table found in the ${year} PDF.`)

  // A page with only a few marks may not touch every column. The tables on
  // pages the same size are drawn from one template, so borrow its columns.
  const complete = pages.filter((page) => page.columns.length === COLUMNS.length)
  for (const page of pages) {
    if (page.columns.length === COLUMNS.length) continue
    const twin = complete.find((other) => other.width === page.width)
    if (!twin) {
      throw new Error(`Page ${page.number}: found ${page.columns.length} state columns, not 16.`)
    }
    for (const x of page.columns) {
      if (!twin.columns.some((column) => Math.abs(column - x) < 6)) {
        throw new Error(`Page ${page.number}: a mark at x=${x.toFixed(1)} is in no column.`)
      }
    }
    page.columns = twin.columns
    page.header ??= twin.header
  }

  // The federal and state tables together are everything; the combined one
  // is the same again. Use the pair when a year has it.
  const hasPair = pages.some((page) => page.kind === 'federal') && pages.some((page) => page.kind === 'state')
  const used = pages.filter((page) => (hasPair ? page.kind !== 'both' : page.kind === 'both'))

  const rows = []
  for (const page of used) {
    const order = page.header ?? COLUMNS
    const ticked = page.rows.some((row) => row.marks.some((mark) => mark.tick))
    for (const row of page.rows) {
      const column = (x) => page.columns.findIndex((one) => Math.abs(one - x) < 6)
      const ticks = new Set(row.marks.filter((mark) => mark.tick).map((mark) => column(mark.x)))
      const dashes = new Set(row.marks.filter((mark) => !mark.tick).map((mark) => column(mark.x)))
      for (const index of ticks) {
        if (dashes.has(index)) throw new Error(`${row.date} ${row.name}: ticked and crossed in one column.`)
      }
      let states
      if (ticks.size) states = [...ticks].map((index) => order[index])
      else if (dashes.size || !ticked) states = order.filter((_, index) => !dashes.has(index))
      else throw new Error(`${row.date} ${row.name}: no state is marked.`)
      if (!row.name) throw new Error(`${row.date}: the holiday has no name.`)
      rows.push({ date: row.date, official: row.name, states, federal: page.kind === 'federal' })
    }
  }

  check(rows, year)
  return rows
}

/** The things that are always true, so a misread table cannot be written. */
function check(rows, year) {
  const federal = new Set(rows.filter((row) => row.federal).map((row) => row.date))
  if (rows.some((row) => row.federal) && federal.size < 11) {
    throw new Error(`Only ${federal.size} federal holidays read for ${year}; there are always more.`)
  }

  let checked = 0
  for (const [pattern, states] of ALWAYS) {
    for (const row of rows.filter((one) => pattern.test(one.official))) {
      checked += 1
      if ([...row.states].sort().join() !== [...states].sort().join()) {
        throw new Error(
          `${row.date} ${row.official} is marked for ${row.states.join(' ')}, ` +
            `but it only ever belongs to ${states.join(' ')}. The columns were misread.`,
        )
      }
    }
  }
  if (checked < 8) {
    throw new Error(`Only ${checked} of the single-state holidays were found for ${year}.`)
  }

  for (const [pattern, monthDay] of [
    [/^Hari Kebangsaan/i, '08-31'],
    [/^Hari Malaysia/i, '09-16'],
    [/^Hari Pekerja/i, '05-01'],
  ]) {
    const row = rows.find((one) => pattern.test(one.official))
    if (!row) throw new Error(`No ${pattern.source.slice(1)} in ${year}.`)
    if (row.date !== `${year}-${monthDay}`) throw new Error(`${row.official} is not on ${monthDay}.`)
    if (new Set(rows.filter((one) => one.date === row.date).flatMap((one) => one.states)).size !== 16) {
      throw new Error(`${row.official} is not marked for every state.`)
    }
  }
}
