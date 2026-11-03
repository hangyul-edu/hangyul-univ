import fs from 'node:fs';
const S = { // branch, second, third, fourth
  ko: ['분교', '제2캠퍼스', '제3캠퍼스', '제4캠퍼스'], en: ['branch campus', 'second campus', 'third campus', 'fourth campus'],
  vi: ['phân hiệu', 'cơ sở 2', 'cơ sở 3', 'cơ sở 4'], ne: ['शाखा क्याम्पस', 'दोस्रो क्याम्पस', 'तेस्रो क्याम्पस', 'चौथो क्याम्पस'],
  uz: ['filial', 'ikkinchi kampus', 'uchinchi kampus', 'toʻrtinchi kampus'], mn: ['салбар', '2-р кампус', '3-р кампус', '4-р кампус'],
  'zh-Hans': ['分校', '第二校区', '第三校区', '第四校区'], ja: ['分校', '第2キャンパス', '第3キャンパス', '第4キャンパス'],
  th: ['วิทยาเขตสาขา', 'วิทยาเขตที่ 2', 'วิทยาเขตที่ 3', 'วิทยาเขตที่ 4'], id: ['kampus cabang', 'kampus kedua', 'kampus ketiga', 'kampus keempat'],
  fil: ['sangay na kampus', 'ikalawang kampus', 'ikatlong kampus', 'ikaapat na kampus'], my: ['ခွဲကျောင်း', 'ဒုတိယကျောင်းဝင်း', 'တတိယကျောင်းဝင်း', 'စတုတ္ထကျောင်းဝင်း'],
  hi: ['शाखा परिसर', 'दूसरा परिसर', 'तीसरा परिसर', 'चौथा परिसर'], bn: ['শাখা ক্যাম্পাস', 'দ্বিতীয় ক্যাম্পাস', 'তৃতীয় ক্যাম্পাস', 'চতুর্থ ক্যাম্পাস'],
  kk: ['филиал', 'екінші кампус', 'үшінші кампус', 'төртінші кампус'], ky: ['филиал', 'экинчи кампус', 'үчүнчү кампус', 'төртүнчү кампус'],
  ar: ['حرم فرعي', 'الحرم الثاني', 'الحرم الثالث', 'الحرم الرابع'], tr: ['şube kampüsü', 'ikinci kampüs', 'üçüncü kampüs', 'dördüncü kampüs'],
  ru: ['филиал', 'второй кампус', 'третий кампус', 'четвёртый кампус'], uk: ['філія', 'другий кампус', 'третій кампус', 'четвертий кампус'],
  pl: ['filia', 'drugi kampus', 'trzeci kampus', 'czwarty kampus'], cs: ['pobočka', 'druhý kampus', 'třetí kampus', 'čtvrtý kampus'],
  hu: ['kihelyezett kampusz', 'második kampusz', 'harmadik kampusz', 'negyedik kampusz'], ro: ['filială', 'al doilea campus', 'al treilea campus', 'al patrulea campus'],
  sr: ['огранак', 'други кампус', 'трећи кампус', 'четврти кампус'], el: ['παράρτημα', 'δεύτερη πανεπιστημιούπολη', 'τρίτη πανεπιστημιούπολη', 'τέταρτη πανεπιστημιούπολη'],
  it: ['sede distaccata', 'secondo campus', 'terzo campus', 'quarto campus'], es: ['campus filial', 'segundo campus', 'tercer campus', 'cuarto campus'],
  pt: ['polo', 'segundo campus', 'terceiro campus', 'quarto campus'], fr: ['campus annexe', 'deuxième campus', 'troisième campus', 'quatrième campus'],
  de: ['Zweigcampus', 'zweiter Campus', 'dritter Campus', 'vierter Campus'], nl: ['nevenvestiging', 'tweede campus', 'derde campus', 'vierde campus'],
  sv: ['filialcampus', 'andra campus', 'tredje campus', 'fjärde campus'],
};
const col = (i) => Object.fromEntries(Object.entries(S).map(([l, v]) => [l, v[i]]));
fs.writeFileSync(new URL('./campus-role.json', import.meta.url), JSON.stringify({ marketing: Object.fromEntries(['branch', 'second', 'third', 'fourth'].map((k, i) => [`v23.uni.campusRole.${k}`, col(i)])) }));
