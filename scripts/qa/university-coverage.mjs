#!/usr/bin/env node
/**
 * Field coverage of the public university export (apps/marketing-web/public/data/public).
 *
 * Counts, across every institution in the index, how many records carry each fact the public detail page can
 * show. Exact counts, no rounding: a field the export does not carry at all is reported as 0 with "not in export".
 *
 *   node scripts/qa/university-coverage.mjs            # markdown table
 *   node scripts/qa/university-coverage.mjs --json     # JSON
 *   node scripts/qa/university-coverage.mjs --slugs    # also list example slugs per profile (rich / mid / sparse)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'marketing-web', 'public', 'data', 'public');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const index = read('institutions.json').items;
const SERVABLE = new Set(['CC0_PUBLIC_DOMAIN', 'HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION']);

const rows = index.map((card) => {
  const inst = read(`institutions/${card.slug}.json`);
  let adm = null;
  try { adm = read(`admissions/${card.slug}.json`); } catch { /* reported as missing */ }
  const e = inst.enrichment ?? {};
  const intl = e.intl ?? null;
  const links = intl?.links ?? {};
  const rules = adm?.language_rules ?? {};
  const levels = Object.keys(rules).filter((k) => rules[k]?.length);
  const sch = adm?.scholarships ?? [];
  const yt = e.youtube ?? null;
  const dorm = intl?.dormitory ?? null;
  return {
    slug: card.slug,
    f: {
      admissionsFile: !!adm,
      campusPhoto: !!e.media?.hero,
      campusGallery: (e.media?.gallery ?? []).length > 0,
      logo: !!e.logo?.url && SERVABLE.has(e.logo.rights_status),
      logoAny: !!e.logo?.url,
      website: !!inst.website_url,
      intlOffice: !!(links.international_office?.url ?? e.international_office_url),
      intlOfficeVerified: !!links.international_office?.url,
      admissionsPage: !!(links.international_admissions?.url ?? e.international_admissions_url),
      admissionsPageVerified: !!links.international_admissions?.url,
      guide: (intl?.sources ?? []).some((s) => s.kind === 'OFFICIAL_GUIDE'),
      intlResearch: !!intl,
      languageRule: levels.length > 0,
      ruleBachelor: levels.includes('BACHELOR'),
      ruleTransfer: levels.includes('TRANSFER'),
      ruleMaster: levels.includes('MASTER'),
      ruleDoctorate: levels.includes('DOCTORATE'),
      ruleCombined: levels.includes('COMBINED'),
      ruleLanguageCourse: levels.includes('LANGUAGE'),
      ruleAssociate: levels.includes('ASSOCIATE'),
      degreeLevelsField: Array.isArray(inst.degree_levels) && inst.degree_levels.length > 0,
      englishTaught: intl?.english_taught_degrees?.value === true,
      tuition: inst.tuition != null || e.tuition != null || intl?.tuition != null,
      applicationFee: inst.application_fee != null || e.application_fee != null || intl?.application_fee != null,
      intakes: inst.intakes != null || e.intakes != null || intl?.intakes != null,
      requiredDocuments: inst.required_documents != null || e.required_documents != null || intl?.required_documents != null,
      legalization: inst.legalization != null || e.legalization != null || intl?.legalization != null,
      scholarships: sch.length > 0,
      scholarshipLink: !!links.scholarship?.url,
      gksNiied: (e.gks?.programmes ?? []).length > 0,
      gksOwnPage: intl?.gks_participating?.value === true,
      ieqas: inst.ieqas?.certified === true,
      ieqasExcellent: inst.ieqas?.excellent === true,
      ieqasLanguage: inst.ieqas?.language_programme === true,
      dormFact: dorm?.available != null,
      dormAvailable: dorm?.available === true,
      dormNotAvailable: dorm?.available === false,
      dormCost: dorm?.cost_semester_krw_min != null || dorm?.cost_semester_krw_max != null,
      dormLink: !!(links.dormitory?.url ?? e.dormitory_url),
      kliFact: intl?.korean_language_program?.value === true,
      kliLink: !!links.korean_language_institute?.url,
      support: (intl?.support_services ?? []).length > 0,
      videoChannel: !!yt?.channel_url,
      video: !!yt?.video_id,
      videoIntl: !!yt?.video_id && !!yt.purpose && yt.purpose !== 'GENERAL_PROMO',
      videoCampusPoster: yt?.poster_review === 'CAMPUS_SCENE',
      address: !!(inst.address ?? e.address),
      city: !!e.city_ko,
      coordinates: (inst.latitude != null && inst.longitude != null) || (e.lat != null && e.lon != null),
      foundedYear: !!e.founded_year,
      philosophy: e.education_philosophy?.verification_status === 'HANGYUL_REVIEWED' || !!(e.motto?.ko || e.motto?.en),
      otherCampuses: (inst.other_campuses ?? []).length > 0,
      majorCount: !!inst.major_count,
      lastVerified: !!inst.last_verified,
    },
    n: { scholarships: sch.length },
  };
});

