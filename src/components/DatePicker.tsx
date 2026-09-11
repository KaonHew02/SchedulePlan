import { useState } from 'react'
import { ChevronLeft, ChevronRight } from './Icons'
import {
  addMonths,
  dayNumber,
  isSameMonth,
  monthGrid,
  todayISO,
  weekDays,
  weekdayShort,
} from '../lib/date'

/**
 * The calendar that opens under a date field.
 *
 * It replaces the browser's own, which was never really a choice: the native
 * picker reads 11/09/2026 in one locale and 09/11/2026 in another, sits in a
 * box the app cannot style, and on Windows opens a list that has to be driven
 * three separate times before it commits anything.
 */

const CELL =
  'flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors'

export function CalendarPanel({
  value,
  onPick,
  onClear,
  /** The first day of a range being completed — shown shaded, never pickable before. */
  rangeStart,
  /** Nothing before this day can be chosen. */
  min,
}: {
  value: string
  onPick: (iso: string) => void
  onClear?: () => void
  rangeStart?: string | null
  min?: string | null
}) {
  const today = todayISO()
  // The month on screen is its own state: paging through March should not
  // reach back and change what is selected.
  const [month, setMonth] = useState(value || rangeStart || today)
  const grid = monthGrid(month)

  return (
    <div className="w-[292px] p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Previous month"
          className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[14px] font-semibold tracking-tight">
          {new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
            new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1),
          )}
        </span>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Next month"
          className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 justify-items-center pb-1">
        {weekDays(month).map((day) => (
          <div key={day} className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
            {weekdayShort(day).slice(0, 2)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 justify-items-center gap-y-0.5">
        {grid.map((day) => {
          const selected = day === value
          const blocked = Boolean(min && day < min)
          const inRange = Boolean(
            rangeStart && value && day > rangeStart && day < value && !blocked,
          )
          const isStart = Boolean(rangeStart && day === rangeStart)

          return (
            <button
              key={day}
              type="button"
              disabled={blocked}
              onClick={() => onPick(day)}
              aria-current={selected ? 'date' : undefined}
              className={[
                CELL,
                selected ? 'bg-blue-600 font-semibold text-white' : '',
                !selected && isStart ? 'bg-blue-100 font-medium text-blue-700' : '',
                !selected && !isStart && inRange ? 'bg-blue-50 text-blue-700' : '',
                !selected && !isStart && !inRange && blocked ? 'text-neutral-200' : '',
                !selected && !isStart && !inRange && !blocked && day === today
                  ? 'font-semibold text-blue-600 hover:bg-neutral-100'
                  : '',
                !selected && !isStart && !inRange && !blocked && day !== today
                  ? `${isSameMonth(day, month) ? 'text-neutral-900' : 'text-neutral-300'} hover:bg-neutral-100`
                  : '',
              ].join(' ')}
            >
              {dayNumber(day)}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex gap-2 border-t border-neutral-100 pt-2">
        <button
          type="button"
          onClick={() => {
            setMonth(today)
            if (!min || today >= min) onPick(today)
          }}
          className="flex-1 rounded-lg py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Today
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex-1 rounded-lg py-1.5 text-[13px] font-medium text-neutral-400 hover:bg-neutral-100"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export default CalendarPanel
