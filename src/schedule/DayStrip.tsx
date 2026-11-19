import { tr } from '../lib/i18n'
import { dayNumber, todayISO, weekDays, weekdayShort } from '../lib/date'
import type { Holiday } from '../lib/holidays'
import { occupies } from '../lib/store'
import type { ScheduleItem } from '../types'

/**
 * The week, as seven pills.
 *
 * It is a fixed seven-across grid rather than a scrolling strip. A row you
 * have to swipe hides days behind an edge with nothing to say they are there,
 * and on a mouse it is close to unreachable — the same trap the tag chips fell
 * into. Seven fit across the narrowest phone at this size.
 */
export default function DayStrip({
  anchor,
  items,
  onPick,
  holidays,
}: {
  anchor: string
  items: ScheduleItem[]
  onPick: (day: string) => void
  holidays?: Map<string, Holiday[]>
}) {
  const today = todayISO()

  return (
    <div className="grid grid-cols-7 gap-1 px-3 pb-3">
      {weekDays(anchor).map((day) => {
        const selected = day === anchor
        const isToday = day === today
        const busy = items.some((item) => occupies(item, day))
        const holiday = holidays?.has(day)

        return (
          <button
            key={day}
            onClick={() => onPick(day)}
            aria-current={selected ? 'date' : undefined}
            className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
              selected
                ? 'bg-brand-500 text-white'
                : holiday
                  ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                  : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            {holiday && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1.5 rounded-full bg-amber-500 px-[3px] text-[8px] font-bold leading-[1.35] text-white shadow-sm"
              >
                {tr('PH', '休')}
              </span>
            )}
            <span className={`text-[10px] font-medium ${selected ? 'text-white/75' : ''}`}>
              {weekdayShort(day)}
            </span>
            <span
              className={`text-[15px] font-semibold tabular-nums ${
                selected
                  ? 'text-white'
                  : isToday
                    ? 'text-brand-500'
                    : holiday
                      ? 'text-amber-800'
                      : 'text-neutral-900'
              }`}
            >
              {dayNumber(day)}
            </span>
            {/* A dot rather than a count: seven cells is not the place to read
                numbers, only to see which days have something in them. */}
            <span
              className={`h-1 w-1 rounded-full ${
                busy ? (selected ? 'bg-white' : 'bg-brand-500') : 'bg-transparent'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
