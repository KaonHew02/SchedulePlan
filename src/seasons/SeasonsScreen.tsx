import { useMemo, useState } from 'react'
import { Segmented, Toggle } from '../components/FormFields'
import { ChevronLeft, ChevronRight, PlaneIcon } from '../components/Icons'
import DestinationSheet from './DestinationSheet'
import {
  AREAS,
  EVENT_YEARS,
  FLIGHTS,
  RATING_LABEL,
  RATING_TINT,
  eventsIn,
  highlightMonths,
  matches,
  nameOf,
  noChange,
  reachLabel,
  reachOf,
  seasonsOf,
  spanIn,
  spanLabel,
  useRuleDates,
  useSeasons,
  type Destination,
  type YearEvent,
} from './seasons'

/**
 * Seasons — 全球旅行月历. Where to go in which month, for 242 places.
 *
 * Two ways in, because there are two questions. "It is October, where is
 * good?" is the month view: everything at its best or good that month,
 * grouped by part of the world, with what is happening there. "When should I
 * go to Hokkaido?" is the year view: every destination as a row of twelve
 * colours, read across.
 *
 * The year at the top is the year the dates are for. The weather does not
 * change with it; Chinese New Year, Ramadan, Easter and a year's one-off
 * events do, and those are worked out for it (see seasons.ts) — which is why
 * nothing has to be edited when the year turns.
 */

type View = 'month' | 'year'

/**
 * Flights from home. 直飞 is everywhere got to without changing planes: a
 * flight straight there, one that stops on the way, one a train ride short of
 * it — each card says which — and the places a drive from home.
 */
type Flight = 'all' | 'direct' | 'connect'

/** What there is before the data arrives — one array, so the memos hold still. */
const NO_DESTINATIONS: Destination[] = []

const VIEWS: { value: View; label: string }[] = [
  { value: 'month', label: '这个月去哪' },
  { value: 'year', label: '全年日历' },
]

const FLIGHT_CHOICES: { value: Flight; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'direct', label: '直飞' },
  { value: 'connect', label: '要转机' },
]

const fits = (d: Destination, flight: Flight) => flight === 'all' || noChange(d) === (flight === 'direct')

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
  area: '全部',
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
        aria-label="上一年"
        className="rounded-full p-1.5 text-neutral-500 disabled:text-neutral-300"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange(thisYear)}
        title="回到今年"
        className="min-w-[3.5rem] text-center text-[14px] font-semibold tabular-nums"
      >
        {year}
      </button>
      <button
        onClick={() => onChange(year + 1)}
        disabled={year >= thisYear + 10}
        aria-label="下一年"
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

/** Under the name: the country, or the first few places when the country is already the heading. */
function subtitle(d: Destination): string {
  if (d.region !== d.country && d.country !== d.area) return d.country
  return d.places.split('、').slice(0, 3).join('、')
}

