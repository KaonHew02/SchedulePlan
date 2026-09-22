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
 * one it is, tap one of the badges under it and the globe turns to face that
 * country and comes in close enough to see it. Clipping to the near side is d3's: the far half of a polygon is
 * cut at the horizon and closed along it, which is what stops Brazil being
 * drawn flat across the Pacific.
 *
 * Eighteen countries are too small for the 110m file to carry at all, and
 * Singapore is one of them. Those get a dot, because a globe that looks
 * untouched after a trip is worse than one with a mark in the wrong style.
 */

const SIZE = 268
/** Nearly the full width of the box. A circle leaves the corners free anyway. */
const RADIUS = 126
const CENTRE = SIZE / 2

/** Below 1 the globe would be smaller than its window; past 8 it is one country. */
const MIN_ZOOM = 1
const MAX_ZOOM = 8

/*
 * Neutral, not lavender, and the borders are dark enough to read.
 *
 * The first pass tinted everything toward the app's purple and drew the
 * borders in the ocean colour, on the reasoning that a white hairline between
 * two greys reads as a crack. It does — but so does no border at all, and the
 * result was a globe you could not pick a country out of. Dark lines on plain
 * grey is what a map looks like, and this is the one place in the app that is
 * a map rather than a screen.
 */
const OCEAN = '#EFEFF2'
const LAND = '#C6C6CC'
const BEEN = '#B7E764'
const BORDER = '#84848E'
const EDGE = '#C9C9D2'

/*
 * The country under the pointer, and it is meant to shout.
 *
 * Lighting one used to mean darkening it a single step — #C6C6CC to #ADADB6,
 * #B7E764 to #A3E635. That is a difference a colour picker can see and a
 * person leaning at a laptop cannot: K pointed at Malaysia and nothing on
 * screen moved. So the highlight is a different colour now rather than a
 * darker shade of the same one — purple for somewhere not visited, deep green
 * for somewhere visited, each with a heavier outline, and the shape is redrawn
 * last so no neighbour's border is laid back over it.
 */
const LAND_LIT = '#6C5CE7'
const BEEN_LIT = '#3F6212'
const LIT_BORDER = '#2E2C43'

const clamp = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/** How long the globe takes to turn to a country it was asked to show. */
const FLIGHT = 520

/**
 * As close as a flight will ever come in.
 *
 * Fitting a country exactly would put Singapore at 8x with nothing on screen
 * but Johor, and a country with no coastline in view is not a country you can
 * place. Stopping short leaves the neighbours in the frame, which is the
 * thing that says *where* rather than merely *which*.
 */
const CLOSE = 6

/**
 * The share of the window's radius the country is aimed to take up.
 *
 * The first pass filled it, and a country touching all four edges is a
 * country you cannot see the shape of. The quarter left over is where the
 * coastline and the neighbours go, and they are most of what tells you the
 * globe turned to the right place.
 */
const FILL = 0.78

/**
 * How far to zoom to hold a country of this angular radius.
 *
 * The window at zoom z shows a cap of angular radius asin(1/z). Give the
 * country a little more room than it needs and invert: z = 1/sin(r/FILL).
 * Past about 1.2 radians the cap is most of a hemisphere and the sine stops
 * being worth inverting, which is the cap on the argument.
 *
 * No radius means a country the map file does not carry — Singapore is one
 * of eighteen. Those stay a dot however far in you go, so they just go all
 * the way, and the neighbours do the work of saying where.
 */
const fitZoom = (radius: number | undefined): number =>
  radius === undefined
    ? CLOSE
    : Math.min(CLOSE, clamp(1 / Math.sin(Math.min(1.2, radius / FILL))))

/** Slow at both ends, quick through the middle — a turn, not a jump-cut. */
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Somebody who has asked not to be moved around is not moved around. The
 * query is read at the moment of the tap rather than subscribed to, because
 * the answer only matters for the half second a flight lasts.
 */
const stillPreferred = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const spread = (points: Iterable<{ x: number; y: number }>): number => {
  const [a, b] = [...points]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}

