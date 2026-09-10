import { useState } from 'react'
import { PencilIcon, PinIcon, TrashIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { longDate, relativeDay, timeRange } from '../lib/date'
import { useTags } from '../lib/store'
import { tagEmoji, tagLabel } from '../lib/tags'
import type { ScheduleItem } from '../types'

export default function ScheduleDetail({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: ScheduleItem
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const tags = useTags()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
      // On success the parent closes this sheet.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete. Please try again.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <Sheet onClose={onClose} title={relativeDay(item.date)}>
      <div className="flex items-start gap-2.5">
        <span className="text-[20px] leading-8">{tagEmoji(tags, item.tag)}</span>
        <h3 className="text-[20px] leading-8 font-semibold tracking-tight">{item.title}</h3>
      </div>

      <p className="mt-1 text-[14px] text-neutral-500">
        {longDate(item.date)} &middot; {timeRange(item.start_time, item.end_time)}
      </p>

      {item.location && (
        <p className="mt-4 flex items-center gap-1.5 text-[15px]">
          <PinIcon className="w-4 h-4 text-neutral-400" />
          {item.location}
        </p>
      )}

      {item.notes && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-neutral-700">
          {item.notes}
        </p>
      )}

      {tagLabel(tags, item.tag) && (
        <p className="mt-4 text-[13px] text-neutral-400">{tagLabel(tags, item.tag)}</p>
      )}

      {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

      <div className="mt-6 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 py-3 text-[15px] font-medium"
        >
          <PencilIcon />
          Edit
        </button>
        {confirming ? (
          <button
            onClick={remove}
            disabled={deleting}
            className="flex-1 rounded-full bg-red-600 py-3 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {deleting ? 'Deleting...' : 'Tap to confirm'}
          </button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-5 py-3 text-[15px] font-medium text-red-600"
          >
            <TrashIcon />
            Delete
          </button>
        )}
      </div>
    </Sheet>
  )
}
