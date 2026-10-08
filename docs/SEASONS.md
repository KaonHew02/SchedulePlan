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
| A destination's public holidays, and its state's where `holidayRegion` names one | The same source as the calendar (`src/lib/holidays.ts`) | **Worked out on the phone**; Malaysia from the gazette |
| The airports each destination is flown to, and the one a train ride away | `destinations.json` (`airports`, `via`), names in `src/seasons/airports.json` | No — airports do not move |
| Where Kuala Lumpur flies without a change of plane | `src/seasons/flights.json` | **Read through once a year** — routes open and close |

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

A festival does not stop at New Year. Each year is worked out together with
the year either side of it, so Ramadan that begins on 26 December 2030 is on
January's cards in 2031 as well as December's in 2030, labelled with the year
it started in.

Ramadan itself is a highlight in every destination where it changes the trip
(the Gulf, Egypt, Morocco, Tunisia, Jordan, Iran, Türkiye, the Maldives), so
the year's dates are on the sheet; the tips point there rather than saying
when it falls.

Hindu, Thai, Tibetan and Balinese festivals (Diwali, Holi, Loy Krathong,
Losar, Nyepi) have no rule the library can work out. They keep their usual
months and say *每年日期不同* in the text.

**No year is ever written into `destinations.json`.** A sentence that says
"2027年" is right once and wrong every year after, so the check refuses it.
A date that belongs to one year goes in `events.json`; one that comes round
every year gets a rule.

## Direct or a change of plane

Under the area chips is a second row: **从吉隆坡 · 全部 · 直飞 · 要转机**.
Each card says how it is got to, and the sheet says it in full under 怎么去.

It comes from two things kept apart because they age differently. Every
destination names its airports, which do not move:

```json
"airports": ["SDJ", "AOJ", "AXT", "HNA", "GAJ"],
"via": { "airports": ["NRT", "HND"], "t": "东京坐新干线到仙台约1.5小时、青森约3小时" },
```

`airports` is where you land for the place itself. `via` is only for where
the usual way in is overland from a bigger airport — Huangshan by train from
Hangzhou, Kyrgyzstan by road from Almaty — and says how to go on. It is not
for anywhere a second flight is the normal way: Jiuzhaigou is flown to from
Chengdu, so it has no `via`. The Chinese name of every code is in
`airports.json`; a city with two airports writes them 东京·成田, so a card can
say just 东京.

`flights.json` is the routes, which do change:

```json
"checked": "2026-10",
"from": "吉隆坡",
"home": ["KUL", "SZB"],
"direct": ["ADD", "ADL", …],
"stop": { "CGQ": "福州", "DLC": "南京", "TYN": "昆明" },
"seasonal": ["CTS", "HFE"],
"charter": ["DNH", "DSN", "TXN"]
```

- `direct` — nonstop from KLIA or Subang.
- `stop` — the same plane all the way, landing on the way in the city named;
  in China that is where everyone clears immigration.
- `seasonal` — flown some months only, like AirAsia X to Sapporo.
- `charter` — sold mostly with tours.

A place is **直飞** when any of these reach one of its airports, or one of its
`via` airports, or when home is among them (KL itself, and Genting and
Cameron by road). The best one is what the card says: nonstop before a stop,
before seasonal, before a charter, and the place itself before somewhere a
train ride away. Everything else is **要转机**.

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
5. **Read the flights through.** The *Airlines and destinations* table on
   Wikipedia's Kuala Lumpur International Airport page (and Subang's) lists
   every route, with what is starting and ending. Add what opened to
   `flights.json`, take out what stopped, and look up anything Chinese
   or new: a "direct" route to a smaller Chinese city often stops on the way,
   and goes under `stop`. Set `"checked"` to the month. `npm run seasons --
   --flights` then lists every destination by how it is reached, so a place
   that changed side is easy to see.
6. `npm run seasons -- --format` puts the files back in the house layout,
   and `npm run build` checks them again before anything is published.

All of it can be handed to a Claude Code session in this repository: "do the
yearly Seasons read-through for 2028" is enough for it to find this page.

## Adding or changing a destination

Each destination in `destinations.json` has this shape. `countries` is the
ISO codes the badge, the wishlist and the public holidays use — several when
it crosses a border, none for Antarctica. `holidayRegion` is optional: the
state or province of the first country, in date-holidays' codes, for the days
off only it keeps — `12` is Sabah (Kaamatan), `SCT` is Scotland (St Andrew's
Day), `LA` is Louisiana (Mardi Gras). Malaysia's codes are the gazette's,
`01` Johor to `16` Putrajaya, the same ones More → Calendar uses.

```json
{
  "id": "my-sabah",
  "area": "东南亚",
  "country": "马来西亚",
  "region": "沙巴",
  "countries": ["MY"],
  "holidayRegion": "12",
  "airports": ["BKI", "TWU", "SDK"],
  "places": "亚庇、京那巴鲁神山、仙本那…",
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
refuses: a missing field, a key it does not know (`offest` for `offset` would
otherwise be ignored by the app and dropped by `--format`), a rating outside
0–3, anything but twelve months, a destination with no best month, a country
listed twice, a `holidayRegion` the library does not know, a rule it cannot
read, an event naming an id that does not exist, an airport that is not a
three-letter code or has no name, a route listed under two kinds, and a year
written into the evergreen file — 2027年, with or without a space. A year before 2020 is
history and is left alone: 1987年列入世界遗产 stays true.

`--format` runs the check first and writes nothing if it fails.
