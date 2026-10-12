import { isZh } from './i18n'

/**
 * The countries, and where they sit on a sphere.
 *
 * One compact table rather than a map file. A real world map is hundreds of
 * kilobytes of border geometry, and nothing here needs borders — the globe
 * plots a dot per country and the counters group by continent, both of which
 * a centroid answers perfectly well.
 *
 * Flags are not stored. A flag emoji is just the two letters of the country
 * code shifted into the regional-indicator block, so it can be derived.
 *
 * The continent column is a single choice per country, which is a
 * simplification with known casualties: Russia and Türkiye straddle two,
 * and are filed where most of their land and most travellers' sense of them
 * sits.
 */

export type ContinentCode = 'AF' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC'

export const CONTINENTS: Record<ContinentCode, string> = {
  AF: 'Africa',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  OC: 'Oceania',
}

const CONTINENTS_ZH: Record<ContinentCode, string> = {
  AF: '非洲',
  AS: '亚洲',
  EU: '欧洲',
  NA: '北美洲',
  SA: '南美洲',
  OC: '大洋洲',
}

/** A continent in the app's language. CONTINENTS is the English, for anything kept or compared. */
export const continentName = (code: ContinentCode): string =>
  isZh() ? CONTINENTS_ZH[code] : CONTINENTS[code]

