/**
 * V11 — write the homepage copy into the locale bundles.
 *
 * Korean and Russian are NOT authored here. Both are taken from `docs/qa/v11/koreanasha-copy.json`, generated
 * from the owner's template, so both homepages match the Koreanasha source by construction and
 * `scripts/qa/v11-copy-fidelity.mjs` can prove it. The template ships both as first-class locales — Koreanasha's
 * audience is Russian-speaking, so its Russian is the company's own words rather than a translation of its
 * Korean — which makes **two** owner-authorised canonical locales, not one.
 *
 * English is a translation OF THE KOREAN SOURCE (brief: "The Korean source becomes the canonical marketing
 * source"), not a carry-over of V10's English marketing text.
 *
 * Translation provenance: these English strings are an AI translation, reviewed in-session against the Korean.
 * That is `SYNTHETIC_REVIEWED` at best and is recorded as such — no human translator has seen them, and nothing
 * here may be labelled HUMAN_REVIEWED.
 *
 *   node scripts/i18n/v11-install-copy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const p = (x) => resolve(root, x);
const manifest = JSON.parse(readFileSync(p('docs/qa/v11/koreanasha-copy.json'), 'utf8'));

/** English rendering of the canonical Korean, keyed by the same Hangyul key. */
const EN = {
  'v11.nav.services': 'Services',
  'v11.nav.faq': 'FAQ',
  'v11.hero.title': 'Studying in Korea is easy!',
  'v11.hero.lede': 'We turn your dream into reality.<br>Take the first step towards studying in Korea — start right now!',
  'v11.unis.title': '<h2 class="mb-4"><span class="text-blue">{{count}} Korean universities</span><br>are waiting for your admission.</h2>',
  'v11.why.title': 'With Hangyul,<br><span class="text-gradation">the road to studying abroad changes!</span>',
  'v11.why.s1.title': 'Complete support,<br>from the first step to success',
  'v11.why.s1.text': 'We take responsibility for every stage of studying in Korea. Choosing a programme, preparing documents, entering the country — we are beside you from beginning to end. Hangyul is not simply a consultation; we are your partner in success.',
  'v11.why.s2.title': 'A 100% tailored strategy,<br>for you alone',
  'v11.why.s2.text': 'Every student’s dreams and goals are different. With a study plan built around your strengths and your goals, we design the best route to making that dream real. Hangyul maximises your potential.',
  'v11.why.s3.title': 'The most reasonable cost,<br>the best result',
  'v11.why.s3.text': 'Start studying in Korea without worrying about the cost! Hangyul provides a premium service at a reasonable price and guarantees a successful life as a student abroad. Experience study-abroad support on a different level, at the best value for money.',
  'v11.services.eyebrow': 'Our services',
  'v11.services.title': 'Every moment of studying abroad,<br>Hangyul is <span class="text-blue">completely with you</span>.',
  'v11.services.lede': 'From the start of your preparation to the moment you reach your goal,<br>Hangyul stays firmly by your side.',
  'v11.services.s1.title': 'University and language-school recommendations made for you',
  'v11.services.s1.text': 'We propose the universities and language institutes that match your ability and your goals exactly. One-to-one counselling covers scholarship programmes in detail, and we take care of the whole process, from preparing your admission documents to communicating with the university.',
  'v11.services.s2.title': 'No worries after you are accepted either — full support until you are settled',
  'v11.services.s2.text': 'We give careful support through every part of settling in as a student: visa issuance, applying for your alien registration card, enrolling in classes. We go through everything you need so that you can make a steady start, even in a new environment.',
  'v11.services.s3.title': 'A study-abroad community that is stronger together',
  'v11.services.s3.text': 'Through a community of admitted students we offer the chance to share information and build new connections. Finding accommodation, everyday information and networking are all handled in one place, supporting every moment of student life.',
  'v11.faq.eyebrow': 'FAQ',
  'v11.faq.title': 'Frequently asked questions',
  'v11.faq.q1.q': 'What documents do I need in order to be admitted?',
  'v11.faq.q1.a': 'The documents required for admission are listed below. Additional documents may be needed depending on the university and the department, and you may also submit recommendation letters from teachers and employers, or a certificate of participation in an olympiad.<br><br>1. * A high-school / junior-college graduation certificate, translated into English and certified by a notary + apostille<br>2. An academic transcript translated into English and certified by a notary + apostille<br>3. A copy of your passport<br>4. Copies of both parents’ passports. Where a parent does not hold a foreign passport, their identity document must be translated into English and notarised.<br>5. A translated and notarised birth certificate or family relation certificate<br>6. A certificate for either Korean or English (TOPIK, TOEFL, IELTS, or a relevant supporting document)<br>7. A bank certificate for USD 15,000 or more (the amount can vary with the university’s location) (valid 30 days)',
  'v11.faq.q2.q': 'Do I have to submit TOPIK to be admitted?',
  'v11.faq.q2.a': 'To be admitted to a Korean university you need a Korean or English qualification (TOPIK, TOEFL, IELTS), and there are also universities that can accept you through their own internal test of Korean ability.',
  'v11.faq.q3.q': 'Which language tests are taken?',
  'v11.faq.q3.a': 'Universities accept TOPIK, TOEFL and IELTS certification. However, there are universities that will also accept documents such as a certificate of completion from a Korean language institute at a university in Korea, a Korean language certificate (for those who have passed the university’s own Korean test), or a certificate of completion of King Sejong Institute Korean at intermediate level 1 or above.',
  'v11.faq.q4.q': 'Can I prepare even if I do not know any Korean?',
  'v11.faq.q4.a': 'If you choose an English-track major you can study entirely in English.',
  'v11.faq.q5.q': 'When is the application deadline?',
  'v11.faq.q5.a': 'It depends on the university and the direction you have chosen. So that preparing your documents is comfortable, it is best to start with us at least six months before your studies begin. For language courses the lead time can be a little shorter.',
  'v11.faq.q6.q': 'Which universities offer scholarships for international students?',
  'v11.faq.q6.a': 'Universities each offer scholarships for international students, but the size and the entry conditions differ.',
  'v11.faq.q7.q': 'What grades do I need in order to be admitted?',
  'v11.faq.q7.a': 'There is no lower limit on the grades you need to apply to a university in Korea, but the higher your marks, the better your chances of being admitted to the university you want.',
  'v11.faq.q8.q': 'Is there an age limit for admission?',
  'v11.faq.q8.a': 'Most Korean universities have no limit on the age of admission, although some universities do set a particular age limit. There is no need to worry, though! We can recommend universities where the age limit is not a problem, so please talk to us. In principle a high-school or junior-college graduation certificate is required, and that is a mandatory document.',
  'v11.faq.q9.q': 'Can I be admitted straight after finishing high school?',
  'v11.faq.q9.a': 'Yes — you can go to a Korean university straight after graduating from high school or junior college.',
  'v11.faq.q10.q': 'Is it easy to find a job after graduating from a Korean university?',
  'v11.faq.q10.a': 'Finding employment in Korea depends on your major. Engineering and business are comparatively easier, while the humanities can be difficult.',
};

