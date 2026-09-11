import { ChevronRight } from '../components/Icons'
import {
  dayNumber,
  isSameMonth,
  monthGrid,
  relativeDay,
  shortDate,
  todayISO,
  weekDays,
  weekdayShort,
} from '../lib/date'
import { occupies } from '../lib/store'
import type { ScheduleItem } from '../types'
import ItemRow from './ItemRow'

/**
 * The month grid, and the chosen day's list under it.
 *
 * The dots under each number were 4px of neutral-300 and effectively
 * invisible — on a white cell at arm's length they read as dirt on the
 * screen rather than as information. They are now 6px and the app's blue,
 * which is the one colour the month grid already uses to mean *something is
 * here*. A day with more than three things shows three dots and a count,
 * because four identical dots is a number nobody can read at a glance.
 */
export default function MonthView({
  anchor,
  items,
  onOpen,
  onSelect,
  onPickDay,
}: {
  anchor: string
  items: ScheduleItem[]
  onOpen: (item: ScheduleItem) => void
  onSelect: (date: string) => void
  onPickDay: (date: string) => void
}) {
  const today = todayISO()
  const grid = monthGrid(anchor)

  // Counted per day rather than per record: a trip covers every day it runs
  // for, and a month grid that only marked the day it started would be wrong
  // about five days out of six.
  const counts = new Map<string, number>()
  for (const day of grid) {
    const count = items.reduce((total, item) => total + (occupies(item, day) ? 1 : 0), 0)
    if (count) counts.set(day, count)
  }

  const selectedItems = items.filter((item) => occupies(item, anchor))

  return (
    <div>
      <div className="grid grid-cols-7 px-2 pb-1">
        {weekDays(anchor).map((day) => (
          <div key={day} className="text-center text-[11px] text-neutral-400">
            {weekdayShort(day)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 px-2">
        {grid.map((day) => {
          const count = counts.get(day) ?? 0
          const selected = day === anchor
          const thisMonth = isSameMonth(day, anchor)

          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              aria-label={`${shortDate(day)}, ${count} scheduled`}
              className="flex h-12 flex-col items-center justify-center gap-1 md:h-16"
            >
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums',
                  selected ? 'bg-neutral-900 font-medium text-white' : '',
                  !selected && day === today ? 'font-semibold text-blue-600' : '',
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
                      thisMonth ? 'text-blue-600' : 'text-neutral-300'
                    }`}
                  >
                    {count}
                  </span>
                ) : (
                  Array.from({ length: count }, (_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 w-1.5 rounded-full ${
                        thisMonth ? 'bg-blue-600' : 'bg-neutral-300'
                      }`}
                    />
                  ))
                )}
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onPickDay(anchor)}
        className="mt-4 flex w-full items-center gap-1 px-5 pb-2 text-left"
      >
        <span className="text-[13px] font-medium">{relativeDay(anchor)}</span>
        <span className="text-[13px] text-neutral-400">{shortDate(anchor)}</span>
        <ChevronRight className="h-4 w-4 text-neutral-300" />
      </button>

      {selectedItems.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] text-neutral-300">Nothing scheduled</p>
      ) : (
        <div className="border-t border-neutral-100">
          {selectedItems.map((item) => (
            <ItemRow key={item.id} item={item} day={anchor} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
