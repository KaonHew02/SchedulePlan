import { useState, type ReactNode } from 'react'
import CountryBadge from '../components/CountryBadge'
import Sheet from '../components/Sheet'
import { useHolidayYear, type Holiday } from '../lib/holidays'
import { countryName, countryOf } from '../lib/places'
import { saveWish, useWishlist } from '../lib/store'
import {
  RATING_LABEL,
  RATING_TINT,
  eventsIn,
  monthsLabel,
  nameOf,
  spanLabel,
  spansOf,
  type Destination,
} from './seasons'

/**
 * One destination, the whole year of it.
 *
 * Everything the month card leaves out: all twelve months, every highlight,
 * the climate, what to avoid and the tips. And the part that is different
 * every year — the festivals' actual dates, that year's one-off events and
 * the country's public holidays for it — worked out for the year the screen
 * is on, so the sheet for 2027 tells you the Chinese New Year of 2027.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-5">
      <h3 className="pb-1.5 text-[13px] font-medium text-neutral-400">{title}</h3>
      {children}
    </section>
  )
}

interface HolidayRun {
  start: string
  end: string
  name: string
  country: string
  /** A Malaysian year the government has not published yet — see holidays.ts. */
  estimated: boolean
}

/** Runs of the same holiday on consecutive days, as one line: 2月6–8日 Chinese New Year. */
function holidayRuns(days: Holiday[]): HolidayRun[] {
  const runs: HolidayRun[] = []
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date) || a.country.localeCompare(b.country))
  for (const day of sorted) {
    const last = runs.find(
      (run) =>
        run.name === day.name &&
        run.country === day.country &&
        new Date(`${day.date}T00:00:00Z`).getTime() - new Date(`${run.end}T00:00:00Z`).getTime() === 86_400_000,
    )
    if (last) last.end = day.date
    else {
      runs.push({
        start: day.date,
        end: day.date,
        name: day.name,
        country: day.country,
        estimated: Boolean(day.estimated),
      })
    }
  }
  return runs
}

export default function DestinationSheet({
  destination: d,
  year,
  month,
  dates,
  onClose,
  onToast,
}: {
  destination: Destination
  year: number
  /** The month the screen is on, which is the row picked out in the list. */
  month: number
  dates: Map<string, string[]> | null
  onClose: () => void
  onToast: (message: string) => void
}) {
  const wishlist = useWishlist()
  const holidays = useHolidayYear(d.countries, year)
  const [saving, setSaving] = useState(false)

  const best = d.ratings.flatMap((r, i) => (r === 3 ? [i + 1] : []))
  const events = eventsIn(year).filter((event) => event.ids.includes(d.id))
  const runs = holidayRuns(holidays)
  const several = d.countries.length > 1

  /*
   * Onto the wishlist, as the place to go and when.
   *
   * Only for somewhere the app has a country for — the wishlist card and the
   * badge on it are drawn from the country table, and French Polynesia or
   * Antarctica would arrive as two dots. The best months go in the note,
   * which is where a wish keeps "the season to go in" anyway.
   */
  const home = countryOf(d.countries[0])
  const name = nameOf(d)
  const wished = wishlist.some((wish) => wish.name === name && wish.country === home?.code)

  async function addWish() {
    if (!home) return
    setSaving(true)
    try {
      await saveWish({
        name,
        country: home.code,
        note: `${d.summary}\n最佳月份：${monthsLabel(best)}\n去处：${d.places}`,
        photo: null,
        attachments: [],
        links: [],
      })
      onToast(`${name} 已加入心愿单`)
    } catch {
      onToast('没能加入心愿单，请再试一次')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={name}
      onClose={onClose}
      footer={
        home ? (
          <button
            onClick={addWish}
            disabled={wished || saving}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {wished ? '已在心愿单' : '加入心愿单'}
          </button>
        ) : undefined
      }
    >
      <div className="flex items-center gap-2 text-[12px] text-neutral-400">
        {d.countries.slice(0, 3).map((code) => (
          <CountryBadge key={code} code={code} size="sm" />
        ))}
        <span className="truncate">
          {d.area} · {d.country}
        </span>
      </div>
      <p className="pt-2 text-[15px] font-medium leading-6">{d.summary}</p>

      <Section title="主要去处">
        <p className="text-[14px] leading-6 text-neutral-700">{d.places}</p>
      </Section>

      <Section title={`逐月 · 最佳 ${monthsLabel(best)}`}>
        <ol className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100">
          {d.notes.map((note, i) => (
            <li
              key={i}
              className={`grid grid-cols-[2.6rem_3.4rem_minmax(0,1fr)] items-start gap-2 px-3 py-2 text-[13px] leading-5 ${
                i + 1 === month ? 'bg-brand-50' : ''
              }`}
            >
              <span className="tabular-nums text-neutral-500">{i + 1}月</span>
              <span
                className={`justify-self-start rounded-full px-2 text-[11px] font-semibold leading-5 ${RATING_TINT[d.ratings[i]]}`}
              >
                {RATING_LABEL[d.ratings[i]]}
              </span>
              <span className="text-neutral-700">{note}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="季节亮点">
        <ul className="space-y-2">
          {d.highlights.map((h, i) => {
            const spans = spansOf(h, dates)
            // A rule's dates are this year's; the rest are the usual months.
            const when =
              spans && spans.length > 0
                ? spans.map((span) => `${year}年${spanLabel(span, h.rule)}`).join('、')
                : monthsLabel(h.m)
            return (
              <li key={i} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 text-[13px] leading-5">
                <span className={`tabular-nums ${spans?.length ? 'font-medium text-brand-600' : 'text-neutral-400'}`}>
                  {when}
                </span>
                <span className="text-neutral-700">{h.t}</span>
              </li>
            )
          })}
        </ul>
      </Section>

      {events.length > 0 && (
        <Section title={`${year} 年的特别活动`}>
          <ul className="space-y-2">
            {events.map((event, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 text-[13px] leading-5">
                <span className="font-medium text-brand-600">{monthsLabel(event.m)}</span>
                <span className="text-neutral-700">{event.t}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/*
        The country's days off, for the year on screen: the week the shops
        shut and every hotel is full. Left out where the library has no list
        for the country, rather than claiming a year with no holidays in it.
      */}
      {runs.length > 0 && (
        <Section title={`${year} 年公众假期`}>
          <ul className="space-y-1">
            {runs.map((run) => (
              <li
                key={`${run.country}${run.start}${run.name}`}
                className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 text-[13px] leading-5"
              >
                <span className="tabular-nums text-neutral-500">{spanLabel(run)}</span>
                <span className="text-neutral-700">
                  {run.name}
                  {several && <span className="text-neutral-400"> · {countryName(run.country)}</span>}
                  {run.estimated && <span className="text-neutral-400"> · 未确认</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="气候">
        <p className="text-[14px] leading-6 text-neutral-700">{d.climate}</p>
      </Section>
      <Section title="要避开">
        <p className="text-[14px] leading-6 text-neutral-700">{d.avoid}</p>
      </Section>
      <Section title="出行贴士">
        <p className="pb-2 text-[14px] leading-6 text-neutral-700">{d.tips}</p>
      </Section>
    </Sheet>
  )
}
