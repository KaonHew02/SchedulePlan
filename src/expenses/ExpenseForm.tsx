import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import AttachmentStrip from '../components/Attachments'
import CurrencySelect from '../components/CurrencySelect'
import { DateField, Field } from '../components/FormFields'
import { ChevronDown, ScanIcon } from '../components/Icons'
import Popover from '../components/Popover'
import Sheet from '../components/Sheet'
import TagEditor from '../components/TagEditor'
import { addDays, shortDate, todayISO } from '../lib/date'
import { effectiveRates, money, rateBetween, rateLine, readCache } from '../lib/currency'
import { createTag, useCategories, useSchedule, useSettings } from '../lib/store'
import ReceiptScan, { type ScanResult } from './ReceiptScan'
import type { Attachment, Expense, ExpenseDraft, TagId } from '../types'

const FORM_ID = 'expense-form'

/** Which schedule items to offer linking to: the same week, near the date. */
function nearbyItems(items: { id: number; date: string; title: string }[], date: string) {
  const from = addDays(date, -3)
  const to = addDays(date, 3)
  return items
    .filter((item) => item.date >= from && item.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40)
}

function ScheduleLink({
  value,
  date,
  onChange,
}: {
  value: number | null
  date: string
  onChange: (id: number | null) => void
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const schedule = useSchedule()
  const options = useMemo(() => nearbyItems(schedule, date), [schedule, date])
  const chosen = schedule.find((item) => item.id === value)

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="Link to a schedule item"
        onClick={() => setOpen((was) => !was)}
        className="flex min-w-0 items-center gap-1 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] transition-colors hover:bg-neutral-200/70"
      >
        <span className={`truncate ${chosen ? '' : 'text-neutral-400'}`}>
          {chosen ? chosen.title : 'Not linked'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label="Schedule items" onClose={() => setOpen(false)}>
          <div className="w-[260px] p-2">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-[14px] text-neutral-500 hover:bg-neutral-100"
            >
              Not linked
            </button>
            <div className="no-scrollbar max-h-[220px] overflow-y-auto">
              {options.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] leading-5 text-neutral-400">
                  Nothing in the schedule within three days of this date.
                </p>
              ) : (
                options.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                      item.id === value ? 'bg-brand-50' : 'hover:bg-neutral-100'
                    }`}
                  >
                    <span className="w-12 shrink-0 text-[12px] text-neutral-400">
                      {shortDate(item.date)}
                    </span>
                    <span className="truncate text-[14px]">{item.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Popover>
      )}
    </>
  )
}

export default function ExpenseForm({
  expense,
  defaultDate,
  defaultScheduleId,
  onClose,
  onSave,
}: {
  expense: Expense | null
  defaultDate?: string
  defaultScheduleId?: number | null
  onClose: () => void
  onSave: (draft: ExpenseDraft) => Promise<void>
}) {
  const settings = useSettings()
  const categories = useCategories()
  const home = settings.currency

  const [title, setTitle] = useState(expense?.title ?? '')
  const [date, setDate] = useState(expense?.date ?? defaultDate ?? todayISO())
  const [amount, setAmount] = useState(
    expense ? String(expense.original_amount ?? expense.amount) : '',
  )
  const [currency, setCurrency] = useState(expense?.original_currency ?? expense?.currency ?? home)
  const [rate, setRate] = useState(expense?.exchange_rate ? String(expense.exchange_rate) : '')
  const [category, setCategory] = useState<TagId | null>(expense?.category ?? null)
  const [linked, setLinked] = useState<number | null>(
    expense?.schedule_id ?? defaultScheduleId ?? null,
  )
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [files, setFiles] = useState<Attachment[]>(expense?.attachments ?? [])
  const [showDetails, setShowDetails] = useState(
    Boolean(expense?.notes || expense?.attachments?.length || expense?.schedule_id),
  )
  const [scanning, setScanning] = useState(false)
  const [newCategory, setNewCategory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const foreign = currency !== home
  const rates = useMemo(() => effectiveRates(readCache(), settings.manualRates), [settings.manualRates])

  // A rate is only suggested, never forced: a money changer's rate is the one
  // that actually applied, and it is rarely the market's.
  useEffect(() => {
    if (!foreign) return
    if (rate) return
    const suggested = rateBetween(rates, currency, home)
    if (suggested) setRate(String(Number(suggested.toPrecision(8))))
  }, [foreign, currency, home, rates, rate])

  const entered = Number(amount) || 0
  const usedRate = Number(rate) || 0
  const converted = foreign ? entered * usedRate : entered

  function applyScan(result: ScanResult) {
    if (result.title) setTitle(result.title)
    if (result.date) setDate(result.date)
    if (result.amount !== null) setAmount(String(result.amount))
    if (result.currency && result.currency !== currency) {
      setCurrency(result.currency)
      setRate('') // the effect re-suggests one for the new currency
    }
    setFiles((was) => [...was, result.attachment])
    setShowDetails(true)
    setScanning(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('What was it for?')
    if (!entered || entered <= 0) return setError('Enter an amount above zero.')
    if (foreign && (!usedRate || usedRate <= 0)) {
      return setError(`Enter the rate you got for 1 ${currency}.`)
    }

    setError(null)
    setSaving(true)
    try {
      await onSave({
        date,
        title: title.trim(),
        amount: converted,
        currency: home,
        category,
        // Frozen at this moment. A rate that moves next week must not move
        // what this dinner cost.
        original_amount: foreign ? entered : null,
        original_currency: foreign ? currency : null,
        exchange_rate: foreign ? usedRate : null,
        schedule_id: linked,
        notes: notes.trim() || null,
        attachments: files,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        onClose={onClose}
        title={expense ? 'Edit expense' : 'Add an expense'}
        footer={
          <>
            {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
            <button
              type="submit"
              form={FORM_ID}
              disabled={saving}
              className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={submit}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus={!expense}
            placeholder="What was it for?"
            className="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-neutral-300"
          />

          <div className="mt-2 flex items-center gap-2 border-y border-neutral-100 py-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              aria-label="Amount"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-[28px] font-semibold tabular-nums tracking-tight outline-none placeholder:text-neutral-200"
            />
            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>

          {foreign && (
            <div className="mt-2 rounded-xl bg-neutral-50 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-neutral-500">Rate</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[13px] text-neutral-400">1 {currency} =</span>
                  <input
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    inputMode="decimal"
                    aria-label={`${home} per ${currency}`}
                    placeholder="0.0000"
                    className="w-24 bg-transparent text-right text-[15px] tabular-nums outline-none placeholder:text-neutral-300"
                  />
                  <span className="text-[13px] text-neutral-400">{home}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-neutral-500">
                {converted > 0 ? (
                  <>
                    Recorded as{' '}
                    <span className="font-medium text-neutral-900">{money(converted, home)}</span>
                    , and kept at this rate for good.
                  </>
                ) : (
                  'Change it to the rate you actually got.'
                )}
              </p>
            </div>
          )}

          <div className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100">
            <Field label="Date">
              <DateField value={date} onChange={setDate} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map(({ id, label, emoji }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(category === id ? null : id)}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                  category === id
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-600'
                }`}
              >
                <span className="mr-1">{emoji}</span>
                {label}
              </button>
            ))}
            {!newCategory && (
              <button
                type="button"
                onClick={() => setNewCategory(true)}
                className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-400"
              >
                + New
              </button>
            )}
          </div>

          {newCategory && (
            <div className="mt-2">
              <TagEditor
                submitLabel="Add"
                onCancel={() => setNewCategory(false)}
                onSubmit={(label, emoji) => {
                  const created = createTag(label, emoji, 'categories')
                  setCategory(created.id)
                  setNewCategory(false)
                }}
              />
            </div>
          )}

          {!expense && (
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-3 text-[14px] font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
            >
              <ScanIcon className="h-4 w-4" />
              Scan a receipt
            </button>
          )}

          {showDetails ? (
            <>
              <div className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
                <Field label="Part of">
                  <ScheduleLink value={linked} date={date} onChange={setLinked} />
                </Field>
                <div className="py-3">
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    placeholder="Notes"
                    className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-neutral-300"
                  />
                </div>
              </div>

              <div className="mt-4">
                <p className="pb-2 text-[13px] text-neutral-400">Receipts and files</p>
                <AttachmentStrip files={files} onChange={setFiles} onError={setError} />
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="mt-4 text-[14px] text-neutral-400"
            >
              + Link to schedule, add notes or files
            </button>
          )}
        </form>
      </Sheet>

      {scanning && (
        <ReceiptScan
          defaultCurrency={currency}
          onClose={() => setScanning(false)}
          onUse={applyScan}
        />
      )}
    </>
  )
}

/** The line under a converted expense, for the list and the detail sheet. */
export function conversionNote(expense: Expense): string | null {
  if (!expense.original_currency || !expense.original_amount || !expense.exchange_rate) return null
  return `${money(expense.original_amount, expense.original_currency)} · ${rateLine(
    expense.original_currency,
    expense.currency,
    expense.exchange_rate,
  )}`
}
