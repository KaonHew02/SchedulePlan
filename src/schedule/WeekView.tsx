import { dayNumber, todayISO, weekDays, weekdayShort } from '../lib/date'
import { onDay } from '../lib/store'
import type { ScheduleItem } from '../types'
import ItemCard from './ItemCard'

export default function WeekView({
  anchor,
  items,
  onOpen,
  onPickDay,
}: {
  anchor: string
  items: ScheduleItem[]
  onOpen: (item: ScheduleItem) => void
  onPickDay: (date: string) => void
}) {
  const today = todayISO()

  return (
    <div className="px-4 pb-4">
      {weekDays(anchor).map((day) => {
        // onDay, not a date equality check: a trip belongs to every day it
        // runs through, not only the one it started on.
        const dayItems = onDay(items, day)
        return (
          <section key={day} className="pt-4">
            <button
              onClick={() => onPickDay(day)}
              className="flex w-full items-baseline gap-2 pb-2 text-left"
            >
              <span
                className={`text-[13px] font-semibold ${
                  day === today ? 'text-brand-500' : 'text-neutral-900'
                }`}
              >
                {weekdayShort(day)} {dayNumber(day)}
              </span>
              {dayItems.length === 0 && (
                <span className="text-[13px] text-neutral-300">Nothing scheduled</span>
              )}
            </button>
            <div className="space-y-2">
              {dayItems.map((item) => (
                <ItemCard key={item.id} item={item} day={day} onOpen={onOpen} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
