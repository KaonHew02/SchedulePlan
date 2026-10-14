/**
 * Which card every province, state and district belongs to — the hand-kept
 * half of src/seasons/places.json. scripts/places.mjs reads it.
 *
 * A country with one card needs nothing here: every town in Iceland is on the
 * Iceland card. A country with several does, because nothing in the place
 * data knows that 大阪 is 関西 or that Hoi An is Central Vietnam.
 *
 * An id with a ~ in front is the nearest card rather than the card the place
 * is on: Chicago has no card of its own, and New York and the Northeast is
 * the nearest, so it is found there and the card says it is only the nearest.
 *
 * Names are as GeoNames spells them in admin1CodesASCII.txt and
 * admin2Codes.txt (the ASCII column), and as pca.json spells them for China.
 * "Kedah/Langkawi" is a district of a state, and wins over "Kedah". "*" is
 * every name in the country not given anywhere else. The build stops on a
 * name that is not in the data, and on one in the data given nowhere, so a
 * new province shows up as an error rather than as a town that cannot be
 * found.
 */

/**
 * China, from pca.json: 省 → 市 → 区县. A province with one card is a string;
 * one with several names each 市, and a 区县 where it belongs elsewhere —
 * 东川 is 昆明's, but its red land is on the 元阳罗平建水东川 card.
 */
