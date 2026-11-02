/**
 * Taking the opening screen away (index.html, public/splash.css).
 *
 * Not the moment the notebook is read: off a phone's disk that can take a
 * tenth of a second, and a plane that flashes up and vanishes reads as a
 * glitch, not a loading screen. So it stays until the page has been open for
 * at least SHOW_FOR — one turn of the plane round the globe — and then fades.
 * A phone set to reduce motion has no plane going round, so it goes as soon
 * as the app is ready.
 */

const SHOW_FOR = 1300
const FADE = 400

export function hideSplash(): void {
  const splash = document.getElementById('splash')
  if (!splash) return

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const wait = still ? 0 : Math.max(0, SHOW_FOR - performance.now())

  window.setTimeout(() => {
    splash.classList.add('is-done')
    window.setTimeout(() => splash.remove(), FADE)
  }, wait)
}
