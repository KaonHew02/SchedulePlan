import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Segmented, Toggle } from '../components/FormFields'
import { ChevronLeft, ChevronRight, GlobeIcon, PinIcon, PlaneIcon } from '../components/Icons'
import { isZh, tr } from '../lib/i18n'
import DestinationSheet from './DestinationSheet'
import type { MapPin } from './MapCanvas'
import PlaceSheet from './PlaceSheet'
import { cardOf, loadPoints, pinOf, searchMap, usePoints, type MapPlace, type OnCard } from './where'
import {
  AREAS,
  EVENT_YEARS,
  FLIGHTS,
  RATING_TINT,
  areaName,
  countryIsArea,
  eventsIn,
  firstOf,
  foundOn,
  highlightMonths,
  homeName,
  joinList,
  monthLabel,
  nameOf,
  noChange,
  ratingLabel,
  reachLabel,
  reachOf,
  seasonsOf,
  spanIn,
  spanLabel,
  termsLeft,
  townsOf,
  usePlaces,
  useRuleDates,
  useSeasons,
  type Destination,
  type Found,
  type YearEvent,
} from './seasons'

/**
 * Seasons — 全球旅行月历. Where to go in which month, for 242 places.
 *
 * Two ways in, because there are two questions. "It is October, where is
 * good?" is the month view: everything at its best or good that month,
 * grouped by part of the world, with what is happening there. "When should I
 * go to Hokkaido?" is the year view: every destination as a row of twelve
 * colours, read across. And "what is near 罗平?" is the map: every card as a
 * pin in the colour of the month, on a map that zooms down to the village.
 *
 * The search finds the cards' own words, then every 省, 市 and 区县 and town
 * Seasons keeps (places.json), and when asked, anywhere at all on
 * OpenStreetMap — a waterfall, a temple — with the card it falls on.
 *
 * The year at the top is the year the dates are for. The weather does not
 * change with it; Chinese New Year, Ramadan, Easter and a year's one-off
 * events do, and those are worked out for it (see seasons.ts) — which is why
 * nothing has to be edited when the year turns.
 *
 * Both languages, like the rest of the app. The places themselves come in
 * the app's language from useSeasons; the screen's own words are here.
 */

type View = 'month' | 'year' | 'map'

/**
 * Flights from home. 直飞 is everywhere got to without changing planes: a
 * flight straight there, one that stops on the way, one a train ride short of
 * it — each card says which — and the places a drive from home.
 */
type Flight = 'all' | 'direct' | 'connect'

/** What there is before the data arrives — one array, so the memos hold still. */
const NO_DESTINATIONS: Destination[] = []

// Functions rather than lists, so they are read in the language of the moment.
const views = (): { value: View; label: string }[] => [
  { value: 'month', label: tr('Where this month', '这个月去哪') },
  { value: 'year', label: tr('Whole year', '全年日历') },
  { value: 'map', label: tr('Map', '地图') },
]

const MapCanvas = lazy(() => import('./MapCanvas'))

/** An OpenStreetMap search, and what came back. */
type MapSearch = { query: string; status: 'looking' | 'done' | 'failed'; places: MapPlace[] }

const flightChoices = (): { value: Flight; label: string }[] => [
  { value: 'all', label: tr('All', '全部') },
  { value: 'direct', label: tr('Direct', '直飞') },
  { value: 'connect', label: tr('Connecting', '要转机') },
]

/** The area chip that is every area — a key no real area can have. */
const ALL = 'all'

const fits = (d: Destination, flight: Flight) => flight === 'all' || noChange(d) === (flight === 'direct')