export const CHINA = {
  北京市: 'cn-beijing',
  天津市: 'cn-tianjin',
  河北省: 'cn-hebei',
  山西省: 'cn-shanxi',
  内蒙古自治区: {
    呼伦贝尔市: 'cn-neimenggu-east',
    兴安盟: 'cn-neimenggu-east',
    通辽市: 'cn-neimenggu-east',
    赤峰市: 'cn-neimenggu-east',
    锡林郭勒盟: 'cn-neimenggu-east',
    呼和浩特市: 'cn-neimenggu-west',
    包头市: 'cn-neimenggu-west',
    乌海市: 'cn-neimenggu-west',
    鄂尔多斯市: 'cn-neimenggu-west',
    巴彦淖尔市: 'cn-neimenggu-west',
    乌兰察布市: 'cn-neimenggu-west',
    阿拉善盟: 'cn-neimenggu-west',
  },
  辽宁省: 'cn-liaoning',
  吉林省: 'cn-jilin',
  黑龙江省: 'cn-heilongjiang',
  上海市: 'cn-shanghai',
  江苏省: 'cn-jiangsu',
  浙江省: 'cn-zhejiang',
  安徽省: 'cn-anhui',
  福建省: 'cn-fujian',
  江西省: 'cn-jiangxi',
  山东省: 'cn-shandong',
  河南省: 'cn-henan',
  湖北省: 'cn-hubei',
  湖南省: 'cn-hunan',
  广东省: 'cn-guangdong',
  广西壮族自治区: 'cn-guangxi',
  海南省: 'cn-hainan',
  重庆市: 'cn-chongqing',
  四川省: {
    成都市: 'cn-sichuan-chengdu',
    乐山市: 'cn-sichuan-chengdu',
    眉山市: 'cn-sichuan-chengdu',
    德阳市: 'cn-sichuan-chengdu',
    雅安市: 'cn-sichuan-chengdu',
    // The rest of the basin is the same weather as 成都, a few hours away.
    自贡市: '~cn-sichuan-chengdu',
    泸州市: '~cn-sichuan-chengdu',
    绵阳市: '~cn-sichuan-chengdu',
    广元市: '~cn-sichuan-chengdu',
    遂宁市: '~cn-sichuan-chengdu',
    内江市: '~cn-sichuan-chengdu',
    南充市: '~cn-sichuan-chengdu',
    宜宾市: '~cn-sichuan-chengdu',
    广安市: '~cn-sichuan-chengdu',
    达州市: '~cn-sichuan-chengdu',
    巴中市: '~cn-sichuan-chengdu',
    资阳市: '~cn-sichuan-chengdu',
    阿坝藏族羌族自治州: 'cn-sichuan-jiuzhaigou',
    '阿坝藏族羌族自治州/小金县': 'cn-sichuan-west',
    '阿坝藏族羌族自治州/金川县': '~cn-sichuan-west',
    '阿坝藏族羌族自治州/马尔康市': '~cn-sichuan-west',
    '阿坝藏族羌族自治州/壤塘县': '~cn-sichuan-west',
    '阿坝藏族羌族自治州/汶川县': '~cn-sichuan-chengdu',
    甘孜藏族自治州: 'cn-sichuan-west',
    凉山彝族自治州: '~cn-sichuan-west',
    攀枝花市: '~cn-sichuan-west',
  },
  贵州省: 'cn-guizhou',
  云南省: {
    昆明市: 'cn-yunnan-dali-lijiang',
    '昆明市/东川区': 'cn-yunnan-southeast',
    大理白族自治州: 'cn-yunnan-dali-lijiang',
    丽江市: 'cn-yunnan-dali-lijiang',
    楚雄彝族自治州: '~cn-yunnan-dali-lijiang',
    玉溪市: '~cn-yunnan-dali-lijiang',
    迪庆藏族自治州: 'cn-yunnan-shangri-la-meili',
    西双版纳傣族自治州: 'cn-yunnan-xishuangbanna',
    普洱市: '~cn-yunnan-xishuangbanna',
    红河哈尼族彝族自治州: 'cn-yunnan-southeast',
    曲靖市: 'cn-yunnan-southeast',
    文山壮族苗族自治州: 'cn-yunnan-southeast',
    昭通市: '~cn-yunnan-southeast',
    保山市: 'cn-yunnan-tengchong-nujiang',
    德宏傣族景颇族自治州: 'cn-yunnan-tengchong-nujiang',
    怒江傈僳族自治州: 'cn-yunnan-tengchong-nujiang',
    临沧市: '~cn-yunnan-tengchong-nujiang',
  },
  西藏自治区: {
    拉萨市: 'cn-tibet-lhasa-everest',
    日喀则市: 'cn-tibet-lhasa-everest',
    山南市: '~cn-tibet-lhasa-everest',
    那曲市: '~cn-tibet-lhasa-everest',
    林芝市: 'cn-tibet-nyingchi',
    昌都市: '~cn-tibet-nyingchi',
    阿里地区: 'cn-tibet-ngari',
  },
  陕西省: 'cn-shaanxi',
  甘肃省: {
    酒泉市: 'cn-gansu-hexi',
    嘉峪关市: 'cn-gansu-hexi',
    张掖市: 'cn-gansu-hexi',
    金昌市: 'cn-gansu-hexi',
    武威市: 'cn-gansu-hexi',
    兰州市: '~cn-gansu-hexi',
    白银市: '~cn-gansu-hexi',
    定西市: '~cn-gansu-gannan',
    甘南藏族自治州: 'cn-gansu-gannan',
    临夏回族自治州: 'cn-gansu-gannan',
    天水市: '~cn-gansu-gannan',
    陇南市: '~cn-gansu-gannan',
    平凉市: '~cn-gansu-gannan',
    庆阳市: '~cn-gansu-gannan',
  },
  青海省: 'cn-qinghai',
  宁夏回族自治区: 'cn-ningxia',
  新疆维吾尔自治区: {
    乌鲁木齐市: 'cn-xinjiang-north',
    克拉玛依市: 'cn-xinjiang-north',
    昌吉回族自治州: 'cn-xinjiang-north',
    博尔塔拉蒙古自治州: 'cn-xinjiang-north',
    塔城地区: 'cn-xinjiang-north',
    阿勒泰地区: 'cn-xinjiang-north',
    伊犁哈萨克自治州: 'cn-xinjiang-yili',
    吐鲁番市: 'cn-xinjiang-south-east',
    哈密市: 'cn-xinjiang-south-east',
    巴音郭楞蒙古自治州: 'cn-xinjiang-south-east',
    阿克苏地区: 'cn-xinjiang-south-east',
    克孜勒苏柯尔克孜自治州: 'cn-xinjiang-south-east',
    喀什地区: 'cn-xinjiang-south-east',
    和田地区: 'cn-xinjiang-south-east',
    // The 兵团 towns the region runs itself, each with the card it sits in.
    自治区直辖县级行政区划: 'cn-xinjiang-north',
    '自治区直辖县级行政区划/可克达拉市': 'cn-xinjiang-yili',
    '自治区直辖县级行政区划/阿拉尔市': 'cn-xinjiang-south-east',
    '自治区直辖县级行政区划/图木舒克市': 'cn-xinjiang-south-east',
    '自治区直辖县级行政区划/铁门关市': 'cn-xinjiang-south-east',
    '自治区直辖县级行政区划/昆玉市': 'cn-xinjiang-south-east',
    '自治区直辖县级行政区划/新星市': 'cn-xinjiang-south-east',
  },
}

