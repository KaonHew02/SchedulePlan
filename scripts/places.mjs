/**
 * Places: every province, city and district a search in Seasons can find,
 * and the card each one is on.
 *
 *   npm run places -- fetch <folder>   download the sources into <folder>
 *   npm run places -- build <folder>   write src/seasons/places.json from them
 *
 * A card names a handful of towns — 广州、佛山、深圳 under 广东 — but a trip is
 * planned from wherever it starts: 顺德, 海淀区, Chicago, Ipoh. So beside the
 * cards there is a list of everywhere else, each place filed under the card
 * it is on (顺德区 under 广东), or under the nearest card where its own part of
 * the country has none (Chicago under New York and the Northeast). Search
 * looks there when a card's own words do not have what was typed, and the
 * card says which place it was found by.
 *
 * Where it comes from:
 *
 * - China: every 省, 市 and 区县, from pca.json in
 *   github.com/modood/Administrative-divisions-of-China (国家统计局's list).
 *   The English is the pinyin, from the pinyin-pro package.
 * - Everywhere else: GeoNames (geonames.org, CC BY 4.0) — each country's
 *   states or provinces, and every town of 15,000 people or more.
 * - The Chinese names of those: Wikidata (CC0), found by their GeoNames
 *   number, simplified first, and as Malaysia writes them for Malaysia —
 *   亚庇, not 哥打京那巴鲁.
 *
 * Which card a province or state is on is kept by hand in places-map.mjs.
 *
 * Once a year is plenty; towns do not move, and a new district is the only
 * thing that changes. The folder holds the downloads and nothing else, and is
 * not part of the repository. See docs/SEASONS.md.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import { customPinyin, pinyin } from 'pinyin-pro'
import { ADMIN2, CHINA, EXTRA, SPLIT } from './places-map.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DESTINATIONS = join(ROOT, 'src/seasons/destinations.json')
const OUT = join(ROOT, 'src/seasons/places.json')
const shown = (path) => relative(ROOT, path).replaceAll('\\', '/')

const GEONAMES = 'https://download.geonames.org/export/dump/'
const PCA = 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca.json'
const WIKIDATA = 'https://query.wikidata.org/sparql'
// Wikidata asks every script to say who it is.
const AGENT = 'SchedulePlan-places/1.0 (https://github.com/KaonHew02/SchedulePlan)'

const [command, folder] = process.argv.slice(2)
if (!['fetch', 'build'].includes(command) || !folder) {
  console.error('Usage: npm run places -- fetch <folder>  |  npm run places -- build <folder>')
  process.exit(1)
}

const destinations = JSON.parse(readFileSync(DESTINATIONS, 'utf8')).destinations
const ids = new Set(destinations.map((d) => d.id))

/** Each country's cards. */
const cardsOf = new Map()
for (const d of destinations) for (const code of d.countries) cardsOf.set(code, [...(cardsOf.get(code) ?? []), d.id])
for (const [code, id] of Object.entries(EXTRA)) cardsOf.set(code, [id])

/** The countries GeoNames is read for: every one with a card, except China, which pca.json covers. */
const wanted = (code) => cardsOf.has(code) && code !== 'CN'

// --- Reading the downloads ----------------------------------------------------

const file = (name) => join(folder, name)
const lines = (name) => readFileSync(file(name), 'utf8').split('\n').filter((line) => line && !line.startsWith('#'))

/** admin1CodesASCII.txt and admin2Codes.txt: code, name, ASCII name, GeoNames number. */
function divisions(name) {
  return lines(name).map((line) => {
    const [code, display, ascii, id] = line.split('\t')
    return { code, display, ascii, id }
  })
}

