import { useMemo } from 'react'
import { addDays, daysBetween, shortDate, todayISO } from '../lib/date'
import { holidayName, useHolidays, type Holiday } from '../lib/holidays'
import { tr } from '../lib/i18n'
import { useSettings } from '../lib/store'

/**
 * How many days until the next holidays — Christmas, New Year, Chinese New
 * Year — from the same list that turns the calendar's dates red.
 *
 * A holiday that runs for days (Chinese New Year, Hari Raya) counts once, on
 * its first day, and a day given back for a holiday on a Sunday is left out:
 * the countdown is to the festival, not to the day off after it.
 *
 * New Year and Christmas are always here, even where they are not a day off
 * — New Year is not a holiday in Johor or Kedah, but the countdown to it
 * still is.
 */

const SHOWN = 4

/** One emoji for the kind of day it is. Matched on the English name. */
const EMOJI: [RegExp, string][] = [
  [/christmas/i, '🎄'],
  [/chinese new year|lunar new year|spring festival|tết|vietnamese new year|seollal/i, '🧧'],
  [/new year/i, '🎆'],
  [/aidilfitri|eid al-fitr|lebaran|nuzul|israk|muharram|maulid|ramadan|arafah/i, '🌙'],
  [/haji|aidiladha|eid al-adha/i, '🕌'],
  [/deepavali|diwali/i, '🪔'],
  [/wesak|vesak|buddha/i, '🪷'],
  [/thaipusam/i, '🦚'],
  [/gawai|kaamatan/i, '🌾'],
  [/malaysia day|merdeka/i, '🇲🇾'],
  [/national day|independence/i, '🎊'],
  [/labour|labor/i, '🛠️'],
  [/good friday|easter/i, '✝️'],
  [/birthday/i, '👑'],
]

function emojiFor(day: Holiday): string {
  if (day.country === 'MY' && /national day/i.test(day.name)) return '🇲🇾'
  return EMOJI.find(([pattern]) => pattern.test(day.name))?.[1] ?? '🎉'
}

/** "Chinese New Year (2nd day)" → "Chinese New Year". */
const baseName = (name: string) => name.replace(/\s*\((2nd day|3rd day|extra holiday)\)$/i, '')

const ALWAYS: [monthDay: string, name: string][] = [
  ['01-01', "New Year's Day"],
  ['12-25', 'Christmas Day'],
]

function countdown(days: number): { big: string; small: string } {
  if (days === 0) return { big: '🎉', small: tr('Today!', '就是今天！') }
  if (days === 1) return { big: '1', small: tr('day to go', '天') }
  return { big: String(days), small: tr('days to go', '天') }
}

export default function HolidayCountdown({ className = '' }: { className?: string }) {
  const { holidayCountry } = useSettings()
  const today = todayISO()
  // A year and a bit ahead, so the next New Year is always in reach.
  const until = addDays(today, 400)
  const byDay = useHolidays(today, until, [])

  const next = useMemo(() => {
    const all: Holiday[] = [...byDay.values()].flat().filter((day) => !day.replacement)

    // New Year and Christmas, where the list does not have them as a day off.
    const year = Number(today.slice(0, 4))
    for (const y of [year, year + 1]) {
      for (const [monthDay, name] of ALWAYS) {
        const date = `${y}-${monthDay}`
        if (date < today || date > until) continue
        const pattern = name.startsWith('New') ? /new year's|new year day/i : /christmas day|christmas$/i
        const listed = all.some((day) => day.date === date && pattern.test(day.name))
        if (!listed) all.push({ date, name, country: holidayCountry ?? '', replacement: false })
      }
    }

    all.sort((a, b) => a.date.localeCompare(b.date))

    // One row per holiday: its first day only.
    const shown: Holiday[] = []
    const lastSeen = new Map<string, string>()
    for (const day of all) {
      const base = baseName(day.name)
      const before = lastSeen.get(base)
      lastSeen.set(base, day.date)
      if (before && daysBetween(before, day.date) <= 4) continue
      shown.push({ ...day, name: base })
      if (shown.length === SHOWN) break
    }
    return shown
  }, [byDay, today, until, holidayCountry])

  if (next.length === 0) return null

  const [first, ...rest] = next
  const firstDays = daysBetween(today, first.date) - 1
  const { big, small } = countdown(firstDays)

  return (
    <section
      aria-label={tr('Holiday countdown', '假期倒数')}
      className={`overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(108,92,231,0.25)] ${className}`}
    >
      <div className="flex items-center gap-3 bg-gradient-to-br from-rose-500 via-[#f0607a] to-amber-400 px-4 py-3.5 text-white">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-[24px]">
          {emojiFor(first)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">
            {tr('Next holiday', '下一个假期')}
          </span>
          <span className="block truncate text-[17px] font-bold leading-6">{holidayName(first.name)}</span>
          <span className="block text-[12px] text-white/85 tabular-nums">{shortDate(first.date)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-center text-center">
          <span className="text-[30px] font-extrabold leading-8 tabular-nums">{big}</span>
          <span className="text-[11px] font-medium leading-4 text-white/90">{small}</span>
        </span>
      </div>

      {rest.length > 0 && (
        <ul className="divide-y divide-neutral-100 px-4">
          {rest.map((day) => {
            const days = daysBetween(today, day.date) - 1
            return (
              <li key={`${day.date}|${day.name}`} className="flex items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-center text-[18px]">{emojiFor(day)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-neutral-800">
                    {holidayName(day.name)}
                  </span>
                  <span className="block text-[12px] text-neutral-400 tabular-nums">{shortDate(day.date)}</span>
                </span>
                <span className="shrink-0 text-right text-[13px] font-semibold text-rose-500 tabular-nums">
                  {days === 0
                    ? tr('Today', '今天')
                    : days === 1
                      ? tr('Tomorrow', '明天')
                      : tr(`${days} days`, `${days} 天`)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
