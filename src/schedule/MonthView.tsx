import { ChevronRight } from '../components/Icons'
import { relativeDay, shortDate } from '../lib/date'
import type { Holiday } from '../lib/holidays'
import { tr } from '../lib/i18n'
import { occupies } from '../lib/store'
import type { ScheduleItem } from '../types'
import { HolidayLines } from './HolidayLine'
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
  holidays,
}: {
  anchor: string
  items: ScheduleItem[]
  onOpen: (item: ScheduleItem) => void
  onSelect: (date: string) => void
  onPickDay: (date: string) => void
  holidays: Map<string, Holiday[]>
}) {
  const selectedItems = items.filter((item) => occupies(item, anchor))

  return (
    <div>
      <MonthGrid anchor={anchor} items={items} onSelect={onSelect} holidays={holidays} />

      <button
        onClick={() => onPickDay(anchor)}
        className="mt-4 flex w-full items-center gap-1 px-5 pb-2 text-left"
      >
        <span className="text-[13px] font-medium">{relativeDay(anchor)}</span>
        <span className="text-[13px] text-neutral-400">{shortDate(anchor)}</span>
        <ChevronRight className="h-4 w-4 text-neutral-300" />
        {selectedItems.length > 0 && (
          <span className="ml-auto rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-medium text-brand-700">
            {tr(
              `${selectedItems.length} ${selectedItems.length === 1 ? 'plan' : 'plans'}`,
              `${selectedItems.length} 项行程`,
            )}
          </span>
        )}
      </button>

      <HolidayLines holidays={holidays.get(anchor)} className="px-4 pb-2" />

      {selectedItems.length === 0 ? (
        <p className="mx-4 mb-6 flex items-center gap-2 rounded-2xl border border-dashed border-neutral-200 px-4 py-3 text-[13px] text-neutral-400">
          <span className="text-[16px]">☀️</span>
          {tr('Free day — tap + to plan something', '空闲的一天 — 点 + 安排行程')}
        </p>
      ) : (
        <div className="space-y-2 px-4 pb-4">
          {selectedItems.map((item) => (
            <ItemCard key={`${item.id}:${item.date}`} item={item} day={anchor} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
