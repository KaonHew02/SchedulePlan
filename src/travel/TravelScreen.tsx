import { useMemo, useState } from 'react'
import { useFileUrl } from '../components/Attachments'
import CountryBadge from '../components/CountryBadge'
import { ChevronRight, PinIcon, Plus } from '../components/Icons'
import { daysBetween, rangeLabel, todayISO } from '../lib/date'
import { money } from '../lib/currency'
import { CONTINENTS, countryOf, placeLabel, type ContinentCode } from '../lib/places'
import {
  deleteWish,
  lastDay,
  occupies,
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
    </button>
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
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(String(settings.travelGoal))

  const today = todayISO()

  const trips = useMemo(
    () =>
      schedule
        .filter((item): item is ScheduleItem & { place: NonNullable<ScheduleItem['place']> } =>
          Boolean(item.place?.country),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [schedule],
  )

  const stats = useMemo(() => {
    const countries = new Set<string>()
    const destinations = new Set<string>()
    const continents = new Set<ContinentCode>()
    for (const trip of trips) {
      countries.add(trip.place.country)
      // A destination is a place, not a visit — three trips to Kyoto is one.
      destinations.add(`${trip.place.country}:${(trip.place.city ?? '').toLowerCase()}`)
      const found = countryOf(trip.place.country)
      if (found) continents.add(found.continent)
    }
    return {
      countries: [...countries],
      destinations: destinations.size,
      continents: [...continents],
    }
  }, [trips])

  /** Spend recorded against a trip, in the home currency. */
  const spendOf = useMemo(() => {
    const totals = new Map<number, number>()
    for (const expense of expenses) {
      if (expense.schedule_id === null) continue
      totals.set(expense.schedule_id, (totals.get(expense.schedule_id) ?? 0) + expense.amount)
    }
    return totals
  }, [expenses])

  const here = trips.find((trip) => occupies(trip, today))
  const next = [...trips].reverse().find((trip) => trip.date > today)
  const goalShare = settings.travelGoal
    ? Math.min(1, stats.countries.length / settings.travelGoal)
    : 0

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
      <main className="px-5 pb-28 lg:px-8 lg:pb-10 xl:grid xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start xl:gap-10">
        <div className="xl:sticky xl:top-4">
        <p className="pb-3 pt-2 text-[13px] text-neutral-500">So far you have been to</p>

        <div className="flex justify-between gap-2">
          <Ring
            value={stats.destinations}
            of={Math.max(settings.travelGoal * 2, 1)}
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

        <div className="mt-6 flex items-center gap-2">
          <p className="flex-1 text-[14px] leading-5 text-neutral-600">
            Which makes your travel goal completed by
          </p>
          <span className="rounded-full bg-[#A3E635] px-2.5 py-1 text-[13px] font-semibold tabular-nums">
            {Math.round(goalShare * 100)}%
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-[#A3E635] transition-all"
            style={{ width: `${Math.max(2, goalShare * 100)}%` }}
          />
        </div>

        {editingGoal ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[13px] text-neutral-500">Aiming for</span>
            <input
              autoFocus
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              inputMode="numeric"
              aria-label="Countries to aim for"
              className="w-16 rounded-lg bg-neutral-100 px-2 py-1 text-center text-[14px] tabular-nums outline-none"
            />
            <span className="text-[13px] text-neutral-500">countries</span>
            <button
              onClick={() => {
                const goal = Math.max(1, Math.min(250, Number(goalDraft) || 50))
                updateSettings({ travelGoal: goal })
                setGoalDraft(String(goal))
                setEditingGoal(false)
              }}
              className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-[13px] font-medium text-white"
            >
              Set
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingGoal(true)}
            className="mt-1.5 text-[12px] text-neutral-400"
          >
            {stats.countries.length} of {settings.travelGoal} countries · change the goal
          </button>
        )}

        <div className="mt-6">
          <Globe codes={stats.countries} />
          <p className="pt-2 text-center text-[12px] text-neutral-400">
            {stats.countries.length === 0 ? 'Nowhere marked yet' : 'Drag to spin'}
          </p>
        </div>

        </div>

        <div className="min-w-0">
        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 xl:pt-2">Trips</h2>
        {trips.length === 0 ? (
          <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-center">
            <p className="text-[14px] text-neutral-600">No trips recorded yet.</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[13px] leading-5 text-neutral-400">
              A trip is just a schedule item with a country on it. Add one in Schedule, open
              &ldquo;Add location, notes or files&rdquo; and pick the country.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 border-y border-neutral-100">
            {trips.map((trip) => {
              const spent = spendOf.get(trip.id) ?? 0
              const nights = daysBetween(trip.date, lastDay(trip))
              return (
                <div key={trip.id} className="flex items-center gap-3 py-3">
                  <CountryBadge code={trip.place.country} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{trip.title}</span>
                    <span className="block truncate text-[12px] text-neutral-400">
                      {placeLabel(trip.place)} · {rangeLabel(trip.date, lastDay(trip))}
                      {nights > 1 && ` · ${nights} days`}
                    </span>
                  </span>
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
            attachments: visiting.photo ? [visiting.photo] : [],
          }}
          onClose={() => setVisiting(null)}
          onSave={async (draft: ScheduleDraft) => {
            await store.createSchedule(draft)
            // The photo is on the schedule item now, so its bytes stay.
            await deleteWish(visiting.id, true)
            setVisiting(null)
            onToast(`${visiting.name} added to your trips`)
          }}
        />
      )}
    </>
  )
}
