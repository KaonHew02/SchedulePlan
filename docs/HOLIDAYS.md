# Public holidays, every year

## The short version

**Nothing has to be done when a year turns.** Malaysia's holidays come from the
government's own list, and a GitHub workflow checks for a new one every
morning. When it finds one, it updates the app and publishes the site. The
phone picks up the new dates the next time the app is opened.

## Where the dates come from

| What | From | Kept in |
| --- | --- | --- |
| Malaysia, every year the government has published | The Prime Minister's Department's PDF, [kabinet.gov.my/hari-kelepasan-am](https://www.kabinet.gov.my/hari-kelepasan-am/) | `src/lib/holidays-my.json` |
| Extra days announced later (20 Mar 2026 for Raya, 15 Sep 2025 for Malaysia Day) | Google's public holiday calendar for Malaysia | the same file, under `extras` |
| Replacement days (a Sunday holiday's Monday) | Worked out by the app, by the rule in `src/lib/holidays-my.ts` | not stored |
| Malaysia, a year not published yet | The date-holidays library, worked out | not stored; shown as **not confirmed yet** |
| Every other country | The date-holidays library, worked out for any year | not stored |

The government usually publishes next year's list in August (2027's came out
in August 2026). Until it does, that year's Malaysian holidays say **not
confirmed yet** under their name. Most will be right; the ones that follow
the moon — Raya, Awal Muharram, Maulidur Rasul — can be a day out.

Other countries do not need a yearly update: their rules (Easter, the Chinese
calendar, "first Monday of June") work for any year.

## How the daily check works

`.github/workflows/holidays.yml` runs at 08:17 Malaysian time and does this:

1. `npm run holidays` (`scripts/holidays.mjs`) opens the government's holiday
   page, downloads every year's PDF linked there, and reads the tables in them
   (`scripts/holidays-pdf.mjs`).
2. It checks Google's calendar for days the whole country was given after the
   PDF was printed, and adds those.
3. If `src/lib/holidays-my.json` changed, the workflow commits it as
   *"Holidays: the government's latest list"* and starts the deploy.
4. On a day nothing changed, there is no commit and no deploy.

Each run says what it found on its own page in the Actions tab — "No change.
Official lists for 2023–2027", or what was added — and anyone can read it
there without signing in to GitHub. A warning in yellow (the government's
site was down that morning) needs nothing doing.

Reading the PDF is the delicate part. Every year's is drawn differently — a √
for yes in one year, a - for no in another, a Wingdings tick in a third — so
the reader finds each row by what it says (a day, a Malay month and the
weekday) and checks the weekday against the date. Before anything is written,
it also checks a dozen things that are always true, like Federal Territory Day
belonging only to KL, Labuan and Putrajaya. If a table is misread, those
checks fail and nothing is written. An old calendar is better than a wrong one.

## If it fails

GitHub emails the repository's owner when a run fails, and the run shows red
on the **Actions** tab. It fails for two reasons only:

- **A new year's PDF could not be read.** The government changed the layout
  again. The app is still fine: it shows that year as *not confirmed yet*.
  To fix it, open a Claude Code session in this repo and ask it to make
  `scripts/holidays-pdf.mjs` read the new PDF. The error message in the run
  says which year and why.
- **It is December and next year's list is still missing.** Either the
  government is late, or the page moved, or the site turned GitHub away. Open
  the page above and look. If the PDF is there, the cause is on this side.

A day when the government's site is down is not a failure. The run just says
so, and the next morning's run tries again.

## Doing it by hand

- **On GitHub:** Actions → *Update holidays* → **Run workflow**.
- **On the laptop:** `npm run holidays`, then commit `src/lib/holidays-my.json`
  if it changed.

A push that changes the updater itself (`scripts/holidays*.mjs` or the
workflow) runs it straight away too, so a fix is tried on GitHub's machines
at once.

## Two things to know

- **The workflow commits to `main` by itself.** On a day it has, pushing from
  the laptop is refused until its commit is pulled: `git pull --rebase`, then
  push again. It only commits when the holidays change, a few times a year.
- **GitHub switches off a schedule** in a public repository after 60 days
  with no commits. The workflow switches itself back on every time it runs,
  which stops that happening. If it ever is switched off, the Actions tab says
  so and has a button to switch it back on.
