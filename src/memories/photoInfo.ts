import { isZh } from '../lib/i18n'
import { toISO } from '../lib/date'

/** What a photo says about itself: the day it was taken and, sometimes, where. */
export interface PhotoInfo {
  date: string | null
  lat: number | null
  lon: number | null
}

const NOTHING: PhotoInfo = { date: null, lat: null, lon: null }

/**
 * Read the date and the place out of a photo's EXIF, before it is shrunk:
 * the re-encode in `compressImage` keeps the picture and drops the metadata.
 *
 * exifr is loaded only when a photo is added, so the main bundle does not
 * carry it. Anything it cannot read is simply nothing — a photo with no date
 * is still a photo. An iPhone's photo picker often leaves the place out unless
 * it is told to keep it, so the place is a bonus, never something to count on.
 */
export async function readPhotoInfo(file: File): Promise<PhotoInfo> {
  try {
    const exifr = (await import('exifr')).default
    const [gps, tags] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
    ])
    const taken = (tags?.DateTimeOriginal ?? tags?.CreateDate) as unknown
    const date = taken instanceof Date && !Number.isNaN(taken.getTime()) ? toISO(taken) : null
    const lat = gps && Number.isFinite(gps.latitude) && Math.abs(gps.latitude) <= 90 ? gps.latitude : null
    const lon = gps && Number.isFinite(gps.longitude) && Math.abs(gps.longitude) <= 180 ? gps.longitude : null
    // 0,0 is the sea off Africa, and a camera with no fix writes exactly that.
    const point = lat !== null && lon !== null && !(lat === 0 && lon === 0)
    return { date, lat: point ? lat : null, lon: point ? lon : null }
  } catch {
    return NOTHING
  }
}

/**
 * The name of the place at a point, and its country, from OpenStreetMap — the
 * same service Seasons searches, already allowed by the page's security
 * policy. One question per photo that has a place at most; null when it cannot
 * say, and the point is kept regardless.
 */
export async function placeAt(lat: number, lon: number): Promise<{ name: string; country: string | null } | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      zoom: '14',
      'accept-language': isZh() ? 'zh-CN,zh,en' : 'en',
    }).toString()
    const response = await fetch(url)
    if (!response.ok) return null
    const answer = (await response.json()) as {
      name?: string
      display_name?: string
      address?: Record<string, string>
    }
    const address = answer.address ?? {}
    const name =
      answer.name ||
      address.suburb ||
      address.neighbourhood ||
      address.village ||
      address.town ||
      address.city ||
      address.county ||
      (answer.display_name ?? '').split(',')[0] ||
      ''
    const code = (address.country_code ?? '').toUpperCase()
    return { name: name.trim(), country: /^[A-Z]{2}$/.test(code) ? code : null }
  } catch {
    return null
  }
}