/** cities15000.txt, without the places that are no longer there. */
function towns() {
  const gone = new Set(['PPLH', 'PPLQ', 'PPLW'])
  return lines('cities15000.txt')
    .map((line) => line.split('\t'))
    .filter((f) => wanted(f[8]) && !gone.has(f[7]))
    .map((f) => ({
      id: f[0],
      display: f[1],
      ascii: f[2],
      // Untagged, so only the ones in Chinese characters are any use, and
      // only when Wikidata has none: they are as often 繁體 or Japanese.
      han: f[3].split(',').filter((name) => /^[㐀-鿿]+$/.test(name)),
      country: f[8],
      admin1: f[10],
      admin2: f[11],
      people: Number(f[14]),
    }))
}

// --- fetch ---------------------------------------------------------------------

async function download(url, name) {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT } })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  writeFileSync(file(name), Buffer.from(await response.arrayBuffer()))
  console.log(`  ${name}`)
}

/**
 * The one file in a GeoNames zip. Its size is only in the directory at the
 * end of the zip (the header in front of the file says 0), so that is read
 * first, and the deflated stream after the header inflated.
 */
function unzipOne(name, into) {
  const zip = readFileSync(file(name))
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error(`${name} is not a zip`)
  const entry = zip.readUInt32LE(end + 16)
  const method = zip.readUInt16LE(entry + 10)
  const size = zip.readUInt32LE(entry + 20)
  const header = zip.readUInt32LE(entry + 42)
  const start = header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28)
  const body = zip.subarray(start, start + size)
  writeFileSync(file(into), method === 8 ? inflateRawSync(body) : body)
}

/**
 * The Chinese names of every state, province and town GeoNames gave, by
 * GeoNames number, four hundred to a question so Wikidata is not asked
 * anything it takes long to answer.
 */
async function chineseNames() {
  const numbers = [
    ...divisions('admin1CodesASCII.txt').filter((d) => wanted(d.code.split('.')[0])),
    ...divisions('admin2Codes.txt').filter((d) => ADMIN2[d.code.split('.')[0]]),
    ...towns(),
  ].map((place) => place.id)
  const unique = [...new Set(numbers)]
  const names = {}
  for (let at = 0; at < unique.length; at += 400) {
    const batch = unique.slice(at, at + 400)
    const query = `SELECT ?gn ?label WHERE {
      VALUES ?gn { ${batch.map((n) => `"${n}"`).join(' ')} }
      ?item wdt:P1566 ?gn .
      ?item rdfs:label ?label .
      FILTER(LANG(?label) IN ("zh-cn", "zh-hans", "zh-my", "zh-sg", "zh"))
    }`
    let answer
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(WIKIDATA, {
        method: 'POST',
        headers: {
          'User-Agent': AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ query }),
      })
      if (response.ok) {
        answer = await response.json()
        break
      }
      // Too many questions too fast: wait as long as it says, then ask again.
      if (attempt === 5) throw new Error(`Wikidata: ${response.status} ${await response.text()}`)
      const wait = Number(response.headers.get('retry-after')) || attempt * 10
      console.log(`  Wikidata said ${response.status}; asking again in ${wait}s`)
      await new Promise((done) => setTimeout(done, wait * 1000))
    }
    for (const row of answer.results.bindings) {
      const entry = (names[row.gn.value] ??= {})
      const lang = row.label['xml:lang']
      // A number shared by two items (a city and its municipality) keeps the first.
      entry[lang] ??= row.label.value
    }
    console.log(`  Wikidata: ${Math.min(at + 400, unique.length)} of ${unique.length}`)
    await new Promise((done) => setTimeout(done, 1000))
  }
  writeFileSync(file('zh-names.json'), JSON.stringify(names))
}

if (command === 'fetch') {
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
  console.log(`Downloading into ${folder}`)
  await download(`${GEONAMES}cities15000.zip`, 'cities15000.zip')
  unzipOne('cities15000.zip', 'cities15000.txt')
  await download(`${GEONAMES}admin1CodesASCII.txt`, 'admin1CodesASCII.txt')
  await download(`${GEONAMES}admin2Codes.txt`, 'admin2Codes.txt')
  await download(PCA, 'pca.json')
  await chineseNames()
  console.log(`Done. Now: npm run places -- build ${folder}`)
  process.exit(0)
}

