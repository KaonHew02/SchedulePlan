import { Fragment } from 'react'
import EmptyState from '../components/EmptyState'
import { minutesOf, nowTime, todayISO } from '../lib/date'
import { lastDay } from '../lib/store'
import type { ScheduleItem } from '../types'
import ItemCard from './ItemCard'

/**
 * A day, as a time gutter and a column of cards.
 *
 * The now-line is placed *between cards* rather than at a pixel offset for the
 * minute. Positioning it properly would mean giving the day a fixed height and
 * scaling every card to its duration, which turns a five-minute coffee into an
 * unreadable sliver and a three-hour meeting into a wall. Between cards is
 * both simpler and, for reading "what is next", more useful.
 */

function NowLine({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-brand-500">
        {time}
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
      <span className="h-px flex-1 bg-brand-300" />
    </div>
  )
}

/** What the left column says for this item on this day. */
function Gutter({ item, day }: { item: ScheduleItem; day: string }) {
  if (item.all_day) {
    return <span className="text-[11px] leading-5 text-neutral-400">All day</span>
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
}: {
  items: ScheduleItem[]
  day: string
  onOpen: (item: ScheduleItem) => void
}) {
  if (items.length === 0) {
    return <EmptyState title="Nothing scheduled" hint="Tap + to add something" />
  }

  const now = nowTime()
  const showNow = day === todayISO()
  // The first thing still to come; everything before it has started.
  const upcoming = items.findIndex(
    (item) => !item.all_day && minutesOf(item.start_time) > minutesOf(now),
  )
  const nowAt = showNow ? (upcoming === -1 ? items.length : upcoming) : -1

  return (
    <div className="space-y-2.5 px-4 pb-4 pt-1">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index === nowAt && <NowLine time={now} />}
          <div className="flex gap-3">
            <div className="w-12 shrink-0 pt-3 text-right">
              <Gutter item={item} day={day} />
            </div>
            <div className="min-w-0 flex-1">
              <ItemCard item={item} day={day} onOpen={onOpen} showTime={false} />
            </div>
          </div>
        </Fragment>
      ))}
      {nowAt === items.length && <NowLine time={now} />}
    </div>
  )
}
