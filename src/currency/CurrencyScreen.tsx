import { useEffect, useMemo, useRef, useState } from 'react'
import CurrencySelect from '../components/CurrencySelect'
import Popover from '../components/Popover'
import { RefreshIcon, Spinner, SwapIcon } from '../components/Icons'
import { longDate } from '../lib/date'
import {
  COMMON,
  CURRENCY_NAMES,
  convert,
  effectiveRates,
  fetchRates,
  LOTS,
  perLot,
  plain,
  rateBetween,
  rateDigits,
  rateLine,
  rateNumber,
  readCache,
  unitFor,
  unitLabel,
} from '../lib/currency'
import { updateSettings, useSettings } from '../lib/store'
import type { RateTable } from '../types'

/**
 * The converter — a module of its own since it left More.
 *
 * It was a tool behind a menu, which is the right place for something used
 * twice a year and the wrong place for something opened at every till on a
 * trip. It is in the nav now, next to the money half of the app.
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
 *
 * Everything quoted on this screen is quoted in the currency's own lot — a
 * million dong, a thousand yen, a hundred baht — which is what the board on
 * the wall is quoting, and therefore what you are copying off it. `unitFor`
 * holds the list.
 *
 * The lot is tappable, because the list is one board. Another changer prices
 * yen by the hundred, or dong by the hundred thousand, and the point of the
 * lot is to match whatever is on the wall in front of you — a list that cannot
 * be argued with is only right in the shop it was photographed in. The choice
 * sticks per currency, and the whole screen re-quotes in it.
 */
/**
 * The lot a rate is quoted in, as a menu rather than a cycle.
 *
 * Tapping through the five in order sounds lighter and is not. Yen defaults to
 * the thousand because that is what the board in the photo uses; the changer
 * who disagrees uses the hundred, which is one tap away here and four in a
 * cycle, in the wrong direction, in a queue.
 *
 * The built-in lot is marked, because it is the one printed on most boards and
 * there has to be a way back to it that is not counting.
 */