// --- build ---------------------------------------------------------------------

const problems = []
const say = (message) => problems.push(message)

/** "~id" is the nearest card, "id" the card it is on. */
function card(target, where) {
  const near = target.startsWith('~')
  const id = near ? target.slice(1) : target
  if (!ids.has(id)) say(`${where}: no card is called ${id}`)
  return { id, near }
}

/**
 * Each card's places, in the order the search shows them: the bigger
 * divisions first, then the towns, the biggest first. A place is
 * [中文, English, parent, flags]: the names are a|b when there are two ways
 * of writing it, parent is the place's index in the same list, and flags is
 * 1 for "this is only the nearest card", 2 for "here only to name the one
 * under it" and 4 for "the card's own province": 广东省 on 广东, there so
 * 广东 顺德 finds 顺德区, and left out when a place is named (佛山市 · 顺德区,
 * not 广东省 · 佛山市 · 顺德区).
 */
const lists = new Map()
const NEAR = 1
const CONTEXT = 2
const PROVINCE = 4

function add(id, zh, en, parent = -1, flags = 0) {
  const list = lists.get(id) ?? lists.set(id, []).get(id)
  const key = `${zh}\u0000${en}\u0000${parent}`
  // The same town twice under one card (GeoNames has Chang-hua and Changhua) is once.
  const twin = list.findIndex((place) => place.key === key || (place.en.toLowerCase() === en.toLowerCase() && place.parent === parent))
  if (twin >= 0) {
    // A place met first as a parent kept only to name a town is a real place when it comes again.
    if (!(flags & CONTEXT)) list[twin].flags &= ~CONTEXT
    return twin
  }
  list.push({ key, zh, en, parent, flags })
  return list.length - 1
}

// China -------------------------------------------------------------------------

/**
 * Places whose English is not their pinyin: Inner Mongolia, and the towns
 * known by their Mongolian, Uyghur or Tibetan names — Hohhot, Kashgar, Lhasa.
 * The pinyin is kept beside it, so Huhehaote finds Hohhot too.
 */
const ENGLISH = {
  内蒙古: 'Inner Mongolia',
  西藏: 'Tibet',
  香港: 'Hong Kong',
  澳门: 'Macau',
  呼和浩特: 'Hohhot',
  鄂尔多斯: 'Ordos',
  呼伦贝尔: 'Hulunbuir',
  海拉尔: 'Hailar',
  额尔古纳: 'Ergun',
  乌兰察布: 'Ulanqab',
  乌兰浩特: 'Ulanhot',
  二连浩特: 'Erenhot',
  锡林郭勒: 'Xilingol',
  锡林浩特: 'Xilinhot',
  阿拉善: 'Alxa',
  巴彦淖尔: 'Bayannur',
  兴安: 'Hinggan',
  阿尔山: 'Arxan',
  哈尔滨: 'Harbin',
  齐齐哈尔: 'Qiqihar',
  拉萨: 'Lhasa',
  日喀则: 'Shigatse',
  林芝: 'Nyingchi',
  那曲: 'Nagqu',
  昌都: 'Qamdo',
  阿里: 'Ngari',
  乌鲁木齐: 'Urumqi',
  克拉玛依: 'Karamay',
  吐鲁番: 'Turpan',
  库尔勒: 'Korla',
  阿克苏: 'Aksu',
  喀什: 'Kashgar',
  和田: 'Hotan',
  霍尔果斯: 'Khorgas',
  阿勒泰: 'Altay',
  博尔塔拉: 'Bortala',
  巴音郭楞: 'Bayingolin',
  克孜勒苏: 'Kizilsu',
  伊犁: 'Ili',
  塔什库尔干: 'Taxkorgan',
  香格里拉: 'Shangri-La',
  甘孜: 'Garze',
  阿坝: 'Ngawa',
  马尔康: 'Barkam',
  色达: 'Sertar',
  果洛: 'Golog',
  格尔木: 'Golmud',
}

