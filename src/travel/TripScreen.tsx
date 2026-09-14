import { useEffect, useMemo, useState } from 'react'
import AttachmentStrip from '../components/Attachments'
import CountryBadge from '../components/CountryBadge'
import { ChevronLeft, LinkIcon, Plus, TrashIcon } from '../components/Icons'
import { money } from '../lib/currency'
import { daysBetween, rangeLabel } from '../lib/date'
import { hostLabel, safeUrl } from '../lib/links'
import { placeLabel } from '../lib/places'
import {
  deleteTripLink,
  lastDay,
  saveTripFiles,
  saveTripLink,
  saveTripPlan,
  useExpenses,
  useSettings,
} from '../lib/store'
import type { ScheduleItem } from '../types'

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

function LinkRow({
  tripId,
  link,
  onToast,
}: {
  tripId: number
  link: { id: number; label: string; url: string }
  onToast: (message: string) => void
}) {
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
        onClick={() => void deleteTripLink(tripId, link.id).then(() => onToast('Link removed'))}
        aria-label={`Remove ${link.label || hostLabel(link.url)}`}
        className="shrink-0 p-1.5 text-neutral-300"
      >
        <TrashIcon className="h-[15px] w-[15px]" />
      </button>
    </div>
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

  /*
   * The plan is typed into local state and written a moment after typing
   * stops.
   *
   * Not on every keystroke, which would put a notebook write behind every
   * letter of an itinerary. Not on blur either, which was the first attempt
   * and is a worse idea than it sounds: a plan typed on a bus and then locked
   * in a pocket never blurs, and the way you would find out is by opening the
   * trip a week later to an empty page.
   *
   * The component is keyed by trip id at the call site, so this state is
   * loaded once per trip and never has to be resynced from above — which is
   * what stops a save landing back on top of the sentence being typed after
   * it.
   */
  const [plan, setPlan] = useState(trip.plan ?? '')
  useEffect(() => {
    if (plan === (trip.plan ?? '')) return
    const timer = setTimeout(() => void saveTripPlan(trip.id, plan), 700)
    return () => clearTimeout(timer)
  }, [plan, trip.id, trip.plan])

  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const spent = useMemo(
    () =>
      expenses
        .filter((expense) => expense.schedule_id === trip.id)
        .reduce((sum, expense) => sum + expense.amount, 0),
    [expenses, trip.id],
  )

  const days = daysBetween(trip.date, lastDay(trip))

  async function addLink() {
    if (!safeUrl(url)) {
      setLinkError('That does not look like a link. Paste the whole address.')
      return
    }
    try {
      await saveTripLink(trip.id, { label, url })
      setUrl('')
      setLabel('')
      setLinkError(null)
      setAdding(false)
      onToast('Link saved')
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'That link would not save.')
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
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
                {rangeLabel(trip.date, lastDay(trip))}
                {days > 1 && ` · ${days} days`}
              </span>
            </span>
            {spent > 0 && (
              <span className="shrink-0 text-right">
                <span className="block text-[15px] font-medium tabular-nums">
                  {money(spent, settings.currency)}
                </span>
                <span className="block text-[12px] text-neutral-400">spent</span>
              </span>
            )}
          </div>

          <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">Plan</h2>
          <textarea
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            onBlur={() => {
              // Belt and braces: leaving the field saves at once rather than
              // waiting out the timer.
              if (plan.trim() !== (trip.plan ?? '')) void saveTripPlan(trip.id, plan)
            }}
            rows={8}
            placeholder={'Day 1 — land, check in, bridge at night\nDay 2 — Hoi An, back for dinner\nBook the Ba Na Hills ticket before Friday'}
            aria-label="The plan for this trip"
            className="w-full resize-y rounded-2xl border border-neutral-200 p-4 text-[15px] leading-7 outline-none transition-colors focus:border-brand-300 placeholder:text-neutral-300"
          />
          <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
            Saved as you go. This is the trip's own page — it does not show up in the diary
            alongside the time.
          </p>
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
            <div className="rounded-2xl bg-neutral-50 p-3">
              <input
                autoFocus
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setLinkError(null)
                }}
                onKeyDown={(event) => event.key === 'Enter' && void addLink()}
                placeholder="Paste the link"
                inputMode="url"
                aria-label="Link address"
                className="w-full rounded-lg bg-white px-3 py-2 text-[14px] outline-none ring-1 ring-neutral-200 placeholder:text-neutral-300"
              />
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void addLink()}
                placeholder="What is it? (optional)"
                aria-label="What the link is"
                className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-[14px] outline-none ring-1 ring-neutral-200 placeholder:text-neutral-300"
              />
              {linkError && (
                <p className="pt-2 text-[12px] leading-5 text-amber-700">{linkError}</p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => void addLink()}
                  disabled={!url.trim()}
                  className="rounded-full bg-brand-500 px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setAdding(false)
                    setUrl('')
                    setLabel('')
                    setLinkError(null)
                  }}
                  className="px-2 py-1.5 text-[13px] text-neutral-400"
                >
                  Cancel
                </button>
              </div>
            </div>
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
