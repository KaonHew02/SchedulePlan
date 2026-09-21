import { useMemo, useState } from 'react'
import { useFileUrl } from '../components/Attachments'
import CountryBadge from '../components/CountryBadge'
import { ChevronRight, LinkIcon, PaperclipIcon, PinIcon, Plus } from '../components/Icons'
import { daysBetween, rangeLabel, todayISO } from '../lib/date'
import { money } from '../lib/currency'
import { CONTINENTS, countryOf, placeLabel, type ContinentCode } from '../lib/places'
import {
  deleteWish,
  isTrip,
  isVisit,
  lastDay,
  occupies,
  spanOf,
  store,
  updateSettings,
  useExpenses,
  useSchedule,
  useSettings,
  useWishlist,
} from '../lib/store'
import ScheduleForm from '../schedule/ScheduleForm'
import type { ScheduleDraft, ScheduleItem, WishPlace } from '../types'
import Globe from './Globe'
import TripScreen from './TripScreen'
import WishForm from './WishForm'

/**
 * Where you have been, and where you are going.
 *
 * Everything on this screen except the wishlist is *derived* — there is no
 * Trip record anywhere. A trip is a schedule item that spans days and has a
 * country on it, which is the rule the whole app is built on: the schedule
 * item is the only top-level object, and Travel is a way of looking at the
 * ones that happen to be somewhere.
 *
 * That has a pleasant consequence. Adding a country to something already in
 * the schedule is all it takes to appear here — nothing has to be entered
 * twice, and the spend already linked to that item comes with it.
 */

function Ring({
  value,
  of,
  label,
  colour,
  track,
}: {
  value: number
  of: number
  label: string
  colour: string
  track: string
}) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const share = of > 0 ? Math.min(1, value / of) : 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 88 88" className="h-[88px] w-[88px] -rotate-90">
          <circle cx="44" cy="44" r={radius} fill="none" stroke={track} strokeWidth="9" />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[21px] font-bold leading-none tabular-nums">{value}</span>
        </span>
      </div>
      <span className="mt-1.5 text-[12px] text-neutral-500">{label}</span>
    </div>
  )
}

