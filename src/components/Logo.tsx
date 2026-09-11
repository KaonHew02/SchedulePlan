import { useId } from 'react'

/**
 * The app mark: a globe with a plane going round it.
 *
 * It replaced the day-timeline mark once travel became a module of its own —
 * the notebook is now as much about where you are going as about what time it
 * starts. Pure geometry, so it needs no font and renders identically
 * everywhere.
 *
 * Two details do the work:
 *
 * - The orbit is one ellipse drawn through a mask that hides it where it
 *   crosses the *top* of the globe. That is what makes the line read as going
 *   behind the planet and back out in front of it; without the mask it sits
 *   flat on top and the whole thing reads as a circle with a line through it.
 * - The plane is stroked in the tile colour underneath its own white fill
 *   (`paintOrder`), which cuts a clean gap where it crosses the orbit. Drawn
 *   without it the two shapes merge into one unreadable squiggle.
 *
 * Kept in step with `public/favicon.svg` and `public/logo-mark.svg` — the three
 * hold the same shapes and change together.
 */
export default function Logo({ size = 40 }: { size?: number }) {
  // Several logos can be on one page (nav and More), and duplicate mask ids
  // would make the second one reuse the first's.
  const mask = useId()

  return (
    <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label="SchedulePlan">
      <defs>
        <mask id={mask}>
          <rect width="256" height="256" fill="#fff" />
          <path d="M62 140 A50 50 0 0 0 162 140 Z" fill="#000" />
        </mask>
      </defs>

      <rect width="256" height="256" rx="58" fill="#6C5CE7" />

      <g fill="none" stroke="#fff" strokeLinecap="round">
        <ellipse
          cx="126"
          cy="132"
          rx="88"
          ry="30"
          strokeWidth="11"
          transform="rotate(-22 126 132)"
          mask={`url(#${mask})`}
        />
        <circle cx="112" cy="134" r="50" strokeWidth="11" />
        <ellipse cx="112" cy="134" rx="20" ry="50" strokeWidth="8" />
        <path d="M62 134 H162" strokeWidth="8" />
      </g>

      <g transform="translate(200 80) rotate(-28) scale(0.62)">
        <path
          d="M30 0 2 6l-18 20h-6l14-20h-16l-8 8h-4l4-10-4-10h4l8 8h16l-14-20h6l18 20z"
          fill="#fff"
          stroke="#6C5CE7"
          strokeWidth="13"
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </g>
    </svg>
  )
}
