import { useEffect, useMemo, useRef, useState } from 'react'
import AttachmentStrip from '../components/Attachments'
import CountryBadge from '../components/CountryBadge'
import {
  ChevronDown,
  ChevronLeft,
  LinkIcon,
  PencilIcon,
  Plus,
  TrashIcon,
} from '../components/Icons'
import { money } from '../lib/currency'
import { daysBetween, rangeLabel } from '../lib/date'
import { MONEY } from '../lib/features'
import { hostLabel, safeUrl } from '../lib/links'
import { placeLabel } from '../lib/places'
import {
  deleteTripLink,
  lastDay,
  legsOf,
  saveTripFiles,
  saveTripLink,
  saveTripPlan,
  spanOf,
  useExpenses,
  useSchedule,
  useSettings,
} from '../lib/store'
import type { ScheduleItem, TripLink } from '../types'

/**
 * One trip, all of it, on one page.
 *
 * A trip was only ever a row in a list that took you nowhere — which was fine
 * while a trip was a date and a country, and stopped being fine the moment
 * there was a plan to write and a vlog to keep. Everything about a trip
 * already existed in the notebook and was scattered: the dates in Schedule,
 * the money in Expenses, the photos on the item. This gathers them and adds
 * the two things that had nowhere to live.
 *
 * It writes straight to the notebook rather than collecting edits behind a
 * Save. There is nothing here to get half-right — a plan is prose and a link
 * is a link — and a trip is the kind of thing that gets added to in pieces, on
 * a bus, which is a bad moment to lose a paragraph to a forgotten button.
 */

/**
 * Adding a link and changing one are the same two boxes. Given a link, it
 * starts filled in and saves over that link rather than beside it.
 */
function LinkForm({
  tripId,
  link,
  onDone,
  onToast,
}: {
  tripId: number
  link?: TripLink
  onDone: () => void
  onToast: (message: string) => void
}) {
  const [url, setUrl] = useState(link?.url ?? '')
  const [label, setLabel] = useState(link?.label ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!safeUrl(url)) {
      setError('That does not look like a link. Paste the whole address.')
      return
    }
    try {
      await saveTripLink(tripId, { id: link?.id, label, url })
      onDone()
      onToast(link ? 'Link updated' : 'Link saved')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'That link would not save.')
    }
  }

  return (
    <div className="rounded-2xl bg-neutral-50 p-3">
      <input
        autoFocus
        value={url}
        onChange={(event) => {
          setUrl(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => event.key === 'Enter' && void save()}
        placeholder="Paste the link"
        inputMode="url"
        aria-label="Link address"
        className="w-full rounded-lg bg-white px-3 py-2 text-[14px] outline-hidden ring-1 ring-neutral-200 placeholder:text-neutral-300"
      />
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && void save()}
        placeholder="What is it? (optional)"
        aria-label="What the link is"
        className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-[14px] outline-hidden ring-1 ring-neutral-200 placeholder:text-neutral-300"
      />
      {error && <p className="pt-2 text-[12px] leading-5 text-amber-700">{error}</p>}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => void save()}
          disabled={!url.trim()}
          className="rounded-full bg-brand-500 px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={onDone} className="px-2 py-1.5 text-[13px] text-neutral-400">
          Cancel
        </button>
      </div>
    </div>
  )
}

function LinkRow({
  tripId,
  link,
  onToast,
}: {
  tripId: number
  link: TripLink
  onToast: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="border-b border-neutral-100 py-3">
        <LinkForm
          tripId={tripId}
          link={link}
          onDone={() => setEditing(false)}
          onToast={onToast}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 py-3">
      <LinkIcon className="h-[17px] w-[17px] shrink-0 text-neutral-400" />
      <a
        href={link.url}
        target="_blank"
        // noreferrer for the privacy, noopener because a tab opened this way
        // can otherwise reach back through window.opener.
        rel="noreferrer noopener"
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-[15px] leading-6 text-brand-600">
          {link.label || hostLabel(link.url)}
        </span>
        {link.label && (
          <span className="block truncate text-[12px] leading-4 text-neutral-400">
            {hostLabel(link.url)}
          </span>
        )}
      </a>
      <button
        onClick={() => setEditing(true)}
        aria-label={`Edit ${link.label || hostLabel(link.url)}`}
        className="shrink-0 p-1.5 text-neutral-300"
      >
        <PencilIcon className="h-[15px] w-[15px]" />
      </button>
      <button
        onClick={() => void deleteTripLink(tripId, link.id).then(() => onToast('Link removed'))}
        aria-label={`Remove ${link.label || hostLabel(link.url)}`}
        className="shrink-0 p-1.5 text-neutral-300"
      >
        <TrashIcon className="h-[15px] w-[15px]" />
      </button>
    </div>
  )
}

