/**
 * Putting SchedulePlan on the home screen.
 *
 * Three ways it can go, and the More sheet says the right one:
 *
 *   - **Already there.** Opened from the home screen, the page is in
 *     `standalone` display mode (or, on an older iPhone, `navigator.standalone`
 *     is true). Nothing to say.
 *   - **Chrome and Edge** fire `beforeinstallprompt` when the site can be
 *     installed. Kept, it becomes an Install button that opens the browser's
 *     own dialog.
 *   - **iPhone and iPad** never fire it. Safari only installs from Share →
 *     Add to Home Screen, so the most a page can do is say where that is.
 *
 * The event can fire before React has drawn anything, so it is caught here,
 * when this module is first imported, not in a component.
 */

import { useSyncExternalStore } from 'react'

/** Chrome's event. Not in TypeScript's DOM types, because it is not a standard. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallWay = 'installed' | 'prompt' | 'ios' | 'menu'

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Without this, Chrome shows its own mini-bar over the tab bar.
    event.preventDefault()
    deferred = event as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

function standalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** An iPad on iPadOS 13+ says it is a Mac; the touch screen gives it away. */
function apple(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function way(): InstallWay {
  if (installed || standalone()) return 'installed'
  if (deferred) return 'prompt'
  if (apple()) return 'ios'
  return 'menu'
}

export function useInstallWay(): InstallWay {
  return useSyncExternalStore(subscribe, way, () => 'installed')
}

/** Chrome's own Install dialog. A no-op when there is no event to answer. */
export async function promptInstall(): Promise<void> {
  const event = deferred
  if (!event) return
  // The event is single use: once prompted it cannot be prompted again.
  deferred = null
  emit()
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') installed = true
  emit()
}
