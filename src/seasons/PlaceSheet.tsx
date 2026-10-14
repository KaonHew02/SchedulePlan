import { lazy, Suspense } from 'react'
import { PinIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { tr } from '../lib/i18n'
import { RATING_TINT, monthLabel, monthsLabel, nameOf, ratingLabel, type Destination } from './seasons'
import { googleMapsUrl, type MapPlace, type OnCard } from './where'

const LeafletMap = lazy(() => import('./LeafletMap'))

/**
 * A place found on OpenStreetMap, the way Google Maps shows one: what it is,
 * where it is, on a map you can drag and zoom — and then what Seasons knows
 * about going there, from the card it is on.
 */
export default function PlaceSheet({
  place,
  on,
  month,
  onOpenCard,
  onClose,
}: {
  place: MapPlace
  on: OnCard | null
  month: number
  onOpenCard: (d: Destination) => void
  onClose: () => void
}) {
  // An area — a county, an island, a park — is shown whole; a point close up.
  const [south, north, west, east] = place.bounds ?? [0, 0, 0, 0]
  const area = place.bounds && (north - south > 0.02 || east - west > 0.02)

  return (
    <Sheet
      title={place.name}
      onClose={onClose}
      footer={
        <a
          href={googleMapsUrl(place.lat, place.lon)}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-full bg-neutral-100 py-3 text-center text-[15px] font-medium text-neutral-800"
        >
          {tr('Open in Google Maps', '在 Google 地图打开')}
        </a>
      }
    >
      <p className="flex items-start gap-1.5 text-[13px] leading-5 text-neutral-500">
        <PinIcon className="mt-0.5 h-4 w-4 text-rose-500" />
        <span className="min-w-0">
          {place.kind && <span className="font-medium text-neutral-700">{place.kind} · </span>}
          {place.address}
        </span>
      </p>

      <Suspense fallback={<div className="mt-3 h-64 rounded-2xl bg-neutral-100" />}>
        <LeafletMap
          className="mt-3 h-64"
          spot={[place.lat, place.lon]}
          bounds={
            area
              ? [
                  [south, west],
                  [north, east],
                ]
              : undefined
          }
          center={[place.lat, place.lon]}
          zoom={14}
        />
      </Suspense>

      <section className="pt-5">
        <h3 className="pb-1.5 text-[13px] font-medium text-neutral-400">{tr('In Seasons', '季节里')}</h3>
        {on ? (
          <CardSummary on={on} month={month} onOpen={() => onOpenCard(on.d)} />
        ) : (
          <p className="text-[14px] leading-6 text-neutral-600">
            {tr('Seasons has no card for this country yet.', '季节里还没有这个国家的卡片。')}
          </p>
        )}
      </section>

      <p className="pt-5 text-[11px] leading-4 text-neutral-400">
        {tr('Place and map: © OpenStreetMap contributors.', '地点和地图：© OpenStreetMap 贡献者。')}
      </p>
    </Sheet>
  )
}

/** The card the place is on: how this month is there, and the best months. */
function CardSummary({ on, month, onOpen }: { on: OnCard; month: number; onOpen: () => void }) {
  const { d, near } = on
  const r = d.ratings[month - 1]
  const best = d.ratings.flatMap((rating, i) => (rating === 3 ? [i + 1] : []))
  return (
    <button onClick={onOpen} className="w-full rounded-2xl bg-neutral-50 px-4 py-3.5 text-left active:bg-neutral-100">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-6">{nameOf(d)}</span>
          <span className="block text-[12px] text-neutral-400">
            {near
              ? tr('No card of its own here; this is the nearest', '这里没有自己的卡片，这是最近的一张')
              : `${tr('Best', '最佳')} ${monthsLabel(best)}`}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${RATING_TINT[r]}`}>
          {monthLabel(month)} · {ratingLabel(r)}
        </span>
      </span>
      <span className="block pt-2 text-[13px] leading-5 text-neutral-600">{d.notes[month - 1]}</span>
      <span className="block pt-2 text-[13px] font-medium text-brand-600">
        {tr(`Open ${nameOf(d)} →`, `打开「${nameOf(d)}」→`)}
      </span>
    </button>
  )
}
