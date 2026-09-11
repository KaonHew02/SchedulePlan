import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Fab from '../components/Fab'
import { Segmented } from '../components/FormFields'
import { ChevronLeft, ChevronRight, PaperclipIcon } from '../components/Icons'
import { addMonths, monthTitle, relativeDay, shortDate, todayISO } from '../lib/date'
import { money, plain } from '../lib/currency'
import {
  byNewest,
  createExpense,
  deleteExpense,
  updateExpense,
  useCategories,
  useExpenses,
  useSettings,
  useSplits,
} from '../lib/store'
import { tagEmoji } from '../lib/tags'
import type { Expense, ExpenseDraft, ExpensesTab } from '../types'
import ExpenseDetail from './ExpenseDetail'
import ExpenseForm, { conversionNote } from './ExpenseForm'
import { SplitEditor, SplitsList, createSplit } from './SplitsScreen'

/** The bar under the total: where a month's money actually went. */
const BAR_COLOURS = [
  'bg-brand-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-lime-500',
  'bg-neutral-400',
]

/**
 * Spending, and the bill splits that feed it.
 *
 * Splitting used to be a tool behind More, which made it a calculator you
 * emptied by hand: it told you what a dinner cost you and then you typed that
 * number into the expense list yourself. It is a tab here instead, and a
 * finished split can put your own share straight into the month.
 */
