import { useMemo, useState } from 'react'
import Fab from '../components/Fab'
import ScreenTitle from '../components/ScreenTitle'
import { ChevronLeft, ChevronRight } from '../components/Icons'
import ExpenseForm from '../expenses/ExpenseForm'
import { MONEY } from '../lib/features'
import {
  addDays,
  addMonths,
  monthGrid,
  monthTitle,
  nowTime,
  relativeDay,
  shortDate,
  startOfWeek,
  todayISO,
  weekTitle,
} from '../lib/date'
import { useHolidays } from '../lib/holidays'
import { tr } from '../lib/i18n'
import { firstOccurrence, occurrences } from '../lib/repeat'
import {
  createExpense,
  inRange,
  lastDay,
  onDay,
  store,
  storedItem,
  useSchedule,
} from '../lib/store'
import DayStrip from '../schedule/DayStrip'
import DayView from '../schedule/DayView'
import ItemCard from '../schedule/ItemCard'
import MonthGrid from '../schedule/MonthGrid'
import MonthView from '../schedule/MonthView'
import NextTrip, { FlightPath } from '../schedule/NextTrip'
import ScheduleDetail from '../schedule/ScheduleDetail'
import ScheduleForm from '../schedule/ScheduleForm'
import WeekView from '../schedule/WeekView'
import type { ExpenseDraft, ScheduleDraft, ScheduleItem, ViewMode } from '../types'

const VIEWS: ViewMode[] = ['day', 'week', 'month']

/** The toggle's words. The English is the mode itself, capitalised by the button's class. */
const viewLabel = (mode: ViewMode): string =>
  tr(mode, mode === 'day' ? '日' : mode === 'week' ? '周' : '月')

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

/**
 * Still to come: not finished, soonest first.
 *
 * A repeat is here once, as the next time it comes round. Five Fridays of
 * badminton would fill the list and say nothing the first one does not.
 */
function upcoming(schedule: ScheduleItem[], limit: number): ScheduleItem[] {
  const today = todayISO()
  const now = nowTime()
  const notOver = (item: ScheduleItem) => {
    const ends = lastDay(item)
    if (ends > today) return true
    if (ends < today) return false
    return item.all_day || (item.end_time ?? item.start_time) >= now
  }
  const next: ScheduleItem[] = []
  for (const item of schedule) {
    // Only today's can be over while still ending today, so this reads two
    // at most — the one that finished this morning and the one after it.
    for (const time of occurrences(item, today)) {
      if (notOver(time)) {
        next.push(time)
        break
      }
    }
  }
  return next
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(b.all_day) - Number(a.all_day) ||
        a.start_time.localeCompare(b.start_time) ||
        a.id - b.id,
    )
    .slice(0, limit)
}

