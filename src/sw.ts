/**
 * The offline worker: what lets SchedulePlan open with no signal at all.
 *
 * Before it, the notebook survived airplane mode and the page did not. Every
 * record and every attachment was already in IndexedDB on the phone; what was
 * missing was the app itself — the page, the scripts, the flags — which the
 * browser had to fetch from GitHub Pages before it could show any of it. Open
 * it cold on a plane and there was nothing to show the notebook with.
 *
 * So the worker keeps one copy of the whole published site, and answers every
 * request for it from that copy:
 *
 * - **Everything under the site comes from the copy, always.** Not network
 *   first: on hotel wifi or one bar of signal, waiting for the network to give
 *   up is the slow part, and the copy is never older than the newest deploy
 *   this browser has seen.
 * - **Nothing else is touched.** Drive, the rate feeds, the translators and
 *   the OCR engine go straight to the network, exactly as with no worker, and
 *   the page's security policy still decides whether they are allowed.
 * - **A new version waits to be asked.** A deploy is noticed the next time the
 *   app is opened, its copy is made in the background, and the page offers a
 *   reload (lib/offline.ts). Swapping it in under a running page would leave
 *   that page asking for scripts the new copy no longer has.
 * - **Only what changed is downloaded again.** The first copy is the whole
 *   site, about 2.7MB, most of it flags and the holiday rules. After that a
 *   deploy costs the page and whichever scripts changed; everything else
 *   moves over from the old copy.
 *   That matters on the one network this app is most used on: roaming.
 *
 * `scripts/service-worker.mjs` compiles this after `vite build` and puts two
 * constants in front of it: PRECACHE, every published file with a hash of its
 * content, and VERSION, a hash of all of them. Any change to any file is a new
 * version.
 *
 * It is type-checked with the app's browser types, which do not describe a
 * service worker, so the few parts of that world it uses are described here.
 */

interface ExtendableEvent extends Event {
  waitUntil(work: Promise<unknown>): void
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request
  respondWith(response: Promise<Response>): void
}

declare const self: {
  readonly registration: { readonly scope: string }
  readonly clients: { claim(): Promise<void> }
  skipWaiting(): Promise<void>
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

declare const VERSION: string
/** [path under the site, hash of its content] for every published file. */
declare const PRECACHE: readonly (readonly [string, string])[]

const PREFIX = 'scheduleplan-'
const CACHE = `${PREFIX}${VERSION}`

/** https://kaonhew02.github.io/SchedulePlan/ — or localhost, under preview. */
const SCOPE = self.registration.scope

/** What a page load is answered with, whatever path under the site it asked for. */
const SHELL = new URL('index.html', SCOPE).href

/**
 * Where a copy notes the hash of every file in it, so that the next copy can
 * tell which files it may take over. Not a path the site has.
 */
const HASHES = new URL('__offline-hashes__', SCOPE).href

self.addEventListener('install', (event) => {
  // All or nothing: one file that cannot be had fails the install, and a
  // worker whose install failed never takes over, so a half-made copy is never
  // the one that answers. The browser tries again on the next visit.
  event.waitUntil(makeCopy())
})

async function makeCopy(): Promise<void> {
  const cache = await caches.open(CACHE)
  const before = await earlierFiles()

  await Promise.all(
    PRECACHE.map(async ([path, hash]) => {
      const url = new URL(path, SCOPE).href

      const earlier = before.get(url)
      if (earlier?.hash === hash) {
        const kept = await earlier.cache.match(url, { ignoreVary: true })
        if (kept) return cache.put(url, kept)
      }

      // `reload` goes past the HTTP cache. GitHub Pages lets a browser keep
      // index.html for ten minutes, and a stale one would name scripts that
      // this copy does not have.
      const response = await fetch(url, { cache: 'reload' })
      if (!response.ok) throw new Error(`${path} could not be copied: ${response.status}`)
      return cache.put(url, response)
    }),
  )

  // Written last: a copy with its hashes noted is a whole copy.
  const hashes = Object.fromEntries(PRECACHE)
  await cache.put(
    HASHES,
    new Response(JSON.stringify(hashes), { headers: { 'Content-Type': 'application/json' } }),
  )
}

/** Every file in an earlier whole copy, with its hash and the copy it is in. */
async function earlierFiles(): Promise<Map<string, { hash: string; cache: Cache }>> {
  const files = new Map<string, { hash: string; cache: Cache }>()
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || name === CACHE) continue
    const cache = await caches.open(name)
    // No hashes means an install that stopped partway; nothing in it is vouched for.
    const noted = await cache.match(HASHES)
    if (!noted) continue
    const hashes = (await noted.json()) as Record<string, string>
    for (const [path, hash] of Object.entries(hashes)) {
      files.set(new URL(path, SCOPE).href, { hash, cache })
    }
  }
  return files
}

self.addEventListener('activate', (event) => {
  // Older copies go once this one is in charge; nothing is served from them
  // after this. claim() also takes over the page that installed it, so the
  // very first visit is covered: the parts it has not loaded yet — the globe,
  // the scanner — come from the copy if the signal goes mid-visit.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  // The page's Reload button: take over now, rather than once every
  // SchedulePlan tab has been closed.
  if (event.data === 'skip-waiting') void self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Other servers, and anything that is not a plain read, go past untouched.
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return
  event.respondWith(answer(request))
})

async function answer(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE)
  // ignoreSearch: the favicon is asked for as favicon.svg?v=2, and a page
  // opened with a query string on it is still the page.
  //
  // ignoreVary: the copy holds one answer per file, whatever asked for it. A
  // server that marks its files `Vary: Origin` — `vite preview` does — would
  // otherwise miss every script, because the page asks for its scripts with
  // an Origin header and the copy was made without one. The page shell
  // matched, the scripts did not, and the app opened offline as a blank page.
  const hit = await cache.match(request, { ignoreSearch: true, ignoreVary: true })
  if (hit) return hit
  if (request.mode === 'navigate') {
    const shell = await cache.match(SHELL)
    if (shell) return shell
  }
  // Not in the copy — the browser cleared it, or the file is newer than it.
  return fetch(request)
}
