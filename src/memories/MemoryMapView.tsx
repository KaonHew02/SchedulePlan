import { Suspense, lazy, useMemo } from 'react'
import Flag from '../components/Flag'
import { Spinner } from '../components/Icons'
import { tr } from '../lib/i18n'
import { countryName } from '../lib/places'
import type { MapPin } from '../seasons/MapCanvas'
import type { Memory } from '../types'
import { kindOf } from './kinds'

// The street map Seasons draws (MapLibre and OpenFreeMap tiles), loaded only
// when this view opens — it is the heaviest thing in the app.
const MapCanvas = lazy(() => import('../seasons/MapCanvas'))

/**
 * Where your memories happened: a pin for each one with a point, in its kind's
 * colour, and under the map the countries, each with how many memories.
 */
export default function MemoryMapView({
  memories,
  onOpen,
  onCountry,
}: {
  memories: Memory[]
  onOpen: (id: number) => void
  /** Show the stamps from one country. */
  onCountry: (code: string) => void
}) {
  const pins = useMemo<MapPin[]>(
    () =>
      memories
        .filter((memory) => memory.place?.lat != null && memory.place?.lon != null)
        .map((memory) => ({
          key: String(memory.id),
          lat: memory.place!.lat!,
          lon: memory.place!.lon!,
          label: memory.title,
          tint: kindOf(memory.kind).pin,
          onClick: () => onOpen(memory.id),
        })),
    [memories, onOpen],
  )

  const view = useMemo(() => {
    if (pins.length === 0) return { center: [4.2, 108] as [number, number], zoom: 3 }
    if (pins.length === 1) return { center: [pins[0].lat, pins[0].lon] as [number, number], zoom: 12 }
    const lats = pins.map((pin) => pin.lat)
    const lons = pins.map((pin) => pin.lon)
    return {
      bounds: [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ] as [[number, number], [number, number]],
    }
  }, [pins])

  const countries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const memory of memories) {
      const code = memory.place?.country
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || countryName(a[0]).localeCompare(countryName(b[0])))
  }, [memories])

  const unpinned = memories.length - pins.length

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start lg:gap-8">
      <div>
        <Suspense
          fallback={
            <div className="flex h-[60vh] min-h-[320px] items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Spinner className="h-5 w-5" />
            </div>
          }
        >
          <MapCanvas pins={pins} {...view} className="h-[60vh] min-h-[320px]" />
        </Suspense>
        {unpinned > 0 && (
          <p className="pt-2 text-[12px] leading-5 text-neutral-400">
            {tr(
              `${unpinned} ${unpinned === 1 ? 'memory has' : 'memories have'} no point on the map yet. Search its place in Edit to pin it.`,
              `有 ${unpinned} 段回忆还没在地图上。在编辑里搜索地点就能标上。`,
            )}
          </p>
        )}
      </div>

      <div className="mt-5 lg:mt-0">
        <p className="pb-2 text-[13px] font-medium text-neutral-400">
          {tr(
            `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`,
            `${countries.length} 个国家和地区`,
          )}
        </p>
        {countries.length === 0 ? (
          <p className="text-[13px] leading-5 text-neutral-500">
            {tr('Give a memory a place and its country shows up here.', '给回忆加上地点，国家就会出现在这里。')}
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl bg-white">
            {countries.map(([code, count]) => (
              <button
                key={code}
                type="button"
                onClick={() => onCountry(code)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
              >
                <Flag code={code} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{countryName(code)}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[12px] tabular-nums text-neutral-600">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