/** The first line with something on it — what a folded stop shows of its plan. */
const firstLine = (text: string | null): string =>
  text
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? ''

/**
 * A plan, typed into local state and written a moment after typing stops.
 *
 * Not on every keystroke, which would put a notebook write behind every
 * letter of an itinerary. Not on blur either, which was the first attempt and
 * is a worse idea than it sounds: a plan typed on a bus and then locked in a
 * pocket never blurs, and the way you would find out is by opening the trip a
 * week later to an empty page.
 *
 * The state is loaded once, when the field appears, and never resynced from
 * above — which is what stops a save landing back on top of the sentence
 * being typed after it. Callers key it by the item it writes to.
 */
function PlanField({
  item,
  rows,
  autoFocus = false,
  placeholder,
  label,
}: {
  item: ScheduleItem
  rows: number
  autoFocus?: boolean
  placeholder: string
  label: string
}) {
  const [plan, setPlan] = useState(item.plan ?? '')
  const saved = item.plan ?? ''

  /*
   * What has been typed and not yet written. A stop folds shut the moment
   * another one is tapped, which can be well inside the 700ms of a paste — and
   * folding it takes the timer with it. This is what the field writes on its
   * way out, so the paste goes with it rather than with the timer.
   */
  const unsaved = useRef<string | null>(null)

  useEffect(() => {
    if (plan.trim() === saved) {
      unsaved.current = null
      return
    }
    unsaved.current = plan
    const timer = setTimeout(() => {
      unsaved.current = null
      void saveTripPlan(item.id, plan)
    }, 700)
    return () => clearTimeout(timer)
  }, [plan, saved, item.id])

  useEffect(
    () => () => {
      if (unsaved.current !== null) void saveTripPlan(item.id, unsaved.current)
    },
    [item.id],
  )

  return (
    <textarea
      value={plan}
      onChange={(event) => setPlan(event.target.value)}
      onBlur={() => {
        // Belt and braces: leaving the field saves at once rather than
        // waiting out the timer.
        if (unsaved.current === null) return
        const text = unsaved.current
        unsaved.current = null
        void saveTripPlan(item.id, text)
      }}
      autoFocus={autoFocus}
      rows={rows}
      placeholder={placeholder}
      aria-label={label}
      className="w-full resize-y rounded-2xl border border-neutral-200 p-4 text-[15px] leading-7 outline-hidden transition-colors focus:border-brand-300 placeholder:text-neutral-300"
    />
  )
}

