/**
 * Reading text off a photo, and guessing what it means.
 *
 * The original plan wanted a cloud OCR or AI key here. A static site has
 * nowhere safe to keep one — anything shipped to the browser is public, and a
 * key on a public page is a key someone else is spending. So the recognition
 * runs *in the browser*: Tesseract compiled to WebAssembly, pulled in the
 * first time it is asked for and not before, because it is a large download
 * that most sessions never need.
 *
 * It is worse than a paid cloud model, and it is honest about that. Nothing
 * here ever writes a record by itself: `parseReceipt` and `parseItinerary`
 * return *suggestions*, and the screens that call them put every field in
 * front of you to correct before anything is saved.
 */

export interface OcrProgress {
  /** What it is doing, in words a person can read. */
  status: string
  /** 0 to 1. */
  progress: number
}

type Worker = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

let worker: Worker | null = null
let starting: Promise<Worker> | null = null

const SAY: Record<string, string> = {
  'loading tesseract core': 'Loading the reader',
  'initializing tesseract': 'Loading the reader',
  'loading language traineddata': 'Loading English',
  'initializing api': 'Getting ready',
  'recognizing text': 'Reading the page',
}

async function getWorker(onProgress?: (progress: OcrProgress) => void): Promise<Worker> {
  if (worker) return worker
  if (starting) return starting

  starting = (async () => {
    let createWorker: (
      langs: string,
      oem?: number,
      options?: { logger?: (message: { status: string; progress: number }) => void },
    ) => Promise<Worker>
    try {
      ;({ createWorker } = await import('tesseract.js'))
    } catch {
      throw new Error("Couldn't load the text reader. Check your connection and try again.")
    }

    const created = await createWorker('eng', 1, {
      logger: (message) => {
        onProgress?.({
          status: SAY[message.status] ?? 'Working',
          progress: Number(message.progress) || 0,
        })
      },
    })
    worker = created
    return created
  })()

  starting.catch(() => {
    starting = null
  })
  return starting
}

/** Let the WASM worker and its ~12MB of language data go. */
export async function releaseOcr(): Promise<void> {
  const current = worker
  worker = null
  starting = null
  try {
    await current?.terminate()
  } catch {
    /* Already gone. */
  }
}

export async function readText(
  source: Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const engine = await getWorker(onProgress)
  onProgress?.({ status: 'Reading the page', progress: 0 })
  const result = await engine.recognize(source)
  onProgress?.({ status: 'Done', progress: 1 })
  return result.data.text ?? ''
}

// ------------------------------------------------------------------ money

/**
 * Turn what OCR saw into a number.
 *
 * Both conventions appear on receipts, and '1.234,56' and '1,234.56' are the
 * same amount written by different countries. Two rules sort them out:
 *
 * - With both separators present, whichever comes *last* is the decimal point.
 * - With only one, the digits after it decide. Three means it is grouping
 *   thousands; one or two means it is a decimal point.
 *
 * That second rule is what stops a Vietnamese total of 185,000 dong being read
 * as 185 — which is the kind of mistake that looks plausible enough on screen
 * to get saved.
 */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(/[^\d.,-]/g, '')
  if (!text) return null

  const commas = (text.match(/,/g) ?? []).length
  const dots = (text.match(/\./g) ?? []).length
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  let normalised: string

  if (commas && dots) {
    normalised =
      lastComma > lastDot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '')
  } else if (commas || dots) {
    const separator = commas ? ',' : '.'
    const count = commas || dots
    const after = text.length - 1 - (commas ? lastComma : lastDot)
    // Repeated, or grouping three digits: a thousands separator either way.
    const grouping = count > 1 || after === 3
    normalised = grouping
      ? text.split(separator).join('')
      : text.replace(separator, '.')
  } else {
    normalised = text
  }

  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/** Symbols and codes seen on a till slip, mapped to their ISO code. */
