import { useState, type FormEvent } from 'react'
import { DateField, Field, TimeField } from '../components/FormFields'
import Sheet from '../components/Sheet'
import TagEditor from '../components/TagEditor'
import { nextHalfHour } from '../lib/date'
import { createTag, useTags } from '../lib/store'
import type { ScheduleDraft, ScheduleItem, TagId } from '../types'

const FORM_ID = 'schedule-form'

export default function ScheduleForm({
  item,
  defaultDate,
  onClose,
  onSave,
}: {
  /** null when adding something new. */
  item: ScheduleItem | null
  defaultDate: string
  onClose: () => void
  onSave: (draft: ScheduleDraft) => Promise<void>
}) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [date, setDate] = useState(item?.date ?? defaultDate)
  const [start, setStart] = useState(item?.start_time ?? nextHalfHour())
  const [end, setEnd] = useState(item?.end_time ?? '')
  const [tag, setTag] = useState<TagId | null>(item?.tag ?? null)
  const [location, setLocation] = useState(item?.location ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  // Location and notes stay out of the way until they are wanted.
  const [showDetails, setShowDetails] = useState(Boolean(item?.location || item?.notes))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTag, setNewTag] = useState(false)
  const tags = useTags()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('Please give this a title.')
    if (!date) return setError('Please pick a date.')
    if (!start) return setError('Please pick a start time.')
    if (end && end <= start) return setError('End time must be after the start time.')

    setError(null)
    setSaving(true)
    try {
      await onSave({
        date,
        start_time: start,
        end_time: end || null,
        title: title.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        tag,
      })
      // On success the parent closes this sheet.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={item ? 'Edit' : 'Add to schedule'}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            disabled={saving}
            className="w-full rounded-full bg-neutral-900 py-3 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!item}
          placeholder="What are you doing?"
          className="w-full text-[17px] py-1 bg-transparent outline-none placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label="Date">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Start">
            <TimeField label="Start" value={start} onChange={setStart} />
          </Field>
          <Field label="End">
            <TimeField
              label="End"
              value={end}
              onChange={setEnd}
              placeholder="Optional"
              clearable
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map(({ id, label, emoji }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTag(tag === id ? null : id)}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                tag === id
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600'
              }`}
            >
              <span className="mr-1">{emoji}</span>
              {label}
            </button>
          ))}
          {!newTag && (
            <button
              type="button"
              onClick={() => setNewTag(true)}
              className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-400"
            >
              + New
            </button>
          )}
        </div>

        {newTag && (
          <div className="mt-2">
            <TagEditor
              submitLabel="Add"
              onCancel={() => setNewTag(false)}
              onSubmit={(label, emoji) => {
                const created = createTag(label, emoji)
                setTag(created.id)
                setNewTag(false)
              }}
            />
          </div>
        )}

        {showDetails ? (
          <div className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
            <Field label="Location">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional"
                className="text-[15px] text-right bg-transparent outline-none placeholder:text-neutral-300"
              />
            </Field>
            <div className="py-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes"
                className="w-full text-[15px] bg-transparent outline-none resize-none placeholder:text-neutral-300"
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="mt-4 text-[14px] text-neutral-400"
          >
            + Add location or notes
          </button>
        )}

      </form>
    </Sheet>
  )
}
