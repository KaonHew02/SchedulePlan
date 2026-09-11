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

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]))

export const countryOf = (code: string | null | undefined): Country | undefined =>
  code ? BY_CODE.get(code.toUpperCase()) : undefined

export const countryName = (code: string | null | undefined): string =>
  countryOf(code)?.name ?? code ?? ''

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

/** 'Kyoto, Japan' — or just the country when no city was given. */
export function placeLabel(place: { country: string; city: string | null } | null): string {
  if (!place) return ''
  const name = countryName(place.country)
  return place.city ? `${place.city}, ${name}` : name
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
