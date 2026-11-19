import {
  addMonths,
  dayNumber,
  isSameMonth,
  monthGrid,
  monthTitle,
  shortDate,
  todayISO,
  weekDays,
  weekdayShort,
} from '../lib/date'
import { lastDay, onDay, spansDays, useTags } from '../lib/store'
import { TRAVEL_TAG, tintFor } from '../lib/tags'
import { ChevronLeft, ChevronRight } from '../components/Icons'
import { holidayName, type Holiday } from '../lib/holidays'
import { isZh, tr } from '../lib/i18n'
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
 *
 * Something that runs over several days — a trip, above all — is drawn as a
 * band behind its dates, in its card's colour, the way a booking site shows
 * the nights you have picked. A trip then reads as a journey across the
 * month instead of a row of identical dots. A trip tagged Travel wins the
 * band when two overlap, and the banded item gives up its dot.
 *
 * A public holiday turns the date red in a filled pink circle, the way a
 * printed calendar marks days off — red text alone was too easy to miss.
 * Not a dot: the dots are what you put in the diary, and a holiday is not.
 */
export default function MonthGrid({
  anchor,
  items,
  onSelect,
  /** Smaller cells and no month header — the desktop rail's version. */
  compact = false,
  /** Shown above the grid when compact, so the rail can be paged on its own. */
  onStepMonth,
  holidays,
}: {
  anchor: string
  items: ScheduleItem[]
  /** By day, from useHolidays. */
  holidays?: Map<string, Holiday[]>
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
            aria-label={tr('Previous month', '上个月')}
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold tracking-tight">
            {monthTitle(anchor)}
          </span>
          <button
            onClick={() => onStepMonth(addMonths(anchor, 1))}
            aria-label={tr('Next month', '下个月')}
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
            {/* Two letters of 'Mon' is 'Mo'; two characters of 周一 is all of it,
                so the Chinese keeps the 一 that tells the days apart. */}
            {compact
              ? isZh()
                ? weekdayShort(day).slice(-1)
                : weekdayShort(day).slice(0, 2)
              : weekdayShort(day)}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${compact ? '' : 'px-2'}`}>
        {grid.map((day, index) => {
          const all = onDays.get(day) ?? []
          const band =
            all.find((item) => spansDays(item) && item.tag === TRAVEL_TAG) ??
            all.find((item) => spansDays(item))
          const list = band ? all.filter((item) => item !== band) : all
          const count = all.length
          const column = index % 7
          const bandStart = band && (band.date === day || column === 0)
          const bandEnd = band && (lastDay(band) === day || column === 6)
          // Half the date circle, so the band's round ends sit on the circle.
          const half = compact ? 12 : 14
          const selected = day === anchor
          const thisMonth = isSameMonth(day, anchor)
          const holiday = holidays?.get(day)

          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              aria-label={tr(
                `${shortDate(day)}, ${count} scheduled${
                  holiday ? `, ${holiday.map((one) => holidayName(one.name)).join(', ')}` : ''
                }`,
                `${shortDate(day)}，${count} 项安排${
                  holiday ? `，${holiday.map((one) => holidayName(one.name)).join('、')}` : ''
                }`,
              )}
              className={`flex flex-col items-center justify-center gap-1 ${
                compact ? 'h-9' : 'h-12 md:h-16'
              }`}
            >
              <span className="relative flex w-full justify-center">
                {band && (
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 ${
                      // Untagged cards are white now, which on this white
                      // card would be no band at all.
                      band.tag ? tintFor(band.tag, tags).bg : 'bg-neutral-100'
                    } ${
                      bandStart ? 'rounded-l-full' : ''
                    } ${bandEnd ? 'rounded-r-full' : ''} ${thisMonth ? '' : 'opacity-50'}`}
                    style={{
                      left: bandStart ? `calc(50% - ${half}px)` : 0,
                      right: bandEnd ? `calc(50% - ${half}px)` : 0,
                    }}
                  />
                )}
                <span
                  className={[
                    'relative flex items-center justify-center rounded-full tabular-nums',
                    compact ? 'h-6 w-6 text-[12px]' : 'h-7 w-7 text-[13px]',
                    selected ? 'bg-brand-500 font-medium text-white' : '',
                    // A holiday gets a filled pink circle, not only red text:
                    // red text alone was too easy to miss on a phone.
                    !selected && holiday
                      ? thisMonth
                        ? 'bg-rose-100 ring-1 ring-rose-300'
                        : 'bg-rose-50'
                      : '',
                    !selected && day === today ? 'font-semibold text-brand-500' : '',
                    // Today keeps its own colour even on a holiday: which day it
                    // is matters more, and the pink circle still says holiday.
                    !selected && day !== today && holiday
                      ? thisMonth
                        ? 'font-bold text-rose-700'
                        : 'text-rose-300'
                      : '',
                    !selected && day !== today && !holiday && thisMonth ? 'text-neutral-900' : '',
                    !selected && !holiday && !thisMonth ? 'text-neutral-300' : '',
                  ].join(' ')}
                >
                  {dayNumber(day)}
                </span>
                {band && band.tag === TRAVEL_TAG && band.date === day && !compact && (
                  <span
                    aria-hidden
                    className="absolute -top-1.5 left-1/2 ml-2 text-[10px] leading-none"
                  >
                    ✈️
                  </span>
                )}
              </span>

              <span className="flex h-1.5 items-center gap-[3px]">
                {list.length > 3 ? (
                  <span
                    className={`text-[10px] font-semibold leading-none tabular-nums ${
                      thisMonth ? 'text-neutral-500' : 'text-neutral-300'
                    }`}
                  >
                    {list.length}
                  </span>
                ) : (
                  list.map((item) => (
                    <span
                      key={`${item.id}:${item.date}`}
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
