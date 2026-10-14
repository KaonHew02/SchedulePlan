import { useEffect, useState } from 'react'
import { isZh } from '../lib/i18n'
import pointsUrl from './points.json?url'
import type { Destination } from './seasons'

/*
 * Anywhere on the map, the way Google Maps finds it: a village, a waterfall,
 * a temple, a street. The places Seasons keeps itself (places.json) stop at
 * the 区县 and the town of 15,000 people; this asks OpenStreetMap for the
 * rest, when there is a connection and only when asked — its rules are one
 * question a second and none while typing — and puts what it finds on the
 * card it falls on: 金鸡峰丛 on 元阳罗平建水东川, 九份 on 台北与北部.
 *
 * What is typed goes to OpenStreetMap's server (nominatim.openstreetmap.org)
 * and nowhere else. Nothing is kept but the answers, in memory, so asking
 * the same thing twice does not ask twice.
 */

/** points.json, which scripts/places.mjs writes. */
interface Points {
  /** The cards, in the order of destinations.json. */
  cards: string[]
  /** Where each card's pin goes on the map. */
  pins: [number, number][]
  /** For a country with several cards, its towns: [lat, lon, card, nearest]. */
  towns: Record<string, [number, number, number, number][]>
}

let points: Points | null = null
let pointsLoading: Promise<Points> | null = null

export function loadPoints(): Promise<Points> {
  pointsLoading ??= fetch(pointsUrl).then(async (response) => {
    if (!response.ok) throw new Error(`points: ${response.status}`)
    return (points = (await response.json()) as Points)
  })
  pointsLoading.catch(() => {
    // Offline before the file was ever kept: let the next asker try again.
    pointsLoading = null
  })
  return pointsLoading
}