/** 2026-10 as October 2026, for the English footnotes. */
const monthYear = (yyyyMm: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${yyyyMm}-01T00:00:00`))

/*
 * What was on screen, kept for the next time the tab is opened. Switching to
 * Schedule to check a date and back again should land on the same month, not
 * on today with the search cleared. Not saved anywhere: it is a place in a
 * book, not part of the notebook, and a new day starts on today.
 *
 * Only the starting point is taken when the app opens. "Today" itself is read
 * fresh on every draw, so an app left open over New Year rings the right month.
 */
const opened = new Date()
const kept = {
  year: opened.getFullYear(),
  month: opened.getMonth() + 1,
  view: 'month' as View,
  area: ALL,
  query: '',
  flight: 'all' as Flight,
  onlyBest: false,
}

function YearStepper({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const thisYear = new Date().getFullYear()
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-neutral-100 p-0.5">
      <button
        onClick={() => onChange(year - 1)}
        disabled={year <= thisYear - 1}
        aria-label={tr('Previous year', '上一年')}
        className="rounded-full p-1.5 text-neutral-500 disabled:text-neutral-300"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange(thisYear)}
        title={tr('Back to this year', '回到今年')}
        className="min-w-[3.5rem] text-center text-[14px] font-semibold tabular-nums"
      >
        {year}
      </button>
      <button
        onClick={() => onChange(year + 1)}
        disabled={year >= thisYear + 10}
        aria-label={tr('Next year', '下一年')}
        className="rounded-full p-1.5 text-neutral-500 disabled:text-neutral-300"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Twelve tiny cells, one per month, coloured by rating — the year at a glance. */
function Strip({ ratings, month }: { ratings: number[]; month: number }) {
  return (
    <span className="grid grid-cols-12 gap-[3px]" aria-hidden="true">
      {ratings.map((r, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full ${RATING_TINT[r]} ${i + 1 === month ? 'outline-2 outline-offset-1 outline-neutral-900' : ''}`}
        />
      ))}
    </span>
  )
}

/**
 * Under the name: its 地方 — 三亚、海口、万宁 under 海南 — after the country
 * where the heading does not already say it (日本 · 札幌、小樽). Somewhere that
 * is one town, Singapore or 北京, shows its first few sights instead.
 */
function subtitle(d: Destination): string {
  const towns = townsOf(d)
  const where = joinList(towns.length > 0 ? towns.slice(0, 4) : firstOf(d.places, 3))
  return d.region !== d.country && !countryIsArea(d) ? `${d.country} · ${where}` : where
}

/**
 * What a card was found by when it was not its own words: 佛山市 · 顺德区 on
 * 广东, Illinois · Chicago on New York and the Northeast — saying so when
 * the card is only the nearest one.
 */
function FoundLine({ found }: { found: Found }) {
  const total = found.names.length + found.more
  return (
    <span className="flex min-w-0 items-center gap-1 text-[12px] leading-[18px] text-brand-600">
      <PinIcon className="h-3.5 w-3.5" />
      <span className="min-w-0 truncate">
        {joinList(found.names)}
        {found.more > 0 && tr(` and ${found.more} more`, ` 等 ${total} 处`)}
        {found.near && <span className="text-neutral-400">{tr(' · nearest card', ' · 最近的卡')}</span>}
      </span>
    </span>
  )
}