/** Hangyul's own strings — the ones Koreanasha has no equivalent for, because it had a form where we have login. */
const OWN = {
  ko: {
    'v11.hero.explore': '대학 둘러보기',
    'v11.unis.all': '대학 전체 보기',
    'v11.unis.rowLabel': '한국 대학교 로고 {{n}}번째 줄',
    'v11.unis.disclaimer': '각 로고는 해당 대학의 상표입니다. 한귤과의 제휴 관계를 나타내지 않습니다.',
    'v11.cta.title': '한국 유학, 지금 시작하세요.',
    'v11.cta.text': '계정을 만들면 지원 가능한 과정과 준비해야 할 서류를 내 조건에 맞춰 보여 드립니다.',
    'v11.credits.sourcesTitle': '자료 출처',
    'v11.services.s1.alt': '이화여자대학교 ECC. 도심으로 이어지는 유리 협곡 형태의 캠퍼스 복합 건물.',
    'v11.services.s2.alt': '인천공항 제1터미널 입국장. 수하물을 든 여행객과 항공편 안내 전광판.',
    'v11.services.s3.alt': '홍대의 24시간 라면 가게. 벽을 가득 채운 라면 진열대.',
  },
  ru: {
    'v11.hero.explore': 'Посмотреть университеты',
    'v11.unis.all': 'Все университеты',
    'v11.unis.rowLabel': 'Логотипы корейских университетов, ряд {{n}}',
    'v11.unis.disclaimer': 'Каждый логотип — товарный знак своего университета. Он не означает партнёрства с Hangyul.',
    'v11.cta.title': 'Начните учёбу в Корее прямо сейчас.',
    'v11.cta.text': 'Создайте аккаунт — и мы покажем программы, на которые вы можете подать документы, и какие документы для этого нужны именно вам.',
    'v11.credits.sourcesTitle': 'Откуда взяты наши данные',
    'v11.services.s1.alt': 'Комплекс ECC университета Ихва: стеклянное ущелье, ведущее к городу.',
    'v11.services.s2.alt': 'Зал прилёта терминала 1 аэропорта Инчхон: пассажиры с багажом и табло рейсов.',
    'v11.services.s3.alt': 'Круглосуточная лавка рамёна в Хондэ, полки от стены до стены.',
  },
  en: {
    'v11.hero.explore': 'Explore universities',
    'v11.unis.all': 'See all universities',
    'v11.unis.rowLabel': 'Korean university logos, row {{n}}',
    'v11.unis.disclaimer': 'Each logo is a trademark of its university. It does not indicate a partnership with Hangyul.',
    'v11.cta.title': 'Start studying in Korea now.',
    'v11.cta.text': 'Create an account and we will show you the programmes you can apply to and the documents you need, matched to your own situation.',
    'v11.credits.sourcesTitle': 'Where our figures come from',
    'v11.services.s1.alt': 'The Ewha Campus Complex: a sunken glass valley leading towards the city.',
    'v11.services.s2.alt': 'Incheon Airport Terminal 1 arrivals hall, with travellers, luggage and a flight board.',
    'v11.services.s3.alt': 'A 24-hour ramyeon shop in Hongdae, its shelves filled wall to wall.',
  },
};

const set = (obj, path, value) => {
  const parts = path.split('.');
  let o = obj;
  for (const k of parts.slice(0, -1)) o = (o[k] ??= {});
  o[parts.at(-1)] = value;
};

const CANONICAL = manifest.source.locales;   // ['ko', 'ru'] — straight from the owner's template

for (const loc of [...CANONICAL, 'en']) {
  const file = p(`packages/i18n/locales/${loc}/marketing.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  for (const s of manifest.strings) {
    const value = CANONICAL.includes(loc) ? s.expected[loc] : EN[s.hangyulKey];
    if (value === undefined) throw new Error(`no ${loc} string for ${s.hangyulKey}`);
    set(json, s.hangyulKey, value);
  }
  const own = OWN[loc] ?? OWN.en;   // Hangyul's own strings; ru falls back to English until translated
  for (const [k, v] of Object.entries(own)) set(json, k, v);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`${loc}/marketing.json — ${manifest.strings.length} canonical + ${Object.keys(own).length} Hangyul strings${OWN[loc] ? '' : ' (Hangyul strings in English)'}`);
}
