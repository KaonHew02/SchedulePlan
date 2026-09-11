import { countryOf } from '../lib/places'

/**
 * A country, as a two-letter badge.
 *
 * Not a flag emoji, and that is deliberate. Flag emoji are regional indicator
 * pairs, and Windows ships no font that draws them — every flag there comes
 * out as the two bare letters, so a design leaning on them looks broken on
 * one of the platforms this app is used from and fine on the others. A badge
 * is the same everywhere, reads at any size, and needs no font at all.
 *
 * The tint comes from the continent, which means a wall of them still groups
 * by region at a glance.
 */

const CONTINENT_TINT: Record<string, string> = {
  AF: 'bg-amber-100 text-amber-800',
  AS: 'bg-rose-100 text-rose-800',
  EU: 'bg-brand-100 text-brand-700',
  NA: 'bg-sky-100 text-sky-800',
  SA: 'bg-lime-100 text-lime-800',
  OC: 'bg-teal-100 text-teal-800',
}

export default function CountryBadge({
  code,
  size = 'md',
}: {
  code: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
}) {
  const country = countryOf(code)
  const tint = country ? CONTINENT_TINT[country.continent] : 'bg-neutral-100 text-neutral-500'
  const scale =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'lg'
        ? 'px-2.5 py-1 text-[14px]'
        : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      title={country?.name ?? undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold tracking-wide ${tint} ${scale}`}
    >
      {country?.code ?? '··'}
    </span>
  )
}
