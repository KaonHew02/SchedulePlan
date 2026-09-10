import { useState, type FormEvent } from 'react'
import { DateField, Field, TimeField } from '../components/FormFields'
import Sheet from '../components/Sheet'
import { nextHalfHour, todayISO } from '../lib/date'
import { createReminder, deleteReminder, updateReminder } from '../lib/store'
import type { Reminder } from '../types'

const FORM_ID = 'reminder-form'

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
  const [notes, setNotes] = useState(reminder?.notes ?? '')
  const [showNotes, setShowNotes] = useState(Boolean(reminder?.notes))
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const draft = { title, date, time, notes: notes || null }
      if (reminder) updateReminder(reminder.id, draft)
      else createReminder(draft)
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
            className="w-full rounded-full bg-neutral-900 py-3 text-[15px] font-medium text-white"
          >
            Save
          </button>
          {reminder &&
            (confirming ? (
              <button
                type="button"
                onClick={() => {
                  deleteReminder(reminder.id)
                  onSaved('Deleted')
                }}
                className="mt-2 w-full rounded-full bg-red-600 py-3 text-[15px] font-medium text-white"
              >
                Tap to confirm
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
              >
                Delete
              </button>
            ))}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!reminder}
          placeholder="Remind me to..."
          className="w-full text-[17px] py-1 bg-transparent outline-none placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label="Date">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Time">
            <TimeField label="Time" value={time} onChange={setTime} />
          </Field>
        </div>

        {showNotes ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes"
            className="mt-3 w-full border-b border-neutral-100 pb-3 text-[15px] bg-transparent outline-none resize-none placeholder:text-neutral-300"
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
