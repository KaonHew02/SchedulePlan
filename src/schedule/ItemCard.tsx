import { PaperclipIcon, PinIcon } from '../components/Icons'
import { dayOfSpan, daysBetween, minutesOf, nowTime, todayISO } from '../lib/date'
import { lastDay, spansDays, useTags } from '../lib/store'
import { tagEmoji, tintFor } from '../lib/tags'
import type { ScheduleItem } from '../types'

/**
 * One thing on the timeline, as a card.
 *
 * It used to be a row with a hairline under it, which made a day read as a
 * table. A card tinted by its tag makes the same day readable at a glance —
 * you find Friday's badminton by its colour long before you read the word.
 * The tint comes from the tag id (see `tintFor`), so it is consistent and
 * nobody has to pick one.
 */

/** Is this item running right now, on this day? */
export function isRunning(item: ScheduleItem, day: string): boolean {
  if (day !== todayISO()) return false
  const now = minutesOf(nowTime())
  if (item.all_day || spansDays(item)) {
    // A trip or a whole day is "now" for the whole of the day you are on.
    return true
  }
  const start = minutesOf(item.start_time)
  const end = item.end_time ? minutesOf(item.end_time) : start + 60
  return now >= start && now < end
}

export default function ItemCard({
  item,
  onOpen,
  day,
  /** Show the start time inside the card — off when a gutter already says it. */
  showTime = true,
}: {
  item: ScheduleItem
  onOpen: (item: ScheduleItem) => void
  day?: string
  showTime?: boolean
}) {
  const tags = useTags()
  const tint = tintFor(item.tag, tags)
  const spans = spansDays(item)
  const on = day ?? item.date
  const running = isRunning(item, on)

  const when = item.all_day
    ? 'All day'
    : item.end_time && !spans
      ? `${item.start_time} – ${item.end_time}`
      : item.start_time

  return (
    <button
      onClick={() => onOpen(item)}
      className={`relative flex w-full gap-3 overflow-hidden rounded-2xl ${tint.bg} px-3.5 py-3 text-left transition-transform active:scale-[0.99]`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${tint.bar}`} />

      <span className="min-w-0 flex-1 pl-1.5">
        <span className="flex items-start gap-2">
          <span className="text-[15px] leading-6">{tagEmoji(tags, item.tag)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold leading-6">{item.title}</span>
              {item.attachments.length > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-neutral-400">
                  <PaperclipIcon className="h-3 w-3" />
                  {item.attachments.length > 1 && item.attachments.length}
                </span>
              )}
            </span>

            {item.notes && (
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-neutral-500">
                {item.notes}
              </span>
            )}

            {(item.location || spans) && (
              <span className="mt-1 flex items-center gap-1 text-[12px] text-neutral-500">
                {spans && (
                  <span className={`font-medium ${tint.text}`}>
                    Day {dayOfSpan(item.date, on)}/{daysBetween(item.date, lastDay(item))}
                  </span>
                )}
                {spans && item.location && <span className="text-neutral-300">·</span>}
                {item.location && (
                  <>
                    <PinIcon className="h-3 w-3 shrink-0 text-neutral-400" />
                    <span className="truncate">{item.location}</span>
                  </>
                )}
              </span>
            )}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        {showTime && (
          <span className="text-[12px] font-medium tabular-nums text-neutral-500">{when}</span>
        )}
        {running && (
          <span className={`rounded-full ${tint.bar} px-2 py-0.5 text-[10px] font-semibold text-white`}>
            On now
          </span>
        )}
      </span>
    </button>
  )
}
