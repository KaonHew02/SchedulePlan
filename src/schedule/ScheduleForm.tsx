import { useMemo, useState, type FormEvent } from 'react'
import AttachmentStrip from '../components/Attachments'
import CountrySelect from '../components/CountrySelect'
import { DateField, Field, NotesField, TextField, TimeField, Toggle } from '../components/FormFields'
import LinkEditor from '../components/LinkEditor'
import Sheet from '../components/Sheet'
import TagEditor from '../components/TagEditor'
import { daysBetween, nextHalfHour, shortDate } from '../lib/date'
import { tr } from '../lib/i18n'
import { describeRepeat } from '../lib/repeat'
import { typedBefore } from '../lib/places'
import { createTag, isTrip, placesOf, useSchedule, useTags, useWishlist } from '../lib/store'
import { tagName } from '../lib/tags'
import type {
  Attachment,
  Place,
  ScheduleDraft,
  ScheduleItem,
  ScheduleRepeat,
  TagId,
  TripLink,
} from '../types'
import RepeatField from './RepeatField'

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
  /**
   * The links the wish had. They are re-numbered on the way in like any
   * other, so the ids they arrive with are only ever a shape.
   */
  links?: TripLink[]
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
  const [links, setLinks] = useState<TripLink[]>(item?.links ?? prefill?.links ?? [])
  const [country, setCountry] = useState<string | null>(
    item?.place?.country ?? prefill?.place?.country ?? null,
  )
  const [region, setRegion] = useState(item?.place?.region ?? prefill?.place?.region ?? '')
  const [city, setCity] = useState(item?.place?.city ?? prefill?.place?.city ?? '')
  // A region belongs to its country: 海南 is no use on a trip moved to Taiwan.
  // The city is left alone, as it always was — it is often the reason the
  // country was wrong in the first place.
  const pickCountry = (next: string | null) => {
    if (next !== country) setRegion('')
    setCountry(next)
  }
  const [tripId, setTripId] = useState<number | null>(item?.trip_id ?? null)
  const [repeat, setRepeat] = useState<ScheduleRepeat | null>(item?.repeat ?? null)
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
  // The regions and cities typed for this country before, and on the wishlist.
  const wishlist = useWishlist()
  const typed = useMemo(
    () =>
      country
        ? typedBefore([...placesOf(schedule), ...wishlist], country, region.trim())
        : { regions: [], cities: [] },
    [schedule, wishlist, country, region],
  )
  // Location, links, notes and files stay out of the way until they are wanted.
  const [showDetails, setShowDetails] = useState(
    Boolean(
      item?.location ||
        item?.notes ||
        item?.attachments?.length ||
        item?.links?.length ||
        item?.place ||
        prefill?.place ||
        prefill?.attachments?.length ||
        prefill?.links?.length,
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
    // The same for a repeat's last day, which would otherwise end it before it began.
    if (repeat?.until && repeat.until < next) setRepeat({ ...repeat, until: null })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError(tr('Please give this a title.', '请填写标题。'))
    if (!date) return setError(tr('Please pick a date.', '请选择日期。'))
    if (!allDay && !start) return setError(tr('Please pick a start time.', '请选择开始时间。'))
    if (!allDay && end && !spans && end <= start) {
      return setError(tr('End time must be after the start time.', '结束时间必须晚于开始时间。'))
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
        place: country ? { country, region: region.trim() || null, city: city.trim() || null } : null,
        attachments: files,
        links,
        trip_id: tripId,
        repeat,
      })
      // On success the parent closes this sheet.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tr('Could not save. Please try again.', '保存失败，请重试。'),
      )
      setSaving(false)
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={item ? tr('Edit', '编辑') : tr('Add to schedule', '添加日程')}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            disabled={saving}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {saving ? tr('Saving...', '正在保存…') : tr('Save', '保存')}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!item}
          placeholder={tr('What are you doing?', '要做什么？')}
          className="w-full bg-transparent py-1 text-[17px] outline-hidden placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label={tr('All day', '全天')}>
            <Toggle checked={allDay} onChange={setAllDay} label={tr('All day', '全天')} />
          </Field>

          <Field label={tr('Date', '日期')}>
            <DateField value={date} onChange={moveStart} />
          </Field>

          <Field
            label={tr('Ends', '结束日期')}
            hint={spans ? tr(`${nights} days`, `${nights} 天`) : undefined}
          >
            <DateField
              label={tr('End date', '结束日期')}
              value={endDate}
              onChange={setEndDate}
              placeholder={tr('Same day', '当天')}
              clearable
              rangeStart={date}
              min={date}
            />
          </Field>

          {/* A whole-day thing has no clock, so the clock rows go away rather
              than sitting there greyed out asking to be filled in. */}
          {!allDay && (
            <>
              <Field label={tr('Start', '开始')} hint={spans ? shortDate(date) : undefined}>
                <TimeField label={tr('Start', '开始时间')} value={start} onChange={setStart} />
              </Field>
              <Field label={tr('End', '结束')} hint={spans ? shortDate(endDate) : undefined}>
                <TimeField
                  label={tr('End', '结束时间')}
                  value={end}
                  onChange={setEnd}
                  placeholder={tr('Optional', '可不填')}
                  clearable
                  relativeTo={spans ? null : start}
                />
              </Field>
            </>
          )}

          <RepeatField value={repeat} date={date} onChange={setRepeat} />
        </div>

        {/* The rule in words, so a custom one can be checked before it is
            saved rather than by paging through the months afterwards. */}
        {repeat && (
          <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
            {describeRepeat(repeat, date)}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((one) => (
            <button
              key={one.id}
              type="button"
              onClick={() => setTag(tag === one.id ? null : one.id)}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                tag === one.id
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600'
              }`}
            >
              <span className="mr-1">{one.emoji}</span>
              {tagName(one)}
            </button>
          ))}
          {!newTag && (
            <button
              type="button"
              onClick={() => setNewTag(true)}
              className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-400"
            >
              {tr('+ New', '+ 新建')}
            </button>
          )}
        </div>

        {newTag && (
          <div className="mt-2">
            <TagEditor
              submitLabel={tr('Add', '添加')}
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
              <Field label={tr('Location', '地点')}>
                <TextField label={tr('Location', '地点')} value={location} onChange={setLocation} />
              </Field>
              {/* Country is what Travel counts; region and city are labels, and
                  the city is what makes a place. */}
              <Field label={tr('Country', '国家')} hint={tr('For Travel', '用于旅行')}>
                <CountrySelect
                  value={country}
                  onChange={pickCountry}
                  recent={recentCountries}
                  placeholder={tr('Not set', '未设置')}
                  clearable
                />
              </Field>
              {country && (
                <>
                  <Field
                    label={tr('Region', '地区')}
                    hint={tr('地区, like 海南 or Sabah', '如海南、沙巴')}
                  >
                    <TextField label={tr('Region', '地区')} value={region} onChange={setRegion} suggestions={typed.regions} />
                  </Field>
                  <Field label={tr('City', '城市')}>
                    <TextField label={tr('City', '城市')} value={city} onChange={setCity} suggestions={typed.cities} />
                  </Field>
                </>
              )}
              {joinable.length > 0 && (
                <Field
                  label={tr('Part of trip', '所属行程')}
                  hint={tr('Groups it under one trip in Travel', '在旅行里归入同一个行程')}
                >
                  <select
                    value={tripId ?? ''}
                    onChange={(event) =>
                      setTripId(event.target.value ? Number(event.target.value) : null)
                    }
                    aria-label={tr('The trip this is part of', '所属的行程')}
                    className="max-w-[190px] truncate rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] font-medium outline-hidden transition-colors hover:bg-neutral-200/70 focus:ring-2 focus:ring-brand-500/40"
                  >
                    <option value="">{tr('Its own trip', '独立行程')}</option>
                    {joinable.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title} · {shortDate(row.date)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="py-3">
                <NotesField value={notes} onChange={setNotes} />
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
              <p className="pb-2 text-[13px] text-neutral-400">{tr('Attachments', '附件')}</p>
              <AttachmentStrip files={files} onChange={setFiles} onError={setError} />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="mt-4 text-[14px] text-neutral-400"
          >
            {tr('+ Add location, links, notes or files', '+ 添加地点、链接、备注或文件')}
          </button>
        )}
      </form>
    </Sheet>
  )
}
