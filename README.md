# SchedulePlan

Short form **S.P**. A clean digital notebook for your schedule and spending.

**Live at [kaonhew02.github.io/SchedulePlan](https://kaonhew02.github.io/SchedulePlan/)**

**Phase 1 (done): Schedule.** Day / week / month views, add, edit, delete,
details, Export / Import, Drive backup. Expenses, currency, receipts, bill
split and the itinerary scanner come in later phases.

---

## Running it

One command — see [docs/RUNNING.md](docs/RUNNING.md).

```
npm install
npm run dev
```

Then open **http://localhost:5173/SchedulePlan/** (the base path matters).

## Where the data lives

**In your browser, and nowhere else** unless you put it somewhere. There is no
server and no account.

That is a deliberate trade and it has teeth: clearing site data clears the
schedule, and `localhost` and the live site keep separate copies. **More →
Backup** is what makes it survivable:

- **Export / Import** — one JSON file. No account, no internet, no setup.
- **Save to Drive / Load from Drive** — one file in one Drive folder. Needs a
  few minutes of Google Cloud setup, once: [docs/DRIVE.md](docs/DRIVE.md).

Both replace rather than merge, and both say what they are about to overwrite
before they do it.

The reasoning behind all of this, and what it costs later, is in
[docs/DEPLOY.md](docs/DEPLOY.md).

## Name and logo

The mark deliberately does not use the letters. It is a day's timeline: three
rows falling back into the distance, with the first picked out by the same blue
dot the month grid puts under a day that has something on it. Rectangles and
circles only, so it needs no font.

| | |
| --- | --- |
| Ink | `#171717` |
| Accent (the leading dot) | `#2563eb` |
| Row fade | 100% / 75% / 45% white |
| Tile corner | `rx 58` on a 256 grid |

`public/favicon.svg`, `public/logo-mark.svg` (ink, for light backgrounds) and
`src/components/Logo.tsx` hold the same shapes. Change them together.

## How it fits together

```
SchedulePlan/
  .github/workflows/pages.yml   Builds and publishes on every push to main
  docs/                         DEPLOY, DRIVE, RUNNING
  public/                       favicon.svg, logo-mark.svg
  src/
    App.tsx                     Three screens + bottom nav + toast
    types.ts                    Shared types
    lib/
      store.ts                  THE data layer - localStorage, the only file
                                that knows where records live
      drive.ts                  Google sign-in and the Drive read/write
      drive-config.ts           Client ID and folder ID (both safe to publish)
      date.ts                   Date maths and formatting (no date library)
      tags.ts                   The seven optional tags and their emoji
    components/                 BottomNav, Sheet, Toast, EmptyState, Icons, Logo
    screens/                    ScheduleScreen, ExpensesScreen, MoreScreen
    schedule/                   DayView, WeekView, MonthView, ItemRow,
                                ScheduleForm, ScheduleDetail
```

React + TypeScript + Tailwind, built by Vite. No runtime dependencies beyond
React itself.

## The data shape

One record type so far. It is stored as JSON under the `scheduleplan:v1` key,
and the same shape is what Export writes and Drive holds.

```json
{
  "format": "scheduleplan.backup",
  "version": 1,
  "savedAt": "2026-09-10T12:00:00.000Z",
  "schedule": [
    {
      "id": 1,
      "date": "2026-09-10",
      "start_time": "18:00",
      "end_time": "20:00",
      "title": "Badminton",
      "location": "PJ Sports Centre",
      "notes": "With friends",
      "tag": "sports"
    }
  ]
}
```

`end_time`, `location`, `notes` and `tag` are nullable. `tag` is one of
`personal`, `work`, `travel`, `food`, `sports`, `event`, `other`.

Later phases add `expenses`, `attachments`, `people`, `bill_splits` and
`exchange_rates` as sibling arrays in the same envelope, and `version` goes up
if an old file ever needs migrating on import.

## Notes for later phases

- Dates travel as `YYYY-MM-DD` strings and times as `HH:MM` strings, end to
  end, so nothing ever shifts across a timezone.
- **`store.ts` is the seam.** It was an HTTP client until 2026-09-10 and no
  screen noticed the swap. Anything that changes where data lives changes that
  file and nothing else.
- `Sheet` is the one modal pattern — the expense form, receipt review and bill
  split should use it rather than new full screens.
- Expenses attach to a schedule item by `schedule_item_id`; the schedule item
  itself does not change.
- Phases 4 and 6 need an AI/OCR provider, and a static site has nowhere safe
  for an API key. The three honest routes are written up in
  [docs/DEPLOY.md](docs/DEPLOY.md).