function Card({
  d,
  month,
  year,
  dates,
  events,
  onOpen,
}: {
  d: Destination
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
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${RATING_TINT[r]}`}>
          {RATING_LABEL[r]}
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
function Row({ d, month, onOpen }: { d: Destination; month: number; onOpen: (d: Destination) => void }) {
  return (
    <button
      onClick={() => onOpen(d)}
      className="grid w-full grid-cols-1 gap-x-4 gap-y-0.5 py-2.5 text-left md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
    >
      <span className="truncate text-[14px] font-medium">
        {d.region === d.country ? d.country : `${d.country} · ${d.region}`}
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
  const [open, setOpen] = useState<Destination | null>(null)

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
  // The search first, then the flights and the area: each row of chips counts
  // what the search and the other row let through, so 樱花 shows at a glance
  // which parts of the world have any, and how many of those are 直飞.
  const searched = useMemo(() => all.filter((d) => matches(d, query.trim())), [all, query])
  const found = useMemo(() => searched.filter((d) => fits(d, flight)), [searched, flight])
  const list = useMemo(() => found.filter((d) => area === '全部' || d.area === area), [found, area])

  const perArea = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of found) counts.set(d.area, (counts.get(d.area) ?? 0) + 1)
    return counts
  }, [found])

  const perFlight = useMemo(() => {
    const here = searched.filter((d) => area === '全部' || d.area === area)
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
              <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">Seasons</h1>
              <p className="truncate pt-0.5 text-[13px] text-neutral-500">
                全球旅行月历 · {seasonsOf(month)}
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
          <div className="mt-3 grid grid-cols-6 gap-1.5 md:grid-cols-12" role="group" aria-label="月份">
            {bestBy.map((count, i) => {
              const m = i + 1
              const on = m === month
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  aria-pressed={on}
                  title={`${m}月：${count} 处正值最佳季节`}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 pb-1.5 pt-1 transition-colors ${
                    on
                      ? 'bg-brand-500 text-white'
                      : m === thisMonth
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                        : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  <span className="text-[13px] font-medium tabular-nums">{m}月</span>
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
          {/* A set width: left to size itself, the pair squeezed 这个月去哪 onto two lines. */}
          <div className="w-full shrink-0 md:w-64">
            <Segmented value={view} options={VIEWS} onChange={setView} />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索国家、城市或关键词：北海道、樱花、极光"
            aria-label="搜索目的地"
            className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-3 py-2 text-[14px] outline-hidden placeholder:text-neutral-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-3" role="group" aria-label="地区">
          {['全部', ...AREAS].map((name) => (
            <button
              key={name}
              onClick={() => setArea(name)}
              aria-pressed={area === name}
              className={`rounded-full px-3 py-1 text-[13px] transition-colors ${
                area === name ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {name}
              <span className="ml-1 text-[11px] tabular-nums opacity-60">
                {name === '全部' ? found.length : (perArea.get(name) ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2" role="group" aria-label={`从${FLIGHTS.from}的航班`}>
          <span className="flex items-center gap-1 pr-1 text-[13px] text-neutral-500">
            <PlaneIcon className="h-3.5 w-3.5" />从{FLIGHTS.from}
          </span>
          {FLIGHT_CHOICES.map((choice) => (
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

        {!data ? (
          <p className="py-16 text-center text-[13px] text-neutral-400">
            {failed ? '没能载入目的地。连上网络后再打开一次。' : '正在载入目的地…'}
          </p>
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-neutral-50 px-4 py-8 text-center">
            <p className="text-[14px] text-neutral-600">没有找到{query.trim() && `「${query.trim()}」`}</p>
            <p className="mx-auto mt-1 max-w-[300px] text-[13px] leading-5 text-neutral-400">
              试试国家名、城市名，或者「樱花」「极光」「潜水」这样的关键词
              {area !== '全部' && '，也可以把地区切回「全部」'}
              {flight !== 'all' && '，或者把航班切回「全部」'}。
            </p>
          </div>
        ) : view === 'month' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-6">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-neutral-500">
                {([3, 2, 1, 0] as const).map((r) => (
                  <span key={r} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-sm ${RATING_TINT[r]}`} />
                    {RATING_LABEL[r]}
                    <span className="font-medium tabular-nums text-neutral-900">{byRating[r].length}</span>
                  </span>
                ))}
              </p>
              <label className="flex items-center gap-2 text-[13px] text-neutral-600">
                只看最佳
                <Toggle checked={onlyBest} onChange={setOnlyBest} label="只看最佳" />
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
                    {name} <span className="tabular-nums">{here.length}</span>
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {here.map((d) => (
                      <Card
                        key={d.id}
                        d={d}
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
                {month}月在这里没有{onlyBest ? '正值最佳季节' : '适合去'}的地方。
              </p>
            )}

            {byRating[1].length > 0 && (
              <details className="mt-8 border-y border-neutral-100">
                <summary className="cursor-pointer py-3 text-[13px] font-medium text-neutral-500">
                  一般 · {byRating[1].length} 处 <span className="font-normal text-neutral-400">能去，但不是最好的时候</span>
                </summary>
                <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                  {byRating[1].map((d) => (
                    <Row key={d.id} d={d} month={month} onOpen={setOpen} />
                  ))}
                </div>
              </details>
            )}

            {byRating[0].length > 0 && (
              <>
                <h2 className="pb-1 pt-8 text-[13px] font-medium text-rose-500">
                  {month}月不建议去 · {byRating[0].length} 处
                </h2>
                <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                  {byRating[0].map((d) => (
                    <Row key={d.id} d={d} month={month} onOpen={setOpen} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <YearTable list={list} month={month} year={year} dates={dates} events={events} onMonth={setMonth} onOpen={setOpen} />
        )}

        <div className="space-y-1 pt-10 text-[12px] leading-5 text-neutral-400">
          <p>
            气温是大致范围，花期和红叶每年前后会差一两周。农历、伊斯兰历和复活节的节庆，日期按所选年份自动推算；伊斯兰节日以当地看月宣布为准，可能差一天。
          </p>
          {!EVENT_YEARS.includes(year) && <p>{year} 年的特别活动（奥运、日食、世博之类）还没有整理进来。</p>}
          {data && <p>签证、门票和开放时间以官方为准。资料核对于 {data.reviewed.replace('-', ' 年 ')} 月。</p>}
          <p>
            直飞指从{FLIGHTS.from}出发不用换飞机，包括中途经停，和直飞附近城市再坐车。航线常有增减，核对于{' '}
            {FLIGHTS.checked.replace('-', ' 年 ')} 月，订票前以航空公司为准。
          </p>
        </div>
      </main>

      {open && (
        <DestinationSheet
          destination={open}
          year={year}
          month={month}
          dates={dates}
          onClose={() => setOpen(null)}
          onToast={onToast}
        />
      )}
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
  month,
  year,
  dates,
  events,
  onMonth,
  onOpen,
}: {
  list: Destination[]
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
              目的地
            </th>
            {Array.from({ length: 12 }, (_, i) => (
              <th key={i} className="bg-white px-0 py-2">
                <button
                  onClick={() => onMonth(i + 1)}
                  className={`w-full text-[12px] tabular-nums ${
                    i + 1 === month ? 'font-semibold text-brand-600' : 'font-normal text-neutral-400'
                  }`}
                >
                  {i + 1}月
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
                  {name}
                </th>
              </tr>,
              ...rows.map((d) => (
                <tr key={d.id} onClick={() => onOpen(d)} className="cursor-pointer hover:[&>th]:text-brand-600">
                  <th className="sticky left-0 z-10 max-w-[11rem] border-r border-neutral-100 bg-white px-3 py-1 text-left font-normal">
                    {/* The row is what a finger taps; the button is what a keyboard can reach. */}
                    <button className="block w-full min-w-0 text-left">
                      <span className="block truncate text-[13px] font-medium">{nameOf(d)}</span>
                      {d.region !== d.country && d.country !== d.area && (
                        <span className="block truncate text-[11px] text-neutral-400">{d.country}</span>
                      )}
                    </button>
                  </th>
                  {d.ratings.map((r, i) => (
                    <td
                      key={i}
                      title={`${i + 1}月 · ${RATING_LABEL[r]}：${d.notes[i]}`}
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
