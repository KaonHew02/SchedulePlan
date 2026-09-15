import { useMemo, useState, type FormEvent } from 'react'
import AttachmentStrip from '../components/Attachments'
import CountrySelect from '../components/CountrySelect'
import { DateField, Field, TextField, TimeField, Toggle } from '../components/FormFields'
import LinkEditor from '../components/LinkEditor'
import Sheet from '../components/Sheet'
import TagEditor from '../components/TagEditor'
import { daysBetween, nextHalfHour, shortDate } from '../lib/date'
import { createTag, isTrip, useSchedule, useTags } from '../lib/store'
import type { Attachment, Place, ScheduleDraft, ScheduleItem, TagId, TripLink } from '../types'

const FORM_ID = 'schedule-form'

/**
 * A new item that starts part-filled rather than blank. Marking a wishlist
 * place as visited is the one user of it: the country, the name and the
 * picture are already known, and retyping them would be the whole point of
 * the wishlist thrown away. Ignored when editing — an existing item's own
 * values always win.
 */
export interface SchedulePrefill {
  title?: string
  notes?: string | null
  place?: Place | null
  allDay?: boolean
  attachments?: Attachment[]
}

export default function ScheduleForm({
  item,
  defaultDate,
  prefill,
  onClose,
  onSave,
}: {
  /** null when adding something new. */
  item: ScheduleItem | null
  defaultDate: string
  prefill?: SchedulePrefill
  onClose: () => void
  onSave: (draft: ScheduleDraft) => Promise<void>
}) {
  const [title, setTitle] = useState(item?.title ?? prefill?.title ?? '')
  const [date, setDate] = useState(item?.date ?? defaultDate)
  const [endDate, setEndDate] = useState(item?.end_date ?? '')
  const [allDay, setAllDay] = useState(item?.all_day ?? prefill?.allDay ?? false)
  const [start, setStart] = useState(item?.start_time ?? nextHalfHour())
  const [end, setEnd] = useState(item?.end_time ?? '')
  const [tag, setTag] = useState<TagId | null>(item?.tag ?? null)
  const [location, setLocation] = useState(item?.location ?? '')
  const [notes, setNotes] = useState(item?.notes ?? prefill?.notes ?? '')
  const [files, setFiles] = useState<Attachment[]>(item?.attachments ?? prefill?.attachments ?? [])
  const [links, setLinks] = useState<TripLink[]>(item?.links ?? [])
  const [country, setCountry] = useState<string | null>(
    item?.place?.country ?? prefill?.place?.country ?? null,
  )
  const [city, setCity] = useState(item?.place?.city ?? prefill?.place?.city ?? '')
  const [tripId, setTripId] = useState<number | null>(item?.trip_id ?? null)
  const schedule = useSchedule()

  /*
   * The trips this row could be a leg of.
   *
   * One journey to Vietnam is four rows in the diary and was four trips in
   * Travel. Joining them needs somewhere to say so, and this is it: pick the
   * trip and this row stops being a trip of its own and becomes part of that
   * one — still in the diary, still counted as a place you have been, just no
   * longer its own line in the list.
   *
   * A trip that is already a leg is not offered, because legs of legs is a
   * shape nothing else here would know what to do with. Nor is this row
   * itself, for the obvious reason.
   */
  const joinable = useMemo(
    () =>
      schedule
        .filter((row) => row.id !== item?.id && isTrip(row, schedule))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30),
    [schedule, item?.id],
  )
  // Countries already in the notebook go to the top of the picker.
  const recentCountries = useMemo(() => {
    const seen: string[] = []
    for (const row of schedule) {
      if (row.place?.country && !seen.includes(row.place.country)) seen.push(row.place.country)
    }
    return seen.slice(0, 8)
  }, [schedule])
  // Location, links, notes and files stay out of the way until they are wanted.
  const [showDetails, setShowDetails] = useState(
    Boolean(
      item?.location ||
        item?.notes ||
        item?.attachments?.length ||
        item?.links?.length ||
        item?.place ||
        prefill?.place ||
        prefill?.attachments?.length,
    ),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTag, setNewTag] = useState(false)
  const tags = useTags()

  const spans = Boolean(endDate && endDate > date)
  const nights = spans ? daysBetween(date, endDate) : 1

  /** Dragging the start past the end would otherwise leave an invalid range. */
  function moveStart(next: string) {
    setDate(next)
    if (endDate && endDate < next) setEndDate('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('Please give this a title.')
    if (!date) return setError('Please pick a date.')
    if (!allDay && !start) return setError('Please pick a start time.')
    if (!allDay && end && !spans && end <= start) {
      return setError('End time must be after the start time.')
    }

    setError(null)
    setSaving(true)
    try {
      await onSave({
        date,
        end_date: endDate || null,
        all_day: allDay,
        start_time: allDay ? '00:00' : start,
        end_time: allDay ? null : end || null,
        title: title.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        tag,
        place: country ? { country, city: city.trim() || null } : null,
        attachments: files,
        links,
        trip_id: tripId,
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
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
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
          className="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label="All day">
            <Toggle checked={allDay} onChange={setAllDay} label="All day" />
          </Field>

          <Field label="Date">
            <DateField value={date} onChange={moveStart} />
          </Field>

          <Field label="Ends" hint={spans ? `${nights} days` : undefined}>
            <DateField
              label="End date"
              value={endDate}
              onChange={setEndDate}
              placeholder="Same day"
              clearable
              rangeStart={date}
              min={date}
            />
          </Field>

          {/* A whole-day thing has no clock, so the clock rows go away rather
              than sitting there greyed out asking to be filled in. */}
          {!allDay && (
            <>
              <Field label="Start" hint={spans ? shortDate(date) : undefined}>
                <TimeField label="Start" value={start} onChange={setStart} />
              </Field>
              <Field label="End" hint={spans ? shortDate(endDate) : undefined}>
                <TimeField
                  label="End"
                  value={end}
                  onChange={setEnd}
                  placeholder="Optional"
                  clearable
                  relativeTo={spans ? null : start}
                />
              </Field>
            </>
          )}
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
          <>
            <div className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
              <Field label="Location">
                <TextField label="Location" value={location} onChange={setLocation} />
              </Field>
              {/* Country is what Travel counts; city is only ever a label. */}
              <Field label="Country" hint="For Travel">
                <CountrySelect
                  value={country}
                  onChange={setCountry}
                  recent={recentCountries}
                  placeholder="Not set"
                  clearable
                />
              </Field>
              {country && (
                <Field label="City">
                  <TextField label="City" value={city} onChange={setCity} />
                </Field>
              )}
              {joinable.length > 0 && (
                <Field label="Part of trip" hint="Groups it under one trip in Travel">
                  <select
                    value={tripId ?? ''}
                    onChange={(event) =>
                      setTripId(event.target.value ? Number(event.target.value) : null)
                    }
                    aria-label="The trip this is part of"
                    className="max-w-[190px] truncate rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] font-medium outline-none transition-colors hover:bg-neutral-200/70 focus:ring-2 focus:ring-brand-500/40"
                  >
                    <option value="">Its own trip</option>
                    {joinable.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title} · {shortDate(row.date)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="py-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes"
                  className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-neutral-300"
                />
              </div>
            </div>

            {/*
              Links before files, because one is usually why the other is not
              there: the vlog and the booking page are the parts of a day that
              live on somebody else's server, and pasting the address is the
              whole of keeping them.
            */}
            <div className="mt-4">
              <LinkEditor links={links} onChange={setLinks} />
            </div>

            <div className="mt-4">
              <p className="pb-2 text-[13px] text-neutral-400">Attachments</p>
              <AttachmentStrip files={files} onChange={setFiles} onError={setError} />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="mt-4 text-[14px] text-neutral-400"
          >
            + Add location, links, notes or files
          </button>
        )}
      </form>
    </Sheet>
  )
}
