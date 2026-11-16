import { useMemo } from 'react'
import Flag from '../components/Flag'
import { PlaneIcon } from '../components/Icons'
import { daysBetween, rangeLabel, todayISO } from '../lib/date'
import { tr } from '../lib/i18n'
import { countryName } from '../lib/places'
import { isTrip, legsOf, spanOf } from '../lib/store'
import type { ScheduleItem } from '../types'

/**
 * The trip you are on, or the next one coming, as a boarding pass.
 *
 * This is what makes the diary read as a travel planner rather than a plain
 * calendar: the first thing on the screen is where you are going and how
 * long until you leave. A trip is what Travel calls one — tagged Travel with
 * a country on it — and its dates take in every leg bound to it.
 *
 * With nothing booked it is a dashed "where to next?" that opens the form,
 * so the empty state still points at planning.
 */

/** A dotted arc with a plane at the end — decoration, so hidden from readers. */
export function FlightPath({ className = '', dot = true }: { className?: string; dot?: boolean }) {
  return (
    <svg
      viewBox="0 0 160 60"
      fill="none"
      aria-hidden
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M4 54 C 40 6, 104 2, 140 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.1 7"
      />
      {dot && <circle cx="4" cy="54" r="3.5" fill="currentColor" />}
      <g transform="translate(138 12) rotate(28)">
        <path
          d="M8.9 9.6 8 5.5l1.75-1.75C10.5 3 10.75 2 10.5 1.5c-.5-.25-1.5 0-2.25.75L6.5 4 2.4 3.1c-.25-.05-.45.05-.55.25l-.15.25c-.1.25-.05.5.15.65L4.5 6l-1 1.5H2l-.5.5 1.5 1 1 1.5.5-.5V8.5l1.5-1 1.75 2.65c.15.2.4.25.65.15l.25-.1c.2-.15.3-.35.25-.6z"
          fill="currentColor"
          transform="scale(1.6)"
        />
      </g>
    </svg>
  )
}

export default function NextTrip({
  schedule,
  onOpen,
  onPlan,
  className = '',
}: {
  schedule: ScheduleItem[]
  onOpen: (item: ScheduleItem) => void
  onPlan: () => void
  className?: string
}) {
  const today = todayISO()

  const next = useMemo(() => {
    let best: { trip: ScheduleItem; start: string; end: string } | null = null
    for (const item of schedule) {
      if (!isTrip(item, schedule)) continue
      const { start, end } = spanOf(item, legsOf(schedule, item.id))
      if (end < today) continue
      if (!best || start < best.start) best = { trip: item, start, end }
    }
    return best
  }, [schedule, today])

  if (!next) {
    return (
      <button
        onClick={onPlan}
        className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] border-2 border-dashed border-brand-200 bg-brand-50/60 px-4 py-3.5 text-left transition-transform active:scale-[0.99] ${className}`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[22px] shadow-xs">
          🧳
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-brand-700">
            {tr('Where to next?', '下一站去哪里？')}
          </span>
          <span className="block text-[12px] text-brand-500">
            {tr('Plan your next trip', '开始计划你的下一趟旅行')}
          </span>
        </span>
        <FlightPath className="h-10 w-24 shrink-0 text-brand-300" />
      </button>
    )
  }

  const { trip, start, end } = next
  const length = daysBetween(start, end)
  const onTrip = start <= today
  const until = daysBetween(today, start) - 1
  const country = trip.place?.country ?? null

  // The stub: how long to go, or how far in you are.
  const big = onTrip ? String(daysBetween(start, today)) : until <= 1 ? '' : String(until)
  const small = onTrip
    ? tr(`of ${length} days`, `/ ${length} 天`)
    : until === 0
      ? tr('Leaving today', '今天出发')
      : until === 1
        ? tr('Tomorrow', '明天出发')
        : tr('days to go', '天后出发')
  const above = onTrip ? tr('Day', '第') : until <= 1 ? '' : tr('In', '还有')

  return (
    <button
      onClick={() => onOpen(trip)}
      aria-label={tr(`Next trip: ${trip.title}`, `下一趟旅行：${trip.title}`)}
      className={`relative flex w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-brand-500 via-[#7b6cf0] to-sky-500 text-left text-white shadow-[0_10px_30px_-12px_rgba(108,92,231,0.7)] transition-transform active:scale-[0.99] ${className}`}
    >
      <FlightPath dot={false} className="absolute -right-2 top-1 h-16 w-44 text-white/25" />

      <span className="relative min-w-0 flex-1 px-4 py-3.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">
          <PlaneIcon className="h-3.5 w-3.5" />
          {onTrip ? tr('On a trip', '旅行中') : tr('Next trip', '下一趟旅行')}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          {country && <Flag code={country} className="h-[16px] w-[23px] shrink-0 rounded-[3px] shadow-xs" />}
          <span className="truncate text-[18px] font-bold leading-6 tracking-[-0.01em]">
            {trip.title}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[12px] text-white/80">
          <span className="tabular-nums">{rangeLabel(start, end)}</span>
          <span className="text-white/40">·</span>
          <span>{tr(`${length} ${length === 1 ? 'day' : 'days'}`, `${length} 天`)}</span>
          {country && !trip.title.includes(countryName(country)) && (
            <>
              <span className="text-white/40">·</span>
              <span className="truncate">{countryName(country)}</span>
            </>
          )}
        </span>
      </span>

      {/* The tear-off stub, behind a perforation with a notch top and bottom. */}
      <span className="relative flex w-[92px] shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-white/35 px-2 py-3 text-center">
        <span className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-white" />
        <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-white" />
        {above && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/75">
            {above}
          </span>
        )}
        {big ? (
          <span className="text-[30px] font-extrabold leading-8 tabular-nums">{big}</span>
        ) : (
          <PlaneIcon className="my-1 h-7 w-7" />
        )}
        <span className="text-[11px] font-medium leading-4 text-white/85">{small}</span>
      </span>
    </button>
  )
}