/**
 * The rest of the world, by GeoNames' first-level divisions. Taiwan's are
 * too coarse to be any use (one of them is "Taiwan"), so ADMIN2 says to go by
 * its counties instead; the Philippines' provinces are searched as well as
 * its regions, because Palawan, Bohol and Aklan are what people type.
 */
export const ADMIN2 = { TW: 'instead', PH: 'also' }

export const SPLIT = {
  JP: {
    'jp-hokkaido': ['Hokkaido'],
    'jp-tohoku': ['Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima'],
    'jp-kanto': ['Tokyo', 'Kanagawa', 'Chiba', 'Saitama', 'Ibaraki', 'Tochigi', 'Gunma'],
    'jp-chubu': ['Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi'],
    'jp-kansai': ['Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama'],
    'jp-chugoku-shikoku': ['Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi'],
    'jp-kyushu': ['Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima'],
    'jp-okinawa': ['Okinawa'],
  },
  KR: {
    'kr-seoul-gyeonggi': ['Seoul', 'Incheon', 'Gyeonggi-do', '~North Chungcheong', '~Chungcheongnam-do', '~Daejeon', '~Sejong-si', '~Jeollabuk-do'],
    'kr-gangwon': ['Gangwon-do'],
    'kr-busan-gyeongsang': ['Busan', 'Daegu', 'Ulsan', 'Gyeongsangbuk-do', 'Gyeongsangnam-do', '~Jeollanam-do', '~Gwangju'],
    'kr-jeju': ['Jeju-do'],
  },
  TW: {
    'tw-taipei-north': [
      'Taipei/New Taipei City', 'Taiwan/Taipei City', 'Taiwan/Keelung', 'Taiwan/Taoyuan',
      'Taiwan/Hsinchu', 'Taiwan/Hsinchu County', 'Taiwan/Yilan',
    ],
    'tw-central-south': [
      'Taiwan/Taichung City', 'Taiwan/Changhua', 'Taiwan/Nantou', 'Taiwan/Yunlin', 'Taiwan/Chiayi', 'Taiwan/Chiayi County',
      'Taiwan/Tainan', 'Takao/Kaohsiung', 'Taiwan/Pingtung', '~Taiwan/Miaoli',
    ],
    'tw-east-islands': ['Taiwan/Hualien', 'Taiwan/Taitung', 'Taiwan/Penghu County', 'Fukien/Kinmen County', 'Fukien/Lienchiang'],
  },
  MY: {
    'my-kuala-lumpur': ['Kuala Lumpur', 'Putrajaya', 'Selangor', 'Melaka', 'Perak', 'Negeri Sembilan', '~Johor'],
    'my-penang': ['Penang', '~Kedah', '~Perlis'],
    'my-langkawi': ['Kedah/Langkawi'],
    'my-highlands': ['Pahang/Cameron Highlands', 'Pahang/Bentong', 'Pahang/Raub'],
    'my-east-coast': [
      'Terengganu', 'Kelantan', 'Pahang', 'Pahang/Kuantan', 'Pahang/Pekan', 'Pahang/Daerha Rompin',
      '~Pahang/Maran', '~Pahang/Temerluh', '~Pahang/Bera', '~Pahang/Daerah Jerantut', '~Pahang/Lipis',
    ],
    'my-sabah': ['Sabah', '~Labuan'],
    'my-sarawak': ['Sarawak'],
  },
  TH: {
    'th-bangkok-central': [
      'Bangkok', 'Nonthaburi', 'Pathum Thani', 'Samut Prakan', 'Samut Sakhon', 'Samut Songkhram', 'Nakhon Pathom',
      'Phra Nakhon Si Ayutthaya', 'Ang Thong', 'Sing Buri', 'Chai Nat', 'Lopburi', 'Saraburi', 'Nakhon Nayok',
      'Suphan Buri', 'Kanchanaburi', 'Ratchaburi', 'Phetchaburi', 'Prachuap Khiri Khan', 'Chon Buri', 'Rayong',
      'Chachoengsao', 'Prachin Buri', 'Sa Kaeo', '~Chanthaburi', '~Trat',
      '~Kamphaeng Phet', '~Phichit', '~Phetchabun', '~Nakhon Sawan', '~Uthai Thani',
      // 东北部 (Isan) has no card of its own.
      '~Nong Khai', '~Sakon Nakhon', '~Khon Kaen', '~Kalasin', '~Maha Sarakham', '~Roi Et', '~Chaiyaphum',
      '~Nakhon Ratchasima', '~Buriram', '~Surin', '~Si Sa Ket', '~Yasothon', '~Nakhon Phanom', '~Ubon Ratchathani',
      '~Udon Thani', '~Amnat Charoen', '~Mukdahan', '~Nong Bua Lamphu', '~Bueng Kan',
    ],
    'th-chiang-mai-north': [
      'Chiang Mai', 'Chiang Rai', 'Mae Hong Son', 'Lamphun', 'Lampang', 'Phrae', 'Nan', 'Phayao', 'Uttaradit',
      '~Tak', '~Sukhothai', '~Phitsanulok', '~Loei',
    ],
    'th-phuket-andaman': ['Phuket', 'Krabi', 'Phang Nga', 'Ranong province', 'Trang', 'Satun'],
    'th-samui-gulf': [
      'Surat Thani', 'Chumphon', 'Nakhon Si Thammarat', '~Phatthalung', '~Songkhla', '~Pattani', '~Yala', '~Narathiwat',
    ],
  },
  VN: {
    'vn-north': [
      'Hanoi', 'Cao Bang Province', 'Tuyen Quang', 'GJien Bien Province', 'Lai Chau Province', 'Son La Province',
      'Lao Cai', 'Thai Nguyen', 'Lang Son Province', 'Quang Ninh', 'Bac Ninh', 'Phu Tho', 'Hai Phong',
      'Hung Yen Province', 'Ninh Binh', '~Thanh Hoa Province', '~Nghe An Province',
    ],
    'vn-central': ['Quang Tri', 'Thua Thien Hue Province', 'Da Nang City', 'Quang Ngai', '~Ha Tinh Province'],
    'vn-south-central': ['Gia Lai', 'Khanh Hoa', 'Lam Dong', 'Dak Lak'],
    'vn-south': [
      'Ho Chi Minh City (HCMC)', 'Dong Nai', 'Tay Ninh', 'Dong Thap', 'Vinh Long', 'An Giang', 'Can Tho City', 'Ca Mau',
    ],
  },
  PH: {
    'ph-manila-luzon': [
      'National Capital Region', 'Calabarzon', 'Central Luzon', 'Ilocos', 'Cordillera', 'Cagayan Valley', 'Bicol Region',
      '~Mimaropa',
    ],
    'ph-palawan': ['Mimaropa/Province of Palawan'],
    'ph-boracay': ['~Western Visayas', 'Western Visayas/Province of Aklan'],
    'ph-cebu-bohol': ['Central Visayas', '~Eastern Visayas'],
    'ph-siargao-mindanao': [
      'Caraga', 'Davao Region', '~Northern Mindanao', '~Zamboanga Peninsula', '~Soccsksargen',
      '~Autonomous Region in Muslim Mindanao',
    ],
  },
  ID: {
    'id-bali': ['Bali'],
    'id-lombok-gili': ['West Nusa Tenggara'],
    'id-java': [
      'Jakarta', 'West Java', 'Central Java', 'East Java', 'Yogyakarta', 'Banten',
      '~West Kalimantan', '~South Kalimantan', '~Central Kalimantan', '~East Kalimantan', '~North Kalimantan',
    ],
    'id-komodo-flores': [
      'East Nusa Tenggara', '~Central Sulawesi', '~Southeast Sulawesi', '~North Sulawesi', '~Gorontalo',
      '~South Sulawesi', '~West Sulawesi',
    ],
    'id-sumatra': [
      'Aceh', 'North Sumatra', 'West Sumatra', 'Riau', 'Riau Islands', 'Jambi', 'South Sumatra', 'Bengkulu', 'Lampung',
      'Bangka-Belitung Islands',
    ],
    'id-raja-ampat-papua': [
      'Papua', 'West Papua', 'Southwest Papua', 'Highland Papua', 'South Papua', 'Central Papua', '~Maluku', '~North Maluku',
    ],
  },
  IN: {
    'in-north-plains': [
      'Delhi', 'Uttar Pradesh', 'Rajasthan', 'Haryana', 'Punjab', 'Chandigarh',
      '~Madhya Pradesh', '~Bihar', '~Gujarat', '~Jharkhand', '~Chhattisgarh',
    ],
    'in-ladakh-himachal': ['Ladakh', 'Himachal Pradesh', '~Jammu and Kashmir', '~Uttarakhand'],
    'in-goa': ['Goa', '~Maharashtra', '~Dadra and Nagar Haveli and Daman and Diu'],
    'in-kerala-south': [
      'Kerala', 'Tamil Nadu', 'Karnataka', 'Puducherry', 'Lakshadweep',
      '~Andhra Pradesh', '~Telangana', '~Andaman and Nicobar',
    ],
    'in-darjeeling-sikkim': [
      'West Bengal', 'Sikkim', 'Meghalaya', 'Assam', 'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura',
      '~Odisha',
    ],
  },
  LK: {
    'lk-southwest-coast': ['Western Province', 'Southern Province', '~North Western Province'],
    'lk-hill-country': ['Central Province', 'Uva Province', 'North Central Province', '~Sabaragamuwa Province'],
    'lk-east-north': ['Eastern Province', 'Northern Province'],
  },
  TR: {
    'tr-istanbul': [
      'Istanbul', '~Edirne', '~Kirklareli', '~Tekirdag', '~Kocaeli', '~Sakarya', '~Yalova', '~Bursa Province',
      '~Bilecik', '~Duzce', '~Bolu', '~Zonguldak Province', '~Bartin', '~Karabuek Province', '~Kastamonu', '~Sinop',
    ],
    'tr-cappadocia': ['Nevsehir Province', 'Kayseri', 'Aksaray', 'Nigde Province', 'Kirsehir', '~*'],
    'tr-aegean-med': [
      'Izmir Province', 'Aydin', 'Mugla', 'Denizli', 'Antalya',
      '~Manisa', '~Usak', '~Kuetahya', '~Afyonkarahisar Province', '~Isparta', '~Burdur', '~Balikesir', '~Canakkale',
      '~Mersin', '~Adana', '~Hatay', '~Osmaniye',
    ],
  },
  GB: {
    'gb-england': ['England', '~Wales'],
    'gb-scotland': ['Scotland', '~Northern Ireland'],
  },
  FR: {
    'fr-paris-north': [
      'Ile-de-France', 'Normandy', 'Hauts-de-France', '~Brittany', '~Pays de la Loire', '~Centre-Val de Loire',
      '~New Aquitaine',
    ],
    'fr-provence': ["Provence-Alpes-Cote d'Azur", '~Occitanie', '~Corsica'],
    'fr-alps-east': ['Auvergne-Rhone-Alpes', 'Grand Est', 'Bourgogne-Franche-Comte'],
  },
  ES: {
    'es-madrid-central': ['Madrid', 'Castille-La Mancha', 'Castille and Leon', '~Extremadura'],
    'es-barcelona-north': [
      'Catalonia', 'Basque Country', 'Navarre', 'La Rioja', 'Aragon', 'Cantabria', 'Asturias', 'Galicia', '~Valencia',
    ],
    'es-andalusia': ['Andalusia', '~Murcia', '~Ceuta', '~Melilla'],
    'es-balearic': ['Balearic Islands'],
    'es-canary': ['Canary Islands'],
  },
  PT: {
    'pt-lisbon-porto': ['*', '~Evora', '~Portalegre', '~Beja'],
    'pt-algarve-islands': ['Faro', 'Madeira', 'Azores'],
  },
  IT: {
    'it-north': [
      'Lombardy', 'Veneto', 'Liguria', 'Emilia-Romagna', 'Piedmont', 'Aosta Valley', 'Trentino-Alto Adige',
      'Friuli Venezia Giulia',
    ],
    'it-central': ['Lazio', 'Tuscany', 'Umbria', '~The Marches', '~Abruzzo', '~Molise'],
    'it-south-islands': ['Campania', 'Basilicate', 'Apulia', 'Calabria', 'Sicily', 'Sardinia'],
  },
  GR: {
    'gr-athens-mainland': [
      'Attica', 'Central Greece', 'Thessaly', 'Peloponnese', '~Central Macedonia', '~East Macedonia and Thrace',
      '~West Macedonia', '~Epirus', '~West Greece', '~Mount Athos',
    ],
    'gr-islands': ['Ionian Islands', 'North Aegean', 'South Aegean', 'Crete'],
  },
  DE: {
    'de-north': [
      'State of Berlin', 'Hamburg', 'Bremen', 'Schleswig-Holstein', 'Lower Saxony', 'Mecklenburg-Vorpommern',
      'Brandenburg', 'Saxony', 'Saxony-Anhalt', 'North Rhine-Westphalia', '~Thuringia',
    ],
    'de-south': ['Bavaria', 'Baden-Wurttemberg', '~Hesse', '~Rheinland-Pfalz', '~Saarland'],
  },
  NO: {
    'no-fjords': ['*', '~Trondelag'],
    'no-arctic': ['Nordland', 'Troms', 'Finnmark'],
  },
  FI: {
    'fi-south': [
      'Uusimaa', 'Southwest Finland', 'Pirkanmaa', 'Kanta-Haeme', 'Paijat-Hame', 'Kymenlaakso', 'South Karelia',
      'Satakunta', '~*',
    ],
    'fi-lapland': ['Lapland', '~North Ostrobothnia', '~Kainuu'],
  },
  RU: {
    // Everything west of the Urals that has no card is nearest Moscow.
    'ru-moscow-spb': ['Moscow', 'Moscow Oblast', 'St.-Petersburg', "Leningradskaya Oblast'", 'Vladimir Oblast', '~*'],
    'ru-murmansk': ['Murmansk', '~Karelia', '~Arkhangelskaya', '~Nenets', '~Komi'],
    'ru-baikal': [
      'Irkutsk Oblast', 'Buryatiya Republic', '~Zabaykalskiy (Transbaikal) Kray', '~Krasnoyarsk Krai',
      '~Republic of Tyva', '~Khakasiya Republic', '~Kuzbass', '~Novosibirsk Oblast', '~Tomsk Oblast', '~Omsk Oblast',
      '~Altai', '~Altai Krai', '~Tyumen Oblast', '~Khanty-Mansia', '~Yamalo-Nenets',
    ],
    'ru-far-east': [
      'Primorye', 'Kamchatka', '~Khabarovsk', '~Amur Oblast', '~Jewish Autonomous Oblast', '~Sakhalin Oblast',
      '~Magadan Oblast', '~Chukotka', '~Sakha',
    ],
  },
  TZ: {
    'tz-tanzania-north': ['Arusha', 'Kilimanjaro', 'Manyara', 'Mara', 'Simiyu', '~*'],
    'tz-zanzibar': [
      'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West', 'Pemba North', 'Pemba South',
      '~Dar es Salaam Region', '~Pwani',
    ],
  },
  ZA: {
    'za-cape-town': ['Western Cape', '~Eastern Cape', '~Northern Cape'],
    'za-kruger': ['Mpumalanga', 'Limpopo', 'Gauteng', '~KwaZulu-Natal', '~Free State', '~North West'],
  },
  AU: {
    'au-sydney-nsw': ['New South Wales', '~Australian Capital Territory'],
    'au-melbourne-vic': ['Victoria'],
    'au-queensland': ['Queensland'],
    'au-northern-territory': ['Northern Territory'],
    'au-western-australia': ['Western Australia'],
    'au-south-australia': ['South Australia'],
    'au-tasmania': ['Tasmania'],
  },
  NZ: {
    'nz-north-island': [
      'Auckland', 'Bay of Plenty', 'Waikato Region', 'Wellington Region', 'Gisborne', "Hawke's Bay Region",
      'Manawatu-Wanganui', 'Taranaki Region', 'Northland',
    ],
    'nz-south-island': [
      'Canterbury', 'Otago', 'Southland', 'West Coast', 'Marlborough', 'Nelson Region', 'Tasman District',
      '~Chatham Islands',
    ],
  },
  US: {
    'us-northeast': [
      'New York', 'New Jersey', 'Pennsylvania', 'Massachusetts', 'Connecticut', 'Rhode Island', 'Vermont',
      'New Hampshire', 'Maine', 'District of Columbia', 'Maryland', 'Delaware',
      '~Virginia', '~West Virginia', '~Ohio', '~Michigan', '~Indiana', '~Illinois', '~Wisconsin',
    ],
    'us-south': [
      'Louisiana', 'Texas', 'Tennessee', 'South Carolina', 'Georgia', 'North Carolina', 'Kentucky', 'Alabama',
      'Mississippi', 'Arkansas', '~Oklahoma', '~Missouri',
    ],
    'us-florida': ['Florida'],
    'us-california': ['California'],
    'us-southwest': ['Arizona', 'Nevada', 'Utah', 'New Mexico'],
    'us-yellowstone': [
      'Wyoming', 'Montana', 'Colorado', 'Idaho',
      '~Minnesota', '~Iowa', '~North Dakota', '~South Dakota', '~Nebraska', '~Kansas',
    ],
    'us-pacificnw': ['Washington', 'Oregon'],
    'us-hawaii': ['Hawaii'],
    'us-alaska': ['Alaska'],
  },
  CA: {
    'ca-rockies': ['Alberta', '~Saskatchewan'],
    'ca-bc': ['British Columbia'],
    'ca-east': ['Ontario', 'Quebec', '~New Brunswick', '~Nova Scotia', '~Prince Edward Island', '~Newfoundland and Labrador'],
    'ca-north': ['Yukon', 'Northwest Territories', 'Nunavut', '~Manitoba'],
  },
  MX: {
    'mx-cancun': ['Quintana Roo', 'Yucatan', 'Campeche', '~Tabasco', '~Chiapas'],
    'mx-central': ['Mexico City', 'Mexico', 'Oaxaca', 'Guanajuato', 'Puebla', 'Queretaro', 'Hidalgo', 'Morelos', 'Tlaxcala', '~*'],
  },
  CL: {
    'cl-santiago-atacama': [
      'Santiago Metropolitan', 'Valparaiso', 'Antofagasta', 'Atacama', 'Coquimbo Region', 'Tarapaca',
      'Arica y Parinacota Region', "~O'Higgins Region", '~Maule Region', '~Nuble', '~Biobio',
    ],
    'cl-patagonia': ['Aysen', 'Region of Magallanes', '~Araucania', '~Los Rios Region', '~Los Lagos Region'],
    'cl-easter-island': ['Valparaiso/Provincia de Isla de Pascua'],
  },
  AR: {
    'ar-buenosaires-north': ['Buenos Aires', 'Buenos Aires F.D.', 'Misiones', 'Mendoza', 'Salta', 'Jujuy', '~*'],
    'ar-patagonia': ['Santa Cruz', 'Tierra del Fuego', 'Rio Negro', 'Chubut', 'Neuquen'],
  },
  BR: {
    'br-rio': ['Rio de Janeiro', 'Sao Paulo', 'Parana', '~Minas Gerais', '~Espirito Santo', '~Santa Catarina', '~Rio Grande do Sul'],
    'br-amazon-pantanal': [
      'Amazonas', 'Para', 'Acre', 'Rondonia', 'Roraima', 'Amapa', 'Mato Grosso', 'Mato Grosso do Sul', 'Bahia', 'Ceara',
      '~*',
    ],
  },
  // One card for the country, but for part of it.
  PK: { 'pk-north': ['Gilgit-Baltistan', '~*'] },
  ZW: { 'zw-victoria-falls': ['Matabeleland North', '~*'] },
  ZM: { 'zw-victoria-falls': ['Southern Province', '~*'] },
}