/** `CODE|Name|Continent|lat|lon` */
const TABLE = `
AD|Andorra|EU|42.5|1.5
AE|United Arab Emirates|AS|24|54
AF|Afghanistan|AS|33|65
AG|Antigua and Barbuda|NA|17.05|-61.8
AL|Albania|EU|41|20
AM|Armenia|AS|40|45
AO|Angola|AF|-12.5|18.5
AR|Argentina|SA|-34|-64
AT|Austria|EU|47.33|13.33
AU|Australia|OC|-27|133
AZ|Azerbaijan|AS|40.5|47.5
BA|Bosnia and Herzegovina|EU|44|18
BB|Barbados|NA|13.17|-59.53
BD|Bangladesh|AS|24|90
BE|Belgium|EU|50.83|4
BF|Burkina Faso|AF|13|-2
BG|Bulgaria|EU|43|25
BH|Bahrain|AS|26|50.55
BI|Burundi|AF|-3.5|30
BJ|Benin|AF|9.5|2.25
BN|Brunei|AS|4.5|114.67
BO|Bolivia|SA|-17|-65
BR|Brazil|SA|-10|-55
BS|Bahamas|NA|24.25|-76
BT|Bhutan|AS|27.5|90.5
BW|Botswana|AF|-22|24
BY|Belarus|EU|53|28
BZ|Belize|NA|17.25|-88.75
CA|Canada|NA|60|-95
CD|DR Congo|AF|0|25
CF|Central African Republic|AF|7|21
CG|Congo|AF|-1|15
CH|Switzerland|EU|47|8
CI|Côte d'Ivoire|AF|8|-5
CL|Chile|SA|-30|-71
CM|Cameroon|AF|6|12
CN|China|AS|35|105
CO|Colombia|SA|4|-72
CR|Costa Rica|NA|10|-84
CU|Cuba|NA|21.5|-80
CV|Cabo Verde|AF|16|-24
CY|Cyprus|EU|35|33
CZ|Czechia|EU|49.75|15.5
DE|Germany|EU|51|9
DJ|Djibouti|AF|11.5|43
DK|Denmark|EU|56|10
DO|Dominican Republic|NA|19|-70.67
DZ|Algeria|AF|28|3
EC|Ecuador|SA|-2|-77.5
EE|Estonia|EU|59|26
EG|Egypt|AF|27|30
ER|Eritrea|AF|15|39
ES|Spain|EU|40|-4
ET|Ethiopia|AF|8|38
FI|Finland|EU|64|26
FJ|Fiji|OC|-18|178
FR|France|EU|46|2
GA|Gabon|AF|-1|11.75
GB|United Kingdom|EU|54|-2
GE|Georgia|AS|42|43.5
GH|Ghana|AF|8|-2
GL|Greenland|NA|72|-40
GM|Gambia|AF|13.47|-16.57
GN|Guinea|AF|11|-10
GQ|Equatorial Guinea|AF|2|10
GR|Greece|EU|39|22
GT|Guatemala|NA|15.5|-90.25
GW|Guinea-Bissau|AF|12|-15
GY|Guyana|SA|5|-59
HK|Hong Kong|AS|22.25|114.17
HN|Honduras|NA|15|-86.5
HR|Croatia|EU|45.17|15.5
HT|Haiti|NA|19|-72.42
HU|Hungary|EU|47|20
ID|Indonesia|AS|-5|120
IE|Ireland|EU|53|-8
IL|Israel|AS|31.5|34.75
IN|India|AS|20|77
IQ|Iraq|AS|33|44
IR|Iran|AS|32|53
IS|Iceland|EU|65|-18
IT|Italy|EU|42.83|12.83
JM|Jamaica|NA|18.25|-77.5
JO|Jordan|AS|31|36
JP|Japan|AS|36|138
KE|Kenya|AF|1|38
KG|Kyrgyzstan|AS|41|75
KH|Cambodia|AS|13|105
KM|Comoros|AF|-12.17|44.25
KP|North Korea|AS|40|127
KR|South Korea|AS|37|127.5
KW|Kuwait|AS|29.34|47.66
KZ|Kazakhstan|AS|48|68
LA|Laos|AS|18|105
LB|Lebanon|AS|33.83|35.83
LI|Liechtenstein|EU|47.17|9.53
LK|Sri Lanka|AS|7|81
LR|Liberia|AF|6.5|-9.5
LS|Lesotho|AF|-29.5|28.5
LT|Lithuania|EU|56|24
LU|Luxembourg|EU|49.75|6.17
LV|Latvia|EU|57|25
LY|Libya|AF|25|17
MA|Morocco|AF|32|-5
MC|Monaco|EU|43.73|7.4
MD|Moldova|EU|47|29
ME|Montenegro|EU|42.5|19.3
MG|Madagascar|AF|-20|47
MK|North Macedonia|EU|41.83|22
ML|Mali|AF|17|-4
MM|Myanmar|AS|22|98
MN|Mongolia|AS|46|105
MO|Macau|AS|22.17|113.55
MR|Mauritania|AF|20|-12
MT|Malta|EU|35.83|14.58
MU|Mauritius|AF|-20.28|57.55
MV|Maldives|AS|3.25|73
MW|Malawi|AF|-13.5|34
MX|Mexico|NA|23|-102
MY|Malaysia|AS|2.5|112.5
MZ|Mozambique|AF|-18.25|35
NA|Namibia|AF|-22|17
NE|Niger|AF|16|8
NG|Nigeria|AF|10|8
NI|Nicaragua|NA|13|-85
NL|Netherlands|EU|52.5|5.75
NO|Norway|EU|62|10
NP|Nepal|AS|28|84
NZ|New Zealand|OC|-41|174
OM|Oman|AS|21|57
PA|Panama|NA|9|-80
PE|Peru|SA|-10|-76
PG|Papua New Guinea|OC|-6|147
PH|Philippines|AS|13|122
PK|Pakistan|AS|30|70
PL|Poland|EU|52|20
PR|Puerto Rico|NA|18.25|-66.5
PT|Portugal|EU|39.5|-8
PY|Paraguay|SA|-23|-58
QA|Qatar|AS|25.5|51.25
RO|Romania|EU|46|25
RS|Serbia|EU|44|21
RU|Russia|EU|60|100
RW|Rwanda|AF|-2|30
SA|Saudi Arabia|AS|25|45
SB|Solomon Islands|OC|-8|159
SC|Seychelles|AF|-4.58|55.67
SD|Sudan|AF|15|30
SE|Sweden|EU|62|15
SG|Singapore|AS|1.37|103.8
SI|Slovenia|EU|46.12|14.82
SK|Slovakia|EU|48.67|19.5
SL|Sierra Leone|AF|8.5|-11.5
SM|San Marino|EU|43.77|12.42
SN|Senegal|AF|14|-14
SO|Somalia|AF|10|49
SR|Suriname|SA|4|-56
SS|South Sudan|AF|7|30
SV|El Salvador|NA|13.83|-88.92
SY|Syria|AS|35|38
SZ|Eswatini|AF|-26.5|31.5
TD|Chad|AF|15|19
TG|Togo|AF|8|1.17
TH|Thailand|AS|15|100
TJ|Tajikistan|AS|39|71
TL|Timor-Leste|AS|-8.83|125.92
TM|Turkmenistan|AS|40|60
TN|Tunisia|AF|34|9
TO|Tonga|OC|-20|-175
TR|Türkiye|AS|39|35
TT|Trinidad and Tobago|NA|11|-61
TW|Taiwan|AS|23.5|121
TZ|Tanzania|AF|-6|35
UA|Ukraine|EU|49|32
UG|Uganda|AF|1|32
US|United States|NA|38|-97
UY|Uruguay|SA|-33|-56
UZ|Uzbekistan|AS|41|64
VE|Venezuela|SA|8|-66
VN|Vietnam|AS|16|106
VU|Vanuatu|OC|-16|167
WS|Samoa|OC|-13.58|-172.33
YE|Yemen|AS|15|48
ZA|South Africa|AF|-29|24
ZM|Zambia|AF|-15|30
ZW|Zimbabwe|AF|-20|30
`

