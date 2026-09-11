# SchedulePlan

Short form **S.P**. A clean digital notebook for your schedule and spending.

**Live at [kaonhew02.github.io/SchedulePlan](https://kaonhew02.github.io/SchedulePlan/)**

All seven phases are in, plus Travel. Schedule with whole-day and multi-day
items, Reminders that can run from one date until another, Expenses in any
currency, a converter, a bill split that works out who owes whom, a scanner
that reads a receipt or a booking with no account and no API key, and a Travel
screen that counts where you have been.

Five tabs — Schedule, Travel, Expenses, Reminders, More. Everything else lives
behind **More**.

---

## Running it

One command — see [docs/RUNNING.md](docs/RUNNING.md).

```
npm install
npm run dev
```

Then open **http://localhost:5173/SchedulePlan/** (the base path matters).

## What it does

**Schedule** — day, week and month views. An item can be a whole day, and it
can run from one date to another, which is what a trip actually is. A spanning
item appears on every day it covers and says which day of it you are looking
at. Items carry your own tags, a location, notes and attachments.

**Reminders** — due date and time, optionally running *until* a later date and
time, optionally repeating daily or weekly inside that window. Alerts only fire
while a tab is open; there is no server to send them otherwise, and the screen
says so.

**Expenses** — what you spent, in whatever currency you spent it, grouped by
month with a breakdown by category. Anything paid in a foreign currency keeps
the original amount, the currency and the rate **frozen at the moment you saved
it**, so a rate that moves next week never restates what last week's dinner
cost. An expense can hang off a schedule item, which is how a trip adds up.

**Currency** — a converter over a keyless public rate feed, cached for the day
so it still works on a plane. The rate can be overridden by hand, because the
money changer's rate is the one that actually applied and it is rarely the
market's.

**Bill split** — who is in, what each person paid for, split evenly or by
exact amounts, and then the fewest payments that settle everybody up.

**Travel** — countries, destinations and continents counted off the schedule,
a goal to aim at, a globe you can spin with a dot on everywhere you have been,
every trip with what it cost, and a wishlist of where to go next. Nothing is
entered twice: see below.

**Scanner** — photograph a receipt or a booking. The lighting is flattened out
of the photo, the text is read, and the fields are *offered* in a form you
correct before anything is saved. See below for why that matters.

## Attachments, scanning, and where the OCR runs

Images and documents attach to schedule items and expenses. Photos are shrunk
to 1800px and re-encoded on the way in; a 4MB camera file is not worth keeping
whole for a 390px screen.

**Scan** is different from **Photo**. A phone picture of paper has one corner
in shadow and a hand's silhouette across the middle, and turning up the
contrast just makes the dark corner black. So the shading is estimated with a
heavy box blur and every pixel is divided by its own local brightness — ink
stays dark because it is dark *relative to the paper beside it*, wherever that
paper happens to sit. The result reads as a scan, and the text reader does
markedly better on it.

The reading itself is **Tesseract compiled to WebAssembly, running in your
browser**. That is a deliberate choice over a cloud OCR or an AI model: a
static site has nowhere to keep an API key, and a key shipped to the browser is
a key someone else can spend. The trade is that it is less accurate than a paid
model, and that it is a ~12MB download the first time you use it.

Which is why **nothing it reads is ever saved on its own.** A scanned receipt
fills in a form you check; a scanned itinerary produces a list with a tick
beside each line and nothing is added until you say so. The other amounts it
saw on the slip are offered as one-tap alternatives, because the total is the
field it is most likely to get wrong and most costly to get wrong quietly.

## Travel has no Trip record, and that is the point

The rule the whole app is built on is that **the schedule item is the only
top-level object**. Work, travel, badminton and lunch are all schedule items;
expenses, receipts, attachments and splits hang off them. Travel does not break
that.

A trip is a schedule item that runs across days and has a **country** on it —
one more optional field beside location and notes. Everything on the Travel
screen is derived from that: the counters, the goal, the globe, the trip list,
and the spend, which comes free because expenses already link to schedule
items. Adding a country to something already in the diary is all it takes to
appear there.

The one thing Travel stores of its own is the **wishlist**, because somewhere
you have *not* been is not a schedule item at all.

The globe is a wireframe, not a map. A world map with borders would be the
largest thing in the bundle by a distance, and a dot at a country's centroid
says "been there" just as well as a filled outline. `lib/places.ts` holds one
compact table — code, name, continent, latitude, longitude — and the
orthographic projection that puts it on a sphere. Points on the far side are
dropped rather than drawn flat, which is what stops Peru appearing over the top
of Mongolia.

Countries show as **two-letter badges rather than flag emoji**. Flag emoji are
regional-indicator pairs and Windows ships no font that draws them, so every
flag there comes out as two bare letters — a design leaning on them looks
broken on one platform and fine on the rest.

## Where the data lives

**In your browser, and nowhere else** unless you put it somewhere. There is no
server and no account.

Records and attachments live in **IndexedDB**, not localStorage. That changed
when items gained attachments: localStorage holds about 5MB, stores strings
only, and a base64'd photo is a third bigger than the file it came from — two
scans would have filled it. An old `scheduleplan:v1` localStorage notebook is
migrated across on first run and then left alone, as a way back.

That is still one copy in one browser, and it has teeth: clearing site data
clears it, and `localhost` and the live site keep separate copies. The bar at
the top of **More** is what makes it survivable:

- **Export / Import** — one JSON file, attachments inlined. No account, no
  internet, no setup.
- **To Drive / From Drive** — one file in one Drive folder. Needs a few minutes
  of Google Cloud setup, once: [docs/DRIVE.md](docs/DRIVE.md).
- **Auto** — keeps the Drive copy current after changes. It can only ride a
  token that a **To Drive** tap already obtained: getting a new one opens
  Google's popup, and a browser only allows that inside the click that asked
  for it. When the hour is up it stops and says so, rather than being a switch
  that quietly stopped working after lunch.

Import and From Drive both **replace** rather than merge, and both say what
they are about to overwrite first. Tapping the saved time opens **Your data**,
which says which store, whether the browser has agreed to keep it, how much
room it is using and when Drive last saw a copy.

The reasoning behind all of this is in [docs/DEPLOY.md](docs/DEPLOY.md).

## Name, logo and colour

The mark deliberately does not use the letters. It is a globe with a plane
going round it — the day-timeline mark it replaced stopped describing the app
once Travel became a module of its own. Circles, an ellipse and one polygon, so
it needs no font.

Two details carry it. The orbit is a single ellipse drawn through a **mask that
hides it where it crosses the top of the globe**, which is what makes the line
read as passing behind the planet and back out in front; without the mask it
sits flat on top and the whole thing reads as a circle with a line through it.
The plane is stroked in the tile colour *underneath* its own white fill
(`paint-order: stroke`), cutting a clean gap where it crosses the orbit —
drawn without that, the two merge into one unreadable squiggle.

| | |
| --- | --- |
| Brand | `#6C5CE7` |
| Page behind the column | `#DEDBF5` |
| Tile corner | `rx 58` on a 256 grid |
| Globe / orbit stroke | 11 on a 256 grid |

The accent is defined once, as `brand` in `tailwind.config.js`. Nothing in
`src/` should name a raw blue or purple — it moved from blue to purple in one
pass precisely because it was never spelled out in more than one place.

Card tints are a separate palette (`tintFor` in `lib/tags.ts`), assigned by a
tag's **position in the tag list** rather than by hashing its id: with seven
tags and seven tints, a hash collision is more likely than not, and a scheme
where Sports and Personal come out the same green is doing nothing for anybody.

`public/favicon.svg`, `public/logo-mark.svg` (ink, for light backgrounds) and
`src/components/Logo.tsx` hold the same shapes. Change them together.

## How it fits together

```
SchedulePlan/
  .github/workflows/pages.yml   Builds and publishes on every push to main
  docs/                         DEPLOY, DRIVE, RUNNING
  public/                       favicon.svg, logo-mark.svg
  src/
    App.tsx                     The responsive shell: four screens, and the
                                nav that swaps sides with the viewport
    types.ts                    Shared types
    lib/
      idb.ts                    IndexedDB, wrapped thin; storage estimates
      store.ts                  THE data layer - the only file that knows
                                where records live
      files.ts                  Attachment blobs, photo shrinking, the scan
                                filter
      ocr.ts                    Lazy Tesseract, and the receipt / itinerary
                                guessing
      currency.ts               Rate fetch, cache, conversion, formatting
      split.ts                  Share division and settlement minimisation
      reminders.ts              When a reminder with a window or a repeat is
                                actually due
      autosave.ts               The Drive Auto switch, and its one honest limit
      drive.ts                  Google sign-in and the Drive read/write
      drive-config.ts           Client ID and folder ID (both safe to publish)
      places.ts                 The country table, and the globe projection
      date.ts                   Date maths and formatting (no date library)
      tags.ts                   Default tags, categories, emoji choices
    components/                 Popover, DatePicker, TimePicker, CurrencySelect,
                                CountrySelect, CountryBadge, Attachments,
                                BackupBar, DataSheet, Sheet, BottomNav,
                                SideNav, Toast, Fab, Icons, Logo, TagEditor,
                                FormFields
    screens/                    ScheduleScreen, MoreScreen
    schedule/                   DayStrip, DayView, WeekView, MonthView,
                                ItemCard, ScheduleForm, ScheduleDetail
    travel/                     TravelScreen, Globe, WishForm
    expenses/                   ExpensesScreen, ExpenseForm, ExpenseDetail,
                                ReceiptScan
    reminders/                  RemindersScreen, ReminderForm
    tools/                      CurrencyScreen, SplitScreen, ScanScreen,
                                LabelsScreen
```

### The pickers are ours, not the browser's

The date and time fields used to be native inputs made invisible and laid over
a chip. They came with the native behaviour attached, and one piece of it was a
real bug: **Chrome's time control on Windows only writes a value back once all
three of hour, minute and AM/PM have been set.** Pick the hour and the
meridiem, which is what most people think a time needs, and the field hands
back an empty string — indistinguishable from a picker that silently refuses to
save.

`DatePicker` and `TimePicker` replace them. Every tap commits a whole value:
choose an hour and the minutes it already had come with it. They render through
`Popover`, which portals to `<body>` — the add form is a bottom sheet whose
body scrolls, and a calendar positioned inside a scrolling box loses its bottom
two rows to it.

### Three layouts, one tree

| Width | Shape |
| --- | --- |
| under 640px — phone | Full-bleed column, bottom nav, floating add button |
| 640–1023px — tablet | Same column, wider (`max-w-xl`), on a grey page |
| 1024px and up — laptop, desktop | Sidebar with the logo and nav on the left, content beside it, no bottom bar |

The whole frame is capped at `max-w-4xl` and centred. A personal notebook
stretched across a 1900px monitor is harder to read, not easier — the extra
room goes into margin rather than into line length.

React + TypeScript + Tailwind, built by Vite. One runtime dependency beyond
React: `tesseract.js`, and it is only fetched when you scan something.

## The data shape

One document in IndexedDB, and the same shape is what Export writes and Drive
holds. `version` is 2; a version 1 file still imports.

```json
{
  "format": "scheduleplan.backup",
  "version": 2,
  "savedAt": "2026-09-11T12:00:00.000Z",
  "schedule": [
    {
      "id": 1,
      "date": "2026-09-14",
      "end_date": "2026-09-18",
      "all_day": true,
      "start_time": "00:00",
      "end_time": null,
      "title": "Danang trip",
      "location": null,
      "notes": null,
      "tag": "travel",
      "place": { "country": "VN", "city": "Da Nang" },
      "attachments": []
    }
  ],
  "expenses": [
    {
      "id": 1,
      "date": "2026-09-15",
      "title": "Banh mi and coffee",
      "amount": 29.08,
      "currency": "MYR",
      "category": "food-drink",
      "original_amount": 185000,
      "original_currency": "VND",
      "exchange_rate": 0.0001571804,
      "schedule_id": 1,
      "notes": null,
      "attachments": [
        {
          "id": "1f2e…",
          "name": "receipt.jpg",
          "type": "image/jpeg",
          "size": 23104,
          "kind": "scan",
          "addedAt": "2026-09-15T12:04:00.000Z",
          "text": "TOTAL 185,000"
        }
      ]
    }
  ],
  "reminders": [
    {
      "id": 1,
      "title": "Bring a raincoat",
      "date": "2026-09-14",
      "time": "08:00",
      "end_date": "2026-09-18",
      "end_time": null,
      "repeat": "daily",
      "notes": null,
      "done": false
    }
  ],
  "tags": [{ "id": "travel", "label": "Travel", "emoji": "✈️" }],
  "categories": [{ "id": "food-drink", "label": "Food & drink", "emoji": "🍽" }],
  "splits": [],
  "wishlist": [{ "id": 1, "name": "Lofoten", "country": "NO", "note": null, "photo": null }],
  "settings": {
    "currency": "MYR", "autoDrive": false, "lastDriveSync": null,
    "manualRates": {}, "travelGoal": 50
  },
  "files": [{ "id": "1f2e…", "dataUrl": "data:image/jpeg;base64,…" }]
}
```

Attachment **bytes** live in their own IndexedDB store, one per key, so a photo
is never parsed out of JSON because a row rendered. The record keeps only the
id, the name and the size. `files` appears in an export or a Drive copy, where
inlining the bytes is what keeps the promise that one file is the whole
notebook.

Older files read back fine: missing fields are filled in once, on read —
`end_date` and `place` become null, `all_day` becomes false, missing arrays
become empty.

`end_time`, `end_date`, `location`, `notes` and `tag` are nullable. `tag` and
`category` hold an id, and every one is editable in **More → Labels** — the
ones that ship are only defaults. Deleting one untags the records using it; it
never deletes them.

## Things worth not re-learning

- Dates travel as `YYYY-MM-DD` strings and times as `HH:MM` strings, end to
  end, so nothing ever shifts across a timezone.
- **`store.ts` is the seam.** It was an HTTP client, then localStorage, now
  IndexedDB, and no screen noticed either swap. Reads are synchronous off an
  in-memory cache hydrated before the first render; writes go to disk in the
  background.
- `Sheet` is the one modal pattern. `Popover` is the one anchored-panel
  pattern, and it must stay portalled.
- **Wrap controls, never scroll them sideways.** A row of four backup buttons
  is 361px wide and pushed a 320px phone into scrolling the whole page; it is
  a 2×2 grid below 380px for that reason.
- An amount written `185,000` is a hundred and eighty-five thousand, and
  written `185.000` it still is. A separator with three digits after it is
  grouping thousands; with one or two it is a decimal point. Getting this wrong
  turns a Vietnamese lunch into 185 dong.
- A pattern loose enough to read `24.00` as a clock time will delete every
  price on a receipt. The dot form of a time only counts with an am or pm
  beside it.