export default function TripScreen({
  trip,
  onBack,
  onToast,
}: {
  trip: ScheduleItem & { place: NonNullable<ScheduleItem['place']> }
  onBack: () => void
  onToast: (message: string) => void
}) {
  const settings = useSettings()
  const expenses = useExpenses()
  const schedule = useSchedule()

  const legs = useMemo(() => legsOf(schedule, trip.id), [schedule, trip.id])
  const span = useMemo(() => spanOf(trip, legs), [trip, legs])

  /*
   * The stop whose plan is open. One at a time: the way this gets used is a
   * day's plan pasted in, then the next day tapped, and a page of open boxes
   * would bury the list being worked down.
   */
  const [openStop, setOpenStop] = useState<number | null>(null)

  const [adding, setAdding] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  /*
   * The trip's money, its legs' included.
   *
   * A dinner in Hoi An is attached to the Hoi An row, and Hoi An is three days
   * of this journey — so a total that counted only receipts pinned to the
   * first row would quietly under-report the trip by however much of it
   * happened on the other rows.
   */
  const spent = useMemo(() => {
    const ids = new Set([trip.id, ...legs.map((leg) => leg.id)])
    return expenses
      .filter((expense) => expense.schedule_id !== null && ids.has(expense.schedule_id))
      .reduce((sum, expense) => sum + expense.amount, 0)
  }, [expenses, trip.id, legs])

  const days = daysBetween(span.start, span.end)

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-1 px-5 pb-3 pt-4 lg:px-8">
          <button onClick={onBack} aria-label="Back to Travel" className="-ml-2 p-2 text-neutral-400">
            <ChevronLeft />
          </button>
          <h1 className="min-w-0 truncate text-[19px] font-semibold tracking-tight lg:text-[22px]">
            {trip.title}
          </h1>
        </div>
      </header>

      <main className="px-5 pb-28 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:px-8 lg:pb-10">
        <div>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
            <CountryBadge code={trip.place.country} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">
                {placeLabel(trip.place)}
              </span>
              <span className="block truncate text-[13px] text-neutral-400">
                {rangeLabel(span.start, span.end)}
                {days > 1 && ` · ${days} days`}
              </span>
            </span>
            {MONEY && spent > 0 && (
              <span className="shrink-0 text-right">
                <span className="block text-[15px] font-medium tabular-nums">
                  {money(spent, settings.currency)}
                </span>
                <span className="block text-[12px] text-neutral-400">spent</span>
              </span>
            )}
          </div>

          {/*
            The legs, when there are any. This is the reason they exist: one
            journey to Vietnam is Danang, then Hoi An, then Danang again, and
            Travel listed three trips where there was one. They are joined on
            the schedule form — 'Part of trip' — and this is where the joining
            shows up as something other than a row that went missing.

            Each stop carries its own plan, opened by tapping the stop: the
            boarding day's plan belongs under the boarding day, not in one
            long box below all of them. The first row is the trip itself, so
            its plan is the trip's — the one that was the whole page's before
            there were stops.
          */}
          {legs.length > 0 ? (
            <>
              <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">
                Stops · {legs.length + 1}
              </h2>
              <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                {[trip, ...legs].map((stop) => {
                  const open = openStop === stop.id
                  const preview = firstLine(stop.plan)
                  return (
                    <div key={stop.id}>
                      <button
                        onClick={() => setOpenStop(open ? null : stop.id)}
                        aria-expanded={open}
                        className="flex w-full items-baseline gap-3 py-2.5 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px]">{stop.title}</span>
                          {stop.place && (
                            <span className="block truncate text-[12px] text-neutral-400">
                              {placeLabel(stop.place)}
                            </span>
                          )}
                          {!open && preview && (
                            <span className="block truncate text-[12px] text-neutral-500">
                              {preview}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                          {rangeLabel(stop.date, lastDay(stop))}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 self-center text-neutral-300 transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {open && (
                        <div className="pb-3">
                          <PlanField
                            key={stop.id}
                            item={stop}
                            rows={6}
                            // Straight to the cursor when there is nothing
                            // to read yet, so a paste is one long-press away;
                            // not when there is, or the keyboard would cover
                            // the plan just opened to be read.
                            autoFocus={!stop.plan}
                            placeholder="Write or paste the plan for this stop"
                            label={`The plan for ${stop.title}`}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
                Tap a stop to write or paste its plan. Saved as you go.
              </p>
            </>
          ) : (
            <>
              <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">Plan</h2>
              <PlanField
                key={trip.id}
                item={trip}
                rows={8}
                placeholder={'Day 1 — land, check in, bridge at night\nDay 2 — Hoi An, back for dinner\nBook the Ba Na Hills ticket before Friday'}
                label="The plan for this trip"
              />
              <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
                Saved as you go. This is the trip's own page — it does not show up in the diary
                alongside the time.
              </p>
            </>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between pb-1 pt-8 lg:pt-0">
            <h2 className="text-[13px] font-medium text-neutral-400">Vlog &amp; links</h2>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 text-[13px] font-medium text-brand-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            )}
          </div>

          {adding && (
            <LinkForm tripId={trip.id} onDone={() => setAdding(false)} onToast={onToast} />
          )}

          {trip.links.length === 0 && !adding ? (
            <p className="rounded-2xl bg-neutral-50 px-4 py-5 text-center text-[13px] leading-5 text-neutral-400">
              The vlog, the hotel booking, a map — anything about this trip that lives somewhere
              else.
            </p>
          ) : (
            <div className={trip.links.length ? 'border-t border-neutral-100' : ''}>
              {trip.links.map((link) => (
                <LinkRow key={link.id} tripId={trip.id} link={link} onToast={onToast} />
              ))}
            </div>
          )}

          {/*
            The item's own attachments rather than a second gallery: a photo
            added to the trip in Schedule is a photo of the trip, and two
            places to put one would mean explaining which. Shown whether or not
            there are any, because this page was read-only about files at first
            — the section simply was not there until something had been
            attached somewhere else, which is a strange way to be offered a
            boarding pass slot.
          */}
          <h2 className="pb-2 pt-8 text-[13px] font-medium text-neutral-400">Photos &amp; files</h2>
          <AttachmentStrip
            files={trip.attachments}
            onChange={(files) => {
              setFileError(null)
              void saveTripFiles(trip.id, files).catch((error: unknown) =>
                setFileError(error instanceof Error ? error.message : 'That would not save.'),
              )
            }}
            onError={setFileError}
          />
          {fileError && (
            <p className="pt-2 text-[12px] leading-5 text-amber-700">{fileError}</p>
          )}

          {trip.notes && (
            <>
              <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">Notes</h2>
              <p className="whitespace-pre-wrap text-[14px] leading-6 text-neutral-600">
                {trip.notes}
              </p>
            </>
          )}
        </div>
      </main>
    </>
  )
}
