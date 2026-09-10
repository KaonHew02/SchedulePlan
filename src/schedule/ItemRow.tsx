import { useTags } from '../lib/store'
import { tagEmoji } from '../lib/tags'
import type { ScheduleItem } from '../types'

/** One line on the timeline: time, tag emoji, title, location. */
export default function ItemRow({
  item,
  onOpen,
}: {
  item: ScheduleItem
  onOpen: (item: ScheduleItem) => void
}) {
  const tags = useTags()

  return (
    <button
      onClick={() => onOpen(item)}
      className="w-full flex gap-3 px-5 py-3.5 text-left border-b border-neutral-100 active:bg-neutral-50"
    >
      <div className="w-11 shrink-0 tabular-nums">
        <div className="text-[13px] leading-6 text-neutral-900">{item.start_time}</div>
        {item.end_time && (
          <div className="text-[12px] leading-4 text-neutral-400">{item.end_time}</div>
        )}
      </div>
      <div className="w-5 shrink-0 text-[15px] leading-6 text-center">{tagEmoji(tags, item.tag)}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-6 font-medium truncate">{item.title}</div>
        {item.location && (
          <div className="text-[13px] leading-5 text-neutral-500 truncate">{item.location}</div>
        )}
      </div>
    </button>
  )
}