function LotPicker({
  code,
  lot,
  onPick,
}: {
  code: string
  lot: number
  onPick: (lot: number) => void
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const group = new Intl.NumberFormat('en-MY')

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={`Quoted per ${group.format(lot)} ${code}. Tap to change the lot.`}
        title="The lot this is quoted in — set it to match the board"
        className={`-mx-1 rounded-md px-1 underline decoration-neutral-400 decoration-dotted underline-offset-4 transition-colors hover:bg-neutral-200/70 ${
          open ? 'bg-neutral-200/70' : ''
        }`}
      >
        {group.format(lot)}
      </button>

      {open && (
        <Popover anchor={anchor} label={`Lot for ${code}`} onClose={() => setOpen(false)}>
          <div className="w-[176px] p-1.5">
            <p className="px-2.5 pb-1 pt-1 text-[12px] leading-4 text-neutral-400">
              Quote {code} per
            </p>
            {LOTS.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  onPick(choice)
                  setOpen(false)
                }}
                className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] tabular-nums transition-colors ${
                  choice === lot ? 'bg-brand-50 font-medium text-brand-700' : 'hover:bg-neutral-100'
                }`}
              >
                {group.format(choice)}
                {choice === unitFor(code) && (
                  <span className="text-[11px] font-normal text-neutral-400">usual</span>
                )}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  )
}

export default function CurrencyScreen() {
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

  /*
   * The home currency is stripped out. It never carries a lot of its own
   * choosing — how your own money is counted is the list's business, not a
   * setting — and stripping it here means a stale entry saved before that rule
   * existed cannot come back to life by switching which currency the notebook
   * is kept in. It also drops out of storage the next time any lot is picked.
   */
  const lots = useMemo(() => {
    const kept = { ...(settings.quoteUnits ?? {}) }
    delete kept[settings.currency]
    return kept
  }, [settings.quoteUnits, settings.currency])

  function setLot(code: string, lot: number) {
    const kept = { ...lots }
    // Choosing the built-in lot stores nothing, so a currency nobody has an
    // opinion about stays on the list rather than on a frozen copy of it.
    if (lot === unitFor(code)) delete kept[code]
    else kept[code] = lot
    updateSettings({ quoteUnits: kept })
  }

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

  const home = settings.currency

  /*
   * Which side of the pair the rate line prices, and what it prices it in.
   *
   * A board never prices your own money. The UNITS column is always theirs,
   * the ringgit column is always what it costs, and that stays true whichever
   * way round you happen to be converting. So the line prices the foreign
   * side, and the lot belongs to that side.
   *
   * It used to follow `from`, which meant converting ringgit *into* dong put
   * the lot on the ringgit. K set it to a million — reasonably, having just
   * read VND 1000000 off a board — typed the board's number into it, and
   * every conversion afterwards came out as zero, because what had been
   * stored was a price for a million ringgit. Nobody quotes a million ringgit.
   */
  const priced = from === home && to !== home ? to : from
  const inTerms = priced === from ? to : from
  const quoteRate = rateBetween(rates, priced, inTerms)

  function swap() {
    setFrom(to)
    setTo(from)
  }

  function saveManual() {
    const typed = Number(manualDraft)
    setEditingRate(false)
    if (!Number.isFinite(typed) || typed <= 0) return

    // What was typed is a price for a whole lot of the priced currency — 164
    // ringgit for a million dong — so it comes back to a rate for one unit
    // before anything stores it.
    const perOne = typed / unitFor(priced, lots)

    // Overrides are stored against the home currency, which is what the whole
    // table is quoted in — so a rate typed for a pair has to be converted
    // back to that shape before it is kept.
    const pricedRate = rates[priced]
    if (priced === home) {
      updateSettings({ manualRates: { ...settings.manualRates, [inTerms]: perOne } })
    } else if (inTerms === home) {
      updateSettings({ manualRates: { ...settings.manualRates, [priced]: 1 / perOne } })
    } else if (pricedRate) {
      updateSettings({ manualRates: { ...settings.manualRates, [inTerms]: perOne * pricedRate } })
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
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">Currency</h1>
          <button
            onClick={() => void load(true)}
            disabled={loading}
            aria-label="Refresh rates"
            className="-mr-1.5 p-1.5 text-neutral-400 disabled:opacity-40"
          >
            {loading ? <Spinner className="h-[18px] w-[18px]" /> : <RefreshIcon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </header>

      {/*
        Two columns from a laptop up, like every other screen: the converter
        and its rate on the left, the at-a-glance table on the right. Stacked,
        the table sat a screen and a half below the thing it belongs to.
      */}
      <main className="px-5 pb-28 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:px-8 lg:pb-10">
        <div>
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
              {/* Grouped, not toFixed. A conversion into dong ran to seven
                  digits in a row and had to be counted with a finger. */}
              {result === null ? (
                <span className="text-neutral-300">—</span>
              ) : (
                plain(result, to)
              )}
            </span>
            <CurrencySelect value={to} onChange={setTo} label="Convert to" />
          </div>
        </div>

        {quoteRate !== null && (
          <div className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3">
            {editingRate ? (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">
                  {unitLabel(priced, lots)} {priced} =
                </span>
                <input
                  autoFocus
                  value={manualDraft}
                  onChange={(event) => setManualDraft(event.target.value)}
                  inputMode="decimal"
                  aria-label={`${inTerms} per ${unitLabel(priced, lots)} ${priced}`}
                  className="w-24 rounded-lg bg-white px-2 py-1 text-right text-[14px] tabular-nums outline-none ring-1 ring-neutral-200"
                />
                <span className="shrink-0 text-[13px] text-neutral-500">{inTerms}</span>
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
                  {/* Only the lot is a control. The rest is a sentence, and a
                      sentence that is entirely clickable reads as a link to
                      somewhere else rather than as a number you can change. */}
                  <span className="text-[14px] tabular-nums">
                    <LotPicker
                      code={priced}
                      lot={unitFor(priced, lots)}
                      onPick={(lot) => setLot(priced, lot)}
                    />{' '}
                    {priced} = {rateNumber(perLot(quoteRate, priced, lots))} {inTerms}
                  </span>
                  {overridden && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Yours
                    </span>
                  )}
                  <button
                    onClick={() => {
                      // Seeded with the market price of a lot, so the board's
                      // number goes in over the top of a number the same shape.
                      const lot = perLot(quoteRate, priced, lots)
                      setManualDraft(lot.toFixed(rateDigits(lot)))
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
                    `Market rate from ${longDate(table.date)} · tap the lot to match the board`
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

        </div>

        <div>
        {/*
          Two numbers per row, because a money changer's board and this list
          face opposite ways. Big number: what your money turns into, which is
          the one you want in a shop. Small number: what a lot of theirs costs
          in yours, which is the one printed on the wall behind the counter.
          Working the second out from the first is a division by 5,700, in a
          queue, holding a bag.
        */}
        {/* `unitFor` without the overrides on purpose: how your own money is
            counted is not a thing you pick, it is a thing the list knows — a
            million for a notebook kept in dong, one for a notebook kept in
            ringgit. Only the currency being priced takes an override. */}
        <h2 className="pb-1 pt-8 text-[13px] font-medium tabular-nums text-neutral-400 lg:pt-0">
          {unitLabel(settings.currency)} {settings.currency} buys
        </h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {COMMON.filter((code) => code !== settings.currency).map((code) => {
            const value = rates[code]
            const back = rateBetween(rates, code, settings.currency)
            return (
              <button
                key={code}
                onClick={() => {
                  setFrom(settings.currency)
                  setTo(code)
                }}
                className="flex w-full items-start gap-3 py-3 text-left active:bg-neutral-50"
              >
                <span className="w-11 shrink-0 text-[14px] font-medium leading-6">{code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-6 text-neutral-400">
                    {CURRENCY_NAMES[code] ?? ''}
                  </span>
                  {back !== null && (
                    <span className="block text-[12px] leading-4 tabular-nums text-neutral-400">
                      {rateLine(code, settings.currency, back, lots)}
                    </span>
                  )}
                </span>
                {/* A rate, not a price: `plain` would round the whole SGD
                    column to 0.31 and the yen column to a flat 35. */}
                <span className="shrink-0 text-[15px] leading-6 tabular-nums">
                  {value ? (
                    rateNumber(value * unitFor(settings.currency))
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </span>
                {settings.manualRates[code] && (
                  <span className="shrink-0 text-[11px] font-medium leading-6 text-amber-600">
                    yours
                  </span>
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
        </div>
      </main>
    </>
  )
}
