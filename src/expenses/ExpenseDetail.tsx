import { useState } from 'react'
import { FileViewer, Thumb } from '../components/Attachments'
import { CalendarIcon, PencilIcon, TrashIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { longDate } from '../lib/date'
import { money } from '../lib/currency'
import { tr } from '../lib/i18n'
import { useCategories, useSchedule, useSettings } from '../lib/store'
import { tagEmoji, tagLabel } from '../lib/tags'
import type { Attachment, Expense } from '../types'
import { conversionNote } from './ExpenseForm'


export default function ExpenseDetail({
  expense,
  onClose,
  onEdit,
  onDelete,
}: {
  expense: Expense
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const categories = useCategories()
  const schedule = useSchedule()
  const settings = useSettings()
  const linked = schedule.find((item) => item.id === expense.schedule_id)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const note = conversionNote(expense, settings.quoteUnits)

  async function remove() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not delete. Please try again.', '删除失败，请再试一次。'))
      setDeleting(false)
    }
  }

  return (
    <>
      <Sheet onClose={onClose} title={tr('Expense', '支出')}>
        <p className="text-[28px] font-semibold tabular-nums tracking-tight">
          {money(expense.amount, expense.currency)}
        </p>
        {note && <p className="mt-0.5 text-[13px] text-neutral-500">{note}</p>}

        <div className="mt-2 flex items-start gap-2.5">
          <span className="text-[18px] leading-7">{tagEmoji(categories, expense.category)}</span>
          <h3 className="text-[18px] font-medium leading-7">{expense.title}</h3>
        </div>

        <p className="mt-1 text-[14px] text-neutral-500">
          {longDate(expense.date)}
          {tagLabel(categories, expense.category) &&
            ` · ${tagLabel(categories, expense.category)}`}
        </p>

        {linked && (
          <p className="mt-3 flex items-center gap-1.5 text-[14px] text-neutral-600">
            <CalendarIcon className="h-4 w-4 text-neutral-400" />
            {tr(`Part of ${linked.title}`, `关联「${linked.title}」`)}
          </p>
        )}

        {expense.notes && (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-neutral-700">
            {expense.notes}
          </p>
        )}

        {expense.attachments.length > 0 && (
          <div className="mt-4">
            <p className="pb-2 text-[13px] text-neutral-400">
              {tr(
                `${expense.attachments.length} attachment${expense.attachments.length === 1 ? '' : 's'}`,
                `${expense.attachments.length} 个附件`,
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {expense.attachments.map((file) => (
                <Thumb key={file.id} file={file} onOpen={() => setViewing(file)} />
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-neutral-200 py-3 text-[15px] font-medium"
          >
            <PencilIcon />
            {tr('Edit', '编辑')}
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
            {deleting ? tr('Deleting...', '正在删除…') : tr('Delete', '删除')}
          </button>
        </div>
      </Sheet>

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
