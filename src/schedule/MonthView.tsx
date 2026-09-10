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
import type { ScheduleItem } from '../types'
import ItemRow from './ItemRow'

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
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  const selectedItems = items.filter((item) => item.date === anchor)

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
          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              className="h-11 flex flex-col items-center justify-center gap-[3px]"
            >
              <span
                className={[
                  'flex items-center justify-center w-7 h-7 rounded-full text-[13px] tabular-nums',
                  selected ? 'bg-neutral-900 text-white font-medium' : '',
                  !selected && day === today ? 'text-blue-600 font-semibold' : '',
                  !selected && day !== today && isSameMonth(day, anchor)
                    ? 'text-neutral-900'
                    : '',
                  !selected && !isSameMonth(day, anchor) ? 'text-neutral-300' : '',
                ].join(' ')}
              >
                {dayNumber(day)}
              </span>
              <span className="flex gap-[3px] h-1">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-neutral-300" />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onPickDay(anchor)}
        className="mt-4 w-full flex items-center gap-1 px-5 pb-2 text-left"
      >
        <span className="text-[13px] font-medium">{relativeDay(anchor)}</span>
        <span className="text-[13px] text-neutral-400">{shortDate(anchor)}</span>
        <ChevronRight className="w-4 h-4 text-neutral-300" />
      </button>

      {selectedItems.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] text-neutral-300">Nothing scheduled</p>
      ) : (
        <div className="border-t border-neutral-100">
          {selectedItems.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
