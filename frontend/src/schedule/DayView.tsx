import EmptyState from '../components/EmptyState'
import type { ScheduleItem } from '../types'
import ItemRow from './ItemRow'

export default function DayView({
  items,
  onOpen,
}: {
  items: ScheduleItem[]
  onOpen: (item: ScheduleItem) => void
}) {
  if (items.length === 0) {
    return <EmptyState title="Nothing scheduled" hint="Tap + to add something" />
  }

  return (
    <div className="border-t border-neutral-100">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  )
}
