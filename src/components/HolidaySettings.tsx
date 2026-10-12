import { useEffect, useState } from 'react'
import CountrySelect from './CountrySelect'
import { aboutCountry, type HolidayCountry } from '../lib/holidays'
import { MALAYSIA_YEARS } from '../lib/holidays-my'
import { tr } from '../lib/i18n'
import { updateSettings, useSettings } from '../lib/store'

/**
 * Whose holidays go on the calendar, and which state's.
 *
 * The state matters more than it looks. In Malaysia a third of the holidays
 * belong to some states and not others — Thaipusam, Hari Gawai, every
 * Sultan's birthday — and with no state picked only the federal ones show.
 */
export default function HolidaySettings() {
  const { holidayCountry: country, holidayRegion: region } = useSettings()
  const [about, setAbout] = useState<{ country: string; info: HolidayCountry | null } | null>(
    null,
  )

  useEffect(() => {
    if (!country) return
    let live = true
    aboutCountry(country)
      .then((info) => live && setAbout({ country, info }))
      // No signal and no offline copy yet: say nothing rather than "unsupported".
      .catch(() => live && setAbout({ country, info: null }))
    return () => {
      live = false
    }
  }, [country])

  const info = about?.country === country ? about.info : null
  const regions = info?.regions ?? []

  return (
    <>
      <div className="divide-y divide-neutral-100 border-y border-neutral-100">
        <div className="flex items-center justify-between gap-3 py-3.5">
          <span className="min-w-0">
            <span className="block text-[15px]">{tr('Public holidays', '公共假期')}</span>
            <span className="block text-[13px] text-neutral-400">
              {tr('In red on the calendar', '在日历上用红色显示')}
            </span>
          </span>
          <CountrySelect
            value={country}
            onChange={(code) => updateSettings({ holidayCountry: code, holidayRegion: null })}
            label={tr('Holidays of', '假期所属国家')}
            placeholder={tr('None', '无')}
            clearable
            clearLabel={tr('No holidays', '不显示假期')}
          />
        </div>

        {regions.length > 0 && (
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="min-w-0">
              <span className="block text-[15px]">{tr('State', '州/地区')}</span>
              <span className="block text-[13px] text-neutral-400">
                {tr('For its own holidays too', '连当地自己的假期也显示')}
              </span>
            </span>
            <select
              value={region ?? ''}
              onChange={(event) => updateSettings({ holidayRegion: event.target.value || null })}
              aria-label={tr('State or region', '州或地区')}
              className="max-w-[190px] truncate rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] font-medium outline-hidden transition-colors hover:bg-neutral-200/70 focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="">{tr('Whole country', '全国')}</option>
              {regions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
        {info && !info.supported ? (
          tr('There is no holiday list for this country yet.', '这个国家暂时还没有假期列表。')
        ) : (
          <>
            {tr(
              "On a trip abroad, that country's holidays show on the trip days too. ",
              '出国旅行时，旅行那几天也会显示当地的假期。',
            )}
            {country === 'MY'
              ? tr(
                  `Malaysia's dates come from the government's official list, which this app has for ${MALAYSIA_YEARS.first}–${MALAYSIA_YEARS.last} and checks for a new year every day. A later year shows as "not confirmed yet" until the list comes out.`,
                  `马来西亚的日期来自政府公布的官方列表，本应用已有 ${MALAYSIA_YEARS.first}–${MALAYSIA_YEARS.last} 年的，并且每天检查有没有新一年的列表。之后的年份在列表公布前会显示「尚未确认」。`,
                )
              : tr(
                  'The dates are worked out, so a holiday that follows the moon may be one day off.',
                  '日期是推算出来的，所以按月亮定的假期可能会差一天。',
                )}
          </>
        )}
      </p>
    </>
  )
}