/** 陕西 spelt Shanxi would be 山西, so it is only ever Shaanxi. */
const ONLY = { 陕西: 'Shaanxi' }

// Characters read one way in a place name and another in everyday words:
// 都 is du in 成都, 花都 and 都匀, not dou; and names the dictionary gets wrong.
customPinyin({
  都: 'dū',
  陂: 'pí',
  什: 'shí',
  闵行: 'mǐn háng',
  珲春: 'hún chūn',
  尉犁: 'yù lí',
  筠连: 'jūn lián',
  六安: 'lù ān',
  六合: 'lù hé',
  乐清: 'yuè qīng',
  乐亭: 'lào tíng',
  长子: 'zhǎng zǐ',
  单县: 'shàn xiàn',
  莘县: 'shēn xiàn',
  歙县: 'shè xiàn',
  蔚县: 'yù xiàn',
  大城: 'dà chéng',
  洪洞: 'hóng tóng',
  枞阳: 'zōng yáng',
  铅山: 'yán shān',
  涡阳: 'guō yáng',
  繁峙: 'fán shì',
  柏乡: 'bǎi xiāng',
  泌阳: 'bì yáng',
  番禺: 'pān yú',
})

const PEOPLES =
  '各族|蒙古族|蒙古|回族|藏族|维吾尔|苗族|彝族|壮族|布依族|朝鲜族|满族|侗族|瑶族|白族|土家族|哈尼族|哈萨克|傣族|黎族|傈僳族|佤族|畲族|拉祜族|水族|东乡族|纳西族|景颇族|柯尔克孜|土族|达斡尔族|仫佬族|羌族|布朗族|撒拉族|毛南族|仡佬族|锡伯|阿昌族|普米族|塔吉克|怒族|鄂温克族|德昂族|保安族|裕固族|京族|独龙族|鄂伦春族|基诺族'

/** 顺德区 → 顺德, 红河哈尼族彝族自治州 → 红河, for the pinyin. */
function bare(name) {
  let short = name.replace(/自治(区|州|县|旗)$/, '')
  const people = new RegExp(`(${PEOPLES})族?$`)
  while (people.test(short) && short.replace(people, '').length >= 2) short = short.replace(people, '')
  short = short.replace(/(特别行政区|林区|新区|地区|矿区|特区|省|市|区|县|盟|旗)$/, '')
  return short.length >= 2 ? short : name
}

function english(name) {
  const short = bare(name)
  if (ONLY[short]) return ONLY[short]
  const words = pinyin(short, { toneType: 'none', type: 'array', v: true }).join('')
  const spelt = words.charAt(0).toUpperCase() + words.slice(1)
  const known = ENGLISH[short]
  return known && known.toLowerCase() !== spelt.toLowerCase() ? `${known}|${spelt}` : spelt
}

/** 市辖区 and 省直辖县级行政区划 are bookkeeping, not places. */
const filing = (name) => name === '市辖区' || name === '县' || /直辖县级行政区划$/.test(name)

/**
 * Development zones and industrial parks are in the list too, as places a
 * city runs. Nobody travels to 呼和浩特经济技术开发区; its city finds the card.
 */
const zone = (name) => /(开发区|产业园区|工业园区|化工园区|创意园区|示范区|合作区|试验区|实验区|聚集区|食品区|生态园)$/.test(name)

const pca = JSON.parse(readFileSync(file('pca.json'), 'utf8'))