const CURRENCY_HINTS: [RegExp, string][] = [
  [/\bRM\b|\bMYR\b|\bRINGGIT\b/i, 'MYR'],
  [/\bSGD\b|\bS\$/i, 'SGD'],
  [/\bUSD\b|\bUS\$/i, 'USD'],
  [/\bTHB\b|฿|\bBAHT\b/i, 'THB'],
  [/\bVND\b|₫|\bDONG\b/i, 'VND'],
  [/\bIDR\b|\bRp\b/i, 'IDR'],
  [/\bEUR\b|€/i, 'EUR'],
  [/\bGBP\b|£/i, 'GBP'],
  [/\bJPY\b|¥|\bYEN\b/i, 'JPY'],
  [/\bAUD\b|\bA\$/i, 'AUD'],
  [/\bPHP\b|₱/i, 'PHP'],
  [/\bHKD\b|\bHK\$/i, 'HKD'],
  [/\bKRW\b|₩/i, 'KRW'],
  [/\bTWD\b|\bNT\$/i, 'TWD'],
  [/\bCNY\b|\bRMB\b/i, 'CNY'],
  [/\bINR\b|₹/i, 'INR'],
]

/** The generic '$' only wins if nothing more specific was found. */
const DOLLAR = /\$/

// ------------------------------------------------------------------ dates

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

const pad = (value: number) => String(value).padStart(2, '0')

function validISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (year < 100) year += year > 70 ? 1900 : 2000
  if (year < 1990 || year > 2100) return null
  const date = new Date(year, month - 1, day)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * The first date in some text, as YYYY-MM-DD.
 *
 * Ambiguous slash dates are read day-first, which is what receipts in
 * Malaysia, Singapore, the UK and most of Europe print. 03/04 on a US receipt
 * will come out as 3 April — which is exactly why the review screen shows the
 * date as a field and not as a fact.
 */
export function findDate(text: string): string | null {
  const numeric = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text)
  if (numeric) {
    const iso = validISO(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]))
    if (iso) return iso
  }

  const slash = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text)
  if (slash) {
    const first = Number(slash[1])
    const second = Number(slash[2])
    // A number above 12 can only be the day, whichever order the rest is in.
    const [day, month] = second > 12 && first <= 12 ? [second, first] : [first, second]
    const iso = validISO(Number(slash[3]), month, day)
    if (iso) return iso
  }

  const named = /\b(\d{1,2})\s*[-\s]\s*([A-Za-z]{3,9})\.?\s*[-,\s]\s*(\d{2,4})\b/.exec(text)
  if (named) {
    const month = MONTHS[named[2].slice(0, 4).toLowerCase()] ?? MONTHS[named[2].slice(0, 3).toLowerCase()]
    if (month) {
      const iso = validISO(Number(named[3]), month, Number(named[1]))
      if (iso) return iso
    }
  }

  const monthFirst = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(text)
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].slice(0, 4).toLowerCase()] ?? MONTHS[monthFirst[1].slice(0, 3).toLowerCase()]
    if (month) {
      const iso = validISO(Number(monthFirst[3]), month, Number(monthFirst[2]))
      if (iso) return iso
    }
  }

  return null
}

/**
 * A clock time, written either way round.
 *
 * The dot form only counts with an am or pm beside it, and that restriction is
 * load-bearing: '24.00' on a receipt is twenty-four ringgit, not midnight, and
 * a pattern loose enough to call it a time will quietly delete every price on
 * the slip.
 */
export const TIME_PATTERN = /\b(?:\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?|\d{1,2}[.:]\d{2}\s*[ap]\.?m\.?)\b/gi

