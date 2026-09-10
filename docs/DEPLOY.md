# Going live

## Why GitHub Pages could not host what Phase 1 built

Phase 1 was FastAPI plus SQLite, exactly as the spec asked. GitHub Pages is a
**static file host**: it serves HTML, CSS, JavaScript and images exactly as
committed. It does not run Python, and it has no writable disk.

Two things follow, and both are fatal for the original build:

1. **Nothing can be saved.** There is no process to receive a new schedule item
   and no disk to write it to.
2. **A committed database is a published database.** Committing
   `scheduleplan.db` to a public repo to get data onto the site would make
   every appointment readable by anyone who found the URL.

This is not a flaw in how the app was written. Anything that saves data needs
somewhere that runs code and can write. Pages is neither.

## The options that were on the table

### Option A — Keep the Python backend, pay a host

Render, Railway and Fly run what Phase 1 built, untouched. One URL, works on
the phone, real database, syncs between devices for free.

Costs about **US$5–7/month**, and the catch: free tiers on those hosts use
*ephemeral* disks that are wiped on restart, which would silently delete the
database. The persistent volume is the paid part.

### Option B — Google Cloud Run plus Firestore or Cloud SQL

Keeps Python and puts the app next to the Drive credential. More moving parts
than any of the others — a Dockerfile, a service, a database rewire — and Cloud
SQL has a monthly floor.

### Option C — Static site, data in the browser

No server at all. The screens are the same React app; the data layer moves from
HTTP calls to `localStorage`, and a Drive file is the copy that outlives the
browser.

## What was chosen — Option C, on 2026-09-10

**GitHub Pages for the screens, this browser's storage for the data, Drive for
the copy.** Free, no server, no bill, and it matches every other app on the
account.

The port was small because of where the seam was: `api.ts` was the only file
that knew data came from a server. It became [`src/lib/store.ts`](../src/lib/store.ts)
with the same four functions, and not one screen changed.

**The FastAPI backend was deleted from the working tree**, not archived. It held
no data — it was a day old and the database was empty — so keeping a dead Python
server in a static repo would only confuse. It is in git history at commit
`b03b945` if it is ever wanted back.

## What this route costs you

**Your schedule has exactly one copy, and you are holding it.**

- **It lives in one browser, at one address.** `localhost:5173` and the Pages
  URL are separate stores. Your phone is a third.
- **Clearing browsing data deletes everything** unless a copy is elsewhere.
  That is what Export and the Drive buttons in More are for.
- **`localStorage` caps at about 5 MB** — thousands of items, not millions.
- Nothing syncs by itself, and nobody can recover it for you.

**Export and the Drive sync are what make this survivable.** Export writes one
`scheduleplan-YYYY-MM-DD.json`; Import reads it back, here or on another
machine. Import *replaces* rather than merges — merging two schedules means
guessing which entries are the same, and guessing wrong quietly duplicates a
day — so it states what is in the file and what is about to go, and waits.

## The one thing this decision costs later

**Phases 4 and 6 are the receipt scanner and the itinerary scanner, and both
need an AI/OCR provider.** A static site has nowhere safe to keep an API key —
anything shipped in the bundle is readable by anyone who opens the page. When
you reach those phases there are three honest routes:

1. **You paste your own key**, kept in this browser's storage and never
   committed. Fine for one person; the key is only as safe as the browser.
2. **A small serverless function** (Cloudflare Workers or Netlify Functions,
   both free at this size) holds the key and proxies the call.
3. **A provider with browser-safe, origin-restricted keys.**

Nothing needs deciding now. It is written down here so it is not a surprise in
Phase 4.

## Publishing

Pushing to `main` is the whole deployment. `.github/workflows/pages.yml` builds
the site and publishes it.

One-time setup on the repo:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main`. The Actions tab shows the build; it takes about a minute.
3. The site is at **https://kaonhew02.github.io/SchedulePlan/**

`vite.config.ts` sets `base: '/SchedulePlan/'` because the site is served from a
sub-path, not the domain root. **If the repo is ever renamed, that string must
change with it**, or every asset 404s and the page loads blank.
