import { useMemo, useRef, useState } from 'react'
import CountryBadge from '../components/CountryBadge'
import { countryOf, graticule, project, type Country } from '../lib/places'

/**
 * A wireframe globe with a dot on every country you have been to.
 *
 * It is a globe rather than a flat map on purpose. A world map with borders is
 * hundreds of kilobytes of geometry and would be the largest thing in the
 * bundle by a distance; a sphere with a graticule needs only trigonometry, and
 * a dot at a country's centroid says "been there" just as well as a filled
 * outline does.
 *
 * Drag it. Points on the far side are dropped rather than drawn flat, which is
 * what stops Peru appearing over the top of Mongolia.
 */

const SIZE = 268
const RADIUS = 112
const CENTRE = SIZE / 2

export default function Globe({
  codes,
  onPick,
}: {
  /** Country codes visited, most recent first. */
  codes: string[]
  onPick?: (code: string) => void
}) {
  const visited = useMemo(
    () =>
      codes
        .map((code) => countryOf(code))
        .filter((country): country is Country => Boolean(country)),
    [codes],
  )

  // Open looking at the middle of wherever you have been, so the dots are on
  // the near side rather than round the back waiting to be found.
  const [view, setView] = useState(() => {
    if (visited.length === 0) return { lat: 20, lon: 100 }
    const lat = visited.reduce((sum, c) => sum + c.lat, 0) / visited.length
    // Longitudes wrap, so they are averaged as unit vectors rather than as
    // numbers — otherwise Tokyo and Los Angeles average out to Africa.
    const x = visited.reduce((sum, c) => sum + Math.cos((c.lon * Math.PI) / 180), 0)
    const y = visited.reduce((sum, c) => sum + Math.sin((c.lon * Math.PI) / 180), 0)
    return { lat: Math.max(-60, Math.min(60, lat)), lon: (Math.atan2(y, x) * 180) / Math.PI }
  })

  const drag = useRef<{ x: number; y: number; lat: number; lon: number } | null>(null)
  const lines = useMemo(() => graticule(view.lat, view.lon, RADIUS), [view])

  const dots = useMemo(
    () =>
      visited.map((country) => ({
        country,
        point: project(country.lat, country.lon, view.lat, view.lon, RADIUS),
      })),
    [visited, view],
  )

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[268px] cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label={`Globe showing ${visited.length} countries visited`}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, ...view }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const from = drag.current
          if (!from) return
          setView({
            lon: from.lon - (event.clientX - from.x) * 0.45,
            lat: Math.max(-75, Math.min(75, from.lat + (event.clientY - from.y) * 0.45)),
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="#F1F0FA" />

        <g transform={`translate(${CENTRE} ${CENTRE})`}>
          {lines.map((path, index) => (
            <path key={index} d={path} fill="none" stroke="#CFCBE8" strokeWidth="1" />
          ))}
        </g>

        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          fill="none"
          stroke="#B8B2DE"
          strokeWidth="1.5"
        />

        <g transform={`translate(${CENTRE} ${CENTRE})`}>
          {dots.map(({ country, point }) =>
            point.visible ? (
              <g key={country.code}>
                <circle cx={point.x} cy={point.y} r="7" fill="#6C5CE7" opacity="0.18" />
                <circle cx={point.x} cy={point.y} r="3.5" fill="#6C5CE7">
                  <title>{country.name}</title>
                </circle>
              </g>
            ) : null,
          )}
        </g>
      </svg>

      {visited.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {visited.slice(0, 14).map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => onPick?.(country.code)}
              title={country.name}
              className="rounded-full transition-transform hover:scale-105"
            >
              <CountryBadge code={country.code} />
            </button>
          ))}
          {visited.length > 14 && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] text-neutral-500">
              +{visited.length - 14}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
