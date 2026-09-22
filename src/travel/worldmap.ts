import type { Feature, Geometry, MultiPolygon } from 'geojson'
import { COUNTRIES, alpha2Of } from '../lib/places'

/**
 * The world map, fetched the first time the Travel screen asks for it.
 *
 * The globe used to be a wireframe on purpose: border geometry is the largest
 * thing that could go in this bundle, and a dot at a country's centroid says
 * "been there" perfectly well. K wanted the countries filled in, so this is
 * the cost of that, paid in the one place it buys anything.
 *
 * Nothing here is in the main bundle. d3-geo, the topology reader and the
 * 108KB of coastline are all behind dynamic imports, and the map file is
 * emitted as its own asset rather than inlined — so Schedule, the screen
 * that actually gets opened every day, loads exactly as fast as it did.
 *
 * 110m resolution, which is the coarsest of the three world-atlas files. At
 * 268px across, a sharper one would spend a megabyte drawing fjords two
 * thirds of a pixel wide.
 */

export interface CountryShape {
  /** Null for the three shapes in the file with no ISO code of their own. */
  code: string | null
  feature: Feature<Geometry>
}

export interface WorldMap {
  shapes: CountryShape[]
  /**
   * Countries a filled outline cannot show: the eighteen too small to be in
   * the file at all — Singapore, Bahrain, Malta, Maldives — and the handful
   * that are in it but come out a pixel wide. They get a dot instead, or a
   * trip to Singapore would leave the globe looking untouched.
   */
  needsDot: Set<string>
  /**
   * Where to aim the globe at each country, and how much sky it takes up.
   *
   * `places.ts` has a latitude and longitude per country already, but they
   * are the ones an atlas prints — a point inside the country, chosen to
   * hang a label off. Malaysia's is in Borneo, and pointing the globe there
   * puts the peninsula off the left edge. This is the shape's own centroid
   * and the angular radius of a circle round it that holds all of it, both
   * read off the geometry, so a country arrives centred and whole however
   * oddly it is strung out.
   */
  frame: Map<string, { lat: number; lon: number; radius: number }>
  geoOrthographic: (typeof import('d3-geo'))['geoOrthographic']
  geoPath: (typeof import('d3-geo'))['geoPath']
}

/** Below this many steradians a country is a pixel or two at globe size. */
const TOO_SMALL = 3e-4

/**
 * The share of a country's area a piece must carry to count as part of it
 * for framing.
 *
 * The map file gives one shape per country, territories and all. France is
 * therefore France and French Guiana, and a box round both is four thousand
 * miles wide — ask the globe to show France and it zooms to fit the Atlantic.
 * The United States is the same story with Alaska and Hawaii.
 *
 * So the framing looks at the pieces and keeps the ones that are a fifth of
 * the country or more. Guiana is a tenth of France and goes; Alaska is a
 * sixth of the United States and goes; Malaysia's two halves are forty and
 * sixty per cent and both stay, which is the case that stops this being a
 * rule about mainlands. A country whose pieces are all small — an
 * archipelago — keeps all of them, because there is no main body to find.
 */
const MAIN_SHARE = 0.2

/**
 * A country without its far-flung minor parts, for measuring only.
 *
 * Nothing here reaches the screen: the shape that gets drawn is always the
 * whole country, territories included. This is the shape the globe is aimed
 * at and zoomed to, which is a different question from what is painted.
 */
function mainBody(d3: typeof import('d3-geo'), feature: Feature<Geometry>): Feature<Geometry> {
  if (feature.geometry.type !== 'MultiPolygon') return feature
  const parts = (feature.geometry as MultiPolygon).coordinates.map((coordinates) => ({
    coordinates,
    area: d3.geoArea({ type: 'Polygon', coordinates }),
  }))
  const total = parts.reduce((sum, part) => sum + part.area, 0)
  const kept = total > 0 ? parts.filter((part) => part.area / total >= MAIN_SHARE) : []
  if (kept.length === 0 || kept.length === parts.length) return feature
  return {
    type: 'Feature',
    properties: null,
    geometry: { type: 'MultiPolygon', coordinates: kept.map((part) => part.coordinates) },
  }
}

let pending: Promise<WorldMap> | null = null

/** Load once per session; every later call gets the same promise. */
export function loadWorldMap(): Promise<WorldMap> {
  if (!pending) pending = build()
  return pending
}

async function build(): Promise<WorldMap> {
  const [d3, topo, asset] = await Promise.all([
    import('d3-geo'),
    import('topojson-client'),
    import('world-atlas/countries-110m.json?url'),
  ])

  const response = await fetch(asset.default)
  if (!response.ok) throw new Error(`The map file came back ${response.status}.`)

  // The topology's own types are stricter than anything here needs; what
  // matters is that `feature()` hands back one Feature per country, each
  // carrying the ISO numeric id that `alpha2Of` translates.
  const topology = (await response.json()) as Parameters<typeof topo.feature>[0]
  const collection = topo.feature(topology, topology.objects.countries) as unknown as {
    features: (Feature<Geometry> & { id?: string | number })[]
  }

  const shapes: CountryShape[] = collection.features.map((feature) => ({
    code: alpha2Of(feature.id) ?? null,
    feature,
  }))

  const drawn = new Map<string, Feature<Geometry>>()
  for (const shape of shapes) if (shape.code) drawn.set(shape.code, shape.feature)

  const needsDot = new Set<string>()
  const frame = new Map<string, { lat: number; lon: number; radius: number }>()
  for (const country of COUNTRIES) {
    const shape = drawn.get(country.code)
    if (!shape) {
      needsDot.add(country.code)
      continue
    }
    if (d3.geoArea(shape) < TOO_SMALL) needsDot.add(country.code)

    const body = mainBody(d3, shape)
    const [lon, lat] = d3.geoCentroid(body)
    const [[west, south], [east, north]] = d3.geoBounds(body)
    // A country straddling the antimeridian comes back with its east edge
    // numerically behind its west one. Wrapping rather than subtracting is
    // the difference between Fiji covering four degrees and 356 of them —
    // and a full turn has to be spelt out, or Antarctica wraps to nothing.
    const span = east - west
    const wide = Math.abs(span) >= 360 ? 360 : ((span % 360) + 360) % 360
    const tall = north - south
    // Degrees of longitude shrink away from the equator; degrees of latitude
    // do not. Without the cosine, Norway is asked for a window twice as wide
    // as it needs and arrives as a speck.
    const squeeze = Math.cos((lat * Math.PI) / 180)
    const radius = (Math.hypot(tall / 2, (wide / 2) * squeeze) * Math.PI) / 180
    frame.set(country.code, { lat, lon, radius })
  }

  return { shapes, needsDot, frame, geoOrthographic: d3.geoOrthographic, geoPath: d3.geoPath }
}