function Card({
  d,
  found,
  month,
  year,
  dates,
  events,
  onOpen,
}: {
  d: Destination
  found?: Found
  month: number
  year: number
  dates: Map<string, string[]> | null
  events: YearEvent[]
  onOpen: (d: Destination) => void
}) {
  const r = d.ratings[month - 1]
  const happening = events.filter((event) => event.ids.includes(d.id) && event.m.includes(month))
  // There is room for three. The ones with a rule go first: Ramadan or
  // Chinese New Year landing in this month of this year changes the trip
  // more than a flower that is out every year, and is the part that moves.
  const highlights = d.highlights
    .filter((h) => highlightMonths(h, dates, year).includes(month))
    .sort((a, b) => Number(Boolean(b.rule)) - Number(Boolean(a.rule)))
    .slice(0, 3 - Math.min(happening.length, 2))

  return (
    <button
      onClick={() => onOpen(d)}
      className="flex w-full min-w-0 flex-col gap-2 rounded-2xl bg-neutral-50 px-4 py-3.5 text-left transition-colors hover:bg-neutral-100 active:bg-neutral-100"
    >
      <span className="flex w-full items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-6">{nameOf(d)}</span>
          <span className="block truncate text-[12px] text-neutral-400">{subtitle(d)}</span>
          {found && <FoundLine found={found} />}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${RATING_TINT[r]}`}>
          {ratingLabel(r)}
        </span>
      </span>

      <span className="text-[13px] leading-5 text-neutral-600">{d.notes[month - 1]}</span>

      {(happening.length > 0 || highlights.length > 0) && (
        <span className="flex flex-col gap-1">
          {happening.slice(0, 2).map((event, i) => (
            <span key={`e${i}`} className="flex gap-1.5 text-[12px] leading-[18px] text-neutral-700">
              <span className="mt-px shrink-0 rounded bg-brand-100 px-1 text-[10px] font-semibold leading-4 tabular-nums text-brand-700">
                {year}
              </span>
              <span className="min-w-0">{event.t}</span>
            </span>
          ))}
          {highlights.map((h, i) => {
            const span = spanIn(h, dates, year, month)
            return (
              <span key={i} className="flex gap-1.5 text-[12px] leading-[18px] text-neutral-700">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                <span className="min-w-0">
                  {h.t}
                  {span && <span className="whitespace-nowrap text-brand-600"> · {spanLabel(span, h.rule)}</span>}
                </span>
              </span>
            )
          })}
        </span>
      )}

      <FlightLine d={d} />
      <Strip ratings={d.ratings} month={month} />
    </button>
  )
}

/**
 * How it is got to from home, in a line. Green when there is no change of
 * plane, amber when the flight is there only some months or with a tour,
 * grey when there is a change somewhere.
 */
function FlightLine({ d }: { d: Destination }) {
  const reach = reachOf(d)
  const tone =
    reach.kind === 'connect'
      ? 'text-neutral-400'
      : reach.kind === 'seasonal' || reach.kind === 'charter'
        ? 'text-amber-700'
        : 'text-emerald-700'
  return (
    <span className={`flex items-center gap-1.5 text-[12px] leading-[18px] ${tone}`}>
      <PlaneIcon className="h-3.5 w-3.5" />
      <span className="min-w-0 truncate">{reachLabel(reach)}</span>
    </span>
  )
}

/** A plain row, for the months that are not the time to go. */
function Row({
  d,
  found,
  month,
  onOpen,
}: {
  d: Destination
  found?: Found
  month: number
  onOpen: (d: Destination) => void
}) {
  return (
    <button
      onClick={() => onOpen(d)}
      className="grid w-full grid-cols-1 gap-x-4 gap-y-0.5 py-2.5 text-left md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium">
          {d.region === d.country ? d.country : `${d.country} · ${nameOf(d)}`}
        </span>
        {found && <FoundLine found={found} />}
      </span>
      <span className="text-[13px] leading-5 text-neutral-500">{d.notes[month - 1]}</span>
    </button>
  )
}

export default function SeasonsScreen({ onToast }: { onToast: (message: string) => void }) {
  const { data, failed } = useSeasons()
  const [year, setYearState] = useState(kept.year)
  const [month, setMonthState] = useState(kept.month)
  const [view, setViewState] = useState<View>(kept.view)
  const [area, setAreaState] = useState(kept.area)
  const [query, setQueryState] = useState(kept.query)
  const [flight, setFlightState] = useState<Flight>(kept.flight)
  const [onlyBest, setOnlyBestState] = useState(kept.onlyBest)
  // The id, not the place: the place is a different object in each language,
  // and a sheet left open across a switch should redraw in the new one.
  const [openId, setOpenId] = useState<string | null>(null)
  const setOpen = (d: Destination) => setOpenId(d.id)
  // A place found on OpenStreetMap, in a sheet of its own.
  const [openPlace, setOpenPlace] = useState<MapPlace | null>(null)
  const [mapSearch, setMapSearch] = useState<MapSearch | null>(null)

  const setYear = (value: number) => setYearState((kept.year = value))
  const setMonth = (value: number) => setMonthState((kept.month = value))
  const setView = (value: View) => setViewState((kept.view = value))
  const setArea = (value: string) => setAreaState((kept.area = value))
  const setQuery = (value: string) => setQueryState((kept.query = value))
  const setFlight = (value: Flight) => setFlightState((kept.flight = value))
  const setOnlyBest = (value: boolean) => setOnlyBestState((kept.onlyBest = value))

  const dates = useRuleDates(data, year)
  const events = eventsIn(year)

  const all = data?.destinations ?? NO_DESTINATIONS
  const open = openId ? all.find((d) => d.id === openId) : undefined
  // The search first, then the flights and the area: each row of chips counts
  // what the search and the other row let through, so 樱花 shows at a glance
  // which parts of the world have any, and how many of those are 直飞.
  //
  // A card's own words are looked at first; what they do not have is looked
  // for in the places on it, so 顺德 finds 广东 by 佛山市 · 顺德区. The places
  // come only once something is typed.
  const q = query.trim()
  const { places, failed: placesFailed } = usePlaces(q !== '')
  const { searched, foundBy } = useMemo(() => {
    const foundBy = new Map<string, Found>()
    const searched = all.filter((d) => {
      const left = termsLeft(d, q)
      if (left.length === 0) return true
      const found = foundOn(d.id, left, places, q)
      if (found) foundBy.set(d.id, found)
      return Boolean(found)
    })
    return { searched, foundBy }
  }, [all, q, places])
  const lookingFurther = q !== '' && places === null && !placesFailed

  // OpenStreetMap, only when asked — the button, or the keyboard's search
  // key — and with the towns that say which card a place is on, so the
  // answers come with their card. A search typed over hides the last answers.
  const askMap = () => {
    if (!q) return
    const asking = q
    setMapSearch({ query: asking, status: 'looking', places: [] })
    Promise.all([searchMap(asking), loadPoints().catch(() => null)]).then(
      ([found]) => setMapSearch((now) => (now?.query === asking ? { query: asking, status: 'done', places: found } : now)),
      () => setMapSearch((now) => (now?.query === asking ? { query: asking, status: 'failed', places: [] } : now)),
    )
  }
  const mapAnswer = mapSearch?.query === q ? mapSearch : null
  const where = usePoints(mapAnswer !== null || view === 'map')
  const onCards = useMemo(
    () => new Map((mapAnswer?.places ?? []).map((p) => [p.key, cardOf(p, all, places, where)])),
    [mapAnswer, all, places, where],
  )
  const found = useMemo(() => searched.filter((d) => fits(d, flight)), [searched, flight])
  const list = useMemo(() => found.filter((d) => area === ALL || d.area === area), [found, area])

  const perArea = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of found) counts.set(d.area, (counts.get(d.area) ?? 0) + 1)
    return counts
  }, [found])

  const perFlight = useMemo(() => {
    const here = searched.filter((d) => area === ALL || d.area === area)
    const direct = here.filter(noChange).length
    return { all: here.length, direct, connect: here.length - direct }
  }, [searched, area])

  // How many places are at their best in each month, for the strip.
  const bestBy = useMemo(
    () => Array.from({ length: 12 }, (_, i) => list.filter((d) => d.ratings[i] === 3).length),
    [list],
  )
  const peak = Math.max(...bestBy, 1)

  const byRating = useMemo(() => {
    const groups: Destination[][] = [[], [], [], []]
    for (const d of list) groups[d.ratings[month - 1]].push(d)
    return groups
  }, [list, month])

  const shown = onlyBest ? byRating[3] : [...byRating[3], ...byRating[2]]
  const today = new Date()
  const thisMonth = today.getFullYear() === year ? today.getMonth() + 1 : null

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="px-5 pb-3 pt-4 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">{tr('Seasons', '季节')}</h1>
              <p className="truncate pt-0.5 text-[13px] text-neutral-500">
                {tr('Where to go, month by month', '全球旅行月历')} · {seasonsOf(month)}
              </p>
            </div>
            <YearStepper year={year} onChange={setYear} />
          </div>

          {/*
            All twelve at once, in two rows on a phone, rather than a strip to
            swipe: a row that runs off the edge hides half the year behind it.
            The bar under each month is how many places are at their best
            then, so the good months for wherever is filtered show before any
            of them is opened.

            One row from md, not sm. The app is still a 448px column until md,
            and twelve to a row there is 28px a month — narrower than 10月.
          */}
          <div className="mt-3 grid grid-cols-6 gap-1.5 md:grid-cols-12" role="group" aria-label={tr('Months', '月份')}>
            {bestBy.map((count, i) => {
              const m = i + 1
              const on = m === month
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  aria-pressed={on}
                  title={tr(`${monthLabel(m)}: ${count} at their best`, `${m}月：${count} 处正值最佳季节`)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 pb-1.5 pt-1 transition-colors ${
                    on
                      ? 'bg-brand-500 text-white'
                      : m === thisMonth
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                        : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  <span className="text-[13px] font-medium tabular-nums">{monthLabel(m)}</span>
                  <span className="flex h-1.5 w-full max-w-[2.5rem] items-end overflow-hidden rounded-full bg-black/5">
                    <span
                      className={`h-full rounded-full ${on ? 'bg-white' : 'bg-emerald-500'}`}
                      // A sliver for one place, so it is not mistaken for none;
                      // nothing at all for none.
                      style={{ width: count ? `${Math.max(6, Math.round((count / peak) * 100))}%` : 0 }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="px-5 pb-28 lg:px-8 lg:pb-10">
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* A set width: left to size itself, the three squeezed 这个月去哪 onto two lines. */}
          <div className="w-full shrink-0 md:w-80">
            <Segmented value={view} options={views()} onChange={setView} />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            enterKeyHint="search"
            onKeyDown={(event) => {
              // Not while a pinyin keyboard is still choosing the characters.
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.currentTarget.blur()
              askMap()
            }}
            placeholder={tr(
              'Search a place or word: Hokkaido, Chicago, cherry blossom',
              '搜索地方或关键词：北海道、顺德、樱花',
            )}
            aria-label={tr('Search destinations', '搜索目的地')}
            className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-3 py-2 text-[14px] outline-hidden placeholder:text-neutral-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-3" role="group" aria-label={tr('Areas', '地区')}>
          {[ALL, ...AREAS].map((name) => (
            <button
              key={name}
              onClick={() => setArea(name)}
              aria-pressed={area === name}
              className={`rounded-full px-3 py-1 text-[13px] transition-colors ${
                area === name ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {name === ALL ? tr('All', '全部') : areaName(name)}
              <span className="ml-1 text-[11px] tabular-nums opacity-60">
                {name === ALL ? found.length : (perArea.get(name) ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2" role="group" aria-label={tr(`Flights from ${homeName()}`, `从${homeName()}的航班`)}>
          <span className="flex items-center gap-1 pr-1 text-[13px] text-neutral-500">
            <PlaneIcon className="h-3.5 w-3.5" />
            {tr(`From ${homeName()}`, `从${homeName()}`)}
          </span>
          {flightChoices().map((choice) => (
            <button
              key={choice.value}
              onClick={() => setFlight(choice.value)}
              aria-pressed={flight === choice.value}
              className={`rounded-full px-3 py-1 text-[13px] transition-colors ${
                flight === choice.value ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {choice.label}
              <span className="ml-1 text-[11px] tabular-nums opacity-60">{perFlight[choice.value]}</span>
            </button>
          ))}
        </div>

        {q && data && (
          <MapAnswers
            query={q}
            answer={mapAnswer}
            onCards={onCards}
            month={month}
            onAsk={askMap}
            onPick={setOpenPlace}
          />
        )}

        {!data ? (
          <p className="py-16 text-center text-[13px] text-neutral-400">
            {failed
              ? tr('Could not load the destinations. Connect to the internet and open this again.', '没能载入目的地。连上网络后再打开一次。')
              : tr('Loading destinations…', '正在载入目的地…')}
          </p>
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-neutral-50 px-4 py-8 text-center">
            <p className="text-[14px] text-neutral-600">
              {lookingFurther
                ? tr('Looking through every town and district…', '正在查找所有城市和区县…')
                : tr(`Nothing found${q && ` for "${q}"`}`, `没有找到${q && `「${q}」`}`)}
            </p>
            <p className="mx-auto mt-1 max-w-[300px] text-[13px] leading-5 text-neutral-400">
              {isZh() ? (
                <>
                  试试国家名、城市名，或者「樱花」「极光」「潜水」这样的关键词
                  {area !== ALL && '，也可以把地区切回「全部」'}
                  {flight !== 'all' && '，或者把航班切回「全部」'}。
                </>
              ) : (
                <>
                  Try a country, a city, or a word like "cherry blossom", "aurora" or "diving"
                  {area !== ALL && ', or set the area back to All'}
                  {flight !== 'all' && ', or set flights back to All'}.
                </>
              )}
            </p>
          </div>
        ) : view === 'month' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-6">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-neutral-500">
                {([3, 2, 1, 0] as const).map((r) => (
                  <span key={r} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-sm ${RATING_TINT[r]}`} />
                    {ratingLabel(r)}
                    <span className="font-medium tabular-nums text-neutral-900">{byRating[r].length}</span>
                  </span>
                ))}
              </p>
              <label className="flex items-center gap-2 text-[13px] text-neutral-600">
                {tr('Best only', '只看最佳')}
                <Toggle checked={onlyBest} onChange={setOnlyBest} label={tr('Best only', '只看最佳')} />
              </label>
            </div>

            {AREAS.map((name) => {
              const here = shown
                .filter((d) => d.area === name)
                .sort((a, b) => b.ratings[month - 1] - a.ratings[month - 1])
              if (here.length === 0) return null
              return (
                <section key={name}>
                  <h2 className="pb-2 pt-8 text-[13px] font-medium text-neutral-400">
                    {areaName(name)} <span className="tabular-nums">{here.length}</span>
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {here.map((d) => (
                      <Card
                        key={d.id}
                        d={d}
                        found={foundBy.get(d.id)}
                        month={month}
                        year={year}
                        dates={dates}
                        events={events}
                        onOpen={setOpen}
                      />
                    ))}
                  </div>
                </section>
              )
            })}

            {shown.length === 0 && (
              <p className="mt-6 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-500">
                {tr(
                  `Nowhere here is ${onlyBest ? 'at its best' : 'good to go'} in ${monthLabel(month)}.`,
                  `${month}月在这里没有${onlyBest ? '正值最佳季节' : '适合去'}的地方。`,
                )}
              </p>
            )}

            {byRating[1].length > 0 && (
              <details className="mt-8 border-y border-neutral-100">
                <summary className="cursor-pointer py-3 text-[13px] font-medium text-neutral-500">
                  {ratingLabel(1)} · {tr(`${byRating[1].length}`, `${byRating[1].length} 处`)}{' '}
                  <span className="font-normal text-neutral-400">
                    {tr('You can go, but it is not the best time', '能去，但不是最好的时候')}
                  </span>
                </summary>
                <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                  {byRating[1].map((d) => (
                    <Row key={d.id} d={d} found={foundBy.get(d.id)} month={month} onOpen={setOpen} />
                  ))}
                </div>
              </details>
            )}

            {byRating[0].length > 0 && (
              <>
                <h2 className="pb-1 pt-8 text-[13px] font-medium text-rose-500">
                  {tr(`Not advised in ${monthLabel(month)}`, `${month}月不建议去`)} ·{' '}
                  {tr(`${byRating[0].length}`, `${byRating[0].length} 处`)}
                </h2>
                <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                  {byRating[0].map((d) => (
                    <Row key={d.id} d={d} found={foundBy.get(d.id)} month={month} onOpen={setOpen} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : view === 'year' ? (
          <YearTable list={list} foundBy={foundBy} month={month} year={year} dates={dates} events={events} onMonth={setMonth} onOpen={setOpen} />
        ) : (
          <MapView list={list} month={month} onOpen={setOpen} />
        )}

        <div className="space-y-1 pt-10 text-[12px] leading-5 text-neutral-400">
          <p>
            {tr(
              'Temperatures are rough ranges, and blossom and autumn colours come a week or two earlier or later each year. Festivals on the lunar or Islamic calendar, or tied to Easter, are worked out for the year you pick; Islamic dates follow the local moon sighting and can be a day out.',
              '气温是大致范围，花期和红叶每年前后会差一两周。农历、伊斯兰历和复活节的节庆，日期按所选年份自动推算；伊斯兰节日以当地看月宣布为准，可能差一天。',
            )}
          </p>
          {!EVENT_YEARS.includes(year) && (
            <p>
              {tr(
                `One-off events for ${year} (Olympics, eclipses, expos and the like) are not in yet.`,
                `${year} 年的特别活动（奥运、日食、世博之类）还没有整理进来。`,
              )}
            </p>
          )}
          {data && (
            <p>
              {tr(
                `Check visas, tickets and opening hours with the official sources. Last checked ${monthYear(data.reviewed)}.`,
                `签证、门票和开放时间以官方为准。资料核对于 ${data.reviewed.replace('-', ' 年 ')} 月。`,
              )}
            </p>
          )}
          <p>
            {tr(
              `Direct means no change of plane from ${homeName()}: that includes a stop on the way, and a direct flight to a nearby city and then overland. Routes come and go; checked ${monthYear(FLIGHTS.checked)}, so check with the airline before booking.`,
              `直飞指从${homeName()}出发不用换飞机，包括中途经停，和直飞附近城市再坐车。航线常有增减，核对于 ${FLIGHTS.checked.replace('-', ' 年 ')} 月，订票前以航空公司为准。`,
            )}
          </p>
          <p>
            {tr(
              'Towns and districts to search by: GeoNames (CC BY 4.0), Wikidata and the National Bureau of Statistics of China. The map: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors, whose places the map search finds.',
              '搜索用的城市和区县：GeoNames（CC BY 4.0）、Wikidata、国家统计局。地图：OpenFreeMap，© OpenMapTiles、© OpenStreetMap 贡献者；地图搜索找到的地方也来自 OpenStreetMap。',
            )}
          </p>
        </div>
      </main>

      {open && (
        <DestinationSheet
          destination={open}
          year={year}
          month={month}
          dates={dates}
          onClose={() => setOpenId(null)}
          onToast={onToast}
        />
      )}

      {openPlace && (
        <PlaceSheet
          place={openPlace}
          on={onCards.get(openPlace.key) ?? null}
          month={month}
          onOpenCard={(d) => {
            setOpenPlace(null)
            setOpen(d)
          }}
          onClose={() => setOpenPlace(null)}
        />
      )}
    </>
  )
}

/**
 * The search on OpenStreetMap: first a button offering it, then what it
 * found — each place with what it is, where, and the card it is on.
 */
function MapAnswers({
  query,
  answer,
  onCards,
  month,
  onAsk,
  onPick,
}: {
  query: string
  answer: MapSearch | null
  onCards: Map<string, OnCard | null>
  month: number
  onAsk: () => void
  onPick: (place: MapPlace) => void
}) {
  if (!answer) {
    return (
      <button
        onClick={onAsk}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-700 active:bg-neutral-50"
      >
        <GlobeIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">
          {tr(`Find “${query}” on the map — villages, sights, anywhere`, `在地图上找「${query}」：村镇、景点，哪里都行`)}
        </span>
      </button>
    )
  }
  return (
    <section className="mt-3 rounded-2xl border border-neutral-100">
      <p className="flex items-center justify-between gap-3 px-4 pt-3 text-[12px] text-neutral-400">
        <span>{tr(`On the map: “${query}”`, `地图上的「${query}」`)}</span>
        <span>© OpenStreetMap</span>
      </p>
      {answer.status === 'looking' ? (
        <p className="px-4 py-4 text-[13px] text-neutral-500">{tr('Looking…', '正在找…')}</p>
      ) : answer.status === 'failed' ? (
        <p className="px-4 py-4 text-[13px] text-neutral-500">
          {tr('Could not reach the map. Check the internet and try again.', '连不上地图，请检查网络再试一次。')}
        </p>
      ) : answer.places.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-neutral-500">
          {tr(`Nothing on the map is called “${query}”.`, `地图上也没有叫「${query}」的地方。`)}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 pb-1">
          {answer.places.map((place) => {
            const on = onCards.get(place.key) ?? null
            return (
              <li key={place.key}>
                <button onClick={() => onPick(place)} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left active:bg-neutral-50">
                  <PinIcon className="mt-0.5 h-4 w-4 text-rose-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {place.name}
                      {place.kind && <span className="font-normal text-neutral-400"> · {place.kind}</span>}
                    </span>
                    <span className="block truncate text-[12px] text-neutral-500">{place.address}</span>
                    {on ? (
                      <span className="block truncate text-[12px] text-brand-600">
                        {nameOf(on.d)} · {monthLabel(month)} {ratingLabel(on.d.ratings[month - 1])}
                        {on.near && <span className="text-neutral-400">{tr(' · nearest card', ' · 最近的卡')}</span>}
                      </span>
                    ) : (
                      <span className="block text-[12px] text-neutral-400">
                        {tr('No card for this country yet', '这个国家还没有卡片')}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * Every card on the map: a pin in the colour of the month's rating, and its
 * name beside it once zoomed in far enough to read. Tapping a pin opens the
 * card. What the search, the areas and the flights let through is what is
 * pinned, so 樱花 in April is a map of where the blossom is.
 */
function MapView({ list, month, onOpen }: { list: Destination[]; month: number; onOpen: (d: Destination) => void }) {
  const where = usePoints()
  // The pins keep their handler from the first draw; this keeps it current.
  const opener = useRef(onOpen)
  opener.current = onOpen
  const pins = useMemo<MapPin[]>(
    () =>
      list.flatMap((d) => {
        const at = pinOf(where, d.id)
        if (!at) return []
        // 北部 alone on a map could be anywhere: 越南·北部, but 云南·昆明大理丽江 as it is.
        const label = d.region !== d.country && !countryIsArea(d) ? `${d.country}·${nameOf(d)}` : nameOf(d)
        return [{ key: d.id, lat: at[0], lon: at[1], label, tint: RATING_TINT[d.ratings[month - 1]], onClick: () => opener.current(d) }]
      }),
    [list, where, month],
  )
  // A few cards are shown whole; one close up, as Google shows a region; all
  // of them from Asia, where most trips from Kuala Lumpur go.
  const bounds: [[number, number], [number, number]] | undefined =
    pins.length > 1 && pins.length <= 40
      ? [
          [Math.min(...pins.map((p) => p.lat)), Math.min(...pins.map((p) => p.lon))],
          [Math.max(...pins.map((p) => p.lat)), Math.max(...pins.map((p) => p.lon))],
        ]
      : undefined
  const center: [number, number] = pins.length === 1 ? [pins[0].lat, pins[0].lon] : [22, 108]

  return (
    <>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-6 text-[13px] text-neutral-500">
        {([3, 2, 1, 0] as const).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${RATING_TINT[r]}`} />
            {ratingLabel(r)}
          </span>
        ))}
        <span className="text-neutral-400">{tr(`in ${monthLabel(month)} · tap a dot to open it`, `${month}月 · 点圆点打开卡片`)}</span>
      </p>
      <Suspense fallback={<div className="mt-3 h-[65vh] rounded-2xl bg-neutral-100" />}>
        <MapCanvas className="mt-3 h-[65vh]" pins={pins} bounds={bounds} center={center} zoom={pins.length === 1 ? 7 : 3} />
      </Suspense>
    </>
  )
}

/**
 * Every destination down the side, the twelve months across.
 *
 * A dot marks a month with something dated in it this year — a festival
 * worked out for the year, or one of the year's events — which is the part
 * of this table that moves when the year does.
 */
function YearTable({
  list,
  foundBy,
  month,
  year,
  dates,
  events,
  onMonth,
  onOpen,
}: {
  list: Destination[]
  foundBy: Map<string, Found>
  month: number
  year: number
  dates: Map<string, string[]> | null
  events: YearEvent[]
  onMonth: (month: number) => void
  onOpen: (d: Destination) => void
}) {
  const dated = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const d of list) {
      const months = new Set<number>()
      for (const h of d.highlights) if (h.rule) highlightMonths(h, dates, year).forEach((m) => months.add(m))
      for (const event of events) if (event.ids.includes(d.id)) event.m.forEach((m) => months.add(m))
      map.set(d.id, months)
    }
    return map
  }, [list, dates, year, events])

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-100">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[12px] font-medium text-neutral-400">
              {tr('Destination', '目的地')}
            </th>
            {Array.from({ length: 12 }, (_, i) => (
              <th key={i} className="bg-white px-0 py-2">
                <button
                  onClick={() => onMonth(i + 1)}
                  className={`w-full text-[12px] tabular-nums ${
                    i + 1 === month ? 'font-semibold text-brand-600' : 'font-normal text-neutral-400'
                  }`}
                >
                  {monthLabel(i + 1)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AREAS.map((name) => {
            const rows = list.filter((d) => d.area === name)
            if (rows.length === 0) return null
            return [
              <tr key={name}>
                <th
                  colSpan={13}
                  className="sticky left-0 bg-neutral-50 px-3 py-1.5 text-left text-[12px] font-medium text-neutral-500"
                >
                  {areaName(name)}
                </th>
              </tr>,
              ...rows.map((d) => (
                <tr key={d.id} onClick={() => onOpen(d)} className="cursor-pointer hover:[&>th]:text-brand-600">
                  <th className="sticky left-0 z-10 max-w-[11rem] border-r border-neutral-100 bg-white px-3 py-1 text-left font-normal">
                    {/* The row is what a finger taps; the button is what a keyboard can reach. */}
                    <button className="block w-full min-w-0 text-left">
                      <span className="block truncate text-[13px] font-medium">{nameOf(d)}</span>
                      {d.region !== d.country && !countryIsArea(d) && (
                        <span className="block truncate text-[11px] text-neutral-400">{d.country}</span>
                      )}
                      {foundBy.has(d.id) && (
                        <span className="block truncate text-[11px] text-brand-600">
                          {joinList(foundBy.get(d.id)!.names)}
                          {foundBy.get(d.id)!.near && (
                            <span className="text-neutral-400">{tr(' · nearest card', ' · 最近的卡')}</span>
                          )}
                        </span>
                      )}
                    </button>
                  </th>
                  {d.ratings.map((r, i) => (
                    <td
                      key={i}
                      title={`${monthLabel(i + 1)} · ${ratingLabel(r)}${tr(': ', '：')}${d.notes[i]}`}
                      className={`h-9 min-w-[2rem] border-b-2 border-r-2 border-white text-center text-[10px] ${RATING_TINT[r]} ${
                        i + 1 === month ? 'shadow-[inset_0_0_0_2px_#171717]' : ''
                      }`}
                    >
                      {dated.get(d.id)?.has(i + 1) ? '●' : ''}
                    </td>
                  ))}
                </tr>
              )),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
