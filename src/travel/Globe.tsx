import { useEffect, useMemo, useRef, useState } from 'react'
import CountryBadge from '../components/CountryBadge'
import { countryOf, graticule, project, type Country } from '../lib/places'
import { loadWorldMap, type WorldMap } from './worldmap'

/**
 * A globe with every country you have been to filled in.
 *
 * It was a wireframe with a dot per country until 2026-09-11, on the
 * reasoning that border geometry would be the largest thing in the bundle.
 * K wanted the map. The geometry is still not in the bundle — `worldmap.ts`
 * fetches it when this screen first mounts — so the cost lands on Travel and
 * nowhere else, and until it arrives the wireframe is what is on screen.
 *
 * Drag it. Clipping to the near side is d3's: the far half of a polygon is
 * cut at the horizon and closed along it, which is what stops Brazil being
 * drawn flat across the Pacific.
 *
 * Eighteen countries are too small for the 110m file to carry at all, and
 * Singapore is one of them. Those get a dot, because a globe that looks
 * untouched after a trip is worse than one with a mark in the wrong style.
 */

const SIZE = 268
const RADIUS = 112
const CENTRE = SIZE / 2

const OCEAN = '#F1F0FA'
const LAND = '#CBC7DD'
const BEEN = '#A3E635'
const EDGE = '#B8B2DE'

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

  // Open looking at the middle of wherever you have been, so the countries
  // are on the near side rather than round the back waiting to be found.
  const [view, setView] = useState(() => {
    if (visited.length === 0) return { lat: 20, lon: 100 }
    const lat = visited.reduce((sum, c) => sum + c.lat, 0) / visited.length
    // Longitudes wrap, so they are averaged as unit vectors rather than as
    // numbers — otherwise Tokyo and Los Angeles average out to Africa.
    const x = visited.reduce((sum, c) => sum + Math.cos((c.lon * Math.PI) / 180), 0)
    const y = visited.reduce((sum, c) => sum + Math.sin((c.lon * Math.PI) / 180), 0)
    return { lat: Math.max(-60, Math.min(60, lat)), lon: (Math.atan2(y, x) * 180) / Math.PI }
  })

  const [world, setWorld] = useState<WorldMap | null>(null)
  useEffect(() => {
    let alive = true
    // A map that will not load leaves the wireframe up rather than an error:
    // the counters, the goal and the country chips are all still right, and
    // this is the decoration on top of them.
    loadWorldMap().then(
      (map) => alive && setWorld(map),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [])

  const drag = useRef<{ x: number; y: number; lat: number; lon: number } | null>(null)

  const been = useMemo(() => new Set(codes), [codes])

  const land = useMemo(() => {
    if (!world) return null
    const projection = world
      .geoOrthographic()
      .translate([CENTRE, CENTRE])
      .scale(RADIUS)
      .rotate([-view.lon, -view.lat])
    const draw = world.geoPath(projection)
    return world.shapes
      .map((shape) => ({
        code: shape.code,
        name: shape.code ? countryOf(shape.code)?.name : undefined,
        been: shape.code !== null && been.has(shape.code),
        d: draw(shape.feature) ?? '',
      }))
      .filter((shape) => shape.d)
  }, [world, view, been])

  // The wireframe: what is on screen until the map arrives, and what stays
  // there if it never does.
  const lines = useMemo(() => (world ? null : graticule(view.lat, view.lon, RADIUS)), [world, view])

  const dots = useMemo(
    () =>
      visited
        .filter((country) => !world || world.needsDot.has(country.code))
        .map((country) => ({
          country,
          point: project(country.lat, country.lon, view.lat, view.lon, RADIUS),
        }))
        .filter(({ point }) => point.visible),
    [visited, view, world],
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
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill={OCEAN} />

        {lines && (
          <g transform={`translate(${CENTRE} ${CENTRE})`}>
            {lines.map((path, index) => (
              <path key={index} d={path} fill="none" stroke="#CFCBE8" strokeWidth="1" />
            ))}
          </g>
        )}

        {/* Borders are the ocean colour rather than white: a white hairline
            between two greys reads as a crack, the sea colour reads as a
            coastline. */}
        {land && (
          <g stroke={OCEAN} strokeWidth="0.5" strokeLinejoin="round">
            {land.map((shape, index) => (
              <path key={shape.code ?? `x${index}`} d={shape.d} fill={shape.been ? BEEN : LAND}>
                {shape.been && shape.name && <title>{shape.name}</title>}
              </path>
            ))}
          </g>
        )}

        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" stroke={EDGE} strokeWidth="1.5" />

        <g transform={`translate(${CENTRE} ${CENTRE})`}>
          {dots.map(({ country, point }) => (
            <g key={country.code}>
              <circle cx={point.x} cy={point.y} r="4.5" fill="#FFFFFF" opacity="0.85" />
              <circle cx={point.x} cy={point.y} r="2.8" fill="#84CC16">
                <title>{country.name}</title>
              </circle>
            </g>
          ))}
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
