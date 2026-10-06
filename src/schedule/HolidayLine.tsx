import CountryBadge from '../components/CountryBadge'
import { countryName } from '../lib/places'
import { useSettings } from '../lib/store'
import type { Holiday } from '../lib/holidays'

/**
 * A public holiday, as a line above the day's cards.
 *
 * Not a card. A card is something you put in the diary and can open, edit and
 * delete; a holiday is a fact about the day, and making it look like an item
 * would invite tapping it to find there is nothing to do. So it is a line of
 * red — the red a printed calendar uses for the days off — and nothing more.
 *
 * Another country's holiday, from a trip, carries that country's badge so it
 * is not mistaken for a day off at home.
 */
export default function HolidayLine({ holiday }: { holiday: Holiday }) {
  const { holidayCountry: home } = useSettings()
  const abroad = holiday.country !== home

  const kind = holiday.replacement ? 'Replacement holiday' : 'Public holiday'
  const where = abroad ? ` in ${countryName(holiday.country)}` : ''
  // A year the government has not published yet: right most of the time,
  // but Raya can still move by a day, and saying so is cheaper than a
  // surprise.
  const unsure = holiday.estimated ? ' · not confirmed yet' : ''

  return (
    <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2">
      {abroad && <CountryBadge code={holiday.country} size="sm" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-rose-700">
          {holiday.name}
        </span>
        <span className="block text-[12px] text-rose-500">
          {kind}
          {where}
          {unsure}
        </span>
      </span>
    </div>
  )
}

/** The lines for one day, or nothing. */
export function HolidayLines({
  holidays,
  className = '',
}: {
  holidays: Holiday[] | undefined
  className?: string
}) {
  if (!holidays?.length) return null
  return (
    <div className={`space-y-1.5 ${className}`}>
      {holidays.map((holiday) => (
        <HolidayLine key={`${holiday.country}:${holiday.name}`} holiday={holiday} />
      ))}
    </div>
  )
}
