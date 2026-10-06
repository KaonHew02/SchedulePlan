/**
 * The offline worker, from the page's side.
 *
 * Registers sw.js (src/sw.ts) and keeps two facts the screens can show:
 * whether this browser holds a copy of the app that opens with no signal, and
 * whether a newer copy has arrived and is waiting for a reload.
 *
 * Built site only. The dev server rebuilds a module on every save, and a worker
 * answering from a saved copy would hand yesterday's code to the person writing
 * today's. `npm run preview` is where to see it.
 */

import { useSyncExternalStore } from 'react'

export type OfflineState =
  /** No worker: the dev server, or a browser that will not run one. */
  | 'unavailable'
  /** Registered and still copying the site — the first visit. */
  | 'preparing'
  /** A whole copy is in place: the app opens here with no signal. */
  | 'ready'

/** How often a phone that keeps the app open for days looks for a new version. */
const CHECK_EVERY = 30 * 60 * 1000

let state: OfflineState = 'unavailable'
let waiting: ServiceWorker | null = null
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

export function registerOffline(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  state = 'preparing'

  // `ready` settles once a worker has finished copying the site and is active,
  // which is exactly when opening with no signal starts to work.
  void navigator.serviceWorker.ready.then(() => {
    state = 'ready'
    emit()
  })

  // After load: the copy is two hundred-odd downloads, and they should not
  // queue ahead of the page's own first paint.
  const register = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(watch)
      .catch(() => {
        state = 'unavailable'
        emit()
      })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

function watch(registration: ServiceWorkerRegistration) {
  // A controller means this page is already served from a copy, so a worker
  // that finishes installing now is a newer one. With no controller it is the
  // first copy, which takes over by itself and has nothing to offer.
  const offer = (worker: ServiceWorker) => {
    if (!navigator.serviceWorker.controller) return
    waiting = worker
    emit()
  }

  // Downloaded on an earlier visit and never applied.
  if (registration.waiting) offer(registration.waiting)

  registration.addEventListener('updatefound', () => {
    const incoming = registration.installing
    incoming?.addEventListener('statechange', () => {
      if (incoming.state === 'installed') offer(incoming)
    })
  })

  // The browser looks for a new sw.js whenever the app is opened. An app left
  // open in the background is never opened again, only brought back — so look
  // then too, now and again.
  let checked = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    if (Date.now() - checked < CHECK_EVERY) return
    checked = Date.now()
    void registration.update().catch(() => undefined)
  })
}

/** Swap the waiting version in, and reload onto it. */
export function applyUpdate(): void {
  if (!waiting) return
  // Reload once the new worker is in charge, not before, or the old copy
  // would answer the reload.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  })
  waiting.postMessage('skip-waiting')
}

export function useOfflineState(): OfflineState {
  return useSyncExternalStore(subscribe, () => state)
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => waiting !== null)
}