export interface Country {
  code: string
  name: string
  continent: ContinentCode
  lat: number
  lon: number
}

export const COUNTRIES: Country[] = TABLE.trim()
  .split('\n')
  .map((line) => {
    const [code, name, continent, lat, lon] = line.split('|')
    return {
      code,
      name,
      continent: continent as ContinentCode,
      lat: Number(lat),
      lon: Number(lon),
    }
  })

/**
 * The same countries in Chinese, for when the app is in 中文. Written out
 * rather than asked of Intl.DisplayNames: an older iPhone has no DisplayNames,
 * and the ones that do disagree about Hong Kong. `CODE:名字`, space apart.
 */
const ZH_NAMES = `
AD:安道尔 AE:阿联酋 AF:阿富汗 AG:安提瓜和巴布达 AL:阿尔巴尼亚 AM:亚美尼亚 AO:安哥拉 AR:阿根廷 AT:奥地利 AU:澳大利亚 AZ:阿塞拜疆
BA:波斯尼亚和黑塞哥维那 BB:巴巴多斯 BD:孟加拉国 BE:比利时 BF:布基纳法索 BG:保加利亚 BH:巴林 BI:布隆迪 BJ:贝宁 BN:文莱 BO:玻利维亚
BR:巴西 BS:巴哈马 BT:不丹 BW:博茨瓦纳 BY:白俄罗斯 BZ:伯利兹 CA:加拿大 CD:刚果（金） CF:中非 CG:刚果（布） CH:瑞士 CI:科特迪瓦
CL:智利 CM:喀麦隆 CN:中国 CO:哥伦比亚 CR:哥斯达黎加 CU:古巴 CV:佛得角 CY:塞浦路斯 CZ:捷克 DE:德国 DJ:吉布提 DK:丹麦 DO:多米尼加
DZ:阿尔及利亚 EC:厄瓜多尔 EE:爱沙尼亚 EG:埃及 ER:厄立特里亚 ES:西班牙 ET:埃塞俄比亚 FI:芬兰 FJ:斐济 FR:法国 GA:加蓬 GB:英国
GE:格鲁吉亚 GH:加纳 GL:格陵兰 GM:冈比亚 GN:几内亚 GQ:赤道几内亚 GR:希腊 GT:危地马拉 GW:几内亚比绍 GY:圭亚那 HK:香港 HN:洪都拉斯
HR:克罗地亚 HT:海地 HU:匈牙利 ID:印度尼西亚 IE:爱尔兰 IL:以色列 IN:印度 IQ:伊拉克 IR:伊朗 IS:冰岛 IT:意大利 JM:牙买加 JO:约旦
JP:日本 KE:肯尼亚 KG:吉尔吉斯斯坦 KH:柬埔寨 KM:科摩罗 KP:朝鲜 KR:韩国 KW:科威特 KZ:哈萨克斯坦 LA:老挝 LB:黎巴嫩 LI:列支敦士登
LK:斯里兰卡 LR:利比里亚 LS:莱索托 LT:立陶宛 LU:卢森堡 LV:拉脱维亚 LY:利比亚 MA:摩洛哥 MC:摩纳哥 MD:摩尔多瓦 ME:黑山 MG:马达加斯加
MK:北马其顿 ML:马里 MM:缅甸 MN:蒙古 MO:澳门 MR:毛里塔尼亚 MT:马耳他 MU:毛里求斯 MV:马尔代夫 MW:马拉维 MX:墨西哥 MY:马来西亚
MZ:莫桑比克 NA:纳米比亚 NE:尼日尔 NG:尼日利亚 NI:尼加拉瓜 NL:荷兰 NO:挪威 NP:尼泊尔 NZ:新西兰 OM:阿曼 PA:巴拿马 PE:秘鲁
PG:巴布亚新几内亚 PH:菲律宾 PK:巴基斯坦 PL:波兰 PR:波多黎各 PT:葡萄牙 PY:巴拉圭 QA:卡塔尔 RO:罗马尼亚 RS:塞尔维亚 RU:俄罗斯
RW:卢旺达 SA:沙特阿拉伯 SB:所罗门群岛 SC:塞舌尔 SD:苏丹 SE:瑞典 SG:新加坡 SI:斯洛文尼亚 SK:斯洛伐克 SL:塞拉利昂 SM:圣马力诺
SN:塞内加尔 SO:索马里 SR:苏里南 SS:南苏丹 SV:萨尔瓦多 SY:叙利亚 SZ:斯威士兰 TD:乍得 TG:多哥 TH:泰国 TJ:塔吉克斯坦 TL:东帝汶
TM:土库曼斯坦 TN:突尼斯 TO:汤加 TR:土耳其 TT:特立尼达和多巴哥 TW:台湾 TZ:坦桑尼亚 UA:乌克兰 UG:乌干达 US:美国 UY:乌拉圭
UZ:乌兹别克斯坦 VE:委内瑞拉 VN:越南 VU:瓦努阿图 WS:萨摩亚 YE:也门 ZA:南非 ZM:赞比亚 ZW:津巴布韦
`

