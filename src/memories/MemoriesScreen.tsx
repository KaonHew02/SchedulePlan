import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Fab from '../components/Fab'
import Flag from '../components/Flag'
import { Segmented } from '../components/FormFields'
import { Close, Spinner, StarIcon } from '../components/Icons'
import ScreenTitle from '../components/ScreenTitle'
import Sheet from '../components/Sheet'
import { longDate, monthTitle, todayISO } from '../lib/date'
import { tr, useLang } from '../lib/i18n'
import { countryName } from '../lib/places'
import { useMemories } from '../lib/store'
import type { Memory, MemoryKind } from '../types'
import { KINDS, KindGlyph, kindLabel } from './kinds'
import MemoryDetail from './MemoryDetail'
import MemoryForm from './MemoryForm'
import { MemoryRow, Stamp } from './Stamp'
import YearView from './YearView'
import './memories.css'

// The map pulls in MapLibre, so it loads when its view is first opened.
const MemoryMapView = lazy(() => import('./MemoryMapView'))

type View = 'stamps' | 'map' | 'year'

/** Newest day first; of one day, the one written down last first. */
const byNewest = (a: Memory, b: Memory) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

const chip = 'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors'
const chipOff = 'bg-white text-neutral-600 hover:bg-neutral-50'

/**
 * Memories: the moments worth keeping, not only the trips.
 *
 * Three ways to look at the same records — as stamps on a page, as pins on a
 * map, and as a year — because "when was that", "where was that" and "what
 * did I do this year" are three different questions.
 */