function WishCard({ wish, onOpen }: { wish: WishPlace; onOpen: () => void }) {
  const url = useFileUrl(wish.photo?.id ?? null)

  return (
    <button
      onClick={onOpen}
      className="w-[132px] shrink-0 text-left transition-transform active:scale-[0.98]"
    >
      <span className="block h-[104px] w-full overflow-hidden rounded-2xl bg-neutral-100">
        {url ? (
          <img src={url} alt={wish.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <CountryBadge code={wish.country} size="lg" />
          </span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-[13px] font-medium">{wish.name}</span>
      <span className="flex items-center gap-1 text-[12px] text-neutral-400">
        <PinIcon className="h-3 w-3" />
        <span className="truncate">{countryOf(wish.country)?.name ?? wish.country}</span>
      </span>
      {/*
        What is inside, without opening it. A card that holds nothing but a
        name and one that holds a page of notes, the booking and four photos
        looked exactly alike, so the only way to find out was to open it.
      */}
      {(wish.links.length > 0 || wish.attachments.length > 0) && (
        <span className="mt-0.5 flex items-center gap-2.5 text-[11px] tabular-nums text-neutral-400">
          {wish.links.length > 0 && (
            <span className="flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              {wish.links.length}
            </span>
          )}
          {wish.attachments.length > 0 && (
            <span className="flex items-center gap-1">
              <PaperclipIcon className="h-3 w-3" />
              {wish.attachments.length}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

/**
 * One goal, and how far along it you are.
 *
 * There are two of them because they are two different ambitions. Fifty
 * countries is breadth — somewhere new on the map. A hundred places is depth
 * as well: Da Nang and Hoi An are one country and two places, and a second
 * week in Vietnam that only ever moves you an hour down the coast should show
 * as something rather than as nothing.
 *
 * One number covering both would have to average them, and an average of two
 * unlike things is a number nobody can act on. Each bar wears the colour of
 * the ring above it, so which is which needs no reading.
 */
function GoalBar({
  value,
  of,
  label,
  colour,
  ink,
}: {
  value: number
  of: number
  label: string
  colour: string
  /** Text on the badge: the two fills are nowhere near the same lightness. */
  ink: string
}) {
  const share = of > 0 ? Math.min(1, value / of) : 0

  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-[13px] leading-5 text-neutral-600">
          <span className="font-medium tabular-nums text-neutral-900">{value}</span> of{' '}
          <span className="tabular-nums">{of}</span> {label}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums"
          style={{ backgroundColor: colour, color: ink }}
        >
          {Math.round(share * 100)}%
        </span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, share * 100)}%`, backgroundColor: colour }}
        />
      </div>
    </div>
  )
}

export default function TravelScreen({ onToast }: { onToast: (message: string) => void }) {
  const schedule = useSchedule()
  const expenses = useExpenses()
  const settings = useSettings()
  const wishlist = useWishlist()
  const [form, setForm] = useState<{ wish: WishPlace | null } | null>(null)
  // A wish on its way to becoming a trip: the schedule form is open on it.
  const [visiting, setVisiting] = useState<WishPlace | null>(null)
  // A trip opened onto its own page. Held as an id rather than the item so
  // that editing the plan re-renders with the new one instead of a stale copy.
  const [openTripId, setOpenTripId] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(String(settings.travelGoal))
  const [placeDraft, setPlaceDraft] = useState(String(settings.placeGoal))

  const today = todayISO()

  /*
   * A trip is tagged Travel and has a country on it.
   *
   * The country alone was the first test, which made a run to Daiso with
   * 'Malaysia' on it a trip. The second was a switch of its own on every item,
   * which worked and put a button on every row of this list to turn it off —
   * a column of 'Not a trip' down the side of a page about trips, which is a
   * strange thing to have built.
   *
   * The tag was already there and already being used: these are the same
   * chips that say Personal and Work on the add form, and a shop is not tagged
   * Travel. Nothing new to learn and nothing new to maintain, at the cost of
   * one rule worth knowing — a trip has to carry the tag.
   */
  /*
   * Two different lists out of the same rows, and keeping them apart is the
   * whole point of legs.
   *
   * `trips` is what Travel *lists*: one row per journey. `visits` is what the
   * counters and the globe are made of, and it includes the legs — Hoi An is
   * a place K has been whether it is a row of its own or the middle three days
   * of the Vietnam one. Counting the list would have quietly deleted a
   * destination the moment two rows were joined.
   */
  const visits = useMemo(
    () =>
      schedule.filter(
        (item): item is ScheduleItem & { place: NonNullable<ScheduleItem['place']> } =>
          isVisit(item),
      ),
    [schedule],
  )

  const trips = useMemo(
    () =>
      visits
        .filter((item) => isTrip(item, schedule))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visits, schedule],
  )

  /** The legs of each trip, by trip id. */
  const legsBy = useMemo(() => {
    const map = new Map<number, ScheduleItem[]>()
    for (const item of schedule) {
      if (item.trip_id === null || item.trip_id === undefined) continue
      map.set(item.trip_id, [...(map.get(item.trip_id) ?? []), item])
    }
    for (const [id, legs] of map) map.set(id, legs.sort((a, b) => a.date.localeCompare(b.date)))
    return map
  }, [schedule])

  const stats = useMemo(() => {
    const countries = new Set<string>()
    const destinations = new Set<string>()
    const continents = new Set<ContinentCode>()
    for (const visit of visits) {
      countries.add(visit.place.country)
      // A destination is a place, not a visit — three trips to Kyoto is one.
      destinations.add(`${visit.place.country}:${(visit.place.city ?? '').toLowerCase()}`)
      const found = countryOf(visit.place.country)
      if (found) continents.add(found.continent)
    }
    return {
      countries: [...countries],
      destinations: destinations.size,
      continents: [...continents],
    }
  }, [visits])

  /**
   * Spend against a trip, in the home currency — its own and its legs'.
   *
   * A dinner in Hoi An is money spent on the Vietnam trip, and it is attached
   * to the Hoi An row, so a trip that only counted its own receipts would
   * under-report itself by however much of the journey was legs.
   */
  const spendOf = useMemo(() => {
    const perItem = new Map<number, number>()
    for (const expense of expenses) {
      if (expense.schedule_id === null) continue
      perItem.set(expense.schedule_id, (perItem.get(expense.schedule_id) ?? 0) + expense.amount)
    }
    const totals = new Map<number, number>()
    for (const trip of trips) {
      const legs = legsBy.get(trip.id) ?? []
      totals.set(
        trip.id,
        (perItem.get(trip.id) ?? 0) +
          legs.reduce((sum, leg) => sum + (perItem.get(leg.id) ?? 0), 0),
      )
    }
    return totals
  }, [expenses, trips, legsBy])

  const here = trips.find((trip) => occupies(trip, today))
  const next = [...trips].reverse().find((trip) => trip.date > today)
  // Looked up from the live list, so a plan typed on the page is on screen the
  // moment it is saved — and marking something Not a trip while its own page
  // is open drops back here instead of leaving a page for a trip that is gone.
  const openTrip = trips.find((trip) => trip.id === openTripId)
  if (openTrip) {
    return (
      <TripScreen
        key={openTrip.id}
        trip={openTrip}
        onBack={() => setOpenTripId(null)}
        onToast={onToast}
      />
    )
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="px-5 pb-2 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">Travel</h1>
          <p className="flex items-center gap-1.5 pt-0.5 text-[13px] text-neutral-500">
            <PinIcon className="h-3.5 w-3.5 text-neutral-400" />
            {here ? (
              <>
                Today you are in{' '}
                <span className="font-medium text-neutral-900">{placeLabel(here.place)}</span>
              </>
            ) : next ? (
              <>
                Next up{' '}
                <span className="font-medium text-neutral-900">{placeLabel(next.place)}</span>
                {`, ${rangeLabel(next.date, lastDay(next))}`}
              </>
            ) : (
              'Nothing away in the diary'
            )}
          </p>
        </div>
      </header>

      {/* Stats and the globe on the left, the lists on the right. Two
          columns rather than one long scroll is the whole reason the width
          cap could go. */}
      <main className="px-5 pb-28 lg:px-8 lg:pb-10 xl:grid xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:items-start xl:gap-10">
        <div className="xl:sticky xl:top-4">
        <p className="pb-3 pt-2 text-[13px] text-neutral-500">So far you have been to</p>

        <div className="flex justify-between gap-2">
          <Ring
            value={stats.destinations}
            of={Math.max(settings.placeGoal, 1)}
            label="destinations"
            colour="#A3E635"
            track="#F0F0F5"
          />
          <Ring
            value={stats.countries.length}
            of={Math.max(settings.travelGoal, 1)}
            label="countries"
            colour="#6C5CE7"
            track="#F0F0F5"
          />
          <Ring
            value={stats.continents.length}
            of={6}
            label="continents"
            colour="#171717"
            track="#F0F0F5"
          />
        </div>

        <p className="mt-6 text-[14px] leading-5 text-neutral-600">
          Which makes your travel goals completed by
        </p>
        <GoalBar
          value={stats.countries.length}
          of={settings.travelGoal}
          label="countries"
          colour="#6C5CE7"
          ink="#FFFFFF"
        />
        <GoalBar
          value={stats.destinations}
          of={settings.placeGoal}
          label="places"
          colour="#A3E635"
          ink="#1C1917"
        />

        {editingGoal ? (
          <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
            <div className="flex items-center gap-2">
              <label htmlFor="goal-countries" className="flex-1 text-[13px] text-neutral-600">
                Countries to aim for
              </label>
              <input
                id="goal-countries"
                autoFocus
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                inputMode="numeric"
                className="w-16 rounded-lg bg-white px-2 py-1 text-center text-[14px] tabular-nums outline-none ring-1 ring-neutral-200"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="goal-places" className="flex-1 text-[13px] text-neutral-600">
                Places to aim for
              </label>
              <input
                id="goal-places"
                value={placeDraft}
                onChange={(event) => setPlaceDraft(event.target.value)}
                inputMode="numeric"
                className="w-16 rounded-lg bg-white px-2 py-1 text-center text-[14px] tabular-nums outline-none ring-1 ring-neutral-200"
              />
            </div>
            <div className="mt-2.5 flex items-end gap-2">
              <p className="flex-1 text-[12px] leading-4 text-neutral-400">
                A place is a city: Da Nang and Hoi An are two of them, and going back to
                either one does not add a third. Somewhere with only a country on it counts
                once.
              </p>
              <button
                onClick={() => {
                  const countries = Math.max(1, Math.min(250, Number(goalDraft) || 50))
                  const places = Math.max(1, Math.min(1000, Number(placeDraft) || 100))
                  updateSettings({ travelGoal: countries, placeGoal: places })
                  setGoalDraft(String(countries))
                  setPlaceDraft(String(places))
                  setEditingGoal(false)
                }}
                className="shrink-0 rounded-full bg-brand-500 px-3 py-1.5 text-[13px] font-medium text-white"
              >
                Set
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              // Re-read on the way in. The drafts were seeded at first render,
              // and a goal changed since then would otherwise be offered back
              // as the number it used to be.
              setGoalDraft(String(settings.travelGoal))
              setPlaceDraft(String(settings.placeGoal))
              setEditingGoal(true)
            }}
            className="mt-2 text-[12px] text-neutral-400"
          >
            Change the goals
          </button>
        )}

        <div className="mt-6">
          <Globe codes={stats.countries} />
        </div>

        </div>

        <div className="min-w-0">
        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 xl:pt-2">Trips</h2>
        {trips.length === 0 ? (
          <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-center">
            <p className="text-[14px] text-neutral-600">No trips recorded yet.</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[13px] leading-5 text-neutral-400">
              A trip is a schedule item tagged ✈️ Travel with a country on it. Tag it in
              Schedule, then open &ldquo;Add location, notes or files&rdquo; and pick the country.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 border-y border-neutral-100">
            {trips.map((trip) => {
              const spent = spendOf.get(trip.id) ?? 0
              const legs = legsBy.get(trip.id) ?? []
              const span = spanOf(trip, legs)
              const nights = daysBetween(span.start, span.end)
              return (
                <div key={trip.id} className="group flex items-center gap-3 py-3">
                  <button
                    onClick={() => setOpenTripId(trip.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <CountryBadge code={trip.place.country} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{trip.title}</span>
                      <span className="block truncate text-[12px] text-neutral-400">
                        {placeLabel(trip.place)} · {rangeLabel(span.start, span.end)}
                        {nights > 1 && ` · ${nights} days`}
                        {legs.length > 0 && ` · ${legs.length + 1} stops`}
                        {(trip.plan || trip.links.length > 0) && ' · has a page'}
                      </span>
                    </span>
                  </button>
                  {spent > 0 && (
                    <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">
                      {money(spent, settings.currency)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-baseline justify-between pb-2 pt-8">
          <h2 className="text-[13px] font-medium text-neutral-400">Wishlist</h2>
          <button
            onClick={() => setForm({ wish: null })}
            className="flex items-center gap-1 text-[13px] font-medium text-brand-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {wishlist.length === 0 ? (
          <p className="rounded-2xl bg-neutral-50 px-4 py-5 text-center text-[13px] leading-5 text-neutral-400">
            Nowhere on the list yet. Add the places you keep meaning to go.
          </p>
        ) : (
          // Wrapped, not a sideways-scrolling rail: a row you have to swipe
          // hides half the list behind an edge that says nothing is there.
          <div className="flex flex-wrap gap-3">
            {wishlist.map((wish) => (
              <WishCard key={wish.id} wish={wish} onOpen={() => setForm({ wish })} />
            ))}
          </div>
        )}

        {stats.continents.length > 0 && (
          <>
            <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">Continents</h2>
            <div className="divide-y divide-neutral-100 border-y border-neutral-100">
              {(Object.keys(CONTINENTS) as ContinentCode[]).map((code) => {
                const been = stats.countries.filter(
                  (country) => countryOf(country)?.continent === code,
                ).length
                return (
                  <div key={code} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`text-[14px] ${been ? 'text-neutral-900' : 'text-neutral-300'}`}
                    >
                      {CONTINENTS[code]}
                    </span>
                    <span className="ml-auto text-[13px] tabular-nums text-neutral-400">
                      {been || '—'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-transparent" />
                  </div>
                )
              })}
            </div>
          </>
        )}
        </div>
      </main>

      {form && (
        <WishForm
          wish={form.wish}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            onToast(message)
          }}
          onBeenThere={(wish) => {
            setForm(null)
            setVisiting(wish)
          }}
        />
      )}

      {/*
        Marking a wish as visited is one form, not a flag: where you went and
        when is a schedule item, and only saving one actually moves a counter.
        The wish is dropped afterwards — keeping both would show the same
        place as somewhere you have been and somewhere you mean to go.
      */}
      {visiting && (
        <ScheduleForm
          item={null}
          defaultDate={today}
          prefill={{
            title: visiting.name,
            notes: visiting.note,
            place: { country: visiting.country, city: null },
            allDay: true,
            // The picture first, so the trip leads with the same image the
            // wishlist card did.
            attachments: [...(visiting.photo ? [visiting.photo] : []), ...visiting.attachments],
            links: visiting.links,
          }}
          onClose={() => setVisiting(null)}
          onSave={async (draft: ScheduleDraft) => {
            await store.createSchedule(draft)
            // The files are on the schedule item now, so their bytes stay.
            await deleteWish(visiting.id, true)
            setVisiting(null)
            onToast(`${visiting.name} added to your trips`)
          }}
        />
      )}
    </>
  )
}
