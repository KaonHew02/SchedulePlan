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
- **Records and attachments live in IndexedDB**, which is measured in
  gigabytes rather than the ~5 MB localStorage allowed. The app asks the
  browser to mark the data as persistent, which is a request and not a
  guarantee — **Your data** in More says whether it was granted.
- Nothing syncs by itself, and nobody can recover it for you.

**Export and the Drive sync are what make this survivable.** Export writes one
`scheduleplan-YYYY-MM-DD.json`; Import reads it back, here or on another
machine. Import *replaces* rather than merges — merging two schedules means
guessing which entries are the same, and guessing wrong quietly duplicates a
day — so it states what is in the file and what is about to go, and waits.

## The scanners, and the API key that is not there

**Phases 4 and 6 — the receipt scanner and the itinerary scanner — were the
one thing this decision looked like it would cost.** Both wanted an AI or OCR
provider, and a static site has nowhere safe to keep a key: anything shipped in
the bundle is readable by anyone who opens the page. Three routes were written
down here as the honest options — paste your own key, proxy it through a small
serverless function, or find a provider with origin-restricted browser keys.

**None of them was taken.** The recognition runs *in the browser*: Tesseract
compiled to WebAssembly, pulled from a CDN the first time something is scanned
and not before. No key exists, so no key can leak, and the app still needs no
account and no server.

What that costs instead:

- **Accuracy.** It is meaningfully worse than a paid cloud model, especially on
  a crumpled thermal receipt.
- **A ~12 MB download** the first time per session, which the screens warn
  about before you start.
- **A CDN dependency** — `cdn.jsdelivr.net` for the worker and
  `tessdata.projectnaptha.com` for the English data. Offline, scanning fails
  with a plain message; everything else keeps working.

The rule that makes the accuracy affordable: **nothing a scanner reads is ever
saved on its own.** A receipt fills in a form you correct, with the other
amounts it saw offered as one-tap alternatives. An itinerary produces a list
with a tick beside each row, and adds only what stays ticked. If the OCR is
wrong, you see it wrong before it is anywhere.

If accuracy ever matters more than independence, the seam is `lib/ocr.ts`:
`readText` is the only function that knows what engine is behind it, and the
three routes above are still there.

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
