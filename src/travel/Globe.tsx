import { useEffect, useId, useMemo, useRef, useState } from 'react'
import CountryBadge from '../components/CountryBadge'
import Flag from '../components/Flag'
import { Plus } from '../components/Icons'
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
 * Drag to spin, wheel or pinch to zoom, point at a country to be told which
 * one it is. Clipping to the near side is d3's: the far half of a polygon is
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

/** Below 1 the globe would be smaller than its window; past 8 it is one country. */
const MIN_ZOOM = 1
const MAX_ZOOM = 8

const OCEAN = '#F1F0FA'
const LAND = '#CBC7DD'
const LAND_HOVER = '#B4AECB'
const BEEN = '#A3E635'
const BEEN_HOVER = '#8FD119'
const EDGE = '#B8B2DE'

const clamp = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

const spread = (points: Iterable<{ x: number; y: number }>): number => {
  const [a, b] = [...points]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}

export default function Globe({
  codes,
  onPick,
}: {
  /** Country codes visited, most recent first. */
  codes: string[]
  onPick?: (code: string) => void
}) {
  const clip = useId().replace(/:/g, '')

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
  const [zoom, setZoom] = useState(1)

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

  const svg = useRef<SVGSVGElement>(null)

  // Wheel has to be bound by hand: React's is passive, so it cannot stop the
  // page scrolling underneath a globe somebody is zooming.
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setZoom((was) => clamp(was * Math.exp(-event.deltaY * 0.0015)))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  /** Live pointers, so two fingers can be told from one. */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { kind: 'spin'; x: number; y: number; lat: number; lon: number }
    | { kind: 'pinch'; gap: number; zoom: number }
    | null
  >(null)
  /** Set once the pointer travels: a drag that ends on a country is not a tap. */
  const travelled = useRef(false)

  const [hovered, setHovered] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)

  const been = useMemo(() => new Set(codes), [codes])
  const scale = RADIUS * zoom

  const land = useMemo(() => {
    if (!world) return null
    const projection = world
      .geoOrthographic()
      .translate([CENTRE, CENTRE])
      .scale(scale)
      .rotate([-view.lon, -view.lat])
    const draw = world.geoPath(projection)
    return world.shapes
      .map((shape) => ({
        code: shape.code,
        been: shape.code !== null && been.has(shape.code),
        d: draw(shape.feature) ?? '',
      }))
      .filter((shape) => shape.d)
  }, [world, view, scale, been])

  // The wireframe: what is on screen until the map arrives, and what stays
  // there if it never does.
  const lines = useMemo(
    () => (world ? null : graticule(view.lat, view.lon, scale)),
    [world, view, scale],
  )

  const dots = useMemo(
    () =>
      visited
        .filter((country) => !world || world.needsDot.has(country.code))
        .map((country) => ({
          country,
          point: project(country.lat, country.lon, view.lat, view.lon, scale),
        }))
        .filter(({ point }) => point.visible),
    [visited, view, scale, world],
  )

  const shown = picked ?? hovered
  const country = shown ? countryOf(shown) : undefined

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[340px]">
        <svg
          ref={svg}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full cursor-grab touch-none select-none active:cursor-grabbing"
          role="img"
          aria-label={`Globe showing ${visited.length} countries visited`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            travelled.current = false
            gesture.current =
              pointers.current.size >= 2
                ? { kind: 'pinch', gap: spread(pointers.current.values()), zoom }
                : { kind: 'spin', x: event.clientX, y: event.clientY, ...view }
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            const from = gesture.current
            if (!from) return

            if (from.kind === 'pinch') {
              const gap = spread(pointers.current.values())
              if (from.gap > 0 && gap > 0) setZoom(clamp((from.zoom * gap) / from.gap))
              travelled.current = true
              return
            }

            const dx = event.clientX - from.x
            const dy = event.clientY - from.y
            if (Math.hypot(dx, dy) > 3) travelled.current = true
            // Spinning slows down as you zoom in, or one flick at 8x throws
            // the country you were looking at round the back.
            const speed = 0.45 / zoom
            setView({
              lon: from.lon - dx * speed,
              lat: Math.max(-75, Math.min(75, from.lat + dy * speed)),
            })
          }}
          onPointerUp={(event) => {
            pointers.current.delete(event.pointerId)
            gesture.current = null
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId)
            gesture.current = null
          }}
          onPointerLeave={() => setHovered(null)}
        >
          <defs>
            {/* Zoom makes the sphere bigger, not the window. Without this the
                magnified half of the world spills across the whole card. */}
            <clipPath id={clip}>
              <circle cx={CENTRE} cy={CENTRE} r={RADIUS} />
            </clipPath>
          </defs>

          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RADIUS}
            fill={OCEAN}
            onClick={() => !travelled.current && setPicked(null)}
          />

          {lines && (
            <g transform={`translate(${CENTRE} ${CENTRE})`} clipPath={`url(#${clip})`}>
              {lines.map((path, index) => (
                <path key={index} d={path} fill="none" stroke="#CFCBE8" strokeWidth="1" />
              ))}
            </g>
          )}

          {/* Borders are the ocean colour rather than white: a white hairline
              between two greys reads as a crack, the sea colour reads as a
              coastline. */}
          {land && (
            <g stroke={OCEAN} strokeWidth={0.5 / zoom} strokeLinejoin="round" clipPath={`url(#${clip})`}>
              {land.map((shape, index) => {
                const lit = shape.code !== null && shape.code === shown
                return (
                  <path
                    key={shape.code ?? `x${index}`}
                    d={shape.d}
                    fill={
                      shape.been ? (lit ? BEEN_HOVER : BEEN) : lit ? LAND_HOVER : LAND
                    }
                    onPointerEnter={() => shape.code && setHovered(shape.code)}
                    onClick={() => {
                      if (travelled.current || !shape.code) return
                      setPicked(shape.code)
                      if (shape.been) onPick?.(shape.code)
                    }}
                  />
                )
              })}
            </g>
          )}

          <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" stroke={EDGE} strokeWidth="1.5" />

          <g transform={`translate(${CENTRE} ${CENTRE})`} clipPath={`url(#${clip})`}>
            {dots.map(({ country: place, point }) => (
              <g
                key={place.code}
                onPointerEnter={() => setHovered(place.code)}
                onClick={() => {
                  if (travelled.current) return
                  setPicked(place.code)
                  onPick?.(place.code)
                }}
              >
                <circle cx={point.x} cy={point.y} r="4.5" fill="#FFFFFF" opacity="0.85" />
                <circle cx={point.x} cy={point.y} r="2.8" fill="#84CC16" />
              </g>
            ))}
          </g>
        </svg>

        <div className="absolute right-0 top-0 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoom((was) => clamp(was * 1.4))}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((was) => clamp(was / 1.4))}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:opacity-30"
          >
            <span className="block h-[1.5px] w-3 rounded-full bg-current" />
          </button>
        </div>
      </div>

      {/*
        Fixed height, not a line that appears. The globe sits above a list, and
        a caption that pops in and out as the pointer crosses a coastline
        would nudge everything under it by a row.
      */}
      <div className="mt-2 flex h-6 items-center justify-center gap-2 text-center text-[12px]">
        {country ? (
          <>
            <Flag code={country.code} className="h-[13px] w-[19px]" />
            <span className="font-medium text-neutral-700">{country.name}</span>
            <span className={been.has(country.code) ? 'text-lime-600' : 'text-neutral-400'}>
              {been.has(country.code) ? '· been there' : '· not yet'}
            </span>
          </>
        ) : (
          <span className="text-neutral-400">
            {visited.length === 0 ? 'Nowhere marked yet' : 'Drag to spin, scroll to zoom'}
          </span>
        )}
      </div>

      {visited.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {visited.slice(0, 14).map((place) => (
            <button
              key={place.code}
              type="button"
              onClick={() => {
                setPicked(place.code)
                onPick?.(place.code)
              }}
              onPointerEnter={() => setHovered(place.code)}
              onPointerLeave={() => setHovered(null)}
              title={place.name}
              className="rounded-full transition-transform hover:scale-105"
            >
              <CountryBadge code={place.code} />
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
