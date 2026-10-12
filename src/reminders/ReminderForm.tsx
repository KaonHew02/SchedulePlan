import { useState, type FormEvent } from 'react'
import { DateField, Field, NotesField, Segmented, TimeField } from '../components/FormFields'
import Sheet from '../components/Sheet'
import { daysBetween, nextHalfHour, shortDate, todayISO } from '../lib/date'
import { tr } from '../lib/i18n'
import { createReminder, deleteReminder, updateReminder } from '../lib/store'
import type { Reminder, Repeat } from '../types'

const FORM_ID = 'reminder-form'

/** A function, so the labels are in whichever language the app is in when the form is drawn. */
const repeats = (): { value: Repeat; label: string }[] => [
  { value: 'none', label: tr('Once', '一次') },
  { value: 'daily', label: tr('Daily', '每天') },
  { value: 'weekly', label: tr('Weekly', '每周') },
]

export default function ReminderForm({
  reminder,
  onClose,
  onSaved,
}: {
  /** null when adding a new one. */
  reminder: Reminder | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [date, setDate] = useState(reminder?.date ?? todayISO())
  const [time, setTime] = useState(reminder?.time ?? nextHalfHour())
  const [until, setUntil] = useState(reminder?.end_date ?? '')
  const [untilTime, setUntilTime] = useState(reminder?.end_time ?? '')
  const [repeat, setRepeat] = useState<Repeat>(reminder?.repeat ?? 'none')
  const [notes, setNotes] = useState(reminder?.notes ?? '')
  const [showNotes, setShowNotes] = useState(Boolean(reminder?.notes))
  const [error, setError] = useState<string | null>(null)

  const spans = Boolean(until && until > date)

  /** Moving the start past the until would otherwise leave an invalid window. */
  function moveStart(next: string) {
    setDate(next)
    if (until && until < next) {
      setUntil('')
      setRepeat('none')
    }
  }

  function moveUntil(next: string) {
    setUntil(next)
    // Repeating needs somewhere to stop; clearing the until has to clear it.
    if (!next) setRepeat('none')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const saved = { title, date, time, end_date: until || null, end_time: untilTime || null, repeat, notes: notes || null }
      if (reminder) updateReminder(reminder.id, saved)
      else createReminder(saved)
      onSaved(reminder ? tr('Updated', '已更新') : tr('Added', '已添加'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not save. Please try again.', '保存失败，请再试一次。'))
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={reminder ? tr('Edit reminder', '编辑提醒') : tr('New reminder', '新建提醒')}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white"
          >
            {tr('Save', '保存')}
          </button>
          {reminder && (
            <button
              type="button"
              onClick={() => {
                deleteReminder(reminder.id)
                onSaved(tr('Deleted', '已删除'))
              }}
              className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              {tr('Delete', '删除')}
            </button>
          )}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus={!reminder}
          placeholder={tr('Remind me to...', '提醒我…')}
          className="w-full bg-transparent py-1 text-[17px] outline-hidden placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label={tr('From', '开始')}>
            <DateField value={date} onChange={moveStart} />
          </Field>
          <Field label={tr('Time', '时间')}>
            <TimeField label={tr('Time', '时间')} value={time} onChange={setTime} />
          </Field>
          <Field
            label={tr('Until', '结束')}
            hint={spans ? tr(`${daysBetween(date, until)} days`, `${daysBetween(date, until)} 天`) : undefined}
          >
            <DateField
              label={tr('Until date', '结束日期')}
              value={until}
              onChange={moveUntil}
              placeholder={tr('Same day', '当天')}
              clearable
              rangeStart={date}
              min={date}
            />
          </Field>
          <Field label={tr('Until time', '结束时间')}>
            <TimeField
              label={tr('Until time', '结束时间')}
              value={untilTime}
              onChange={setUntilTime}
              placeholder={tr('Optional', '选填')}
              clearable
              relativeTo={spans ? null : time}
            />
          </Field>
        </div>

        {/* Repeating only makes sense once there is a day to stop on, so the
            choice appears with the until date rather than sitting disabled. */}
        {spans && (
          <div className="mt-4">
            <p className="pb-1.5 text-[13px] text-neutral-400">{tr('Repeat until then', '重复到结束那天')}</p>
            <Segmented value={repeat} options={repeats()} onChange={setRepeat} />
            <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
              {repeat === 'none'
                ? tr('One reminder, standing for the whole stretch.', '只有一条提醒，整段时间都有效。')
                : tr(
                    `${repeat === 'daily' ? 'Every day' : 'Every week'} at ${time}, last one on ${until}.`,
                    `${repeat === 'daily' ? '每天' : '每周'} ${time} 提醒，最后一次在 ${shortDate(until)}。`,
                  )}
            </p>
          </div>
        )}

        {showNotes ? (
          <NotesField
            value={notes}
            onChange={setNotes}
            className="mt-3 border-b border-neutral-100 pb-3"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="mt-4 text-[14px] text-neutral-400"
          >
            {tr('+ Add notes', '+ 添加备注')}
          </button>
        )}
      </form>
    </Sheet>
  )
}