const LABELS = [
  ['campusPhoto', 'Own-campus photograph (hero)'],
  ['campusGallery', 'Additional own-campus photographs (gallery)'],
  ['logo', 'Official logo, servable without credit'],
  ['logoAny', 'Official logo, any rights status'],
  ['website', 'Official website'],
  ['intlOffice', 'International office link (verified research or site crawl)'],
  ['intlOfficeVerified', '— of which from verified research (intl.links)'],
  ['admissionsPage', 'International admissions page (verified research or site crawl)'],
  ['admissionsPageVerified', '— of which from verified research (intl.links)'],
  ['intlResearch', 'International-student research record (intl)'],
  ['guide', 'Verified official admissions guide (OFFICIAL_GUIDE source)'],
  ['languageRule', 'Verified language rule, any level'],
  ['ruleBachelor', '— bachelor'],
  ['ruleTransfer', '— transfer'],
  ['ruleMaster', '— master'],
  ['ruleDoctorate', '— doctorate'],
  ['ruleCombined', '— combined master/doctorate'],
  ['ruleAssociate', '— associate'],
  ['ruleLanguageCourse', '— Korean-language course'],
  ['degreeLevelsField', 'Degree levels offered (dedicated field)'],
  ['englishTaught', 'English-taught degrees confirmed'],
  ['tuition', 'Tuition'],
  ['applicationFee', 'Application fee'],
  ['intakes', 'Intakes / application period'],
  ['requiredDocuments', 'Required documents'],
  ['legalization', 'Legalization / apostille rule'],
  ['scholarships', 'Structured scholarships (>= 1 record)'],
  ['scholarshipLink', 'Official scholarship page link'],
  ['gksNiied', 'GKS — listed in NIIED guidelines'],
  ['gksOwnPage', 'GKS — confirmed on the university\'s own page'],
  ['ieqas', 'IEQAS certified'],
  ['ieqasExcellent', '— of which excellent'],
  ['ieqasLanguage', 'IEQAS-certified Korean-language programme'],
  ['dormFact', 'Dormitory availability verified (yes or no)'],
  ['dormAvailable', '— available'],
  ['dormNotAvailable', '— positively not available'],
  ['dormCost', 'Dormitory cost per semester'],
  ['dormLink', 'Dormitory page link'],
  ['kliFact', 'Korean-language programme confirmed (own page)'],
  ['kliLink', 'Korean-language institute link'],
  ['support', 'International-student support services (>= 1)'],
  ['videoChannel', 'Verified official YouTube channel'],
  ['video', 'Verified official video'],
  ['videoIntl', '— of which made for international students / in English / campus tour'],
  ['videoCampusPoster', '— poster reviewed as a campus scene'],
  ['address', 'Street address'],
  ['city', 'City (Korean)'],
  ['coordinates', 'Coordinates'],
  ['foundedYear', 'Founding year'],
  ['philosophy', 'Reviewed philosophy or motto'],
  ['otherCampuses', 'Other campuses'],
  ['majorCount', 'Major count (registry)'],
  ['lastVerified', 'Verification date (registry record)'],
  ['admissionsFile', 'Admissions record file present'],
];
const NOT_IN_EXPORT = new Set(['degreeLevelsField', 'tuition', 'applicationFee', 'intakes', 'requiredDocuments', 'legalization', 'address']);

const total = rows.length;
const counts = Object.fromEntries(LABELS.map(([k]) => [k, rows.filter((r) => r.f[k]).length]));
const scholarshipRecords = rows.reduce((a, r) => a + r.n.scholarships, 0);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, counts, scholarshipRecords }, null, 2));
} else {
  console.log(`| Field | Records | of ${total} |`);
  console.log('|---|---:|---:|');
  for (const [k, label] of LABELS) {
    const n = counts[k];
    const note = n === 0 && NOT_IN_EXPORT.has(k) ? ' (not in export)' : '';
    console.log(`| ${label}${note} | ${n} | ${((n / total) * 100).toFixed(1)}% |`);
  }
  console.log(`\nScholarship records in total: ${scholarshipRecords}`);
}

if (process.argv.includes('--slugs')) {
  const score = (r) => Object.values(r.f).filter(Boolean).length;
  const by = [...rows].sort((a, b) => score(b) - score(a));
  const pick = (list) => list.slice(0, 6).map((r) => `${r.slug} (${score(r)})`).join(', ');
  console.log('\nrich:  ', pick(by.filter((r) => r.f.guide && r.f.scholarships)));
  console.log('mid:   ', pick(by.filter((r) => !r.f.intlResearch && r.f.campusPhoto && r.f.ieqas)));
  console.log('sparse:', pick(by.filter((r) => !r.f.campusPhoto && !r.f.logoAny && !r.f.video).reverse()));
}
