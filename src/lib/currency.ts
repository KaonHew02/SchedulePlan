/**
 * Rates, and the arithmetic that hangs off them.
 *
 * Two things matter here and they pull in opposite directions.
 *
 * The converter wants today's rate, so it fetches one. The *expense* wants the
 * rate that was true when the money left your hand — so an expense records
 * the number it was converted at and never asks again. A rate that moves
 * overnight must not quietly restate what last week's dinner cost.
 *
 * The table is a cache, so it lives in localStorage rather than in the
 * notebook: losing it costs one request, and there is no reason to carry a
 * day's ECB figures around inside every backup.
 */

import { todayISO } from './date'
import type { RateTable } from '../types'

const CACHE_KEY = 'scheduleplan:rates'

/** No key, no account, CORS open. Tried in order. */
const PROVIDERS = [
  {
    name: 'exchangerate-api',
    url: (base: string) => `https://open.er-api.com/v6/latest/${base}`,
    read: (body: Record<string, unknown>): RateTable | null => {
      const rates = body.rates as Record<string, number> | undefined
      if (!rates || body.result === 'error') return null
      const updated = body.time_last_update_utc
      return {
        base: String(body.base_code ?? ''),
        date: updated ? new Date(String(updated)).toISOString().slice(0, 10) : todayISO(),
        fetchedAt: new Date().toISOString(),
        rates,
      }
    },
  },
  {
    name: 'frankfurter',
    url: (base: string) => `https://api.frankfurter.dev/v1/latest?base=${base}`,
    read: (body: Record<string, unknown>): RateTable | null => {
      const rates = body.rates as Record<string, number> | undefined
      if (!rates) return null
      return {
        base: String(body.base ?? ''),
        date: String(body.date ?? todayISO()),
        fetchedAt: new Date().toISOString(),
        rates,
      }
    },
  },
]

/** The ones worth putting at the top of a list for a traveller from here. */
export const COMMON = [
  'MYR', 'SGD', 'THB', 'IDR', 'VND', 'USD', 'EUR', 'GBP',
  'JPY', 'KRW', 'CNY', 'HKD', 'TWD', 'PHP', 'AUD', 'INR',
]

export const CURRENCY_NAMES: Record<string, string> = {
  MYR: 'Malaysian ringgit',
  SGD: 'Singapore dollar',
  THB: 'Thai baht',
  IDR: 'Indonesian rupiah',
  VND: 'Vietnamese dong',
  USD: 'US dollar',
  EUR: 'Euro',
  GBP: 'Pound sterling',
  JPY: 'Japanese yen',
  KRW: 'South Korean won',
  CNY: 'Chinese yuan',
  HKD: 'Hong Kong dollar',
  TWD: 'New Taiwan dollar',
  PHP: 'Philippine peso',
  AUD: 'Australian dollar',
  NZD: 'New Zealand dollar',
  INR: 'Indian rupee',
  CAD: 'Canadian dollar',
  CHF: 'Swiss franc',
  AED: 'UAE dirham',
  BND: 'Brunei dollar',
  KHR: 'Cambodian riel',
  LAK: 'Lao kip',
  MMK: 'Myanmar kyat',
  NPR: 'Nepalese rupee',
  LKR: 'Sri Lankan rupee',
  PKR: 'Pakistani rupee',
  BDT: 'Bangladeshi taka',
  TRY: 'Turkish lira',
  ZAR: 'South African rand',
  BRL: 'Brazilian real',
  MXN: 'Mexican peso',
  SAR: 'Saudi riyal',
  QAR: 'Qatari riyal',
  EGP: 'Egyptian pound',
  RUB: 'Russian rouble',
  SEK: 'Swedish krona',
  NOK: 'Norwegian krone',
  DKK: 'Danish krone',
  PLN: 'Polish zloty',
  CZK: 'Czech koruna',
  HUF: 'Hungarian forint',
}

/** Currencies normally written without decimals. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF'])

/** 'RM 45.60', '¥1,200' — grouped, and with the right number of decimals. */
export function money(amount: number, code: string): string {
  const digits = ZERO_DECIMAL.has(code) ? 0 : 2
  try {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount)
  } catch {
    // An unknown or made-up code should still print a readable number.
    return `${code} ${amount.toFixed(digits)}`
  }
}

