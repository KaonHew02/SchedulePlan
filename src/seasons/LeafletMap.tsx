import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { tr } from '../lib/i18n'
import './map.css'

/*
 * A map you can drag and pinch, with every road, village and hill on it —
 * OpenStreetMap's, drawn by Leaflet. Loaded only when a map is first shown,
 * so the rest of the app is not kept waiting for it, and the tiles come from
 * OpenStreetMap each time (the offline copy does not keep them; there are far
 * too many, and OpenStreetMap asks that they not be copied).
 */

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
  zoom?: number
  /** The one spot this map is about: a red dot. */
  spot?: [number, number]
  className?: string
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Under this zoom the names are left off the pins: the whole world's would sit on top of each other. */
const NAMES_FROM = 5

export default function LeafletMap({ pins = [], bounds, center, zoom = 7, spot, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!box.current) return
    const here = L.map(box.current, { worldCopyJump: true, zoomSnap: 0.5 })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(here)
    layer.current = L.layerGroup().addTo(here)
    const names = () => box.current?.classList.toggle('seasons-far', here.getZoom() < NAMES_FROM)
    here.on('zoomend', names)
    map.current = here
    return () => {
      here.remove()
      map.current = null
    }
  }, [])

  // Where the map looks: redone only when what it should show changes, not
  // on every draw, so a map someone has dragged stays where they left it.
  const view = JSON.stringify({ bounds, center, zoom })
  useEffect(() => {
    const here = map.current
    if (!here) return
    if (bounds) here.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 })
    else if (center) here.setView(center, zoom)
    else here.setView([20, 100], 2)
    box.current?.classList.toggle('seasons-far', here.getZoom() < NAMES_FROM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    for (const pin of pins) {
      const icon = L.divIcon({
        className: 'seasons-marker',
        html: `<span class="seasons-dot ${pin.tint}"></span><span class="seasons-label">${escape(pin.label)}</span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      const marker = L.marker([pin.lat, pin.lon], { icon, title: pin.label, keyboard: true })
      if (pin.onClick) marker.on('click', pin.onClick)
      marker.addTo(group)
    }
    if (spot) {
      L.marker(spot, {
        icon: L.divIcon({ className: 'seasons-marker', html: '<span class="seasons-spot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
      }).addTo(group)
    }
  }, [pins, spot])

  return (
    // isolate: Leaflet stacks its tiles and buttons up to z-index 1000, which
    // would otherwise draw them over the sticky header and the app's sheets.
    <div className={`relative isolate overflow-hidden rounded-2xl bg-neutral-100 ${className}`}>
      <div ref={box} className="absolute inset-0" />
      {!navigator.onLine && (
        <p className="absolute inset-x-0 top-1/2 z-[500] -translate-y-1/2 px-6 text-center text-[13px] text-neutral-500">
          {tr('The map needs an internet connection.', '地图要联网才看得到。')}
        </p>
      )}
    </div>
  )
}