const ZH = new Map(
  ZH_NAMES.trim()
    .split(/\s+/)
    .map((pair) => pair.split(':') as [string, string]),
)

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]))

/**
 * ISO 3166-1 numeric to alpha-2, for the countries the map file carries.
 *
 * The world map keys its shapes by the numeric code and everything else in
 * this app keys by alpha-2, so one of them has to translate. Kept here rather
 * than in the map loader because it is data about countries, and it is a
 * kilobyte — the map file it belongs to is a hundred times that and loads only
 * when the Travel screen asks for it.
 *
 * Three shapes in the file have no code at all (N. Cyprus, Somaliland,
 * Kosovo). They are drawn as land nobody has been to, which is the honest
 * answer for a country this app has no code for.
 */
const NUMERIC = `242FJ 834TZ 732EH 124CA 840US 398KZ 860UZ 598PG 360ID 032AR 152CL 180CD 706SO 404KE 729SD 148TD 332HT 214DO 643RU 044BS 238FK 578NO 304GL 260TF 626TL 710ZA 426LS 484MX 858UY 076BR 068BO 604PE 170CO 591PA 188CR 558NI 340HN 222SV 320GT 084BZ 862VE 328GY 740SR 250FR 218EC 630PR 388JM 192CU 716ZW 072BW 516NA 686SN 466ML 478MR 204BJ 562NE 566NG 120CM 768TG 288GH 384CI 324GN 624GW 430LR 694SL 854BF 140CF 178CG 266GA 226GQ 894ZM 454MW 508MZ 748SZ 024AO 108BI 376IL 422LB 450MG 275PS 270GM 788TN 012DZ 400JO 784AE 634QA 414KW 368IQ 512OM 548VU 116KH 764TH 418LA 104MM 704VN 408KP 410KR 496MN 356IN 050BD 064BT 524NP 586PK 004AF 762TJ 417KG 795TM 364IR 760SY 051AM 752SE 112BY 804UA 616PL 040AT 348HU 498MD 642RO 440LT 428LV 233EE 276DE 100BG 300GR 792TR 008AL 191HR 756CH 442LU 056BE 528NL 620PT 724ES 372IE 540NC 090SB 554NZ 036AU 144LK 156CN 158TW 380IT 208DK 826GB 352IS 031AZ 268GE 608PH 458MY 096BN 705SI 246FI 703SK 203CZ 232ER 392JP 600PY 887YE 682SA 010AQ 196CY 504MA 818EG 434LY 231ET 262DJ 800UG 646RW 070BA 807MK 688RS 499ME 780TT 728SS`

