import { Fragment } from 'react'
import EmptyState from '../components/EmptyState'
import { minutesOf, nowTime, todayISO } from '../lib/date'
import type { Holiday } from '../lib/holidays'
import { tr } from '../lib/i18n'
import { lastDay } from '../lib/store'
import type { ScheduleItem } from '../types'
import { HolidayLines } from './HolidayLine'
import ItemCard, { isRunning } from './ItemCard'
import { useTags } from '../lib/store'
import { tintFor } from '../lib/tags'

/**
 * A day, as a time gutter and a column of cards.
 *
 * The now-line is placed *between cards* rather than at a pixel offset for the
 * minute. Positioning it properly would mean giving the day a fixed height and
 * scaling every card to its duration, which turns a five-minute coffee into an
 * unreadable sliver and a three-hour meeting into a wall. Between cards is
 * both simpler and, for reading "what is next", more useful.
 */

function NowLine({ time, line }: { time: string; line: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-brand-500">
        {time}
      </span>
      <span className="relative flex w-4 shrink-0 justify-center self-stretch py-1.5">
        {line && <Route />}
        <span className="relative h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
      </span>
      <span className="h-px flex-1 bg-brand-300" />
    </div>
  )
}

/** The dotted line that joins one stop to the next. */
function Route({ from = 'top', to = 'bottom' }: { from?: 'top' | 'node'; to?: 'bottom' | 'node' }) {
  return (
    <span
      aria-hidden
      className={`absolute left-1/2 w-0 -translate-x-1/2 border-l-2 border-dotted border-neutral-300 ${
        from === 'node' ? 'top-[19px]' : 'top-0'
      } ${to === 'node' ? 'h-[19px]' : 'bottom-0'}`}
    />
  )
}

/** A stop on the route: a dot in the card's colour, pulsing while it is on. */
function Stop({ item, day, first, last }: { item: ScheduleItem; day: string; first: boolean; last: boolean }) {
  const tags = useTags()
  const tint = tintFor(item.tag, tags)
  const running = isRunning(item, day)
  return (
    <span className="relative flex w-4 shrink-0 justify-center">
      {!(first && last) && <Route from={first ? 'node' : 'top'} to={last ? 'node' : 'bottom'} />}
      <span className="relative mt-[13px] flex h-3 w-3">
        {running && (
          <span className={`absolute inset-0 animate-ping rounded-full ${tint.bar} opacity-60`} />
        )}
        <span className={`relative h-3 w-3 rounded-full ${tint.bar} ring-4 ring-white`} />
      </span>
    </span>
  )
}

/**
 * The day at a glance, above the route: how many stops, and from when to
 * when — the line a printed itinerary opens each day with.
 */
function DaySummary({ items }: { items: ScheduleItem[] }) {
  const timed = items.filter((item) => !item.all_day)
  const stops = items.length
  const from = timed[0]?.start_time
  const to = timed.reduce<string | undefined>((latest, item) => {
    const end = item.end_time ?? item.start_time
    return !latest || end > latest ? end : latest
  }, undefined)
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-1 pl-[88px] text-[12px]">
      <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">
        🧭 {tr(`${stops} ${stops === 1 ? 'stop' : 'stops'}`, `${stops} 站`)}
      </span>
      {from && to && from !== to && (
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 tabular-nums text-neutral-600">
          {from} → {to}
        </span>
      )}
    </div>
  )
}

/** What the left column says for this item on this day. */
function Gutter({ item, day }: { item: ScheduleItem; day: string }) {
  if (item.all_day) {
    return <span className="text-[11px] leading-5 text-neutral-400">{tr('All day', '全天')}</span>
  }
  if (day === item.date) {
    return <span className="text-[13px] font-medium leading-5 tabular-nums">{item.start_time}</span>
  }
  if (day === lastDay(item) && item.end_time) {
    return (
      <span className="text-[13px] leading-5 tabular-nums text-neutral-500">
        <span className="text-neutral-300">→</span> {item.end_time}
      </span>
    )
  }
  // A middle day of something that spans: no time is true of it.
  return (
    <span className="flex h-5 items-center justify-end">
      <span className="h-px w-4 bg-neutral-200" />
    </span>
  )
}

export default function DayView({
  items,
  day,
  onOpen,
  holidays,
}: {
  items: ScheduleItem[]
  day: string
  onOpen: (item: ScheduleItem) => void
  holidays: Holiday[] | undefined
}) {
  if (items.length === 0) {
    return (
      <>
        <HolidayLines holidays={holidays} className="px-4 pt-1" />
        <EmptyState
          icon="🧳"
          title={tr('A free day', '空闲的一天')}
          hint={tr('Tap + to plan a stop', '点 + 安排行程')}
        />
      </>
    )
  }

  const now = nowTime()
  const showNow = day === todayISO()
  // The first thing still to come; everything before it has started.
  const upcoming = items.findIndex(
    (item) => !item.all_day && minutesOf(item.start_time) > minutesOf(now),
  )
  const nowAt = showNow ? (upcoming === -1 ? items.length : upcoming) : -1

  return (
    <div className="px-4 pb-4 pt-1">
      {/* Lined up with the cards, past the time gutter and the route, so it
          reads as part of the day rather than as a banner across the screen. */}
      <HolidayLines holidays={holidays} className="pb-2.5 pl-[88px]" />
      <DaySummary items={items} />
      <div className="pt-1.5">
        {items.map((item, index) => (
          <Fragment key={`${item.id}:${item.date}`}>
            {index === nowAt && <NowLine time={now} line={index > 0} />}
            <div className="flex gap-3">
              <div className="w-12 shrink-0 pt-3 text-right">
                <Gutter item={item} day={day} />
              </div>
              <Stop
                item={item}
                day={day}
                first={index === 0 && nowAt !== 0}
                last={index === items.length - 1 && nowAt !== items.length}
              />
              <div className="min-w-0 flex-1 pb-2.5">
                <ItemCard item={item} day={day} onOpen={onOpen} showTime={false} />
              </div>
            </div>
          </Fragment>
        ))}
        {nowAt === items.length && <NowLine time={now} line />}
      </div>
    </div>
  )
}
