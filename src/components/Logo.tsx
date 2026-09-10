/**
 * The app mark: a day's timeline, with the leading dot picked out in the same
 * blue the month grid uses. Pure geometry, so it needs no font and renders
 * identically everywhere. Kept in step with `public/favicon.svg` — change both.
 */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label="SchedulePlan">
      <rect width="256" height="256" rx="58" fill="#171717" />
      <circle cx="80" cy="76" r="13" fill="#2563eb" />
      <rect x="108" y="67" width="80" height="18" rx="9" fill="#fff" />
      <circle cx="80" cy="128" r="13" fill="#fff" opacity="0.5" />
      <rect x="108" y="119" width="62" height="18" rx="9" fill="#fff" opacity="0.75" />
      <circle cx="80" cy="180" r="13" fill="#fff" opacity="0.5" />
      <rect x="108" y="171" width="72" height="18" rx="9" fill="#fff" opacity="0.45" />
    </svg>
  )
}
