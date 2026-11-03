/**
 * V11 — the few new console strings the simplification needs (REPORT §§77–78).
 *
 * These are Hangyul's own words, not Koreanasha's: the marketing manifest governs the public homepage only.
 * English and Korean are written together, as the project requires; other locales fall back to English until a
 * translation pass covers them, and nothing here is marked as human-reviewed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const set = (obj, path, value) => {
  const parts = path.split('.');
  let o = obj;
  for (const k of parts.slice(0, -1)) o = (o[k] ??= {});
  o[parts.at(-1)] = value;
};

const COPY = {
  agency: {
    en: {
      'v11.review.title': 'Review',
      'v11.review.sub': 'Documents and writing waiting for you.',
      'v11.manage.title': 'Manage',
      'v11.manage.sub': 'Settings and reference material for your agency.',
      'v11.manage.people': 'People and providers',
      'v11.manage.work': 'How you work',
      'v11.manage.org': 'Organisation',
      'v11.manage.teamHint': 'Counsellors, roles, workload and leave',
      'v11.manage.vendorsHint': 'Housing, pickup and other providers you book',
      'v11.manage.servicesHint': 'Service cases you are delivering for students',
      'v11.manage.templatesHint': 'Message and checklist templates',
      'v11.manage.catalogHint': 'Universities, programmes and their requirements',
      'v11.manage.settingsHint': 'Your agency profile and preferences',
      'v11.manage.paymentsHint': 'Invoices and payouts',
      'v11.manage.auditHint': 'Who changed what, and when',
    },
    ko: {
      'v11.review.title': '검토',
      'v11.review.sub': '검토를 기다리는 서류와 작성 문서입니다.',
      'v11.manage.title': '관리',
      'v11.manage.sub': '유학원 설정과 참고 자료입니다.',
      'v11.manage.people': '담당자와 협력사',
      'v11.manage.work': '업무 방식',
      'v11.manage.org': '조직',
      'v11.manage.teamHint': '상담사, 역할, 업무량과 휴가',
      'v11.manage.vendorsHint': '숙소, 픽업 등 예약하는 협력사',
      'v11.manage.servicesHint': '학생에게 제공 중인 서비스 건',
      'v11.manage.templatesHint': '메시지와 체크리스트 템플릿',
      'v11.manage.catalogHint': '대학, 모집 과정과 요구 요건',
      'v11.manage.settingsHint': '유학원 정보와 환경설정',
      'v11.manage.paymentsHint': '청구와 정산',
      'v11.manage.auditHint': '누가 무엇을 언제 바꿨는지',
    },
  },
  university: {
    en: {
      'v11.manage.title': 'Manage',
      'v11.manage.sub': 'Rules, partnerships and settings for your office.',
      'v11.manage.admissions': 'Admissions',
      'v11.manage.partners': 'Partners and funding',
      'v11.manage.office': 'Office',
      'v11.manage.rulesHint': 'Requirements and decision rules per programme',
      'v11.manage.scholarshipsHint': 'Scholarships you publish and award',
      'v11.manage.partnershipHint': 'Agreements with Hangyul and agencies',
      'v11.manage.exportsHint': 'Download applicant and outcome data',
      'v11.manage.settingsHint': 'Your office profile, team and preferences',
      'v11.applicants.tab.all': 'All applicants',
      'v11.applicants.tab.decision': 'Needs decision',
      'v11.applicants.tab.offers': 'Offers and enrolment',
      'v11.analytics.tab.intake': 'This intake',
      'v11.analytics.tab.cohorts': 'Students over time',
      'v11.analytics.tab.agencies': 'Partner agencies',
    },
    ko: {
      'v11.manage.title': '관리',
      'v11.manage.sub': '입학 규정, 협력 관계, 설정입니다.',
      'v11.manage.admissions': '입학',
      'v11.manage.partners': '협력과 장학',
      'v11.manage.office': '부서',
      'v11.manage.rulesHint': '모집 과정별 요구 요건과 심사 규정',
      'v11.manage.scholarshipsHint': '공개하고 지급하는 장학금',
      'v11.manage.partnershipHint': '한귤 및 유학원과의 협약',
      'v11.manage.exportsHint': '지원자와 결과 데이터 내려받기',
      'v11.manage.settingsHint': '부서 정보, 팀, 환경설정',
      'v11.applicants.tab.all': '전체 지원자',
      'v11.applicants.tab.decision': '심사 필요',
      'v11.applicants.tab.offers': '합격과 등록',
      'v11.analytics.tab.intake': '이번 모집',
      'v11.analytics.tab.cohorts': '기간별 학생',
      'v11.analytics.tab.agencies': '협력 유학원',
    },
  },
};

for (const [ns, locales] of Object.entries(COPY)) {
  for (const [loc, strings] of Object.entries(locales)) {
    const file = resolve(root, `packages/i18n/locales/${loc}/${ns}.json`);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(strings)) set(json, k, v);
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`${loc}/${ns}.json — +${Object.keys(strings).length}`);
  }
}
