import { useState } from 'react'
import { FileViewer, useFileUrl } from '../components/Attachments'
import { FileIcon, PencilIcon, PinIcon, Plus, TrashIcon, WalletIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { daysBetween, longDate, relativeDay, timeRange } from '../lib/date'
import { isImage } from '../lib/files'
import { money } from '../lib/currency'
import { lastDay, spansDays, useExpenses, useSettings, useTags } from '../lib/store'
import { tagEmoji, tagLabel } from '../lib/tags'
import type { Attachment, ScheduleItem } from '../types'

function Thumb({ file, onOpen }: { file: Attachment; onOpen: () => void }) {
  const url = useFileUrl(isImage(file.type) ? file.id : null)

  return (
    <button
      type="button"
      onClick={onOpen}
      title={file.name}
      className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
    >
      {url ? (
        <img src={url} alt={file.name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-neutral-400">
          <FileIcon className="h-5 w-5" />
        </span>
      )}
    </button>
  )
}

export default function ScheduleDetail({
  item,
  onClose,
  onEdit,
  onDelete,
  onAddExpense,
}: {
  item: ScheduleItem
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onAddExpense: () => void
}) {
  const tags = useTags()
  const settings = useSettings()
  const expenses = useExpenses().filter((expense) => expense.schedule_id === item.id)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Attachment | null>(null)

  const spans = spansDays(item)
  const spent = expenses.reduce((total, expense) => total + expense.amount, 0)

  async function remove() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
      // On success the parent closes this sheet.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete. Please try again.')
      setDeleting(false)
    }
  }

  const when = spans
    ? `${longDate(item.date)} – ${longDate(lastDay(item))}`
    : longDate(item.date)
  const clock = item.all_day
    ? 'All day'
    : spans
      ? `from ${item.start_time}${item.end_time ? ` until ${item.end_time}` : ''}`
      : timeRange(item.start_time, item.end_time)

  return (
    <>
      <Sheet onClose={onClose} title={spans ? 'Schedule' : relativeDay(item.date)}>
        <div className="flex items-start gap-2.5">
          <span className="text-[20px] leading-8">{tagEmoji(tags, item.tag)}</span>
          <h3 className="text-[20px] font-semibold leading-8 tracking-tight">{item.title}</h3>
        </div>

        <p className="mt-1 text-[14px] text-neutral-500">
          {when} &middot; {clock}
        </p>
        {spans && (
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {daysBetween(item.date, lastDay(item))} days
          </p>
        )}

        {item.location && (
          <p className="mt-4 flex items-center gap-1.5 text-[15px]">
            <PinIcon className="h-4 w-4 text-neutral-400" />
            {item.location}
          </p>
        )}

        {item.notes && (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-neutral-700">
            {item.notes}
          </p>
        )}

        {item.attachments.length > 0 && (
          <div className="mt-4">
            <p className="pb-2 text-[13px] text-neutral-400">
              {item.attachments.length} attachment{item.attachments.length === 1 ? '' : 's'}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.attachments.map((file) => (
                <Thumb key={file.id} file={file} onOpen={() => setViewing(file)} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <WalletIcon className="h-4 w-4 text-neutral-400" />
            <span className="text-[14px]">
              {expenses.length === 0 ? (
                <span className="text-neutral-400">Nothing spent on this yet</span>
              ) : (
                <>
                  <span className="font-medium tabular-nums">
                    {money(spent, settings.currency)}
                  </span>
                  <span className="text-neutral-400">
                    {' '}
                    across {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onAddExpense}
              className="ml-auto flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>

        {tagLabel(tags, item.tag) && (
          <p className="mt-4 text-[13px] text-neutral-400">{tagLabel(tags, item.tag)}</p>
        )}

        {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-neutral-200 py-3 text-[15px] font-medium"
          >
            <PencilIcon />
            Edit
          </button>
          {/* One tap. Delete means delete — a second tap that only says
              "are you sure" is a step on every real deletion to catch the
              rare accidental one. */}
          <button
            onClick={remove}
            disabled={deleting}
            className="flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-5 py-3 text-[15px] font-medium text-red-600 disabled:opacity-40"
          >
            <TrashIcon />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Sheet>

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