export default function Globe({
  codes,
  places = {},
  onPick,
}: {
  /** Country codes visited, most recent first. */
  codes: string[]
  /**
   * Distinct destinations in each country, by code.
   *
   * The rings above the globe count the whole world at once — fourteen
   * places, four countries — and that is the one number the globe cannot
   * show you, because it is not attached to anywhere. Which four, and how
   * much of the fourteen each one was, is the question a map is for.
   */
  places?: Record<string, number>
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

  /*
   * Turning the globe to face a country.
   *
   * A badge used to light its country and name it in the caption, and that is
   * no use at all when the country is round the back: you tapped SG, were
   * told Singapore, been there — and were shown the Atlantic. The globe has
   * to come round.
   *
   * Animated rather than set, because a sphere that cuts instantly from one
   * side of the world to the other says nothing about where the country is.
   * Half a second of turning does, and it is the reason the map is a globe.
   *
   * Turning alone was not enough either. At 1x the whole globe is 252px, so
   * SG came round to the middle and was still a 3px dot on a continent: K
   * tapped it, the map did something too small to notice, and the country
   * never appeared. So the flight closes in as well as turns.
   */
  const flight = useRef<number | null>(null)
  const stopFlight = () => {
    if (flight.current !== null) cancelAnimationFrame(flight.current)
    flight.current = null
  }
  useEffect(() => stopFlight, [])

  function flyTo(lat: number, lon: number, to: number) {
    stopFlight()
    const from = view
    const fromZoom = zoom
    // Longitudes wrap, so the way round is chosen rather than subtracted:
    // 170°E to 170°W is twenty degrees east, not three hundred and forty west.
    const turn = ((lon - from.lon + 540) % 360) - 180
    const rise = lat - from.lat
    // Zoom is a ratio, not a difference: 1→2 and 4→8 are the same amount of
    // closing in. It is also why the test for 'already there' had to grow a
    // third clause — tapping the country you are centred on used to return
    // here having done nothing at all, which was the whole complaint.
    const closer = to / fromZoom
    if (Math.abs(turn) < 0.5 && Math.abs(rise) < 0.5 && Math.abs(closer - 1) < 0.02) return
    if (stillPreferred()) {
      setView({ lat, lon })
      setZoom(to)
      return
    }
    /*
     * A long turn pulls back before it comes in again.
     *
     * Held at 6x across half a world, the near side is a grey blur going
     * past at speed and you arrive with no idea what you crossed. Lifting
     * out of the zoom mid-turn and settling back into it is how a map moves
     * between two cities, and it costs the same half second.
     */
    const lift = Math.min(1.1, Math.hypot(turn, rise) / 70)
    const started = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / FLIGHT)
      const e = ease(t)
      setView({ lat: from.lat + rise * e, lon: from.lon + turn * e })
      setZoom(clamp(fromZoom * closer ** e * Math.exp(-lift * Math.sin(Math.PI * e))))
      flight.current = t < 1 ? requestAnimationFrame(step) : null
    }
    flight.current = requestAnimationFrame(step)
  }

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
      .map((shape, index) => ({
        // Three shapes in the file have no code of their own, so the key
        // cannot be one. It is fixed here rather than at render time because
        // the list gets reordered to put the lit country on top.
        key: shape.code ?? `x${index}`,
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

  // Pointing wins over the last tap. The other way round, one click on the
  // map froze the highlight and nothing you pointed at afterwards lit up.
  const shown = hovered ?? picked
  const country = shown ? countryOf(shown) : undefined

  // SVG has no z-index: what is drawn last is on top. The lit country goes to
  // the end so its heavy outline is not half-covered by the countries next to
  // it, which are drawn after it in the file's own order.
  const ordered = useMemo(() => {
    if (!land) return null
    const lit = (shape: { code: string | null }) =>
      shape.code !== null && shape.code === shown ? 1 : 0
    return [...land].sort((a, b) => lit(a) - lit(b))
  }, [land, shown])

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[460px]">
        <svg
          ref={svg}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full cursor-grab touch-none select-none active:cursor-grabbing"
          role="img"
          aria-label={`Globe showing ${visited.length} countries visited`}
          onPointerDown={(event) => {
            // A hand on the globe outranks a turn it is in the middle of, or
            // the two would fight over the view for the rest of the flight.
            stopFlight()
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
                magnified half of the world spills across the whole card.

                Every group that uses this clips on the outside and moves on
                the inside, never both at once. An element's own transform
                applies to its clip path as well, so a group translated to the
                centre AND clipped to a circle at the centre gets clipped to a
                circle at (268, 268) — off the bottom-right corner of a 268
                viewBox, which keeps nothing at all. */}
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
            <g clipPath={`url(#${clip})`}>
              <g transform={`translate(${CENTRE} ${CENTRE})`}>
                {lines.map((path, index) => (
                  <path key={index} d={path} fill="none" stroke="#CFCBE8" strokeWidth="1" />
                ))}
              </g>
            </g>
          )}

          {/* The stroke width is NOT divided by zoom. The projection scale
              changes, the viewBox does not, so a user unit is a screen pixel
              at every zoom — dividing made the borders thinner the further in
              you went, which is backwards. */}
          {ordered && (
            <g strokeLinejoin="round" clipPath={`url(#${clip})`}>
              {ordered.map((shape) => {
                const lit = shape.code !== null && shape.code === shown
                return (
                  <path
                    key={shape.key}
                    d={shape.d}
                    fill={lit ? (shape.been ? BEEN_LIT : LAND_LIT) : shape.been ? BEEN : LAND}
                    stroke={lit ? LIT_BORDER : BORDER}
                    strokeWidth={lit ? 1.4 : 0.6}
                    onPointerEnter={() => shape.code && setHovered(shape.code)}
                    // Sliding off a coast into the sea should put the country
                    // out. Only the svg cleared the highlight before, so it
                    // stayed lit until the pointer left the globe altogether.
                    onPointerLeave={() =>
                      setHovered((was) => (was === shape.code ? null : was))
                    }
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

          <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" stroke={EDGE} strokeWidth="1" />

          {/*
            The countries with no outline, and for a long time with nothing
            else either.

            This group carried the transform and the clip together, so the
            clip landed off the corner of the viewBox and took every dot with
            it. Singapore was in the DOM the whole time — lit, at the exact
            centre of the globe, painted nowhere. Tapping SG turned the world
            to face it and showed an empty sea, which is the same complaint
            the flight was supposed to have answered.
          */}
          <g clipPath={`url(#${clip})`}>
            <g transform={`translate(${CENTRE} ${CENTRE})`}>
              {dots.map(({ country: place, point }) => {
                // Singapore has no outline to light, so its dot does the job:
                // same cue, the size a 2.8px mark can manage.
                const lit = place.code === shown
                return (
                  <g
                    key={place.code}
                    onPointerEnter={() => setHovered(place.code)}
                    onPointerLeave={() =>
                      setHovered((was) => (was === place.code ? null : was))
                    }
                    onClick={() => {
                      if (travelled.current) return
                      setPicked(place.code)
                      onPick?.(place.code)
                    }}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={lit ? 6.5 : 4.5}
                      fill="#FFFFFF"
                      opacity="0.85"
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={lit ? 4.2 : 2.8}
                      fill={lit ? BEEN_LIT : '#84CC16'}
                      stroke={lit ? LIT_BORDER : 'none'}
                      strokeWidth="1"
                    />
                  </g>
                )
              })}
            </g>
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
            {/* The country's own share of the destinations ring. Only where
                there is one to show: '· 0 places' under a country you have
                never been to is a line of text saying nothing. */}
            {(places[country.code] ?? 0) > 0 && (
              <span className="tabular-nums text-neutral-400">
                · {places[country.code]}{' '}
                {places[country.code] === 1 ? 'place' : 'places'}
              </span>
            )}
          </>
        ) : (
          <span className="text-neutral-400">
            {visited.length === 0 ? 'Nowhere marked yet' : 'Drag to spin, scroll to zoom'}
          </span>
        )}
      </div>

      {visited.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {visited.slice(0, 14).map((place) => {
            const count = places[place.code] ?? 0
            return (
              <button
                key={place.code}
                type="button"
                onClick={() => {
                  setPicked(place.code)
                  // The shape's own centre where there is a shape, the atlas
                  // point where there is not.
                  const frame = world?.frame.get(place.code)
                  flyTo(frame?.lat ?? place.lat, frame?.lon ?? place.lon, fitZoom(frame?.radius))
                  onPick?.(place.code)
                }}
                onPointerEnter={() => setHovered(place.code)}
                onPointerLeave={() => setHovered(null)}
                title={
                  count > 0
                    ? `${place.name} — ${count} ${count === 1 ? 'place' : 'places'}`
                    : `Show ${place.name} on the globe`
                }
                aria-pressed={picked === place.code}
                // The ring follows the tap, not the focus: a browser's own
                // outline goes the moment you click anywhere else, and which
                // country the globe is turned to outlives that by definition.
                className={`rounded-md transition-transform hover:scale-105 ${
                  picked === place.code ? 'ring-2 ring-brand-400 ring-offset-1' : ''
                }`}
              >
                {/* The tally, broken up. A row reading MY 3 · VN 2 · SG 1 is
                    the destinations ring with the answer to 'where' in it,
                    and it costs one character per country. */}
                <CountryBadge code={place.code} count={count > 0 ? count : undefined} />
              </button>
            )
          })}
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
