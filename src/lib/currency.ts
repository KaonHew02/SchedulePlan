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

/** 'RM 1 = ¥ 37.92' — the line under a conversion that makes it checkable. */
export function rateLine(from: string, to: string, rate: number): string {
  const digits = rate < 0.01 ? 6 : rate < 1 ? 4 : rate > 1000 ? 0 : 3
  return `1 ${from} = ${rate.toFixed(digits)} ${to}`
}