const BY_NUMERIC = new Map<string, string>(
  NUMERIC.trim()
    .split(/\s+/)
    .map((pair) => [pair.slice(0, -2), pair.slice(-2)] as const),
)

/** The alpha-2 code for a map shape's numeric id, if this app knows the country. */
export const alpha2Of = (numeric: string | number | null | undefined): string | undefined =>
  numeric === null || numeric === undefined ? undefined : BY_NUMERIC.get(String(numeric))

export const countryOf = (code: string | null | undefined): Country | undefined =>
  code ? BY_CODE.get(code.toUpperCase()) : undefined

/** In the app's language: 'Japan', or 日本 in 中文. */
export const countryName = (code: string | null | undefined): string => {
  const country = countryOf(code)
  if (!country) return code ?? ''
  return (isZh() && ZH.get(country.code)) || country.name
}

/** Both names and the code, lower-cased, so a search finds 日本 or Japan whichever language the app is in. */
export const countrySearchText = (code: string): string =>
  `${countryOf(code)?.name ?? ''} ${ZH.get(code.toUpperCase()) ?? ''} ${code}`.toLowerCase()

/**
 * The flag, built from the code.
 *
 * 'MY' becomes the two regional indicator symbols for M and Y, which every
 * modern platform renders as the Malaysian flag. Codes the table does not
 * know are given nothing rather than a pair of stray letter blocks.
 */