/** Every name in China, with and without its 市 or 区, for telling a mistaken one abroad. */
const chinaNames = new Set()
for (const [province, cities] of Object.entries(pca)) {
  for (const name of [province, ...Object.keys(cities), ...Object.values(cities).flat()]) {
    chinaNames.add(name)
    chinaNames.add(bare(name))
  }
}
for (const [province, cities] of Object.entries(pca)) {
  const rule = CHINA[province]
  if (rule === undefined) {
    say(`${province} is in pca.json but not in places-map.mjs`)
    continue
  }
  const target = (city, county) =>
    typeof rule === 'string' ? rule : (rule[`${city}/${county}`] ?? (county === undefined ? rule[city] : rule[city]))
  if (typeof rule === 'object') {
    for (const key of Object.keys(rule)) {
      const [city, county] = key.split('/')
      if (!cities[city] || (county && !cities[city].includes(county))) say(`${province}: ${key} is not in pca.json`)
    }
    for (const city of Object.keys(cities)) if (rule[city] === undefined) say(`${province}: ${city} has no card`)
  }
  // The province on every one of its cards: 四川省 is all three.
  const cards = new Set()
  for (const [city, counties] of Object.entries(cities)) {
    const cityTarget = target(city)
    if (cityTarget) cards.add(card(cityTarget, province).id)
    for (const county of counties) {
      const countyTarget = target(city, county)
      if (countyTarget) cards.add(card(countyTarget, province).id)
    }
  }
  const root = new Map([...cards].map((id) => [id, add(id, province, english(province), -1, PROVINCE)]))

  for (const [city, counties] of Object.entries(cities)) {
    const cityTarget = target(city)
    if (!cityTarget) continue
    const home = card(cityTarget, `${province} ${city}`)
    // 市辖区 is no place, so 北京's districts are straight under 北京市.
    const parentIn = new Map()
    if (!filing(city)) {
      parentIn.set(home.id, add(home.id, city, english(city), root.get(home.id), home.near ? NEAR : 0))
    }
    for (const county of counties) {
      if (zone(county)) continue
      const there = card(target(city, county), `${province} ${city} ${county}`)
      if (!parentIn.has(there.id)) {
        parentIn.set(there.id, filing(city) ? root.get(there.id) : add(there.id, city, english(city), root.get(there.id), CONTEXT))
      }
      add(there.id, county, english(county), parentIn.get(there.id), there.near ? NEAR : 0)
    }
  }
}

// The rest of the world -----------------------------------------------------------

const zh = JSON.parse(readFileSync(file('zh-names.json'), 'utf8'))

/** Simplified first; Malaysia's and Singapore's own Chinese first there. */
function chinese(id, country, han = []) {
  const labels = zh[id] ?? {}
  const order =
    country === 'MY'
      ? ['zh-my', 'zh-sg', 'zh-cn', 'zh-hans', 'zh']
      : country === 'SG'
        ? ['zh-sg', 'zh-my', 'zh-cn', 'zh-hans', 'zh']
        : ['zh-cn', 'zh-hans', 'zh', 'zh-sg', 'zh-my']
  const names = [...new Set(order.map((lang) => labels[lang]).filter(Boolean))]
    // A label that is the English name over again is no Chinese name.
    .filter((name) => /[㐀-鿿]/.test(name))
  if (names.length > 0) return names.slice(0, 3).join('|')
  // GeoNames' own, untagged and now and then wrong: a London street called
  // 佛山. Outside the places that write Chinese characters, a name that is a
  // Chinese city's is taken for one of those mistakes.
  const sure = HAN.has(country) ? han : han.filter((name) => !chinaNames.has(name))
  return sure.slice(0, 2).join('|')
}

