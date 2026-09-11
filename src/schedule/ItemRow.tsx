import { PaperclipIcon } from '../components/Icons'
import { dayOfSpan, daysBetween } from '../lib/date'
import { lastDay, spansDays, useTags } from '../lib/store'
import { tagEmoji } from '../lib/tags'
import type { ScheduleItem } from '../types'

/**
 * One line on the timeline: time, tag emoji, title, location.
 *
 * Something spanning several days appears on each of them, so the left column
 * has to say *which part* of it this is. Only the first day shows a start
 * time and only the last shows an end; the days between say so with a rule,
 * because printing 09:00 on the middle day of a trip would be a lie.
 */
export default function ItemRow({
  item,
  onOpen,
  /** The day this row is being drawn under. */
  day,
}: {
  item: ScheduleItem
  onOpen: (item: ScheduleItem) => void
  day?: string
}) {
  const tags = useTags()
  const spans = spansDays(item)
  const on = day ?? item.date
  const isFirst = on === item.date
  const isLast = on === lastDay(item)

  return (
    <button
      onClick={() => onOpen(item)}
      className="flex w-full gap-3 border-b border-neutral-100 px-5 py-3.5 text-left active:bg-neutral-50"
    >
      <div className="w-11 shrink-0 tabular-nums">
        {item.all_day ? (
          <div className="text-[12px] leading-6 text-neutral-500">All day</div>
        ) : isFirst ? (
          <>
            <div className="text-[13px] leading-6 text-neutral-900">{item.start_time}</div>
            {item.end_time && !spans && (
              <div className="text-[12px] leading-4 text-neutral-400">{item.end_time}</div>
            )}
          </>
        ) : isLast && item.end_time ? (
          <div className="text-[13px] leading-6 text-neutral-500">
            <span className="text-neutral-300">→ </span>
            {item.end_time}
          </div>
        ) : (
          <div className="flex h-6 items-center">
            <span className="h-px w-4 bg-neutral-200" />
          </div>
        )}
      </div>

      <div className="w-5 shrink-0 text-center text-[15px] leading-6">
        {tagEmoji(tags, item.tag)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium leading-6">{item.title}</span>
          {item.attachments.length > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-neutral-400">
              <PaperclipIcon className="h-3 w-3" />
              {item.attachments.length > 1 && item.attachments.length}
            </span>
          )}
        </div>
        <div className="flex gap-1.5 truncate text-[13px] leading-5 text-neutral-500">
          {spans && (
            <span className="shrink-0 text-neutral-400">
              Day {dayOfSpan(item.date, on)} of {daysBetween(item.date, lastDay(item))}
            </span>
          )}
          {spans && item.location && <span className="text-neutral-300">·</span>}
          {item.location && <span className="truncate">{item.location}</span>}
        </div>
      </div>
    </button>
  )
}
