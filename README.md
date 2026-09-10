# SchedulePlan

Short form **S.P**. A clean digital notebook for your schedule and spending.

**Phase 1 (done): Schedule.** Day / week / month views, add, edit, delete, details.
Expenses, currency, receipts, bill split and the itinerary scanner come in later phases.

---

## Running it

You need two terminals: one for the API, one for the app.
These commands work in both PowerShell and Git Bash.

**1. Backend** — first time only, creates the virtual environment and installs:

```
cd C:/Users/MIS/Documents/SchedulePlan/backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Then every time:

```
cd C:/Users/MIS/Documents/SchedulePlan/backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

**2. Frontend** — first time only:

```
cd C:/Users/MIS/Documents/SchedulePlan/frontend
npm install
```

Then every time:

```
cd C:/Users/MIS/Documents/SchedulePlan/frontend
npm run dev
```

Open **http://localhost:5173**.

The dev server also prints a `Network:` address (e.g. `http://192.168.x.x:5173`) — open that
on your phone while it is on the same wifi to use the app the way it is meant to be used.

The database file is created automatically at `backend/data/scheduleplan.db`. Deleting that file
resets everything.

## Name and logo

Short form **S.P**, but the mark deliberately does not use the letters. It is a day's
timeline: three rows falling back into the distance, with the first one picked out by the
same blue dot the month grid puts under a day that has something on it. Everything is
rectangles and circles, so the mark needs no font and renders identically everywhere.

| | |
| --- | --- |
| Ink | `#171717` |
| Accent (the leading dot) | `#2563eb` |
| Row fade | 100% / 75% / 45% white |
| Tile corner | `rx 58` on a 256 grid (about 23%) |

- `frontend/public/favicon.svg` - the browser-tab icon, dark tile
- `frontend/public/logo-mark.svg` - the mark alone in ink, for light backgrounds
- `frontend/src/components/Logo.tsx` - the in-app version, used on the More screen

`favicon.svg` and `Logo.tsx` hold the same shapes; change them together.

## How it fits together

```
SchedulePlan/
  backend/                     Python FastAPI + SQLite
    app/
      main.py                  App setup, CORS, human-readable error handling
      database.py              Engine, session, Base, init_db()
      models.py                SQLAlchemy tables (+ the tag list)
      schemas.py               Request/response validation
      routers/
        schedule.py            /api/schedule CRUD
    data/scheduleplan.db     Created on first run (gitignored)
    requirements.txt

  frontend/                    React + TypeScript + Tailwind (Vite)
    public/                    favicon.svg, logo-mark.svg
    src/
      App.tsx                  Three screens + bottom nav + toast
      api.ts                   Fetch wrapper; turns API errors into plain messages
      types.ts                 Shared types
      lib/date.ts              Date maths and formatting (no date library)
      lib/tags.ts              The seven optional tags and their emoji
      components/              BottomNav, Sheet, Toast, EmptyState, Icons, Logo
      screens/                 ScheduleScreen (the real one), Expenses, More
      schedule/                DayView, WeekView, MonthView, ItemRow,
                               ScheduleForm, ScheduleDetail
```

Vite proxies `/api` to `http://127.0.0.1:8000`, so the frontend has no API URL to configure.

## Database

One table so far.

**schedule_items**

| Column | Type | Notes |
| --- | --- | --- |
| id | integer | primary key |
| date | date | indexed; the day the item sits on |
| start_time | time | required |
| end_time | time | optional; must be after the start |
| title | text | required |
| location | text | optional |
| notes | text | optional |
| tag | text | optional: personal, work, travel, food, sports, event, other |
| created_at | datetime | set on insert |
| updated_at | datetime | set on update |

Plus a `(date, start_time)` index, since every view reads a date range in time order.

Tables are created on startup by `init_db()`. Later phases add `expenses`, `expense_items`,
`people`, `bill_splits`, `bill_split_participants`, `attachments` and `exchange_rates`.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/schedule?start=&end=` | Items in a date range, ordered by date then time |
| GET | `/api/schedule/{id}` | One item |
| POST | `/api/schedule` | Create |
| PATCH | `/api/schedule/{id}` | Partial update |
| DELETE | `/api/schedule/{id}` | Delete |
| GET | `/api/health` | Health check |

Errors always come back as `{"message": "..."}` in plain English, and the UI shows that
message as-is. Interactive docs while the backend is running: http://localhost:8000/docs

## Files created in Phase 1

Backend: `requirements.txt`, `.gitignore`, `app/__init__.py`, `app/main.py`,
`app/database.py`, `app/models.py`, `app/schemas.py`, `app/routers/__init__.py`,
`app/routers/schedule.py`

Frontend: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`,
`postcss.config.js`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`,
`src/index.css`, `src/api.ts`, `src/types.ts`, `src/lib/date.ts`, `src/lib/tags.ts`,
`src/components/{BottomNav,Sheet,Toast,EmptyState,Icons,Logo}.tsx`,
`public/{favicon,logo-mark}.svg`,
`src/screens/{ScheduleScreen,ExpensesScreen,MoreScreen}.tsx`,
`src/schedule/{DayView,WeekView,MonthView,ItemRow,ScheduleForm,ScheduleDetail}.tsx`

## Notes for later phases

- Dates travel as `YYYY-MM-DD` strings and times as `HH:MM` strings, end to end, so nothing
  ever shifts across a timezone.
- `Sheet` is the one modal pattern — the expense form, receipt review and bill split should
  all use it rather than new full screens.
- Expenses attach to a schedule item through `schedule_item_id`; the schedule item itself
  does not need to change.