/** The pins and towns, once they are in; null before and if they could not be fetched. */
export function usePoints(wanted = true): Points | null {
  const [, setArrived] = useState(0)
  useEffect(() => {
    if (!wanted || points) return
    let live = true
    loadPoints()
      .then(() => live && setArrived((n) => n + 1))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [wanted])
  return points
}

/** Where a card's pin goes. */
export function pinOf(all: Points | null, id: string): [number, number] | null {
  const at = all?.cards.indexOf(id) ?? -1
  return all && at >= 0 ? all.pins[at] : null
}

/** A place OpenStreetMap knows. */
export interface MapPlace {
  key: string
  name: string
  /** 镇, 景点, 瀑布 — what sort of place, when OpenStreetMap says. */
  kind: string
  /** Where it is: 浙江省 · 嘉善县 in Chinese, Jiashan, Zhejiang, China in English. */
  address: string
  lat: number
  lon: number
  /** [south, north, west, east], to show all of a place that is an area. */
  bounds: [number, number, number, number] | null
  /** ISO code: HK and MO apart from CN, as Seasons has them. */
  country: string
  /** Every name in its address, for finding its 省, 市 and 区县 among the cards' places. */
  parts: string[]
}

/** As Nominatim's jsonv2 has one, the parts of it used here. */
interface Answer {
  osm_type: string
  osm_id: number
  name: string
  display_name: string
  lat: string
  lon: string
  category: string
  type: string
  addresstype: string
  boundingbox?: [string, string, string, string]
  address?: Record<string, string>
}

/** [English, 中文] for the kinds of place people look for. */
const KINDS: Record<string, [string, string]> = {
  city: ['City', '城市'],
  town: ['Town', '镇'],
  village: ['Village', '村'],
  hamlet: ['Village', '村'],
  suburb: ['Neighbourhood', '街区'],
  quarter: ['Neighbourhood', '街区'],
  neighbourhood: ['Neighbourhood', '街区'],
  borough: ['District', '区'],
  city_district: ['District', '区'],
  district: ['District', '区'],
  county: ['County', '县'],
  municipality: ['Municipality', '市镇'],
  state: ['State or province', '省 / 州'],
  province: ['Province', '省'],
  region: ['Region', '地区'],
  country: ['Country', '国家'],
  island: ['Island', '岛'],
  islet: ['Island', '岛'],
  archipelago: ['Islands', '群岛'],
  attraction: ['Sight', '景点'],
  viewpoint: ['Viewpoint', '观景台'],
  museum: ['Museum', '博物馆'],
  gallery: ['Gallery', '美术馆'],
  zoo: ['Zoo', '动物园'],
  theme_park: ['Theme park', '主题乐园'],
  aquarium: ['Aquarium', '水族馆'],
  waterfall: ['Waterfall', '瀑布'],
  peak: ['Mountain', '山峰'],
  volcano: ['Volcano', '火山'],
  mountain_range: ['Mountains', '山脉'],
  valley: ['Valley', '山谷'],
  cave_entrance: ['Cave', '洞穴'],
  beach: ['Beach', '海滩'],
  bay: ['Bay', '海湾'],
  lake: ['Lake', '湖'],
  water: ['Lake', '湖'],
  river: ['River', '河'],
  glacier: ['Glacier', '冰川'],
  nature_reserve: ['Nature reserve', '自然保护区'],
  national_park: ['National park', '国家公园'],
  protected_area: ['Protected area', '保护区'],
  park: ['Park', '公园'],
  garden: ['Garden', '花园'],
  place_of_worship: ['Temple or church', '寺庙 / 教堂'],
  monastery: ['Monastery', '寺院'],
  castle: ['Castle', '城堡'],
  ruins: ['Ruins', '遗址'],
  archaeological_site: ['Ancient site', '古迹'],
  monument: ['Monument', '纪念碑'],
  memorial: ['Memorial', '纪念地'],
  aerodrome: ['Airport', '机场'],
  station: ['Station', '车站'],
  ferry_terminal: ['Ferry', '码头'],
  hotel: ['Hotel', '酒店'],
  restaurant: ['Restaurant', '餐厅'],
  cafe: ['Café', '咖啡馆'],
  mall: ['Shopping', '商场'],
  marketplace: ['Market', '市场'],
  university: ['University', '大学'],
  hospital: ['Hospital', '医院'],
}

function kindOf(answer: Answer): string {
  const kind = KINDS[answer.type] ?? KINDS[answer.addresstype] ?? KINDS[answer.category]
  return kind ? (isZh() ? kind[1] : kind[0]) : ''
}

/** "伊利诺伊州;伊利諾州" is two names for one place; the first will do. */
const first = (value: string) => value.split(';')[0].trim()

/** The address in the order a reader expects: 浙江省 · 嘉善县, or Jiashan, Zhejiang, China. */
function addressOf(answer: Answer): string {
  const skip = /^(ISO3166|country_code|postcode|house_number)/
  const parts = Object.entries(answer.address ?? {})
    .filter(([key]) => !skip.test(key))
    .map(([, value]) => first(value))
    .filter((value, i, all) => value && value !== answer.name && all.indexOf(value) === i)
  return isZh() ? parts.reverse().join(' · ') : parts.join(', ')
}

function countryOf(answer: Answer): string {
  const address = answer.address ?? {}
  const code = (address.country_code ?? '').toUpperCase()
  const part = address['ISO3166-2-lvl3'] ?? address['ISO3166-2-lvl4'] ?? ''
  if (code === 'CN' && part === 'CN-HK') return 'HK'
  if (code === 'CN' && part === 'CN-MO') return 'MO'
  return code
}

const asked = new Map<string, MapPlace[]>()
let lastAsked = 0

/**
 * Ask OpenStreetMap. Answers come in the app's language where OpenStreetMap
 * has the name in it, as Google's do; a second question within the second
 * waits its turn.
 */
export async function searchMap(query: string): Promise<MapPlace[]> {
  const lang = isZh() ? 'zh-CN,zh,en' : 'en'
  const key = `${lang}\u0000${query}`
  const kept = asked.get(key)
  if (kept) return kept
  const wait = lastAsked + 1100 - Date.now()
  if (wait > 0) await new Promise((done) => setTimeout(done, wait))
  lastAsked = Date.now()
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    'accept-language': lang,
  }).toString()
  const response = await fetch(url)
  if (!response.ok) throw new Error(`OpenStreetMap: ${response.status}`)
  const answers = (await response.json()) as Answer[]
  const found = answers.map((answer) => ({
    key: `${answer.osm_type}${answer.osm_id}`,
    name: first(answer.name || answer.display_name.split(',')[0]),
    kind: kindOf(answer),
    address: addressOf(answer),
    lat: Number(answer.lat),
    lon: Number(answer.lon),
    bounds: answer.boundingbox ? (answer.boundingbox.map(Number) as [number, number, number, number]) : null,
    country: countryOf(answer),
    parts: Object.entries(answer.address ?? {})
      .filter(([key]) => !/^(ISO3166|country_code|postcode|house_number)/.test(key))
      .flatMap(([, value]) => value.split(';').map((name) => name.trim())),
  }))
  asked.set(key, found)
  return found
}