/** The first clock time in some text, as HH:MM. */
export function findTime(text: string): string | null {
  const match = /\b(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?\b|\b(\d{1,2}):(\d{2})\b/i.exec(text)
  if (!match) return null
  if (match[4] !== undefined) {
    const hours = Number(match[4])
    const minutes = Number(match[5])
    return hours > 23 || minutes > 59 ? null : `${pad(hours)}:${pad(minutes)}`
  }
  let hours = Number(match[1])
  const minutes = Number(match[2])
  if (minutes > 59) return null
  // The group captures only the a or the p, so 'p.m.' and 'PM' both land here.
  const meridiem = match[3]?.toLowerCase()
  if (meridiem === 'p' && hours < 12) hours += 12
  if (meridiem === 'a' && hours === 12) hours = 0
  if (hours > 23) return null
  return `${pad(hours)}:${pad(minutes)}`
}

// ---------------------------------------------------------------- receipts

export interface ReceiptFields {
  merchant: string | null
  date: string | null
  currency: string | null
  total: number | null
  /** Other amounts found, largest first, in case the total was picked wrong. */
  candidates: number[]
}

/** Lines that carry a number which is emphatically not what you paid. */
const NOT_THE_TOTAL =
  /\b(change|kembalian|kembali|tra\s*lai|cash|tunai|tien\s*mat|tender|round(ing)?|discount|diskaun|balance|point|reward|qty|invoice|receipt\s*no|bill\s*no|table|phone|tel|gst\s*(no|reg)|sst\s*(no|reg)|co\.?\s*reg|account)\b/i

/**
 * What a bill calls its bottom line.
 *
 * Malay and Vietnamese are in here beside English because those are the
 * receipts this actually gets pointed at, and a slip that says JUMLAH is not
 * an edge case in Kuala Lumpur.
 */
const TOTAL_WORDS =
  /\b(grand\s*total|total\s*due|amount\s*due|nett?\s*total|jumlah\s*besar|jumlah|tong\s*cong|thanh\s*tien|tong|total)\b/i

const SUBTOTAL_WORDS = /\b(sub\s*-?\s*total|subjumlah|tam\s*tinh)\b/i

/** Reference numbers and addresses, which are digits but are not money. */
const NOT_MONEY_CONTEXT =
  /\b(no|nos|reg|ref|inv|invoice|bill|tel|phone|fax|table|pax|qty)\b\.?\s*[:.#]?\s*[\w-]+/gi

interface Amount {
  value: number
  /** Written with a decimal part, which is what money on a slip usually has. */
  exact: boolean
}

/**
 * Every number on a line that could be money.
 *
 * Dates, clock times and reference numbers are stripped first. Without that, a
 * receipt dated 14/09/2026 at 19:42 in postcode 43000 offers 2026, 42 and
 * 43000 as amounts you might have paid, which is worse than offering nothing.
 */
function amountsIn(line: string): Amount[] {
  const cleaned = line
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ' ')
    .replace(TIME_PATTERN, ' ')
    .replace(/\b\d{1,2}\s*%/g, ' ')
    .replace(NOT_MONEY_CONTEXT, ' ')

  const matches = cleaned.match(/-?\d[\d.,]*\d|\b\d\b/g) ?? []
  return matches
    .map((text) => {
      const value = parseAmount(text)
      // Judged on how it was written, not on what it parsed to: '37.00' is
      // money written to the cent even though the number is a round 37.
      return value === null ? null : { value, exact: /[.,]\d{1,2}$/.test(text) }
    })
    .filter((amount): amount is Amount => amount !== null && amount.value > 0 && amount.value < 10_000_000)
}

const values = (amounts: Amount[]): number[] => amounts.map((amount) => amount.value)

/**
 * Pull the fields a receipt review screen starts from.
 *
 * The bottom line is found by working *upwards*: a till slip prints the total
 * near the end, and anything after it is change, points and a thank-you. A
 * line calling itself a total wins outright; failing that, the largest amount
 * on the slip is a decent guess, because the total is almost always the
 * biggest number printed on one.
 */
export function parseReceipt(text: string): ReceiptFields {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let currency: string | null = null
  for (const [pattern, code] of CURRENCY_HINTS) {
    if (pattern.test(text)) {
      currency = code
      break
    }
  }
  if (!currency && DOLLAR.test(text)) currency = 'USD'

  let total: number | null = null
  let subtotal: number | null = null

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (NOT_THE_TOTAL.test(line)) continue

    if (SUBTOTAL_WORDS.test(line)) {
      subtotal ??= amountsIn(line).pop()?.value ?? null
      continue
    }
    if (total === null && TOTAL_WORDS.test(line)) {
      // The rightmost number on the line: 'TOTAL 3 ITEMS   45.60'.
      const found = amountsIn(line).pop()?.value ?? null
      // A total line whose number lives on the next line is common enough.
      total = found ?? amountsIn(lines[index + 1] ?? '').pop()?.value ?? null
    }
  }

  const everything = lines.flatMap((line) => (NOT_THE_TOTAL.test(line) ? [] : amountsIn(line)))
  // Where anything was written to the cent, the round numbers beside it are
  // quantities, years and door numbers rather than prices. Where nothing was —
  // a currency with no small change, like the dong — they are all it has.
  const exact = everything.filter((amount) => amount.exact)
  const candidates = [...new Set(values(exact.length ? exact : everything))].sort((a, b) => b - a)

  if (total === null) total = subtotal ?? candidates[0] ?? null

  // The first line with real words on it is the shop's name far more often
  // than not; numbers, addresses and 'TAX INVOICE' are not it.
  const merchant =
    lines.find(
      (line) =>
        /[A-Za-z]{3}/.test(line) &&
        line.replace(/[^A-Za-z]/g, '').length >= line.length * 0.5 &&
        !/\b(tax\s*invoice|receipt|invoice|bill|cash\s*sale|welcome)\b/i.test(line),
    ) ?? null

  return {
    merchant: merchant ? merchant.replace(/\s{2,}/g, ' ').slice(0, 60) : null,
    date: findDate(text),
    currency,
    total,
    candidates: candidates.slice(0, 8),
  }
}