function ViewToggle({
  view,
  onChange,
  className = '',
}: {
  view: ViewMode
  onChange: (view: ViewMode) => void
  className?: string
}) {
  return (
    <div className={`flex gap-1 rounded-full bg-[#e6e4f6] p-1 ${className}`}>
      {VIEWS.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex-1 rounded-full px-4 py-1.5 text-[13px] capitalize transition-colors ${
            view === mode ? 'bg-white font-semibold text-brand-700 shadow-xs' : 'text-neutral-500'
          }`}
        >
          {viewLabel(mode)}
        </button>
      ))}
    </div>
  )
}

export default function ScheduleScreen({ onToast }: { onToast: (message: string) => void }) {
  /*
   * Month first. Opening on the day was the obvious default — the app is for
   * today — but the day you are on is the one thing you already know. What the
   * screen is opened to find out is what is coming, and the month grid answers
   * that in one look. Tapping a date still drops into the day, which is the
   * direction the question actually runs.
   */
  const [view, setView] = useState<ViewMode>('month')
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
  // The rail's calendar shows the anchor's whole month, which is a wider range
  // than the day view alone ever loads.
  const grid = useMemo(() => monthGrid(anchor), [anchor])
  const monthItems = useMemo(
    () => inRange(schedule, grid[0], grid[grid.length - 1]),
    [schedule, grid],
  )
  // The anchor's month grid holds its week and its day too, so one lookup over
  // it serves every view, the strip and the rail.
  const holidays = useHolidays(grid[0], grid[grid.length - 1], monthItems)
  const upNext = useMemo(() => upcoming(schedule, 5), [schedule])

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
    const saved = form?.item
      ? await store.updateSchedule(form.item.id, draft)
      : await store.createSchedule(draft)
    // Land on the saved date so the item is visible straight away. For a
    // repeat that is the next time it comes round from the day on screen —
    // staying put if it is already there — rather than the day it first
    // began, which for a birthday is decades back. One that finished before
    // the day on screen goes back to where it started.
    if (saved.repeat) {
      const coming = occurrences(saved, anchor).next().value
      setAnchor(
        coming
          ? coming.date > anchor
            ? coming.date
            : anchor
          : (firstOccurrence(saved)?.date ?? saved.date),
      )
    } else {
      setAnchor(saved.date)
    }
    setForm(null)
    onToast(form?.item ? tr('Updated', '已更新') : tr('Added', '已添加'))
  }

  async function remove(id: number) {
    await store.deleteSchedule(id)
    setDetail(null)
    onToast(tr('Deleted', '已删除'))
  }

  /** Just this time round, out of a repeat. */
  async function skip(item: ScheduleItem) {
    await store.skipDay(item.id, item.date)
    setDetail(null)
    onToast(tr('Removed from this day', '已从这天移除'))
  }

  async function saveExpense(draft: ExpenseDraft) {
    await createExpense(draft)
    setExpenseFor(null)
    onToast(tr('Expense added', '已添加开销'))
  }

  const title =
    view === 'day'
      ? tr(`${relativeDay(anchor)}, ${shortDate(anchor)}`, `${shortDate(anchor)} ${relativeDay(anchor)}`)
      : view === 'week'
        ? weekTitle(anchor)
        : monthTitle(anchor)

  return (
    <>
      {/*
        A sky behind the title, and a dotted flight path across it: the first
        hint that this is a diary for going places, not an office calendar.
      */}
      <header className="sticky top-0 z-20 overflow-hidden bg-gradient-to-b from-[#e9e7fd]/95 via-[#eff1fd]/90 to-ground/90 pt-safe backdrop-blur-sm">
        <FlightPath dot={false} className="absolute -top-1 right-20 h-14 w-40 text-brand-300/60 lg:right-72" />
        <div className="relative flex items-end justify-between gap-3 px-5 pb-3 pt-3 lg:items-center lg:px-8 lg:pt-4">
          <ScreenTitle>{title}</ScreenTitle>

          <div className="flex shrink-0 items-center gap-3">
            {/* On a laptop the toggle fits beside the title; on a phone it
                needs the full width and lives on its own row below. */}
            <ViewToggle view={view} onChange={setView} className="hidden lg:flex" />
            <div className="flex items-center gap-1 text-neutral-400">
              {anchor !== todayISO() && (
                <button
                  onClick={() => setAnchor(todayISO())}
                  className="mr-1 text-[13px] font-medium text-brand-500"
                >
                  {tr('Today', '今天')}
                </button>
              )}
              <button onClick={() => step(-1)} aria-label={tr('Previous', '上一页')} className="p-1">
                <ChevronLeft />
              </button>
              <button onClick={() => step(1)} aria-label={tr('Next', '下一页')} className="p-1">
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>

        <ViewToggle view={view} onChange={setView} className="relative mx-5 mb-3 lg:hidden" />

        {view === 'day' && (
          <DayStrip anchor={anchor} items={weekItems} onPick={setAnchor} holidays={holidays} />
        )}
      </header>

      <main className="pb-28 lg:px-8 lg:pb-10 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-8">
        <div className="min-w-0">
          {/* Where you are off to next. In the rail instead, on a screen wide
              enough to have one; and not over the day, which has its own route. */}
          {view !== 'day' && (
            <NextTrip
              schedule={schedule}
              onOpen={setDetail}
              onPlan={() => setForm({ item: null })}
              className="mx-auto mb-4 mt-1 max-w-[calc(100%-2rem)] lg:max-w-none xl:hidden"
            />
          )}
          {view === 'day' ? (
            <DayView
              items={dayItems}
              day={anchor}
              onOpen={setDetail}
              holidays={holidays.get(anchor)}
            />
          ) : view === 'week' ? (
            <WeekView
              anchor={anchor}
              items={items}
              onOpen={setDetail}
              onPickDay={openDay}
              holidays={holidays}
            />
          ) : (
            <MonthView
              anchor={anchor}
              items={items}
              onOpen={setDetail}
              onSelect={setAnchor}
              onPickDay={openDay}
              holidays={holidays}
            />
          )}
        </div>

        {/*
          The rail is the reason the column cap could go. Filling a 1900px
          screen by stretching one list across it would be worse than the
          margin was; a calendar to jump with and what is coming next is
          something a phone has no room for and a desktop does.
        */}
        <aside className="hidden xl:block xl:sticky xl:top-4 xl:space-y-6">
          <NextTrip
            schedule={schedule}
            onOpen={setDetail}
            onPlan={() => setForm({ item: null })}
          />

          {view !== 'month' && (
            <section className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(108,92,231,0.25)]">
              <MonthGrid
                anchor={anchor}
                items={monthItems}
                onSelect={setAnchor}
                onStepMonth={setAnchor}
                holidays={holidays}
                compact
              />
            </section>
          )}

          <section>
            <h2 className="pb-2 text-[13px] font-medium text-neutral-400">{tr('Up next', '接下来')}</h2>
            {upNext.length === 0 ? (
              <p className="rounded-2xl bg-white/70 px-4 py-5 text-center text-[13px] leading-5 text-neutral-400">
                <span className="mb-1 block text-[22px]">🗺️</span>
                {tr('Nothing ahead in the diary.', '接下来没有安排。')}
              </p>
            ) : (
              <div className="space-y-2">
                {upNext.map((item) => (
                  <ItemCard key={item.id} item={item} onOpen={setDetail} compact />
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>

      <Fab label={tr('Add to schedule', '添加日程')} onClick={() => setForm({ item: null })} />

      {detail && (
        <ScheduleDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            // The row, not the copy that was tapped: editing a repeat edits all of it.
            setForm({ item: storedItem(detail) })
            setDetail(null)
          }}
          onDelete={() => remove(detail.id)}
          onSkip={detail.repeat ? () => skip(detail) : undefined}
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

      {MONEY && expenseFor && (
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