/** Where a town's name in Chinese characters is its own. */
const HAN = new Set(['CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'SG', 'MY'])

/** Kraków is Krakow too, to whoever has no ó to type. */
const either = (display, ascii) => (ascii && ascii !== display ? `${display}|${ascii}` : display)

/**
 * A division as people say it: Palawan, not Province of Palawan; Izmir, not
 * Izmir Province. Western Province stays, as Western on its own is nothing.
 */
function tidy(name) {
  const short = name
    .replace(/^(Province of|Provincia de|Provincia di|Region of|Región de) /i, '')
    .replace(/ (Province|province|Region)$/, '')
  return /^(North|South|East|West|Central|National Capital)/.test(short) && short !== name ? name : short
}
const divisionName = (d) => either(tidy(d.display), tidy(d.ascii))

const admin1 = new Map(divisions('admin1CodesASCII.txt').map((d) => [d.code, d]))
const admin2 = new Map(divisions('admin2Codes.txt').map((d) => [d.code, d]))

/** places-map.mjs's names, as rules by GeoNames code: "MY.02.0207" → my-langkawi. */
const rules = new Map()
for (const [country, cards] of Object.entries(SPLIT)) {
  const byName = new Map()
  for (const d of admin1.values()) if (d.code.startsWith(`${country}.`)) byName.set(d.ascii, d.code)
  for (const d of admin2.values()) {
    if (!d.code.startsWith(`${country}.`)) continue
    const top = admin1.get(d.code.split('.').slice(0, 2).join('.'))
    if (top) byName.set(`${top.ascii}/${d.ascii}`, d.code)
  }
  for (const [id, names] of Object.entries(cards)) {
    for (const entry of names) {
      const name = entry.replace(/^~/, '')
      const code = name === '*' ? `${country}.*` : byName.get(name)
      if (!code) {
        say(`places-map.mjs ${country}: no division is called "${name}"`)
        continue
      }
      if (rules.has(code)) say(`places-map.mjs ${country}: "${name}" is given twice`)
      rules.set(code, card(entry.startsWith('~') ? `~${id}` : id, `${country} ${name}`))
    }
  }
}

/** Which card a division or town is on, from its codes; the narrowest rule wins. */
function placeOf(country, a1, a2) {
  if (!SPLIT[country]) return { id: cardsOf.get(country)[0], near: false }
  return (
    (a2 && rules.get(`${country}.${a1}.${a2}`)) ||
    (ADMIN2[country] !== 'instead' && rules.get(`${country}.${a1}`)) ||
    rules.get(`${country}.*`) ||
    null
  )
}

// Every division of a split country has to land somewhere, or its towns cannot be found.
const fellThrough = new Map()
for (const d of admin1.values()) {
  const [country, a1] = d.code.split('.')
  if (!SPLIT[country] || ADMIN2[country] === 'instead') continue
  if (!rules.has(d.code)) {
    if (rules.has(`${country}.*`)) fellThrough.set(country, [...(fellThrough.get(country) ?? []), d.ascii])
    else say(`places-map.mjs ${country}: ${d.ascii} (${a1}) has no card`)
  }
}
for (const d of admin2.values()) {
  const [country, a1, a2] = d.code.split('.')
  if (ADMIN2[country] === 'instead' && !placeOf(country, a1, a2)) say(`places-map.mjs ${country}: ${d.ascii} has no card`)
}

/**
 * A division's index on a card, added the first time a town under it is:
 * as a place of its own on its own card, and only to name its towns on
 * any other (Kedah is the nearest for Penang, and Langkawi's on its own).
 */
const divisionIndex = new Map()
function division(d, country, home, onCard) {
  const key = `${onCard.id}\u0000${d.code}`
  if (divisionIndex.has(key)) return divisionIndex.get(key)
  const own = home && home.id === onCard.id
  const flags = own ? (home.near ? NEAR : 0) : CONTEXT
  const index = add(onCard.id, chinese(d.id, country), divisionName(d), -1, flags)
  divisionIndex.set(key, index)
  return index
}

// The divisions themselves, every one, even with no town big enough to list.
for (const d of admin1.values()) {
  const [country, a1] = d.code.split('.')
  if (!wanted(country) || ADMIN2[country] === 'instead') continue
  const home = placeOf(country, a1)
  if (home) division(d, country, home, home)
}
for (const d of admin2.values()) {
  const [country, a1, a2] = d.code.split('.')
  if (!wanted(country) || !ADMIN2[country]) continue
  const home = placeOf(country, a1, a2)
  if (!home) continue
  const top = admin1.get(`${country}.${a1}`)
  const parent = ADMIN2[country] === 'also' && top ? division(top, country, placeOf(country, a1), home) : -1
  const key = `${home.id}\u0000${d.code}`
  divisionIndex.set(key, add(home.id, chinese(d.id, country), divisionName(d), parent, home.near ? NEAR : 0))
}

const all = towns().sort((a, b) => b.people - a.people)
const unplaced = []
const unknown = []
for (const town of all) {
  // GeoNames does not know the state of a few towns (00). In a country with
  // one card that does not matter; in one with several there is no telling
  // which, so they are left out and named.
  if (SPLIT[town.country] && (!town.admin1 || town.admin1 === '00')) {
    unknown.push(`${town.display} (${town.country})`)
    continue
  }
  const home = placeOf(town.country, town.admin1, town.admin2)
  if (!home) {
    unplaced.push(`${town.display} (${town.country}.${town.admin1}.${town.admin2})`)
    continue
  }
  // A town is named by the division a person would say it is in: Taiwan's
  // county, the Philippines' province, everywhere else the state.
  const a2 = admin2.get(`${town.country}.${town.admin1}.${town.admin2}`)
  const a1 = admin1.get(`${town.country}.${town.admin1}`)
  const by = ADMIN2[town.country] && a2 ? a2 : ADMIN2[town.country] === 'instead' ? null : a1
  const parent = by ? division(by, town.country, by === a2 ? placeOf(town.country, town.admin1, town.admin2) : placeOf(town.country, town.admin1), home) : -1
  // A town named in Chinese exactly as its state is a mistake in Wikidata
  // (Evergreen Park as 伊利诺伊州), and would find it for the state's name.
  const theirs = parent >= 0 ? lists.get(home.id)[parent].zh.split('|') : []
  const names = chinese(town.id, town.country, town.han)
    .split('|')
    .filter((name) => name && !theirs.includes(name))
    .join('|')
  add(home.id, names, either(town.display, town.ascii), parent, home.near ? NEAR : 0)
}

// --- Writing it ------------------------------------------------------------------

for (const [country, names] of fellThrough) {
  console.log(`${country}: on the card for the rest of the country — ${names.join(', ')}`)
}
if (unknown.length) console.log(`Left out, in no state or province: ${unknown.join(', ')}`)
if (unplaced.length) say(`on no card: ${unplaced.slice(0, 20).join(', ')}`)
for (const id of lists.keys()) if (!ids.has(id)) say(`places for ${id}, which is no card`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

const places = {}
for (const d of destinations) {
  const list = lists.get(d.id)
  if (!list) continue
  places[d.id] = list.map(({ zh, en, parent, flags }) => {
    const row = [zh, en]
    if (parent >= 0 || flags) row.push(parent)
    if (flags) row.push(flags)
    return row
  })
}

// One card to a line: a diff of a new district is one line, and the file
// still opens in an editor.
const body = Object.entries(places)
  .map(([id, list]) => `    ${JSON.stringify(id)}: ${JSON.stringify(list)}`)
  .join(',\n')
writeFileSync(
  OUT,
  `{\n  "sources": "China: 国家统计局 via github.com/modood/Administrative-divisions-of-China. Elsewhere: GeoNames (geonames.org, CC BY 4.0). Chinese names: Wikidata (CC0).",\n  "places": {\n${body}\n  }\n}\n`,
)

const count = Object.values(places).reduce((sum, list) => sum + list.length, 0)
const withChinese = Object.values(places).reduce((sum, list) => sum + list.filter(([name]) => name).length, 0)
console.log(
  `${shown(OUT)}: ${count} places on ${Object.keys(places).length} cards, ${withChinese} with a Chinese name; ` +
    `${Math.round(readFileSync(OUT).length / 1024)} KB.`,
)
