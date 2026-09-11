import type { Feature, Geometry } from 'geojson'
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
  geoOrthographic: (typeof import('d3-geo'))['geoOrthographic']
  geoPath: (typeof import('d3-geo'))['geoPath']
}

/** Below this many steradians a country is a pixel or two at globe size. */
const TOO_SMALL = 3e-4

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
  for (const country of COUNTRIES) {
    const shape = drawn.get(country.code)
    if (!shape || d3.geoArea(shape) < TOO_SMALL) needsDot.add(country.code)
  }

  return { shapes, needsDot, geoOrthographic: d3.geoOrthographic, geoPath: d3.geoPath }
}
