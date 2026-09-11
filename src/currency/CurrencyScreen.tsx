import { useEffect, useMemo, useState } from 'react'
import CurrencySelect from '../components/CurrencySelect'
import { ChevronLeft, RefreshIcon, Spinner, SwapIcon } from '../components/Icons'
import { longDate } from '../lib/date'
import {
  COMMON,
  CURRENCY_NAMES,
  convert,
  decimalsFor,
  effectiveRates,
  fetchRates,
  plain,
  rateBetween,
  rateLine,
  readCache,
} from '../lib/currency'
import { updateSettings, useSettings } from '../lib/store'
import type { RateTable } from '../types'

/**
 * The converter.
 *
 * Rates come from a public feed with no key and no account — there is nowhere
 * on a static site to hide a key, so the only safe kind is one that does not
 * exist. The table is cached for the day, which also means the converter still
 * works on a plane.
 *
 * The override matters more than it looks. A money changer in a tourist strip
 * is nowhere near the market rate, and the number that belongs in your
 * notebook is the one you actually got. Type it here and it sticks, for the
 * converter and for every expense entered afterwards.
 */
export default function CurrencyScreen({ onBack }: { onBack: () => void }) {
  const settings = useSettings()
  const [table, setTable] = useState<RateTable | null>(() => readCache())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState(settings.currency)
  const [to, setTo] = useState(settings.currency === 'MYR' ? 'THB' : 'MYR')
  const [editingRate, setEditingRate] = useState(false)
  const [manualDraft, setManualDraft] = useState('')

  const rates = useMemo(
    () => effectiveRates(table, settings.manualRates),
    [table, settings.manualRates],
  )

  async function load(force = false) {
    setLoading(true)
    setError(null)
    try {
      setTable(await fetchRates(settings.currency, force))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get rates.")
    } finally {
      setLoading(false)
    }
  }

  // Rates are quoted against the home currency, so changing it invalidates
  // the table rather than merely re-labelling it.
  useEffect(() => {
    void load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.currency])

  const entered = Number(amount) || 0
  const rate = rateBetween(rates, from, to)
  const result = convert(entered, from, to, rates)
  const overridden = Boolean(settings.manualRates[to] || settings.manualRates[from])

  function swap() {
    setFrom(to)
    setTo(from)
  }

  function saveManual() {
    const typed = Number(manualDraft)
    setEditingRate(false)
    if (!Number.isFinite(typed) || typed <= 0) return

    // Overrides are stored against the home currency, which is what the whole
    // table is quoted in — so a rate typed for a pair has to be converted
    // back to that shape before it is kept.
    const fromRate = rates[from]
    if (from === settings.currency) {
      updateSettings({ manualRates: { ...settings.manualRates, [to]: typed } })
    } else if (to === settings.currency && typed > 0) {
      updateSettings({ manualRates: { ...settings.manualRates, [from]: 1 / typed } })
    } else if (fromRate) {
      updateSettings({ manualRates: { ...settings.manualRates, [to]: typed * fromRate } })
    }
  }

  function clearManual() {
    const next = { ...settings.manualRates }
    delete next[to]
    delete next[from]
    updateSettings({ manualRates: next })
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4 lg:px-6">
          <button onClick={onBack} aria-label="Back to More" className="p-1.5 text-neutral-400">
            <ChevronLeft />
          </button>
          <h1 className="text-[19px] font-semibold tracking-tight">Currency</h1>
          <button
            onClick={() => void load(true)}
            disabled={loading}
            aria-label="Refresh rates"
            className="ml-auto mr-2 p-1.5 text-neutral-400 disabled:opacity-40"
          >
            {loading ? <Spinner className="h-[18px] w-[18px]" /> : <RefreshIcon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </header>

      <main className="px-5 pb-28 lg:max-w-2xl lg:px-8 lg:pb-10">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              aria-label="Amount to convert"
              className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold tabular-nums tracking-tight outline-none"
            />
            <CurrencySelect value={from} onChange={setFrom} label="Convert from" />
          </div>

          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-100" />
            <button
              onClick={swap}
              aria-label="Swap the two currencies"
              className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition-colors hover:bg-neutral-50"
            >
              <SwapIcon className="h-4 w-4" />
            </button>
            <div className="h-px flex-1 bg-neutral-100" />
          </div>

          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-[26px] font-semibold tabular-nums tracking-tight">
              {result === null ? (
                <span className="text-neutral-300">—</span>
              ) : (
                result.toFixed(decimalsFor(to))
              )}
            </span>
            <CurrencySelect value={to} onChange={setTo} label="Convert to" />
          </div>
        </div>

        {rate !== null && (
          <div className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3">
            {editingRate ? (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[13px] text-neutral-500">1 {from} =</span>
                <input
                  autoFocus
                  value={manualDraft}
                  onChange={(event) => setManualDraft(event.target.value)}
                  inputMode="decimal"
                  aria-label={`${to} per ${from}`}
                  className="w-24 rounded-lg bg-white px-2 py-1 text-right text-[14px] tabular-nums outline-none ring-1 ring-neutral-200"
                />
                <span className="shrink-0 text-[13px] text-neutral-500">{to}</span>
                <button
                  onClick={saveManual}
                  className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-[13px] font-medium text-white"
                >
                  Set
                </button>
                <button
                  onClick={() => setEditingRate(false)}
                  className="rounded-full px-2 py-1.5 text-[13px] text-neutral-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] tabular-nums">{rateLine(from, to, rate)}</span>
                  {overridden && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Yours
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setManualDraft(rate.toFixed(rate < 1 ? 4 : 3))
                      setEditingRate(true)
                    }}
                    className="ml-auto text-[13px] font-medium text-brand-500"
                  >
                    {overridden ? 'Change' : 'Use my rate'}
                  </button>
                </div>
                <p className="mt-1 text-[12px] leading-5 text-neutral-400">
                  {overridden ? (
                    <>
                      Your own rate, used for the converter and for new expenses.{' '}
                      <button onClick={clearManual} className="underline">
                        Back to the market rate
                      </button>
                    </>
                  ) : table ? (
                    `Market rate from ${longDate(table.date)}`
                  ) : (
                    'No rates loaded yet'
                  )}
                </p>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
            {error}
          </p>
        )}

        {rate === null && !loading && (
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-[13px] leading-5 text-neutral-500">
            No rate for {from} to {to} in the table. Tap refresh, or set one yourself once rates
            have loaded.
          </p>
        )}

        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">
          1 {settings.currency} buys
        </h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {COMMON.filter((code) => code !== settings.currency).map((code) => {
            const value = rates[code]
            return (
              <button
                key={code}
                onClick={() => {
                  setFrom(settings.currency)
                  setTo(code)
                }}
                className="flex w-full items-baseline gap-3 py-3 text-left active:bg-neutral-50"
              >
                <span className="w-11 shrink-0 text-[14px] font-medium">{code}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-400">
                  {CURRENCY_NAMES[code] ?? ''}
                </span>
                <span className="shrink-0 text-[15px] tabular-nums">
                  {value ? plain(value, code) : <span className="text-neutral-300">—</span>}
                </span>
                {settings.manualRates[code] && (
                  <span className="shrink-0 text-[11px] font-medium text-amber-600">yours</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-6">
          <span className="text-[13px] text-neutral-500">Totals are shown in</span>
          <CurrencySelect
            value={settings.currency}
            onChange={(code) => updateSettings({ currency: code })}
            label="Home currency"
          />
        </div>
        <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
          Changing this changes what new expenses are recorded in. Expenses already saved keep the
          currency and the rate they were entered at.
        </p>
      </main>
    </>
  )
}
