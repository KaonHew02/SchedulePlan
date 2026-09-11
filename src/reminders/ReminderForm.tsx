import { useState, type FormEvent } from 'react'
import { DateField, Field, Segmented, TimeField } from '../components/FormFields'
import Sheet from '../components/Sheet'
import { daysBetween, nextHalfHour, todayISO } from '../lib/date'
import { createReminder, deleteReminder, updateReminder } from '../lib/store'
import type { Reminder, Repeat } from '../types'

const FORM_ID = 'reminder-form'

const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
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
      onSaved(reminder ? 'Updated' : 'Added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={reminder ? 'Edit reminder' : 'New reminder'}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white"
          >
            Save
          </button>
          {reminder && (
            <button
              type="button"
              onClick={() => {
                deleteReminder(reminder.id)
                onSaved('Deleted')
              }}
              className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              Delete
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
          placeholder="Remind me to..."
          className="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label="From">
            <DateField value={date} onChange={moveStart} />
          </Field>
          <Field label="Time">
            <TimeField label="Time" value={time} onChange={setTime} />
          </Field>
          <Field label="Until" hint={spans ? `${daysBetween(date, until)} days` : undefined}>
            <DateField
              label="Until date"
              value={until}
              onChange={moveUntil}
              placeholder="Same day"
              clearable
              rangeStart={date}
              min={date}
            />
          </Field>
          <Field label="Until time">
            <TimeField
              label="Until time"
              value={untilTime}
              onChange={setUntilTime}
              placeholder="Optional"
              clearable
              relativeTo={spans ? null : time}
            />
          </Field>
        </div>

        {/* Repeating only makes sense once there is a day to stop on, so the
            choice appears with the until date rather than sitting disabled. */}
        {spans && (
          <div className="mt-4">
            <p className="pb-1.5 text-[13px] text-neutral-400">Repeat until then</p>
            <Segmented value={repeat} options={REPEATS} onChange={setRepeat} />
            <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
              {repeat === 'none'
                ? 'One reminder, standing for the whole stretch.'
                : `${repeat === 'daily' ? 'Every day' : 'Every week'} at ${time}, last one on ${until}.`}
            </p>
          </div>
        )}

        {showNotes ? (
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Notes"
            className="mt-3 w-full resize-none border-b border-neutral-100 bg-transparent pb-3 text-[15px] outline-none placeholder:text-neutral-300"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="mt-4 text-[14px] text-neutral-400"
          >
            + Add notes
          </button>
        )}
      </form>
    </Sheet>
  )
}