/** Just the number, grouped — for a column that already has a currency heading. */
export function plain(amount: number, code: string): string {
  const digits = ZERO_DECIMAL.has(code) ? 0 : 2
  return new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export const decimalsFor = (code: string): number => (ZERO_DECIMAL.has(code) ? 0 : 2)

// ------------------------------------------------------------------- lots

/**
 * The lot a currency is quoted in.
 *
 * Nobody prices a Vietnamese dong. The board at the money changer in Seremban
 * prices a million of them, a thousand yen, a hundred baht, and one pound —
 * and the number it shows you is the number you have to check, so those are
 * the lots this app quotes in too. A rate line reading `1 VND = 0.0002 MYR`
 * is arithmetically perfect and matches nothing on any wall in Asia.
 *
 * The list is the board itself, photographed and typed in, because a rule
 * derived from magnitude gets AED and DKK wrong: both are close enough to a
 * dollar to quote singly, and both are quoted in hundreds anyway, on the size
 * of the notes people actually hand over.
 */
const QUOTE_UNIT: Record<string, number> = {
  IDR: 1_000_000,
  VND: 1_000_000,
  LAK: 1_000_000,
  IRR: 1_000_000,
  JPY: 1_000,
  KRW: 1_000,
  KHR: 1_000,
  MMK: 1_000,
  COP: 1_000,
  CLP: 1_000,
  UZS: 1_000,
  AED: 100,
  BDT: 100,
  BRL: 100,
  CNY: 100,
  CZK: 100,
  DKK: 100,
  EGP: 100,
  HKD: 100,
  HUF: 100,
  INR: 100,
  ISK: 100,
  KES: 100,
  LKR: 100,
  MXN: 100,
  NOK: 100,
  NPR: 100,
  PHP: 100,
  PKR: 100,
  PLN: 100,
  QAR: 100,
  RUB: 100,
  SAR: 100,
  SEK: 100,
  THB: 100,
  TWD: 100,
  ZAR: 100,
}

/**
 * How many units of `code` a rate is quoted for.
 *
 * `lots` is the user's own choice, and it beats the list, because the list is
 * one board and boards do not agree with each other: yen is per thousand at
 * the counter in Seremban and per hundred at plenty of others. A currency left
 * alone is not in `lots` at all, so improving the list later still reaches
 * everyone who never overrode it.
 */
export const unitFor = (code: string, lots: Record<string, number> = {}): number =>
  lots[code] ?? QUOTE_UNIT[code] ?? 1

/** '1,000,000' — the lot itself, grouped, for the left of a rate line. */
export const unitLabel = (code: string, lots?: Record<string, number>): string =>
  new Intl.NumberFormat('en-MY').format(unitFor(code, lots))

/** What a whole lot of `from` is worth, given a rate for one of them. */
export const perLot = (rate: number, from: string, lots?: Record<string, number>): number =>
  rate * unitFor(from, lots)

/**
 * The lots worth offering, in the order tapping moves through them.
 *
 * Every one is a lot some board in the region actually prints. 100,000 is
 * there for the changers that quote dong that way rather than by the million.
 */
export const LOTS = [1, 100, 1_000, 100_000, 1_000_000]


/**
 * A rate, printed to as many places as it is worth reading.
 *
 * Not `decimalsFor`: that is for money, and this is a rate. 175.4386 MYR to
 * the million dong is worth four places when the same four on a dinner bill
 * would be noise, and 5,700 VND to the ringgit is worth none.
 */
export const rateDigits = (value: number): number =>
  value >= 1000 ? 0 : value >= 100 ? 2 : value >= 1 ? 3 : 4

export function rateNumber(value: number): string {
  const digits = rateDigits(value)
  return new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

// ------------------------------------------------------------------ cache

export function readCache(): RateTable | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const table = JSON.parse(raw) as RateTable
    return table?.rates && table.base ? table : null
  } catch {
    return null
  }
}

function writeCache(table: RateTable): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(table))
  } catch {
    /* A cache that will not persist is still fine for this session. */
  }
}

/** True when the cached table is for this base and was fetched today. */
export function isFresh(table: RateTable | null, base: string): boolean {
  return Boolean(table && table.base === base && table.fetchedAt.slice(0, 10) === todayISO())
}

/**
 * Today's table, fetched unless a fresh one is already in hand.
 *
 * If every provider is unreachable the stale cache is returned rather than an
 * error — a rate from yesterday converts a lunch bill perfectly well, and the
 * screen shows the date it came from so nobody has to guess.
 */
export async function fetchRates(base: string, force = false): Promise<RateTable> {
  const cached = readCache()
  if (!force && isFresh(cached, base)) return cached as RateTable

  let lastError: unknown = null
  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(provider.url(base))
      if (!response.ok) throw new Error(`${provider.name} returned ${response.status}`)
      const table = provider.read((await response.json()) as Record<string, unknown>)
      if (!table?.rates) throw new Error(`${provider.name} sent nothing usable`)
      // Some providers leave the base out of its own table; the rest of the
      // maths is much simpler if 1 base = 1 base is written down.
      table.rates = { ...table.rates, [base]: 1 }
      table.base = base
      writeCache(table)
      return table
    } catch (err) {
      lastError = err
    }
  }

  if (cached?.base === base) return cached
  throw new Error(
    lastError instanceof TypeError
      ? 'No connection, and no rates saved yet. Try again once you are online.'
      : "Couldn't get today's rates. Try again in a moment.",
  )
}

// ------------------------------------------------------------------- maths

/** Rates with the user's own corrections laid over the fetched ones. */
export function effectiveRates(
  table: RateTable | null,
  manual: Record<string, number>,
): Record<string, number> {
  return { ...(table?.rates ?? {}), ...manual }
}

/**
 * How many units of `to` one unit of `from` buys.
 *
 * Everything is quoted against the table's base, so a cross rate is one
 * divided by the other. Null when either side is missing rather than a
 * plausible-looking zero.
 */
export function rateBetween(
  rates: Record<string, number>,
  from: string,
  to: string,
): number | null {
  if (from === to) return 1
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) return null
  return toRate / fromRate
}

export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number | null {
  const rate = rateBetween(rates, from, to)
  return rate === null ? null : amount * rate
}

/**
 * '100 THB = 13.099 MYR' — the line that makes a conversion checkable.
 *
 * Quoted in `from`'s own lot, so it can be held up against the board without
 * moving a decimal point in your head.
 */
export function rateLine(
  from: string,
  to: string,
  rate: number,
  lots?: Record<string, number>,
): string {
  return `${unitLabel(from, lots)} ${from} = ${rateNumber(perLot(rate, from, lots))} ${to}`
}
