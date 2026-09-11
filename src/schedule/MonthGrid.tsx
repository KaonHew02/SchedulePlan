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
import { onDay, useTags } from '../lib/store'
import { tintFor } from '../lib/tags'
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
 * They are 6px now, and each one is **the colour of the card it stands for**,
 * so a month of orange down the middle reads as a trip without opening a
 * single day. A day with more than three things shows a count instead, because
 * four dots is a number nobody can read at a glance — and the count stays
 * neutral on purpose, since a coloured number would claim a category the day
 * does not have.
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
  const tags = useTags()
  const grid = monthGrid(anchor)

  // The items themselves, not a tally: each dot needs to know which card it
  // stands for to take its colour. Kept in timeline order so the dots run in
  // the same order as the list under the grid.
  const onDays = new Map<string, ScheduleItem[]>()
  for (const day of grid) {
    const list = onDay(items, day)
    if (list.length) onDays.set(day, list)
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
          const list = onDays.get(day) ?? []
          const count = list.length
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
                      thisMonth ? 'text-neutral-500' : 'text-neutral-300'
                    }`}
                  >
                    {count}
                  </span>
                ) : (
                  list.map((item) => (
                    <span
                      key={item.id}
                      // Untagged takes neutral-400 rather than the card's own
                      // neutral-300 bar: a bar has a whole card edge to be
                      // seen along, a 6px dot on white has nothing.
                      className={`rounded-full ${compact ? 'h-1 w-1' : 'h-1.5 w-1.5'} ${
                        item.tag ? tintFor(item.tag, tags).bar : 'bg-neutral-400'
                      } ${thisMonth ? '' : 'opacity-30'}`}
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
