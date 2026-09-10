import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { store } from '../lib/store'
import { ChevronLeft, ChevronRight, Plus } from '../components/Icons'
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
import DayView from '../schedule/DayView'
import MonthView from '../schedule/MonthView'
import ScheduleDetail from '../schedule/ScheduleDetail'
import ScheduleForm from '../schedule/ScheduleForm'
import WeekView from '../schedule/WeekView'
import type { ScheduleDraft, ScheduleItem, ViewMode } from '../types'

const VIEWS: ViewMode[] = ['day', 'week', 'month']

/** The dates a view needs to have loaded. */
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
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [detail, setDetail] = useState<ScheduleItem | null>(null)
  const [form, setForm] = useState<{ item: ScheduleItem | null } | null>(null)

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor])
  const latestRequest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latestRequest.current
    setLoading(true)
    try {
      const data = await store.listSchedule(range.start, range.end)
      if (request !== latestRequest.current) return // a newer range won the race
      setItems(data)
      setError(null)
    } catch (err) {
      if (request !== latestRequest.current) return
      setError(err instanceof Error ? err.message : 'Could not load your schedule.')
    } finally {
      if (request === latestRequest.current) setLoading(false)
    }
  }, [range.start, range.end])

  useEffect(() => {
    void load()
  }, [load, reloadToken])

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
    setReloadToken((token) => token + 1)
    setForm(null)
    onToast(form?.item ? 'Updated' : 'Added')
  }

  async function remove(id: number) {
    await store.deleteSchedule(id)
    setReloadToken((token) => token + 1)
    setDetail(null)
    onToast('Deleted')
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
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
            <h1 className="text-[19px] font-semibold tracking-tight truncate">{title}</h1>
            <div className="flex items-center gap-1 shrink-0 text-neutral-400">
              {anchor !== todayISO() && (
                <button
                  onClick={() => setAnchor(todayISO())}
                  className="mr-1 text-[13px] font-medium text-blue-600"
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
        </div>
      </header>

      <main className="mx-auto max-w-md pb-28">
        {error && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <span>{error}</span>
            <button
              onClick={() => setReloadToken((token) => token + 1)}
              className="shrink-0 font-medium underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && items.length === 0 && !error ? (
          <div className="border-t border-neutral-100 animate-pulse">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-3 px-5 py-4 border-b border-neutral-100">
                <div className="h-3 w-11 rounded bg-neutral-100" />
                <div className="h-3 flex-1 max-w-[55%] rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : view === 'day' ? (
          <DayView items={items} onOpen={setDetail} />
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

      <div className="fixed inset-x-0 bottom-[72px] z-30 pointer-events-none mb-safe">
        <div className="mx-auto max-w-md px-5 flex justify-end">
          <button
            onClick={() => setForm({ item: null })}
            aria-label="Add to schedule"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg active:scale-95 transition-transform"
          >
            <Plus />
          </button>
        </div>
      </div>

      {detail && (
        <ScheduleDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ item: detail })
            setDetail(null)
          }}
          onDelete={() => remove(detail.id)}
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
    </>
  )
}
