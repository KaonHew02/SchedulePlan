import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import AttachmentStrip from '../components/Attachments'
import CurrencySelect from '../components/CurrencySelect'
import { DateField, Field, NotesField } from '../components/FormFields'
import { ChevronDown, ScanIcon } from '../components/Icons'
import Popover from '../components/Popover'
import Sheet from '../components/Sheet'
import TagEditor from '../components/TagEditor'
import { addDays, shortDate, todayISO } from '../lib/date'
import { effectiveRates, money, rateBetween, rateLine, readCache } from '../lib/currency'
import { tr } from '../lib/i18n'
import { createTag, useCategories, useSchedule, useSettings } from '../lib/store'
import { tagName } from '../lib/tags'
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
        aria-label={tr('Link to a schedule item', '关联日程')}
        onClick={() => setOpen((was) => !was)}
        className="flex min-w-0 items-center gap-1 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] transition-colors hover:bg-neutral-200/70"
      >
        <span className={`truncate ${chosen ? '' : 'text-neutral-400'}`}>
          {chosen ? chosen.title : tr('Not linked', '未关联')}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label={tr('Schedule items', '日程')} onClose={() => setOpen(false)}>
          <div className="w-[260px] p-2">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-[14px] text-neutral-500 hover:bg-neutral-100"
            >
              {tr('Not linked', '未关联')}
            </button>
            <div className="no-scrollbar max-h-[220px] overflow-y-auto">
              {options.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] leading-5 text-neutral-400">
                  {tr('Nothing in the schedule within three days of this date.', '这天前后三天内没有日程。')}
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
    if (!title.trim()) return setError(tr('What was it for?', '花在什么上？'))
    if (!entered || entered <= 0) return setError(tr('Enter an amount above zero.', '请输入大于 0 的金额。'))
    if (foreign && (!usedRate || usedRate <= 0)) {
      return setError(tr(`Enter the rate you got for 1 ${currency}.`, `请输入 1 ${currency} 实际换到的汇率。`))
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
      setError(err instanceof Error ? err.message : tr('Could not save. Please try again.', '保存失败，请再试一次。'))
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        onClose={onClose}
        title={expense ? tr('Edit expense', '编辑支出') : tr('Add an expense', '添加支出')}
        footer={
          <>
            {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
            <button
              type="submit"
              form={FORM_ID}
              disabled={saving}
              className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
            >
              {saving ? tr('Saving...', '正在保存…') : tr('Save', '保存')}
            </button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={submit}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus={!expense}
            placeholder={tr('What was it for?', '花在什么上？')}
            className="w-full bg-transparent py-1 text-[17px] outline-hidden placeholder:text-neutral-300"
          />

          <div className="mt-2 flex items-center gap-2 border-y border-neutral-100 py-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              aria-label={tr('Amount', '金额')}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-[28px] font-semibold tabular-nums tracking-tight outline-hidden placeholder:text-neutral-200"
            />
            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>

          {foreign && (
            <div className="mt-2 rounded-xl bg-neutral-50 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-neutral-500">{tr('Rate', '汇率')}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[13px] text-neutral-400">1 {currency} =</span>
                  <input
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    inputMode="decimal"
                    aria-label={tr(`${home} per ${currency}`, `每 1 ${currency} 换多少 ${home}`)}
                    placeholder="0.0000"
                    className="w-24 bg-transparent text-right text-[15px] tabular-nums outline-hidden placeholder:text-neutral-300"
                  />
                  <span className="text-[13px] text-neutral-400">{home}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-neutral-500">
                {converted > 0 ? (
                  tr(
                    <>
                      Recorded as{' '}
                      <span className="font-medium text-neutral-900">{money(converted, home)}</span>
                      , and kept at this rate for good.
                    </>,
                    <>
                      记为 <span className="font-medium text-neutral-900">{money(converted, home)}</span>
                      ，以后一直按这个汇率。
                    </>,
                  )
                ) : (
                  tr('Change it to the rate you actually got.', '改成你实际换到的汇率。')
                )}
              </p>
            </div>
          )}

          <div className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100">
            <Field label={tr('Date', '日期')}>
              <DateField value={date} onChange={setDate} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setCategory(category === tag.id ? null : tag.id)}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                  category === tag.id
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-600'
                }`}
              >
                <span className="mr-1">{tag.emoji}</span>
                {tagName(tag)}
              </button>
            ))}
            {!newCategory && (
              <button
                type="button"
                onClick={() => setNewCategory(true)}
                className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-400"
              >
                {tr('+ New', '+ 新建')}
              </button>
            )}
          </div>

          {newCategory && (
            <div className="mt-2">
              <TagEditor
                submitLabel={tr('Add', '添加')}
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
              {tr('Scan a receipt', '扫描收据')}
            </button>
          )}

          {showDetails ? (
            <>
              <div className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
                <Field label={tr('Part of', '关联')}>
                  <ScheduleLink value={linked} date={date} onChange={setLinked} />
                </Field>
                <div className="py-3">
                  <NotesField value={notes} onChange={setNotes} />
                </div>
              </div>

              <div className="mt-4">
                <p className="pb-2 text-[13px] text-neutral-400">{tr('Receipts and files', '收据和文件')}</p>
                <AttachmentStrip files={files} onChange={setFiles} onError={setError} />
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="mt-4 text-[14px] text-neutral-400"
            >
              {tr('+ Link to schedule, add notes or files', '+ 关联日程、添加备注或文件')}
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

/**
 * The line under a converted expense, for the list and the detail sheet.
 *
 * The rate itself is frozen — it is what the receipt was converted at and does
 * not move again. The *lot* it is read in is not frozen, because that is only
 * how it is written down, and it should match the way the same currency is
 * written everywhere else in the app.
 */
export function conversionNote(
  expense: Expense,
  lots?: Record<string, number>,
): string | null {
  if (!expense.original_currency || !expense.original_amount || !expense.exchange_rate) return null
  return `${money(expense.original_amount, expense.original_currency)} · ${rateLine(
    expense.original_currency,
    expense.currency,
    expense.exchange_rate,
    lots,
  )}`
}
