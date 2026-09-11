import { ChevronRight } from '../components/Icons'
import { relativeDay, shortDate } from '../lib/date'
import { occupies } from '../lib/store'
import type { ScheduleItem } from '../types'
import ItemCard from './ItemCard'
import MonthGrid from './MonthGrid'

/**
 * The month grid, and the chosen day's list under it.
 *
 * The grid itself lives in MonthGrid, because the desktop rail shows the same
 * calendar beside the day view and two copies of that loop would drift apart.
 */
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
  const selectedItems = items.filter((item) => occupies(item, anchor))

  return (
    <div>
      <MonthGrid anchor={anchor} items={items} onSelect={onSelect} />

      <button
        onClick={() => onPickDay(anchor)}
        className="mt-4 flex w-full items-center gap-1 px-5 pb-2 text-left"
      >
        <span className="text-[13px] font-medium">{relativeDay(anchor)}</span>
        <span className="text-[13px] text-neutral-400">{shortDate(anchor)}</span>
        <ChevronRight className="h-4 w-4 text-neutral-300" />
      </button>

      {selectedItems.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] text-neutral-300">Nothing scheduled</p>
      ) : (
        <div className="space-y-2 px-4 pb-4">
          {selectedItems.map((item) => (
            <ItemCard key={item.id} item={item} day={anchor} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
