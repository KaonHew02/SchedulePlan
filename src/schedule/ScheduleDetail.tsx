import { useRef, useState } from 'react'
import { FileViewer, Thumb } from '../components/Attachments'
import {
  LinkIcon,
  PencilIcon,
  PinIcon,
  Plus,
  RepeatIcon,
  TrashIcon,
  WalletIcon,
} from '../components/Icons'
import Popover from '../components/Popover'
import Sheet from '../components/Sheet'
import { daysBetween, longDate, relativeDay, shortDate, timeRange } from '../lib/date'
import { describeRepeat } from '../lib/repeat'
import { money } from '../lib/currency'
import { MONEY } from '../lib/features'
import { hostLabel } from '../lib/links'
import { reflow } from '../lib/notes'
import { lastDay, spansDays, useExpenses, useSettings, useTags } from '../lib/store'
import { tagEmoji, tagLabel } from '../lib/tags'
import type { Attachment, ScheduleItem } from '../types'


export default function ScheduleDetail({
  item,
  onClose,
  onEdit,
  onDelete,
  onSkip,
  onAddExpense,
}: {
  /** For a repeat, the copy for the day it was opened on — see `inRange`. */
  item: ScheduleItem
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  /** Takes just this day out of a repeat. Only given for one that repeats. */
  onSkip?: () => Promise<void>
  onAddExpense: () => void
}) {
  const tags = useTags()
  const settings = useSettings()
  const expenses = useExpenses().filter((expense) => expense.schedule_id === item.id)
  const [deleting, setDeleting] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)

  const spans = spansDays(item)
  const spent = expenses.reduce((total, expense) => total + expense.amount, 0)

  async function remove(action: () => Promise<void>) {
    setChoosing(false)
    setDeleting(true)
    setError(null)
    try {
      await action()
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
        {/* Read from the series' first day, not this copy's: "on the 31st"
            is still true of the one that fell on 30 April. */}
        {item.repeat && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-neutral-400">
            <RepeatIcon className="h-3.5 w-3.5" />
            {describeRepeat(item.repeat, item.series ?? item.date)}
          </p>
        )}

        {item.location && (
          <p className="mt-4 flex items-center gap-1.5 text-[15px]">
            <PinIcon className="h-4 w-4 text-neutral-400" />
            {item.location}
          </p>
        )}

        {/* Same text, same shape as the card it was opened from. */}
        {item.notes && (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-neutral-700">
            {reflow(item.notes)}
          </p>
        )}

        {item.links.length > 0 && (
          <div className="mt-4 border-t border-neutral-100">
            {item.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                // noreferrer for the privacy, noopener because a tab opened
                // this way can otherwise reach back through window.opener.
                rel="noreferrer noopener"
                className="flex items-center gap-3 border-b border-neutral-100 py-2.5"
              >
                <LinkIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] leading-6 text-brand-600">
                    {link.label || hostLabel(link.url)}
                  </span>
                  {link.label && (
                    <span className="block truncate text-[12px] leading-4 text-neutral-400">
                      {hostLabel(link.url)}
                    </span>
                  )}
                </span>
              </a>
            ))}
          </div>
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

        {MONEY && (
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
        )}

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
              rare accidental one. A repeat is the exception, and not for
              the sake of asking: "this Friday" and "every Friday" are two
              different deletions, and only you know which one you meant. */}
          <button
            ref={deleteButton}
            onClick={() => (onSkip ? setChoosing((was) => !was) : remove(onDelete))}
            disabled={deleting}
            aria-expanded={onSkip ? choosing : undefined}
            className="flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-5 py-3 text-[15px] font-medium text-red-600 disabled:opacity-40"
          >
            <TrashIcon />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Sheet>

      {choosing && onSkip && (
        <Popover anchor={deleteButton} label="Delete which" onClose={() => setChoosing(false)}>
          <div className="w-[220px] p-1.5">
            <button
              type="button"
              onClick={() => remove(onSkip)}
              className="w-full rounded-xl px-3 py-2 text-left text-[14px] transition-colors hover:bg-neutral-100"
            >
              Only {shortDate(item.date)}
            </button>
            <button
              type="button"
              onClick={() => remove(onDelete)}
              className="w-full rounded-xl px-3 py-2 text-left text-[14px] text-red-600 transition-colors hover:bg-neutral-100"
            >
              Every time it repeats
            </button>
          </div>
        </Popover>
      )}

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
