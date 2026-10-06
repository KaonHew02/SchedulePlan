# Opening with no signal

## What changed

**The notebook was always on the device. The app was not.** Every record, photo
and attachment lives in IndexedDB on the phone, so a tab that was already open
kept working when the signal went. But the page and its scripts came from
GitHub Pages every time the app was opened, and opened cold on a plane — from
the home screen, or after the phone had closed the tab to save memory — there
was nothing to show the notebook with. The browser showed its own offline page.

Now a **service worker** keeps a copy of the whole published site: the page,
the scripts, the map data, the holiday rules, all 186 flags and the icons,
about 2.7 MB on the phone (about 1 MB to download, compressed). Every
request for anything under `/SchedulePlan/` is answered from that copy. The
app opens in airplane mode, never having been opened that day.

## What works with no signal

| Works | Waits for a signal |
| --- | --- |
| Schedule, Reminders, Travel and the globe | Save to Drive, Load from Drive |
| Every attachment: photos, PDFs, text files | Fresh exchange rates (the last ones are kept) |
| Saved phrases, and the converter at the last rate | Translating something new |
| Export to a file | Scanning: the OCR engine is downloaded on first use |

Anything that fails for want of a signal says so, and nothing else stops working.

## Getting it onto a phone

1. **Open the site once with a connection.** The copy is made in the background:
   about 1 MB to download, once.
2. **Check it took.** More → tap the saved time in the bar → **Your data**. The
   **With no signal** line says when the app is saved in the browser.
3. **Install it, if you like.** It is not needed for the offline copy, but it
   puts SchedulePlan on the home screen and opens it without the browser bars.
   - **Android, Chrome:** ⋮ → *Add to Home screen* (or *Install app*). The
     installed app shares Chrome's storage, so the notebook is already there.
   - **iPhone, Safari:** Share → *Add to Home Screen*. **An app added to the
     home screen can get its own storage, separate from Safari's.** If it opens
     empty, the notebook has not gone: it is still in Safari. Move it across
     with Export → Import, or To Drive → From Drive. It is worth doing anyway.
     WebKit counts days of use separately for home-screen apps, which keeps
     Safari's seven-day clear-out of unused sites away from the notebook.

## When a new version is published

Pushing to `main` deploys as before. On the phone:

- **The next time the app is opened**, the browser fetches `sw.js` fresh (never
  from its HTTP cache), sees that it changed, and makes the new copy in the
  background. **Only files whose content changed are downloaded**: the page
  and the changed scripts. The flags and everything else move over from the
  old copy, so a deploy costs a few hundred KB rather than the whole copy, which matters
  when roaming.
- Then a bar appears: **A new version is ready · Reload**. It asks rather than
  reloading by itself, because a reload halfway through typing something would
  lose it.
- **Later** puts it off. The new version then arrives the next time every
  SchedulePlan tab has been closed.
- An app left open in the background looks for a new version when it is
  brought back to the front, at most every 30 minutes.

## How it is put together

| File | What it does |
| --- | --- |
| `src/sw.ts` | The worker. Makes the copy, answers from it, clears old copies |
| `scripts/service-worker.mjs` | Runs after `vite build`. Lists everything in `dist/` with a hash of each file, and writes `dist/sw.js` |
| `src/lib/offline.ts` | Registers the worker on the built site, and notices when a new version is waiting |
| `src/components/UpdateBar.tsx` | The *A new version is ready* bar |
| `public/manifest.webmanifest` | Name, colours and icons, for installing |
| `public/icons/`, `public/apple-touch-icon.png` | Drawn from `favicon.svg`. **Redraw them if the mark changes** |

The script is part of `npm run build`, so the Pages workflow runs it without
any change to `.github/workflows/pages.yml`.

**The security policy needed nothing new.** `worker-src 'self'` covers `sw.js`,
and the manifest and icons fall under `default-src 'self'`. The worker only
answers plain reads of the site's own files. Drive, the rate feeds, the
translators and the OCR engine go straight to the network, and the page's
policy still decides whether they are allowed.

## Trying it locally

```
npm run build
npm run preview
```

Open **http://localhost:4173/SchedulePlan/** once, then stop `npm run preview`
(or tick *Offline* in DevTools → Application → Service workers) and open the
address in a new tab. It opens anyway.

**Preview keeps its copy between builds, just like a phone.** After a rebuild,
the previous build answers first and the Reload bar appears. Tap it to see the
new one. DevTools → Application → Service workers → *Update on reload* skips
the step while working.

`npm run dev` never registers the worker. The dev server swaps code in as it
is saved, and a saved copy would only get in the way.

## Traps worth writing down

- **The copy is one per browser, like the notebook.** Clearing a site's data
  clears both.
- **`Vary` is ignored on purpose.** `vite preview` marks every file
  `Vary: Origin`, and the page asks for its scripts with an Origin header the
  copy was made without. Matching on it, the page came from the copy and the
  scripts did not, so the app opened offline as a blank page. The copy holds
  one answer per file, so the worker ignores `Vary`.
- **A copy is all or nothing.** If one file cannot be had, the install fails
  and nothing half-made ever answers. The previous copy carries on, and the
  browser tries again on the next visit.
