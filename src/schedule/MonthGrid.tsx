import {
  addMonths,
  dayNumber,
  isSameMonth,
  monthGrid,
  shortDate,
  todayISO,
  weekDays,
  weekdayShort,
} from '../lib/date'
import { occupies } from '../lib/store'
import { ChevronLeft, ChevronRight } from '../components/Icons'
import type { ScheduleItem } from '../types'

/**
 * The calendar grid, shared by the Month view and the desktop rail.
 *
 * Counted per day rather than per record: a trip covers every day it runs for,
 * and a grid that only marked the day it started would be wrong about five
 * days out of six.
 *
 * The dots were 4px of neutral-300 and effectively invisible — on a white cell
 * at arm's length they read as dirt on the screen rather than as information.
 * They are now 6px and the app's accent, and a day with more than three things
 * shows a count, because four identical dots is a number nobody can read at a
 * glance.
 */
export default function MonthGrid({
  anchor,
  items,
  onSelect,
  /** Smaller cells and no month header — the desktop rail's version. */
  compact = false,
  /** Shown above the grid when compact, so the rail can be paged on its own. */
  onStepMonth,
}: {
  anchor: string
  items: ScheduleItem[]
  onSelect: (day: string) => void
  compact?: boolean
  onStepMonth?: (iso: string) => void
}) {
  const today = todayISO()
  const grid = monthGrid(anchor)

  const counts = new Map<string, number>()
  for (const day of grid) {
    const count = items.reduce((total, item) => total + (occupies(item, day) ? 1 : 0), 0)
    if (count) counts.set(day, count)
  }

  return (
    <div>
      {compact && onStepMonth && (
        <div className="flex items-center justify-between px-1 pb-1">
          <button
            onClick={() => onStepMonth(addMonths(anchor, -1))}
            aria-label="Previous month"
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold tracking-tight">
            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
              new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1, 1),
            )}
          </span>
          <button
            onClick={() => onStepMonth(addMonths(anchor, 1))}
            aria-label="Next month"
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`grid grid-cols-7 pb-1 ${compact ? '' : 'px-2'}`}>
        {weekDays(anchor).map((day) => (
          <div
            key={day}
            className={`text-center text-neutral-400 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
          >
            {compact ? weekdayShort(day).slice(0, 2) : weekdayShort(day)}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${compact ? '' : 'px-2'}`}>
        {grid.map((day) => {
          const count = counts.get(day) ?? 0
          const selected = day === anchor
          const thisMonth = isSameMonth(day, anchor)

          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              aria-label={`${shortDate(day)}, ${count} scheduled`}
              className={`flex flex-col items-center justify-center gap-1 ${
                compact ? 'h-9' : 'h-12 md:h-16'
              }`}
            >
              <span
                className={[
                  'flex items-center justify-center rounded-full tabular-nums',
                  compact ? 'h-6 w-6 text-[12px]' : 'h-7 w-7 text-[13px]',
                  selected ? 'bg-brand-500 font-medium text-white' : '',
                  !selected && day === today ? 'font-semibold text-brand-500' : '',
                  !selected && day !== today && thisMonth ? 'text-neutral-900' : '',
                  !selected && !thisMonth ? 'text-neutral-300' : '',
                ].join(' ')}
              >
                {dayNumber(day)}
              </span>

              <span className="flex h-1.5 items-center gap-[3px]">
                {count > 3 ? (
                  <span
                    className={`text-[10px] font-semibold leading-none tabular-nums ${
                      thisMonth ? 'text-brand-500' : 'text-neutral-300'
                    }`}
                  >
                    {count}
                  </span>
                ) : (
                  Array.from({ length: count }, (_, index) => (
                    <span
                      key={index}
                      className={`rounded-full ${compact ? 'h-1 w-1' : 'h-1.5 w-1.5'} ${
                        thisMonth ? 'bg-brand-500' : 'bg-neutral-300'
                      }`}
                    />
                  ))
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