/**
 * Places GeoNames files under a country of their own that are on a card with
 * another's: Svalbard is SJ, and its card is the Arctic one with Greenland.
 */
export const EXTRA = { SJ: 'xx-arctic' }

/**
 * Where a card's pin goes on the map when none of its towns is a GeoNames
 * town of 15,000 people: the Antarctic Peninsula, Easter Island.
 */
export const PINS = {
  'cn-sichuan-jiuzhaigou': [33.26, 103.92], // 九寨沟 沟口
  'cn-yunnan-tengchong-nujiang': [25.02, 98.49], // 腾冲
  'cn-tibet-ngari': [30.29, 81.18], // 普兰
  'my-highlands': [4.47, 101.38], // Tanah Rata, Cameron Highlands
  'th-samui-gulf': [9.51, 100.01], // Koh Samui
  'id-lombok-gili': [-8.35, 116.04], // Gili Trawangan
  'lu-luxembourg': [49.61, 6.13], // Luxembourg City
  'es-canary': [28.47, -16.25], // Santa Cruz de Tenerife
  'sc-seychelles': [-4.62, 55.45], // Victoria, Mahé
  'pw-palau': [7.34, 134.48], // Koror
  'vu-vanuatu-cook-islands': [-17.73, 168.32], // Port Vila
  'aq-antarctica': [-64.6, -62.5], // the Antarctic Peninsula, by Paradise Bay
  'cl-easter-island': [-27.15, -109.43], // Hanga Roa
  'xx-arctic': [78.22, 15.65], // Longyearbyen
  // GeoNames calls it New York City, so New York would find Boston, the next town.
  'us-northeast': [40.71, -74.01],
}
