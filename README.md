# SchedulePlan

Short form **S.P**. A clean digital notebook for your schedule and spending.

**Live at [kaonhew02.github.io/SchedulePlan](https://kaonhew02.github.io/SchedulePlan/)**

All seven phases are in, plus Travel. Schedule with whole-day and multi-day
items, Reminders that can run from one date until another, Expenses in any
currency, a converter, a bill split that works out who owes whom, a scanner
that reads a receipt or a booking with no account and no API key, and a Travel
screen that counts where you have been.

Seven tabs — Schedule, Travel, Expenses, Reminders, Currency, Translate, More.
Everything else lives behind **More**.

---

## Running it

One command — see [docs/RUNNING.md](docs/RUNNING.md).

```
npm install
npm run dev
```

Then open **http://localhost:5173/SchedulePlan/** (the base path matters).

## What it does

**Schedule** — day, week and month views, opening on the **month**: the day you
are in is the one thing you already know, and what the screen is opened to find
out is what is coming. Tapping a date drops into the day. An item can be a whole
day, and it can run from one date to another, which is what a trip actually is.
A spanning item appears on every day it covers and says which day of it you are
looking at. Items carry your own tags, a location, links, notes and attachments.

**Reminders** — due date and time, optionally running *until* a later date and
time, optionally repeating daily or weekly inside that window. Alerts only fire
while a tab is open; there is no server to send them otherwise, and the screen
says so.

**Expenses** — what you spent, in whatever currency you spent it, grouped by
month with a breakdown by category. Anything paid in a foreign currency keeps
the original amount, the currency and the rate **frozen at the moment you saved
it**, so a rate that moves next week never restates what last week's dinner
cost. An expense can hang off a schedule item, which is how a trip adds up.

**Currency** — a tab of its own: a converter over a keyless public rate feed,
cached for the day so it still works on a plane. The rate can be overridden by
hand, because the money changer's rate is the one that actually applied and it
is rarely the market's.

Everything is quoted in the currency's **own lot** — a million dong, a thousand
yen, a hundred baht, one pound — which is how the board behind the counter
quotes it, so the number on the wall and the number on the screen are the same
shape and can simply be compared. Typing your own rate works the same way: the
board says 164 ringgit to the million dong, so 164 is what you type.

The built-in lots are one board, photographed in Seremban, and boards do not
agree with each other — plenty of changers price yen by the hundred rather than
the thousand. So **the lot is tappable**: tap it in the rate line and pick the
one in front of you. It sticks per currency, re-quotes the whole screen, and
the built-in choice is marked so there is a way back to it.

**Translate** — for the moment in front of somebody where the words are not
there. It started behind More and came out next to Currency, because on the
trip it was built for, the till and the person behind it are the same thirty
seconds. Forty-eight languages, any two of them — the nine a trip from here
actually uses at the top of the list and the rest a word of typing away, the
same arrangement the currency picker uses — and three things
to do with the answer: **say it** through the phone's own voice, **show it** at
a size readable across a food stall, and keep it. Everything translated is
written into the notebook, because the places you need this most — a border
queue, a market, a bus — have the worst signal, and the second time you need a
phrase there should be no request at all. A dozen travel basics are in the back
of the book from the start.

Two translators with no key and no account, tried in order, and the screen says
which one answered. Saying it out loud is the browser's own voice and therefore
the device's: a phone has Vietnamese, a Windows laptop with no language pack
has three American voices and nothing else. Where there is no voice the app
says so rather than handing the text to an English one, which sounds like it
worked and is not.

**Bill split** — the second tab inside Expenses, and built around *what each
person had* rather than how to divide each item. A line sits under the person
who ate it; anything the table shared goes on its own card and divides across
everyone. There is no total field and no split-method picker, because the total
is the sum of the lines and every method falls out of them: an even split is
the same figure on every row, a lump per person is one unlabelled line each, a
percentage is the money it comes to. Out the other end come the three figures
the screen exists for — bill total, your share, what you are owed — and the
fewest payments that settle everybody up.

Your own share can be pushed into the spending list as a real expense,
converted and frozen the same way a foreign receipt is. The expense is
**linked**, so a bill that grows updates it instead of adding a second copy of
the same dinner.

Bills saved under the older *item · who paid · who shares* shape are read
forward into lines on the way in, so a saved bill never comes back reading
differently: an exact-amounts item becomes one line per person, a shared one
becomes a line on the shared card, and one shared by only some of the table
becomes a line each.

**Travel** — countries, destinations and continents counted off the schedule,
a goal to aim at, a globe you can spin with a dot on everywhere you have been
— tap a country badge under it and the globe turns to face that country —
every trip with what it cost, and a wishlist of where to go next. A wish holds
what a trip holds: a note to write in, the links — the booking page, the video
that put the idea there — and the files somebody sent you, on top of the
picture the card is made of. Been to one of them? Open it and tap **I have been
here**: it fills in the schedule form with the country, the note, the links and
the files already on it, and comes off the wishlist when you save. There is no "visited" flag, because having been somewhere is a
schedule item — which is what the counters read. Nothing is entered twice: see
below.

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

A trip is a schedule item tagged **✈️ Travel** with a **country** on it.
Everything on the Travel screen is derived from that: the counters, the goal,
the globe, the trip list, and the spend, which comes free because expenses
already link to schedule items.

It took three goes. The country alone was the first test, which made a run to
Daiso with 'Malaysia' on it a trip, sitting between two real ones and counting
towards a goal of a hundred countries. The second was a switch of its own on
every item, which worked — and put a **Not a trip** button on every row of the
list, a column of them down the side of a page about trips, which is a strange
thing to have built. The tag was there the whole time and already being used:
it is the same chip that says Personal and Work on the add form, and a shop is
not tagged Travel. Nothing new to learn, nothing new to maintain.

The tag is matched by **id**, so renaming it to 'Trips' or swapping the
aeroplane for a suitcase keeps working. Delete it outright and Travel goes
quiet.

One journey is usually several rows in the diary — Danang, then Hoi An, then
Danang again — and Travel listed three trips where there was one. Any row can
be marked **part of** another on the schedule form, which makes it a *leg*: it
stays in the diary, still counts as a place you have been, and stops being its
own line in Travel. The trip then spans its legs' dates, adds up their
spending, and lists them as stops on its page. The shape is borrowed from
`Expense.schedule_id`, which already binds a receipt to the day it belongs to.

Counting and listing are deliberately different: the list shows trips, the
counters and the globe read every visit including the legs. Otherwise joining
two rows would quietly delete a destination.

Tapping a trip opens **its own page**: the plan, the vlog, what it cost, the
days it covers, and its files — which can be added right there, rather than
only in the schedule form, since a boarding pass is something you are handed
while looking at the trip. The plan is kept apart from the item's notes on
purpose — notes is a line, shown inline after the time in every list, and an
itinerary pasted into it would wreck all of them. It saves as you type rather
than on a button or on blur, because a plan written on a bus and then locked in
a pocket never blurs.

Vlogs are **links, not files**. A ten-minute vlog is hundreds of megabytes,
which does not fit in a Drive backup and may not fit in browser storage at all,
and it is already on YouTube — what the notebook was missing is not the video
but which video went with which trip. Links are checked for scheme when they
are stored rather than when they are drawn, because an `href` is somewhere code
can run and a notebook is a file that gets exported and imported again.

They are not the trip page's alone. The add and edit forms carry the same link
field, because the booking confirmation arrives before the trip exists and a
concert has a ticket page without being a trip at all — and the check on the
way in is the store's, so both doors go through it.

The one thing Travel stores of its own is the **wishlist**, because somewhere
you have *not* been is not a schedule item at all. It carries notes, links and
attachments for the same reason the trip page does — the research happens
before the trip exists, and it would otherwise live in another app until the
day you go. They travel with it: **I have been here** hands them to the
schedule item, which is why deleting the wish afterwards leaves the bytes
alone.

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

**From Drive replaces; Import adds.** They look like one gesture and are not
one job. The copy in Drive *is* the notebook, so pulling it down should leave
this device looking like that copy. A file you are handed is a different
animal — it can be a whole notebook or five rows of an itinerary somebody
prepared for you, and replacing on the strength of that meant the only way to
accept the five was to lose everything else. So Import adds, and skips rows it
already has: importing your own backup over your own notebook now finds
everything present and changes nothing, rather than giving you two of every
day. It never takes your settings from the file either, unless there is
nothing here to overrule them. Both say what they are about to do first.

Tapping the saved time opens **Your data**,
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
    App.tsx                     The responsive shell: the six screens, and the
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
      translate.ts              The translator chain, the voice lookup, and the
                                starter phrasebook
      links.ts                  Making a pasted link safe to put in an href
      notes.ts                  Dropping the line breaks a wrapper added, keeping the ones typed
      places.ts                 The country table, and the globe projection
      date.ts                   Date maths and formatting (no date library)
      tags.ts                   Default tags, categories, emoji choices
    components/                 Popover, DatePicker, TimePicker, CurrencySelect,
                                CountrySelect, CountryBadge, Attachments,
                                BackupBar, DataSheet, Sheet, Confirm,
                                BottomNav, SideNav, navItems, Toast, Fab,
                                Icons, Logo, TagEditor, FormFields
    screens/                    ScheduleScreen, MoreScreen
    schedule/                   DayStrip, DayView, WeekView, MonthView,
                                MonthGrid, ItemCard, ScheduleForm,
                                ScheduleDetail
    travel/                     TravelScreen, TripScreen, Globe, WishForm
    translate/                  TranslateScreen
    expenses/                   ExpensesScreen, ExpenseForm, ExpenseDetail,
                                ReceiptScan, SplitsScreen
    currency/                   CurrencyScreen
    reminders/                  RemindersScreen, ReminderForm
    tools/                      ScanScreen, LabelsScreen
```

### Delete is delete

Every record's Delete acts on the first tap. The two-step *Delete → Tap to
confirm* it replaced put a step on every deletion somebody meant in order to
catch the rare one they did not, and the notebook is a personal one with an
Export and a Drive copy behind it. The one thing still guarded is **Replace**
in the backup bar, which is not a record at all — it overwrites the whole
notebook with another copy of it.

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

### Four layouts, one tree

| Width | Shape |
| --- | --- |
| under 640px — phone | Full-bleed column, bottom nav, floating add button |
| 640–1023px — tablet | Same column, wider (`max-w-xl`), on a lavender page |
| 1024px and up — laptop | Sidebar on the left, backup bar across the top, content filling the rest, screens in two columns |
| 1280px and up — desktop | Schedule and Travel add a third column: a calendar to jump with and what is coming next |

Content is capped at **1500px and centred**, which is a deliberate middle. The
frame used to be capped at `max-w-4xl` — 896px — on the theory that a notebook
stretched across a 1900px monitor reads worse. That was true of the *text* and
wrong about everything else: it left a third of the screen as margin and looked
like a bug rather than a decision. Uncapped is no better, putting a single
schedule card 1300px wide with six words in it.

So the width is filled with **more content, not wider content**. Every screen
grows a second column past 1024px, and the two widest — Schedule and Travel —
wait until 1280px before adding their rail, because a 300px rail beside a
1024px window leaves the timeline narrower than the phone column it replaced.

The backup bar moves with the layout too: a dark card inside More on a phone, a
light row across the top of every screen on a laptop. `BackupBar` takes a
`variant` for the two; it is one component because it is one set of controls.

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
  "wishlist": [
    {
      "id": 1, "name": "Lofoten", "country": "NO", "note": null, "photo": null,
      "attachments": [], "links": []
    }
  ],
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
