import { useMemo, useState } from 'react'
import Fab from '../components/Fab'
import { ChevronLeft, ChevronRight } from '../components/Icons'
import ExpenseForm from '../expenses/ExpenseForm'
import {
  addDays,
  addMonths,
  monthGrid,
  monthTitle,
  relativeDay,
  shortDate,
  startOfWeek,
  todayISO,
  weekTitle,
} from '../lib/date'
import { createExpense, inRange, onDay, store, useSchedule } from '../lib/store'
import DayStrip from '../schedule/DayStrip'
import DayView from '../schedule/DayView'
import MonthView from '../schedule/MonthView'
import ScheduleDetail from '../schedule/ScheduleDetail'
import ScheduleForm from '../schedule/ScheduleForm'
import WeekView from '../schedule/WeekView'
import type { ExpenseDraft, ScheduleDraft, ScheduleItem, ViewMode } from '../types'

const VIEWS: ViewMode[] = ['day', 'week', 'month']

/** The dates a view needs. */
function rangeFor(view: ViewMode, anchor: string): { start: string; end: string } {
  if (view === 'day') return { start: anchor, end: anchor }
  if (view === 'week') {
    const start = startOfWeek(anchor)
    return { start, end: addDays(start, 6) }
  }
  // The month grid shows a few days either side of the month.
  const grid = monthGrid(anchor)
  return { start: grid[0], end: grid[grid.length - 1] }
}

export default function ScheduleScreen({ onToast }: { onToast: (message: string) => void }) {
  const [view, setView] = useState<ViewMode>('day')
  const [anchor, setAnchor] = useState(todayISO())
  const schedule = useSchedule()

  const [detail, setDetail] = useState<ScheduleItem | null>(null)
  const [form, setForm] = useState<{ item: ScheduleItem | null } | null>(null)
  const [expenseFor, setExpenseFor] = useState<ScheduleItem | null>(null)

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor])
  const items = useMemo(
    () => inRange(schedule, range.start, range.end),
    [schedule, range.start, range.end],
  )
  const dayItems = useMemo(() => onDay(schedule, anchor), [schedule, anchor])
  // The strip marks every day of the week that has something on it, so it
  // needs the week regardless of which view is showing.
  const weekItems = useMemo(() => {
    const start = startOfWeek(anchor)
    return inRange(schedule, start, addDays(start, 6))
  }, [schedule, anchor])

  function step(direction: 1 | -1) {
    if (view === 'day') setAnchor(addDays(anchor, direction))
    else if (view === 'week') setAnchor(addDays(anchor, 7 * direction))
    else setAnchor(addMonths(anchor, direction))
  }

  function openDay(date: string) {
    setAnchor(date)
    setView('day')
  }

  async function save(draft: ScheduleDraft) {
    if (form?.item) await store.updateSchedule(form.item.id, draft)
    else await store.createSchedule(draft)
    // Land on the saved date so the item is visible straight away.
    setAnchor(draft.date)
    setForm(null)
    onToast(form?.item ? 'Updated' : 'Added')
  }

  async function remove(id: number) {
    await store.deleteSchedule(id)
    setDetail(null)
    onToast('Deleted')
  }

  async function saveExpense(draft: ExpenseDraft) {
    await createExpense(draft)
    setExpenseFor(null)
    onToast('Expense added')
  }

  const title =
    view === 'day'
      ? `${relativeDay(anchor)}, ${shortDate(anchor)}`
      : view === 'week'
        ? weekTitle(anchor)
        : monthTitle(anchor)

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
          <h1 className="truncate text-[19px] font-semibold tracking-tight">{title}</h1>
          <div className="flex shrink-0 items-center gap-1 text-neutral-400">
            {anchor !== todayISO() && (
              <button
                onClick={() => setAnchor(todayISO())}
                className="mr-1 text-[13px] font-medium text-brand-500"
              >
                Today
              </button>
            )}
            <button onClick={() => step(-1)} aria-label="Previous" className="p-1">
              <ChevronLeft />
            </button>
            <button onClick={() => step(1)} aria-label="Next" className="p-1">
              <ChevronRight />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3">
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
            {VIEWS.map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`flex-1 rounded-full py-1.5 text-[13px] capitalize transition-colors ${
                  view === mode ? 'bg-white font-medium shadow-sm' : 'text-neutral-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {view === 'day' && <DayStrip anchor={anchor} items={weekItems} onPick={setAnchor} />}
      </header>

      <main className="pb-28">
        {view === 'day' ? (
          <DayView items={dayItems} day={anchor} onOpen={setDetail} />
        ) : view === 'week' ? (
          <WeekView anchor={anchor} items={items} onOpen={setDetail} onPickDay={openDay} />
        ) : (
          <MonthView
            anchor={anchor}
            items={items}
            onOpen={setDetail}
            onSelect={setAnchor}
            onPickDay={openDay}
          />
        )}
      </main>

      <Fab label="Add to schedule" onClick={() => setForm({ item: null })} />

      {detail && (
        <ScheduleDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ item: detail })
            setDetail(null)
          }}
          onDelete={() => remove(detail.id)}
          onAddExpense={() => {
            setExpenseFor(detail)
            setDetail(null)
          }}
        />
      )}

      {form && (
        <ScheduleForm
          item={form.item}
          defaultDate={anchor}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}

      {expenseFor && (
        <ExpenseForm
          expense={null}
          defaultDate={expenseFor.date > todayISO() ? expenseFor.date : todayISO()}
          defaultScheduleId={expenseFor.id}
          onClose={() => setExpenseFor(null)}
          onSave={saveExpense}
        />
      )}
    </>
  )
}