/** The card a place is on, and whether that card is only the nearest one. */
export interface OnCard {
  d: Destination
  near: boolean
}

/** As places.json's places come from seasons.ts: just what is needed here. */
interface Named {
  zh: string
  near: boolean
  context: boolean
  root: boolean
}

/**
 * Which card a place from OpenStreetMap is on.
 *
 * A country with one card is that card. In China the address says it: its
 * 省 picks the province's cards, and its 市 or 区县, looked up among the
 * cards' own places, picks between them — 小金县 is 川西高原 though 阿坝 is
 * 九寨沟. Anywhere else with several cards, it is the card of the nearest of
 * the towns places.mjs put on them, which is how the town itself would have
 * been filed. Null for a country Seasons has no card for.
 */
export function cardOf(
  place: MapPlace,
  all: Destination[],
  named: Map<string, Named[]> | null,
  where: Points | null,
): OnCard | null {
  // Svalbard is a country of its own to OpenStreetMap, and on the Arctic card here.
  if (place.country === 'SJ') {
    const arctic = all.find((d) => d.id === 'xx-arctic')
    return arctic ? { d: arctic, near: false } : null
  }
  const cards = all.filter((d) => d.countries.includes(place.country))
  if (cards.length === 0) return null
  if (cards.length === 1 && !where?.towns[place.country]) return { d: cards[0], near: false }

  if (place.country === 'CN' && named) {
    const nameOf = (p: Named) => p.zh.split('|')
    // The province first: the cards whose own 省 is in the address.
    const inProvince = cards.filter((d) => named.get(d.id)?.some((p) => p.root && nameOf(p).some((n) => place.parts.includes(n))))
    for (const part of place.parts) {
      for (const d of inProvince) {
        const hit = named.get(d.id)?.find((p) => !p.root && !p.context && nameOf(p).includes(part))
        if (hit) return { d, near: hit.near }
      }
    }
    if (inProvince.length === 1) return { d: inProvince[0], near: false }
  }

  const towns = where?.towns[place.country]
  if (!towns || !where) return cards.length === 1 ? { d: cards[0], near: false } : null
  // Near enough to flat for choosing the nearest town: longitude shrinks with latitude.
  const squeeze = Math.cos((place.lat * Math.PI) / 180)
  let best: [number, number, number, number] | null = null
  let bestDistance = Infinity
  for (const town of towns) {
    const distance = (town[0] - place.lat) ** 2 + ((town[1] - place.lon) * squeeze) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = town
    }
  }
  if (!best) return null
  const d = all.find((x) => x.id === where.cards[best[2]])
  return d ? { d, near: best[3] === 1 } : null
}

/** The spot on Google Maps, for directions, photos and opening hours. */
export const googleMapsUrl = (lat: number, lon: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`
