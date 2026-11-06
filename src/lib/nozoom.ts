/**
 * No zooming the app, the way a phone app does not zoom.
 *
 * iOS ignores user-scalable and maximum-scale for gestures, and the one CSS
 * value that stops a double tap (touch-action: manipulation, in index.css) is
 * also the one that allows a pinch, so the pinch is refused here.
 *
 * The page only: the touch events still arrive, so the map and the full view
 * keep their own pinch. Touch screens only: a trackpad pinch on a computer is
 * left alone.
 */
export function stopPageZoom(): void {
  if (!('ontouchstart' in window)) return

  const refuse = (event: Event) => event.preventDefault()
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(name, refuse)
  }

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1 && event.cancelable) event.preventDefault()
    },
    { passive: false },
  )
}
