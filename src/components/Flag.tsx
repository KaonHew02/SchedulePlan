import { useState } from 'react'
import CountryBadge from './CountryBadge'

/**
 * A country's actual flag.
 *
 * Not an emoji. A flag emoji is derivable from the two letters of the country
 * code — and on Windows it renders as those two bare letters, because no
 * shipped font covers the regional-indicator pairs. That is what `CountryBadge`
 * was built for, and it is still the fallback here: the image is fetched from
 * `public/flags`, one file at a time, and anything that 404s or fails to
 * decode falls back to the lettered chip rather than a broken-image box.
 *
 * The files come from `flag-icons` (MIT), copied in rather than imported so
 * nothing about them is in the bundle. A few carry detailed coats of arms and
 * run to a hundred kilobytes, which is only ever paid by somebody looking at
 * that country.
 */
export default function Flag({
  code,
  className = 'h-[18px] w-[26px]',
}: {
  code: string | null | undefined
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!code || failed) return <CountryBadge code={code ?? ''} />

  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/${code.toLowerCase()}.svg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[3px] object-cover ring-1 ring-black/10 ${className}`}
    />
  )
}
