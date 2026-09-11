import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Fab from '../components/Fab'
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
} from '../lib/store'
import { tagEmoji } from '../lib/tags'
import type { Expense, ExpenseDraft } from '../types'
import ExpenseDetail from './ExpenseDetail'
import ExpenseForm, { conversionNote } from './ExpenseForm'

/** The bar under the total: where a month's money actually went. */
const BAR_COLOURS = [
  'bg-blue-600',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-lime-500',
  'bg-neutral-400',
]

export default function ExpensesScreen({ onToast }: { onToast: (message: string) => void }) {
  const expenses = useExpenses()
  const categories = useCategories()
  const settings = useSettings()
  const [month, setMonth] = useState(todayISO())
  const [detail, setDetail] = useState<Expense | null>(null)
  const [form, setForm] = useState<{ expense: Expense | null } | null>(null)

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

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
          <h1 className="truncate text-[19px] font-semibold tracking-tight">
            {monthTitle(month)}
          </h1>
          <div className="flex shrink-0 items-center gap-1 text-neutral-400">
            {key !== todayISO().slice(0, 7) && (
              <button
                onClick={() => setMonth(todayISO())}
                className="mr-1 text-[13px] font-medium text-blue-600"
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
        </div>
      </header>

      <main className="pb-28">
        <div className="px-5 pb-5">
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
      </main>

      <Fab label="Add an expense" onClick={() => setForm({ expense: null })} />

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
