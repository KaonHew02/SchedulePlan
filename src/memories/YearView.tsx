import { useMemo, useState } from 'react'
import { monthTitle, shortDate, todayISO, toISO } from '../lib/date'
import { isZh, tr } from '../lib/i18n'
import type { Memory } from '../types'
import { KINDS, KindGlyph, kindLabel } from './kinds'

/** Days a year of memories is drawn in: Monday first, a column a week. */
function daysOf(year: number): { blanks: number; days: string[] } {
  const first = new Date(year, 0, 1)
  const blanks = (first.getDay() + 6) % 7
  const days: string[] = []
  for (let day = new Date(first); day.getFullYear() === year; day.setDate(day.getDate() + 1)) days.push(toISO(day))
  return { blanks, days }
}

const LEVEL = ['bg-neutral-100', 'bg-brand-200', 'bg-brand-300', 'bg-brand-400', 'bg-brand-500']

/**
 * The numbers: how many memories, countries, places and photos; a calendar of
 * the year with a square for every day; which kinds; and a few highlights.
 */
export default function YearView({
  memories,
  onOpen,
  onDay,
}: {
  memories: Memory[]
  onOpen: (id: number) => void
  /** A day with more than one memory: show them. */
  onDay: (day: string) => void
}) {
  const thisYear = todayISO().slice(0, 4)
  const years = useMemo(() => {
    const found = new Set(memories.map((memory) => memory.date.slice(0, 4)))
    found.add(thisYear)
    return [...found].sort()
  }, [memories, thisYear])
  const latest = [...years].reverse().find((year) => memories.some((memory) => memory.date.startsWith(year))) ?? thisYear
  const [year, setYear] = useState(memories.some((memory) => memory.date.startsWith(thisYear)) ? thisYear : latest)

  const totals = useMemo(() => {
    const countries = new Set(memories.map((memory) => memory.place?.country).filter(Boolean))
    const places = new Set(
      memories
        .map((memory) => memory.place?.name.trim().toLowerCase() || (memory.place?.lat != null ? `${memory.place.lat.toFixed(2)},${memory.place.lon?.toFixed(2)}` : ''))
        .filter(Boolean),
    )
    const photos = memories.reduce((total, memory) => total + memory.photos.length, 0)
    return { countries: countries.size, places: places.size, photos }
  }, [memories])

  const perDay = useMemo(() => {
    const counts = new Map<string, Memory[]>()
    for (const memory of memories) {
      if (!memory.date.startsWith(year)) continue
      counts.set(memory.date, [...(counts.get(memory.date) ?? []), memory])
    }
    return counts
  }, [memories, year])

  const { blanks, days } = daysOf(Number(year))
  const weeks = Math.ceil((blanks + days.length) / 7)
  const inYear = [...perDay.values()].reduce((total, list) => total + list.length, 0)
  const today = todayISO()

  const kinds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const memory of memories) counts.set(memory.kind, (counts.get(memory.kind) ?? 0) + 1)
    return KINDS.filter((kind) => counts.has(kind.id))
      .map((kind) => ({ kind, count: counts.get(kind.id)! }))
      .sort((a, b) => b.count - a.count)
  }, [memories])
  const most = Math.max(1, ...kinds.map((row) => row.count))

  const highlights = useMemo(() => {
    const byDate = [...memories].sort((a, b) => a.date.localeCompare(b.date))
    const months = new Map<string, number>()
    for (const memory of memories) months.set(memory.date.slice(0, 7), (months.get(memory.date.slice(0, 7)) ?? 0) + 1)
    const busiest = [...months.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]
    const people = new Map<string, number>()
    for (const memory of memories) for (const tag of memory.tags) people.set(tag, (people.get(tag) ?? 0) + 1)
    const tag = [...people.entries()].sort((a, b) => b[1] - a[1])[0]
    return { first: byDate[0], busiest, tag, favourites: memories.filter((memory) => memory.favorite).length }
  }, [memories])

  const tile = (value: number, label: string) => (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-[32px] font-extrabold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="pt-2 text-[12px] font-medium text-neutral-400">{label}</p>
    </div>
  )

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile(memories.length, tr('memories', '段回忆'))}
        {tile(totals.countries, tr('countries', '个国家和地区'))}
        {tile(totals.places, tr('places', '个地点'))}
        {tile(totals.photos, tr('photos', '张照片'))}
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <h3 className="flex-1 text-[15px] font-semibold">{tr('The year in memories', '这一年的回忆')}</h3>
          <div className="flex flex-wrap gap-1">
            {years.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setYear(option)}
                aria-pressed={option === year}
                className={`rounded-full px-2.5 py-1 text-[12px] tabular-nums ${
                  option === year ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div
            className="grid w-max gap-[3px]"
            style={{ gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column', gridAutoColumns: '12px' }}
          >
            {Array.from({ length: blanks }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {days.map((day) => {
              const list = perDay.get(day)
              const level = list ? Math.min(4, list.length) : 0
              const label = `${shortDate(day)}: ${list ? tr(`${list.length} ${list.length === 1 ? 'memory' : 'memories'}`, `${list.length} 段回忆`) : tr('nothing', '没有')}`
              return list ? (
                <button
                  key={day}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => (list.length === 1 ? onOpen(list[0].id) : onDay(day))}
                  className={`h-3 w-3 rounded-[3px] ${LEVEL[level]} ${day === today ? 'outline-1 outline-neutral-900' : ''}`}
                />
              ) : (
                <span key={day} title={label} className={`h-3 w-3 rounded-[3px] ${LEVEL[0]} ${day === today ? 'outline-1 outline-neutral-900' : ''}`} />
              )
            })}
          </div>
          <div className="relative mt-1 h-4 text-[10px] text-neutral-400" style={{ width: weeks * 15 }}>
            {Array.from({ length: 12 }, (_, month) => {
              const first = toISO(new Date(Number(year), month, 1))
              const column = Math.floor((blanks + days.indexOf(first)) / 7)
              return (
                <span key={month} className="absolute" style={{ left: column * 15 }}>
                  {isZh() ? `${month + 1}月` : monthTitle(first).slice(0, 3)}
                </span>
              )
            })}
          </div>
        </div>
        <p className="pt-2 text-[12px] text-neutral-400">
          {tr(`${inYear} ${inYear === 1 ? 'memory' : 'memories'} in ${year}`, `${year} 年共 ${inYear} 段回忆`)}
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4">
          <h3 className="pb-3 text-[15px] font-semibold">{tr('Kinds of memories', '回忆类型')}</h3>
          <div className="space-y-2.5">
            {kinds.map(({ kind, count }) => (
              <div key={kind.id} className="grid grid-cols-[100px_minmax(0,1fr)_28px] items-center gap-2 text-[13px]">
                <span className="flex items-center gap-1.5 text-neutral-600">
                  <KindGlyph kind={kind.id} className="h-3.5 w-3.5" />
                  {kindLabel(kind.id)}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                  <span className={`block h-full rounded-full ${kind.pin}`} style={{ width: `${(count / most) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4">
          <h3 className="pb-3 text-[15px] font-semibold">{tr('Highlights', '亮点')}</h3>
          <dl className="space-y-3 text-[14px]">
            {highlights.first && (
              <div>
                <dt className="text-[12px] text-neutral-400">{tr('First memory', '第一段回忆')}</dt>
                <dd>
                  <button type="button" onClick={() => onOpen(highlights.first.id)} className="font-medium underline decoration-neutral-200 underline-offset-4">
                    {highlights.first.title}
                  </button>
                  <span className="text-neutral-400"> · {shortDate(highlights.first.date)} {highlights.first.date.slice(0, 4)}</span>
                </dd>
              </div>
            )}
            {highlights.busiest && (
              <div>
                <dt className="text-[12px] text-neutral-400">{tr('Busiest month', '回忆最多的月份')}</dt>
                <dd className="font-medium">
                  {monthTitle(`${highlights.busiest[0]}-01`)} ·{' '}
                  {tr(`${highlights.busiest[1]} ${highlights.busiest[1] === 1 ? 'memory' : 'memories'}`, `${highlights.busiest[1]} 段`)}
                </dd>
              </div>
            )}
            {highlights.tag && (
              <div>
                <dt className="text-[12px] text-neutral-400">{tr('Most tagged', '出现最多的标签')}</dt>
                <dd className="font-medium">
                  {highlights.tag[0]} · {tr(`${highlights.tag[1]} ${highlights.tag[1] === 1 ? 'memory' : 'memories'}`, `${highlights.tag[1]} 段`)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[12px] text-neutral-400">{tr('Favourites', '收藏')}</dt>
              <dd className="font-medium">
                {highlights.favourites
                  ? tr(`${highlights.favourites} ${highlights.favourites === 1 ? 'favourite' : 'favourites'}`, `${highlights.favourites} 段`)
                  : tr('None yet — the star on a memory adds one', '还没有——点回忆上的星星就能收藏')}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}