// -------------------------------------------------------------- itineraries

export interface ItineraryDraft {
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
}

/** Words that mean this line is a thing that happens, not a footer. */
const NOISE =
  /^(page\s*\d|terms|conditions|booking\s*reference|confirmation\s*(number|code)?|printed|issued|please|thank)/i

/** Every way findDate can recognise a date, so one can be cut out of a line. */
const DATE_FORMS = [
  /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
  /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g,
  /\b\d{1,2}\s*[-\s]\s*[A-Za-z]{3,9}\.?\s*[-,\s]\s*\d{2,4}\b/g,
  /\b[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/g,
]

const stripDates = (line: string): string =>
  DATE_FORMS.reduce((text, form) => text.replace(form, ' '), line)

/**
 * Turn a booking confirmation or a typed plan into draft schedule items.
 *
 * The shape it looks for is the one every itinerary shares: a date somewhere,
 * then lines under it that start with a time. A line with its own date wins
 * over the heading above it, which is what makes a flat list of bookings work
 * as well as a day-by-day plan.
 *
 * Nothing here is saved. The screen lists what it found with a tick beside
 * each one, and only the ticked ones become items.
 */
export function parseItinerary(text: string, fallbackDate: string): ItineraryDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2 && !NOISE.test(line))

  const drafts: ItineraryDraft[] = []
  let currentDate = fallbackDate

  for (const line of lines) {
    const lineDate = findDate(line)
    // Every date form has to come out, not just the slashed one — otherwise
    // '14 September 2026' keeps enough letters to pass for an appointment and
    // the heading becomes an entry in its own right.
    const withoutDate = lineDate ? stripDates(line) : line

    // A line that is only a date is a heading for the lines beneath it.
    const isHeading = Boolean(lineDate) && withoutDate.replace(/[^A-Za-z]/g, '').length < 4
    if (lineDate) currentDate = lineDate
    if (isHeading) continue

    const times = withoutDate.match(TIME_PATTERN) ?? []
    const start = times[0] ? findTime(times[0]) : null
    const end = times[1] ? findTime(times[1]) : null

    let title = withoutDate
    for (const time of times) title = title.replace(time, ' ')
    // The dash in '08:00 - 12:00 Cable car' is left behind once the times go.
    title = title
      .replace(/\s*[-–—|]\s*$/, '')
      .replace(/^[\s\-–—|:•·]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    // Without a time and without a date this is just prose from the page.
    if (!start && !lineDate) continue
    if (title.replace(/[^A-Za-z]/g, '').length < 3) continue

    // 'Dinner at Sakura, Bukit Bintang' — the tail after 'at' is a place.
    const place = /\b(?:at|in|@)\s+([A-Z][\w'&.\- ]{2,40})$/.exec(title)

    drafts.push({
      title: (place ? title.slice(0, place.index) : title).trim().slice(0, 80) || title.slice(0, 80),
      date: currentDate,
      start_time: start,
      end_time: end,
      location: place ? place[1].trim() : null,
    })
  }

  return drafts
}