export function flagOf(code: string | null | undefined): string {
  const country = countryOf(code)
  if (!country) return '🏳️'
  return String.fromCodePoint(
    ...[...country.code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  )
}

/**
 * 'Kyoto, Japan', '三亚, 海南, China' — or as much of it as was given. A region
 * that is the city over again (Da Nang in Da Nang) is said once. In 中文 the
 * other way round: 日本 · Kyoto, 中国 · 海南 · 三亚.
 */
export function placeLabel(
  place: { country: string; region?: string | null; city: string | null } | null,
): string {
  if (!place) return ''
  const region = place.region && cityKey(place.region) !== cityKey(place.city) ? place.region : null
  // Chinese goes from the biggest to the smallest, as an address does: 中国 · 海南 · 三亚.
  if (isZh()) return [countryName(place.country), region, place.city].filter(Boolean).join(' · ')
  return [place.city, region, countryName(place.country)].filter(Boolean).join(', ')
}

/**
 * What makes two cities the same city, for counting.
 *
 * A name is typed fresh each time it is entered, and case, stray spaces and
 * accents all wander between one typing and the next. Hoi An and Hội An are
 * the same town, and counting them twice walks the places goal ahead of
 * where anybody has actually been.
 *
 * The stroked letters are folded by hand because NFD will not do it: Đ is a
 * letter in its own right, not a D with a mark on top, so it survives the
 * decomposition that catches every other accent in Đà Nẵng.
 *
 * An empty key means a visit that named no city at all, which the counting
 * treats as 'somewhere in this country' rather than as a place of its own.
 */
export function cityKey(city: string | null | undefined): string {
  return (city ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * What has been typed for a country before, for the form to offer back: its
 * regions, and the cities — in `region` when one is given. Each once, in the
 * spelling first met, newest rows first when the list is newest first.
 */
export function typedBefore(
  places: ({ country: string; region?: string | null; city?: string | null } | null | undefined)[],
  country: string,
  region?: string,
): { regions: string[]; cities: string[] } {
  const regions = new Map<string, string>()
  const cities = new Map<string, string>()
  const inRegion = region ? cityKey(region) : ''
  for (const place of places) {
    if (!place || place.country !== country) continue
    const key = cityKey(place.region)
    if (key && !regions.has(key)) regions.set(key, place.region!.trim())
    const city = cityKey(place.city)
    if (city && (!inRegion || key === inRegion) && !cities.has(city)) cities.set(city, place.city!.trim())
  }
  return { regions: [...regions.values()], cities: [...cities.values()] }
}

// ------------------------------------------------------------- projection

const RAD = Math.PI / 180

export interface Projected {
  x: number
  y: number
  /** False when the point is round the back of the sphere. */
  visible: boolean
}

/**
 * Orthographic projection — the globe as seen from very far away.
 *
 * `cosc` is the cosine of the angular distance from the point you are looking
 * at. Negative means the point is on the far hemisphere, which is what tells
 * the globe to hide a dot rather than drawing it wrongly on top.
 */
export function project(
  lat: number,
  lon: number,
  centreLat: number,
  centreLon: number,
  radius: number,
): Projected {
  const phi = lat * RAD
  const lambda = (lon - centreLon) * RAD
  const phi0 = centreLat * RAD

  const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda)
  const x = radius * Math.cos(phi) * Math.sin(lambda)
  // SVG's y grows downward, so north has to be negated.
  const y = -radius * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda))

  return { x, y, visible: cosc >= 0 }
}

/**
 * The wireframe: meridians every 30°, parallels every 30°.
 *
 * Each line is sampled and then broken wherever it crosses the horizon, so a
 * meridian that disappears round the back comes out as one visible arc rather
 * than a chord cutting across the face of the globe.
 */
export function graticule(centreLat: number, centreLon: number, radius: number): string[] {
  const paths: string[] = []
  const push = (points: Projected[]) => {
    let run: string[] = []
    for (const point of points) {
      if (point.visible) {
        run.push(`${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      } else if (run.length > 1) {
        paths.push(`M${run.join('L')}`)
        run = []
      } else {
        run = []
      }
    }
    if (run.length > 1) paths.push(`M${run.join('L')}`)
  }

  for (let lon = -180; lon < 180; lon += 30) {
    const points: Projected[] = []
    for (let lat = -90; lat <= 90; lat += 4) {
      points.push(project(lat, lon, centreLat, centreLon, radius))
    }
    push(points)
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    const points: Projected[] = []
    for (let lon = -180; lon <= 180; lon += 4) {
      points.push(project(lat, lon, centreLat, centreLon, radius))
    }
    push(points)
  }

  return paths
}
