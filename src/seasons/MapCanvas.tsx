import { MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import { tr, useLang, type Lang } from '../lib/i18n'
import './map.css'

/*
 * A map you can drag and pinch, with every road, village and hill on it, its
 * names in the app's language: 曼谷, 清迈, 大阪 in Chinese wherever the map has
 * a Chinese name, Bangkok and Osaka in English. OpenStreetMap's data, cut
 * into tiles by OpenFreeMap (free, no key) and drawn on the phone by
 * MapLibre — which is what lets the names be chosen, where a map that comes
 * as pictures has the local names painted in.
 *
 * Loaded only when a map is first shown. The tiles come from OpenFreeMap each
 * time; the offline copy does not keep them.
 */

// The worker that cuts the tiles up, bundled by Vite into a file of its own
// on this site — the page's security policy runs workers from here only.
setWorkerUrl(workerUrl)

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

/**
 * Which name a label shows. Chinese: 简体 first, then any Chinese, and where
 * the map has none, the English — a village in Thailand in Thai script helps
 * nobody who reads Chinese. English: the English name, then the name in
 * Latin letters the tiles carry for every place, then the local one.
 */
const NAMES: Record<Lang, unknown[]> = {
  zh: [
    'coalesce',
    ['get', 'name:zh-Hans'],
    ['get', 'name:zh'],
    ['get', 'name:zh-Hant'],
    ['get', 'name:en'],
    ['get', 'name:latin'],
    ['get', 'name'],
  ],
  en: ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']],
}

/**
 * Every label of the map's own that is a name — not a road number or a house
 * number. (`as never`: MapLibre does not export the type of an expression.)
 */
function relabel(map: MapLibreMap, lang: Lang) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const field = map.getLayoutProperty(layer.id, 'text-field')
    if (field && JSON.stringify(field).includes('"name')) map.setLayoutProperty(layer.id, 'text-field', NAMES[lang] as never)
  }
}

export interface MapPin {
  key: string
  lat: number
  lon: number
  label: string
  /** The rating's colours, as RATING_TINT has them. */
  tint: string
  onClick?: () => void
}

interface Props {
  pins?: MapPin[]
  /** [[south, west], [north, east]] to show all of. */
  bounds?: [[number, number], [number, number]]
  center?: [number, number]
  /** As Google counts it: 7 is a province, 14 a few streets. */
  zoom?: number
  /** The one spot this map is about: a red dot. */
  spot?: [number, number]
  className?: string
}

/** Under this zoom the cards' names are left off their pins: a continent's would sit on top of each other. */
const NAMES_FROM = 4

/*
 * MapLibre's zoom is one less than Google's for the same view (its tiles are
 * twice the size), so the zooms given here, Google's, are turned into it.
 */
const fromGoogle = (zoom: number) => zoom - 1

function pinElement(pin: MapPin): HTMLElement {
  const element = document.createElement('div')
  element.className = 'seasons-marker'
  const dot = document.createElement('span')
  dot.className = `seasons-dot ${pin.tint}`
  const label = document.createElement('span')
  label.className = 'seasons-label'
  label.textContent = pin.label
  element.append(dot, label)
  element.title = pin.label
  if (pin.onClick) {
    element.style.cursor = 'pointer'
    element.addEventListener('click', (event) => {
      event.stopPropagation()
      pin.onClick?.()
    })
  }
  return element
}

export default function MapCanvas({ pins = [], bounds, center, zoom = 7, spot, className = '' }: Props) {
  const lang = useLang()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markers = useRef<Marker[]>([])
  const langNow = useRef(lang)
  langNow.current = lang
  // Whether the map's style is in, so its labels can be changed. Not
  // isStyleLoaded(): that is false while any tile is still on its way.
  const styled = useRef(false)

  useEffect(() => {
    if (!box.current) return
    const here = new MapLibreMap({
      container: box.current,
      style: STYLE,
      center: [105, 22],
      zoom: 1,
      // Chinese, Japanese and Korean are drawn with the phone's own fonts
      // rather than fetched: the map's fonts have only the Latin letters.
      localIdeographFontFamily: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
      attributionControl: { compact: true },
      // A map to look around, not to tilt: two fingers zoom, and do not turn it.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    here.touchZoomRotate.disableRotation()
    here.addControl(new NavigationControl({ showCompass: false }), 'top-left')
    here.on('style.load', () => {
      styled.current = true
      relabel(here, langNow.current)
    })
    // The credit shows when the map has drawn, then folds into its ⓘ five
    // seconds later, as OpenStreetMap's attribution guidelines allow on a
    // phone: open, it covers a good part of a map in a sheet.
    let fold: ReturnType<typeof setTimeout> | undefined
    here.once('load', () => {
      fold = setTimeout(() => {
        box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      }, 5000)
    })
    here.once('remove', () => clearTimeout(fold))
    const names = () => box.current?.classList.toggle('seasons-far', here.getZoom() < NAMES_FROM)
    here.on('zoom', names)
    names()
    map.current = here
    return () => {
      here.remove()
      map.current = null
      styled.current = false
    }
  }, [])

  // The app's language changed while the map was open.
  useEffect(() => {
    const here = map.current
    if (here && styled.current) relabel(here, lang)
  }, [lang])

  // Where the map looks: redone only when what it should show changes, not
  // on every draw, so a map someone has dragged stays where they left it.
  const view = JSON.stringify({ bounds, center, zoom })
  useEffect(() => {
    const here = map.current
    if (!here) return
    if (bounds) {
      here.fitBounds(
        [
          [bounds[0][1], bounds[0][0]],
          [bounds[1][1], bounds[1][0]],
        ],
        { padding: 24, maxZoom: fromGoogle(13), animate: false },
      )
    } else if (center) here.jumpTo({ center: [center[1], center[0]], zoom: fromGoogle(zoom) })
    box.current?.classList.toggle('seasons-far', here.getZoom() < NAMES_FROM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // The pins, redrawn when what they show changes — not because a sheet
  // passed a new array with the same pins in it.
  const pinsNow = useRef(pins)
  pinsNow.current = pins
  const drawn = JSON.stringify([pins.map((p) => [p.key, p.lat, p.lon, p.label, p.tint]), spot])
  useEffect(() => {
    const here = map.current
    if (!here) return
    for (const marker of markers.current) marker.remove()
    markers.current = pinsNow.current.map((pin) =>
      new Marker({ element: pinElement(pin) }).setLngLat([pin.lon, pin.lat]).addTo(here),
    )
    if (spot) {
      const element = document.createElement('div')
      element.className = 'seasons-spot'
      markers.current.push(new Marker({ element }).setLngLat([spot[1], spot[0]]).addTo(here))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn])

  return (
    // isolate: the map's own buttons are stacked high, and would otherwise
    // draw over the sticky header and the app's sheets.
    <div className={`relative isolate overflow-hidden rounded-2xl bg-neutral-100 ${className}`}>
      {/* h-full, not absolute: MapLibre makes its box position: relative. */}
      <div ref={box} className="h-full w-full" />
      {!navigator.onLine && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-[13px] text-neutral-500">
          {tr('The map needs an internet connection.', '地图要联网才看得到。')}
        </p>
      )}
    </div>
  )
}