export default function ExpensesScreen({ onToast }: { onToast: (message: string) => void }) {
  const expenses = useExpenses()
  const categories = useCategories()
  const settings = useSettings()
  const splits = useSplits()
  const [tab, setTab] = useState<ExpensesTab>('spending')
  const [month, setMonth] = useState(todayISO())
  const [detail, setDetail] = useState<Expense | null>(null)
  const [form, setForm] = useState<{ expense: Expense | null } | null>(null)
  const [openSplit, setOpenSplit] = useState<number | null>(null)

  const key = month.slice(0, 7)

  const { rows, total, breakdown } = useMemo(() => {
    const rows = expenses.filter((expense) => expense.date.slice(0, 7) === key).sort(byNewest)
    const total = rows.reduce((sum, expense) => sum + expense.amount, 0)

    const sums = new Map<string, number>()
    for (const expense of rows) {
      const id = expense.category ?? 'untagged'
      sums.set(id, (sums.get(id) ?? 0) + expense.amount)
    }
    const breakdown = [...sums.entries()]
      .map(([id, amount]) => ({
        id,
        amount,
        label: categories.find((category) => category.id === id)?.label ?? 'Uncategorised',
        emoji: categories.find((category) => category.id === id)?.emoji ?? '•',
      }))
      .sort((a, b) => b.amount - a.amount)

    return { rows, total, breakdown }
  }, [expenses, key, categories])

  // Grouped by day, newest day first, so a week of a trip reads as days.
  const days = useMemo(() => {
    const groups = new Map<string, Expense[]>()
    for (const expense of rows) {
      const list = groups.get(expense.date) ?? []
      list.push(expense)
      groups.set(expense.date, list)
    }
    return [...groups.entries()]
  }, [rows])

  async function save(draft: ExpenseDraft) {
    if (form?.expense) await updateExpense(form.expense.id, draft)
    else await createExpense(draft)
    setMonth(draft.date)
    setForm(null)
    onToast(form?.expense ? 'Updated' : 'Added')
  }

  async function remove(id: number) {
    await deleteExpense(id)
    setDetail(null)
    onToast('Deleted')
  }

  // The editor is a screen of its own, not a panel: it has its own back arrow
  // and nothing from the month view applies while it is open.
  const editing = splits.find((split) => split.id === openSplit)
  if (editing) {
    return (
      <SplitEditor
        initial={editing}
        onClose={() => setOpenSplit(null)}
        onToast={onToast}
      />
    )
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4 lg:px-8">
          <h1 className="truncate text-[19px] font-semibold tracking-tight lg:text-[22px]">
            {tab === 'spending' ? monthTitle(month) : 'Bill splits'}
          </h1>
          {/* A month only means something to the spending list. */}
          {tab === 'spending' && (
            <div className="flex shrink-0 items-center gap-1 text-neutral-400">
              {key !== todayISO().slice(0, 7) && (
                <button
                  onClick={() => setMonth(todayISO())}
                  className="mr-1 text-[13px] font-medium text-brand-500"
                >
                  This month
                </button>
              )}
              <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className="p-1">
                <ChevronLeft />
              </button>
              <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className="p-1">
                <ChevronRight />
              </button>
            </div>
          )}
        </div>
        <div className="px-5 pb-3 lg:px-8">
          <div className="max-w-[260px]">
            <Segmented
              value={tab}
              options={[
                { value: 'spending' as ExpensesTab, label: 'Spending' },
                { value: 'splits' as ExpensesTab, label: 'Splits' },
              ]}
              onChange={setTab}
            />
          </div>
        </div>
      </header>

      {tab === 'splits' && <SplitsList onOpen={setOpenSplit} />}

      {tab === 'spending' && (
      <main className="pb-28 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8 lg:pb-10">
        <div className="px-5 pb-5 lg:sticky lg:top-4 lg:px-0">
          <p className="text-[32px] font-semibold tabular-nums tracking-tight">
            {money(total, settings.currency)}
          </p>
          <p className="text-[13px] text-neutral-400">
            {rows.length === 0
              ? 'Nothing recorded this month'
              : `${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'} this month`}
          </p>

          {breakdown.length > 0 && (
            <>
              <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
                {breakdown.map((slice, index) => (
                  <div
                    key={slice.id}
                    className={BAR_COLOURS[index % BAR_COLOURS.length]}
                    style={{ width: `${(slice.amount / total) * 100}%` }}
                    title={`${slice.label} ${plain(slice.amount, settings.currency)}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {breakdown.slice(0, 6).map((slice, index) => (
                  <span key={slice.id} className="flex items-center gap-1.5 text-[13px]">
                    <span
                      className={`h-2 w-2 rounded-full ${BAR_COLOURS[index % BAR_COLOURS.length]}`}
                    />
                    <span className="text-neutral-600">{slice.label}</span>
                    <span className="tabular-nums text-neutral-400">
                      {plain(slice.amount, settings.currency)}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="min-w-0">
        {rows.length === 0 ? (
          <EmptyState title="Nothing spent yet" hint="Tap + to record something" />
        ) : (
          days.map(([date, list]) => (
            <section key={date}>
              <div className="flex items-baseline justify-between border-t border-neutral-100 bg-neutral-50/60 px-5 py-1.5">
                <span className="text-[12px] font-medium text-neutral-500">
                  {relativeDay(date)} {shortDate(date)}
                </span>
                <span className="text-[12px] tabular-nums text-neutral-400">
                  {plain(
                    list.reduce((sum, expense) => sum + expense.amount, 0),
                    settings.currency,
                  )}
                </span>
              </div>
              {list.map((expense) => {
                const note = conversionNote(expense)
                return (
                  <button
                    key={expense.id}
                    onClick={() => setDetail(expense)}
                    className="flex w-full items-center gap-3 border-b border-neutral-100 px-5 py-3 text-left active:bg-neutral-50"
                  >
                    <span className="w-5 shrink-0 text-center text-[15px]">
                      {tagEmoji(categories, expense.category)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] leading-6">{expense.title}</span>
                        {expense.attachments.length > 0 && (
                          <PaperclipIcon className="h-3 w-3 shrink-0 text-neutral-300" />
                        )}
                      </span>
                      {note && (
                        <span className="block truncate text-[12px] leading-4 text-neutral-400">
                          {note}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[15px] tabular-nums">
                      {plain(expense.amount, settings.currency)}
                    </span>
                  </button>
                )
              })}
            </section>
          ))
        )}
        </div>
      </main>
      )}

      <Fab
        label={tab === 'spending' ? 'Add an expense' : 'New split'}
        onClick={() => {
          if (tab === 'spending') return setForm({ expense: null })
          setOpenSplit(createSplit(settings.currency).id)
        }}
      />

      {detail && (
        <ExpenseDetail
          expense={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ expense: detail })
            setDetail(null)
          }}
          onDelete={() => remove(detail.id)}
        />
      )}

      {form && (
        <ExpenseForm
          expense={form.expense}
          defaultDate={key === todayISO().slice(0, 7) ? todayISO() : `${key}-01`}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </>
  )
}
