import { flushSync } from 'react-dom'

/**
 * Change screens the way an app does: the old one fades, the new one settles
 * in from a little below (the keyframes are in index.css).
 *
 * The browser's View Transitions draw it from two pictures of the page, so
 * nothing in the page itself is ever moved. Animating a wrapper with a CSS
 * transform would have done the same — and for the length of the animation
 * every sheet and button pinned with `position: fixed` inside it would have
 * been pinned to the wrapper instead of the screen.
 *
 * A browser without them (Safari before 18) just changes, as it always did;
 * so does a phone set to reduce motion. flushSync is what lets the browser
 * take its second picture: React has to have drawn the new screen by the time
 * the callback returns.
 */
export function withTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown }
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}
