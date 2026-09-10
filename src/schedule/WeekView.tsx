import { dayNumber, todayISO, weekDays, weekdayShort } from '../lib/date'
import type { ScheduleItem } from '../types'
import ItemRow from './ItemRow'

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
    <div className="border-t border-neutral-100">
      {weekDays(anchor).map((day) => {
        const dayItems = items.filter((item) => item.date === day)
        return (
          <section key={day}>
            <button
              onClick={() => onPickDay(day)}
              className="w-full flex items-baseline gap-2 px-5 pt-4 pb-1.5 text-left"
            >
              <span
                className={`text-[13px] font-medium ${
                  day === today ? 'text-blue-600' : 'text-neutral-900'
                }`}
              >
                {weekdayShort(day)} {dayNumber(day)}
              </span>
              {dayItems.length === 0 && (
                <span className="text-[13px] text-neutral-300">Nothing scheduled</span>
              )}
            </button>
            {dayItems.map((item) => (
              <ItemRow key={item.id} item={item} onOpen={onOpen} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