export default function MemoriesScreen({ onToast }: { onToast: (message: string) => void }) {
  const lang = useLang()
  const memories = useMemories()
  const [view, setView] = useState<View>('stamps')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<MemoryKind | 'all'>('all')
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [country, setCountry] = useState<string | null>(null)
  const [form, setForm] = useState<{ memory: Memory | null } | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [day, setDay] = useState<string | null>(null)

  // By id, so the open memory is always the saved one: starring it from its
  // own sheet changes what the sheet shows.
  const open = openId === null ? null : (memories.find((memory) => memory.id === openId) ?? null)
  const openMemory = useCallback((id: number) => setOpenId(id), [])

  const countries = useMemo(
    () => new Set(memories.map((memory) => memory.place?.country).filter(Boolean)).size,
    [memories],
  )

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return memories
      .filter((memory) => {
        if (kind !== 'all' && memory.kind !== kind) return false
        if (favouritesOnly && !memory.favorite) return false
        if (country && memory.place?.country !== country) return false
        if (words.length === 0) return true
        const haystack = [
          memory.title,
          memory.story ?? '',
          memory.place?.name ?? '',
          memory.place?.country ? countryName(memory.place.country) : '',
          memory.tags.join(' '),
          kindLabel(memory.kind),
        ]
          .join(' ')
          .toLowerCase()
        return words.every((word) => haystack.includes(word))
      })
      .sort(byNewest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, query, kind, favouritesOnly, country, lang])

  // A page of single-stamp months reads as a list of headings, so a sparse
  // notebook is grouped by year until it fills in.
  const groups = useMemo(() => {
    const months = new Set(shown.map((memory) => memory.date.slice(0, 7)))
    const byYear = shown.length / Math.max(1, months.size) < 2.2
    const out: { key: string; title: string; items: Memory[] }[] = []
    for (const memory of shown) {
      const key = memory.date.slice(0, byYear ? 4 : 7)
      let group = out[out.length - 1]
      if (!group || group.key !== key) {
        group = { key, title: byYear ? key : monthTitle(`${key}-01`), items: [] }
        out.push(group)
      }
      group.items.push(memory)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, lang])

  const today = todayISO()
  const onThisDay = useMemo(
    () =>
      memories
        .filter((memory) => memory.date.slice(5) === today.slice(5) && memory.date.slice(0, 4) < today.slice(0, 4))
        .sort(byNewest),
    [memories, today],
  )

  const counts = useMemo(() => {
    const byKind = new Map<MemoryKind, number>()
    for (const memory of memories) byKind.set(memory.kind, (byKind.get(memory.kind) ?? 0) + 1)
    return { byKind, favourites: memories.filter((memory) => memory.favorite).length }
  }, [memories])

  const filtered = kind !== 'all' || favouritesOnly || country !== null || query.trim() !== ''
  const dayList = day ? memories.filter((memory) => memory.date === day).sort(byNewest) : []

  return (
    <>
      <header className="sticky top-0 z-20 bg-hero pt-safe backdrop-blur-sm">
        <div className="px-5 pb-3 pt-3 lg:px-8 lg:pt-4">
          <ScreenTitle>{tr('Memories', '回忆')}</ScreenTitle>
          <p className="pt-0.5 text-[13px] text-neutral-500">
            {memories.length === 0
              ? tr('Photos, places and stories worth keeping', '值得留下的照片、地点和故事')
              : tr(
                  `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} · ${countries} ${countries === 1 ? 'country' : 'countries'}`,
                  `${memories.length} 段回忆 · ${countries} 个国家和地区`,
                )}
          </p>
          {memories.length > 0 && (
            <div className="mt-3 max-w-sm">
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'stamps', label: tr('Stamps', '回忆墙') },
                  { value: 'map', label: tr('Map', '地图') },
                  { value: 'year', label: tr('Year', '年度') },
                ]}
              />
            </div>
          )}
        </div>
      </header>

      <main className="px-5 pb-28 lg:px-8 lg:pb-10">
        {memories.length === 0 ? (
          <>
            <EmptyState
              icon="📮"
              title={tr('No memories yet', '还没有回忆')}
              hint={tr(
                'Keep the moments worth remembering — a trip, a dinner, a birthday — with photos, the place and the story. Each one becomes a stamp, a pin on the map and a day in your year.',
                '把值得记住的时刻留下来——一次旅行、一顿饭、一个生日——配上照片、地点和故事。每一段都会变成一枚邮票、地图上的一个标记和你这一年里的一天。',
              )}
            />
            <div className="-mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setForm({ memory: null })}
                className="rounded-full bg-brand-500 px-5 py-3 text-[15px] font-medium text-white"
              >
                {tr('Add your first memory', '添加第一段回忆')}
              </button>
            </div>
          </>
        ) : view === 'map' ? (
          <Suspense
            fallback={
              <div className="flex h-[60vh] items-center justify-center text-neutral-400">
                <Spinner className="h-5 w-5" />
              </div>
            }
          >
            <MemoryMapView
              memories={memories}
              onOpen={openMemory}
              onCountry={(code) => {
                setCountry(code)
                setView('stamps')
              }}
            />
          </Suspense>
        ) : view === 'year' ? (
          <YearView memories={memories} onOpen={openMemory} onDay={setDay} />
        ) : (
          <>
            {onThisDay.length > 0 && !filtered && (
              <section className="mb-5 rounded-2xl bg-white p-4">
                <h3 className="pb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-neutral-400">
                  {tr('On this day', '历史上的今天')}
                </h3>
                <div className="space-y-2">
                  {onThisDay.map((memory) => {
                    const years = Number(today.slice(0, 4)) - Number(memory.date.slice(0, 4))
                    return (
                      <MemoryRow
                        key={memory.id}
                        memory={memory}
                        note={tr(`${years} ${years === 1 ? 'year' : 'years'} ago`, `${years} 年前`)}
                        onOpen={() => openMemory(memory.id)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr('Search titles, places, people…', '搜索标题、地点、人物…')}
              aria-label={tr('Search memories', '搜索回忆')}
              className="w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] shadow-xs outline-hidden placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:max-w-sm"
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setKind('all')
                  setFavouritesOnly(false)
                }}
                aria-pressed={kind === 'all' && !favouritesOnly}
                className={`${chip} ${kind === 'all' && !favouritesOnly ? 'bg-neutral-900 text-white' : chipOff}`}
              >
                {tr('All', '全部')}
                <span className="tabular-nums opacity-60">{memories.length}</span>
              </button>
              {counts.favourites > 0 && (
                <button
                  type="button"
                  onClick={() => setFavouritesOnly((was) => !was)}
                  aria-pressed={favouritesOnly}
                  className={`${chip} ${favouritesOnly ? 'bg-amber-500 text-white' : chipOff}`}
                >
                  <StarIcon className="h-3.5 w-3.5 fill-current" />
                  {tr('Favourites', '收藏')}
                  <span className="tabular-nums opacity-60">{counts.favourites}</span>
                </button>
              )}
              {KINDS.filter((option) => counts.byKind.has(option.id)).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setKind(kind === option.id ? 'all' : option.id)}
                  aria-pressed={kind === option.id}
                  className={`${chip} ${kind === option.id ? option.solid : chipOff}`}
                >
                  <KindGlyph kind={option.id} className="h-3.5 w-3.5" />
                  {kindLabel(option.id)}
                  <span className="tabular-nums opacity-60">{counts.byKind.get(option.id)}</span>
                </button>
              ))}
              {country && (
                <button
                  type="button"
                  onClick={() => setCountry(null)}
                  aria-label={tr(`Show every country, not only ${countryName(country)}`, `显示所有国家，不只是${countryName(country)}`)}
                  className={`${chip} bg-neutral-900 text-white`}
                >
                  <Flag code={country} className="h-[12px] w-[17px]" />
                  {countryName(country)}
                  <Close className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {shown.length === 0 ? (
              <p className="py-12 text-center text-[14px] text-neutral-500">
                {tr('No memories match. Try another word, or clear the filters.', '没有符合的回忆。换个词试试，或清除筛选。')}
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.key} className="mt-6">
                  <h2 className="flex items-baseline gap-2 pb-3">
                    <span className="text-[20px] font-bold tracking-tight">{group.title}</span>
                    <span className="text-[12px] text-neutral-400">
                      {tr(`${group.items.length} ${group.items.length === 1 ? 'memory' : 'memories'}`, `${group.items.length} 段`)}
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {group.items.map((memory) => (
                      <Stamp key={memory.id} memory={memory} onOpen={() => openMemory(memory.id)} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </main>

      <Fab label={tr('New memory', '新回忆')} onClick={() => setForm({ memory: null })} />

      {day && dayList.length > 0 && (
        <Sheet onClose={() => setDay(null)} title={longDate(day)}>
          <div className="space-y-2">
            {dayList.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onOpen={() => {
                  setDay(null)
                  openMemory(memory.id)
                }}
              />
            ))}
          </div>
        </Sheet>
      )}
      {open && (
        <MemoryDetail
          memory={open}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setOpenId(null)
            setForm({ memory: open })
          }}
          onToast={onToast}
        />
      )}
      {form && (
        <MemoryForm
          memory={form.memory}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            onToast(message)
          }}
        />
      )}
    </>
  )
}
