# Seasons, every year

**Seasons** is the travel calendar — 全球旅行月历. It covers 242 destinations:
every Chinese province, the big countries split by region, and 119 countries
and territories in all. Each is rated month by month, with a line about every
month, what is in flower or in season, what to avoid and how to go.

## The short version

**The year turns by itself.** Pick 2027 at the top of the screen and every
festival that moves — Chinese New Year, Ramadan and the two Eids, Easter,
Carnival, Holy Week, Mid-Autumn, the lunar temple fairs — lands on its 2027
date, in the right month, and the public holidays in each destination's
sheet are 2027's. Nobody edits anything for that.

**Two things are worth an hour once a year**, in the autumn before the year
starts: adding the next year's one-off events, and reading the sentences
that can go out of date — visas, fees, closures. `npm run seasons` lists
both. See *The yearly read-through* below.

## Where everything comes from

| What | Kept in | Changes each year? |
| --- | --- | --- |
| Ratings, the line for each month, climate, tips | `src/seasons/destinations.json` | No — the weather is the weather |
| Highlights on fixed dates: cherry blossom, lavender, Oktoberfest | `destinations.json`, as months | No |
| Highlights on a moving date: Chinese New Year, Eid, Easter, Carnival | `destinations.json`, as a **rule** | **Worked out on the phone** for the year on screen |
| One-off events: an Olympics, an eclipse, a World Cup | `src/seasons/events.json`, under the year | **Added once a year**, by hand |
| A destination's public holidays | The same source as the calendar (`src/lib/holidays.ts`) | **Worked out on the phone**; Malaysia from the gazette |

## How a moving festival works

A highlight that follows the moon or Easter carries a `rule` instead of fixed
months, in the date-holidays library's own grammar — the library that already
puts public holidays on the calendar:

```json
{ "m": [1, 2], "t": "春节庙会与各大公园灯会", "rule": "chinese 01-0-01", "days": 15 }
{ "m": [3], "t": "开斋节：前后约一周返乡潮", "rule": "1 Shawwal", "offset": -3, "days": 7 }
{ "m": [2, 3], "t": "里约狂欢节桑巴大游行", "rule": "easter -51", "days": 6 }
```

- `rule` — the day it is anchored to. `chinese MM-0-DD` and `korean …` and
  `vietnamese …` are lunar dates; `1 Ramadan`, `1 Shawwal`, `10 Dhu al-Hijjah`
  are Hijri; `easter`, `easter -47` (Shrove Tuesday), `easter 60` (Corpus
  Christi) and `orthodox -7` count from Easter; `15 Nisan` and `1 Tishrei` are
  Hebrew.
- `offset` — days from that date to the first day. The flower fair before New
  Year is `-3`.
- `days` — how long it runs. One when left out.
- `m` — the months in a usual year. Shown only for the moment it takes the
  library to load the first time, and kept so the file reads sensibly on its
  own.

The Hijri dates are worked out by arithmetic; the real day is declared when
the moon is seen and can be a day either side, so the app writes them as 约3月9日.

Hindu, Thai, Tibetan and Balinese festivals (Diwali, Holi, Loy Krathong,
Losar, Nyepi) have no rule the library can work out. They keep their usual
months and say *每年日期不同* in the text.

**No year is ever written into `destinations.json`.** A sentence that says
"2027年" is right once and wrong every year after, so the check refuses it.
A date that belongs to one year goes in `events.json`; one that comes round
every year gets a rule.

## The yearly read-through

Some time in the autumn, for the year about to start:

1. **See what next year holds.** `npm run seasons` prints every festival
   worked out for next year in date order, and next year's one-off events.
   (`npm run seasons -- --year 2028` for another year.)
2. **Add next year's one-off events** to `src/seasons/events.json` — an
   Olympics, a total eclipse, an expo, a World Cup — each with the
   destinations it affects:
   ```json
   "2028": [
     { "ids": ["us-california"], "m": [7, 8], "t": "洛杉矶夏季奥运会（7月14日–30日）" }
   ]
   ```
   Until a year has any, the screen says so under the list.
3. **Read the sentences that go out of date.** `npm run seasons -- --review`
   lists every sentence that mentions a visa, a fee, a permit, a booking, an
   opening or a closure: about 320, most of which will still be true. Change
   the ones that are not.
4. **Set `"reviewed"`** at the top of `destinations.json` to the month you
   did it. The screen shows it as *资料核对于…*.
5. `npm run seasons -- --format` puts both files back in the house layout,
   and `npm run build` checks them again before anything is published.

All of it can be handed to a Claude Code session in this repository: "do the
yearly Seasons read-through for 2028" is enough for it to find this page.

## Adding or changing a destination

Each destination in `destinations.json` has this shape. `countries` is the
ISO codes the badge, the wishlist and the public holidays use — several when
it crosses a border, none for Antarctica.

```json
{
  "id": "jp-hokkaido",
  "area": "东亚",
  "country": "日本",
  "region": "北海道",
  "countries": ["JP"],
  "places": "札幌、小樽、富良野…",
  "summary": "最佳：6–9月避暑花海，1–2月雪祭与粉雪滑雪",
  "climate": "…",
  "ratings": [3, 3, 2, 1, 2, 3, 3, 3, 3, 2, 1, 2],
  "notes": ["…January…", "…", "…December…"],
  "highlights": [{ "m": [7], "t": "富良野薰衣草（7月中旬最盛）" }],
  "avoid": "…",
  "tips": "…"
}
```

Ratings are 3 best, 2 good, 1 possible but not the time, 0 not advisable
(typhoons, monsoon, roads closed). Every destination has at least one 3.

## The check

`node scripts/seasons.mjs --check` runs at the start of every `npm run build`,
so a broken file stops the deploy rather than drawing a broken screen. It
refuses: a missing field, a rating outside 0–3, anything but twelve months,
a destination with no best month, a rule the library cannot read, an event
naming an id that does not exist, and a year written into the evergreen file.
