/**
 * **The approved plan content, pinned** (V21 b, REPORT §243.1).
 *
 * The homepage is where this content was approved, and until V21 b it was also the only surface that read
 * it: the student plan screen built its own shorter list out of entitlement numbers, so a buyer was shown
 * less on the screen where they pay than on the one that sold it to them.
 *
 * The fix is structural — `PLAN_PRESENTATION` in `@hangyul/types` is the one definition both surfaces
 * render — and this file pins the *content* at both ends of it:
 *
 *   · exactly three plans, at $179 / $349 / $599, with All-in-One the recommended one;
 *   · exactly five benefit lines per plan, in the owner's order;
 *   · the Korean and English text of every description and every line, written out here so the assertion
 *     does not read the strings from the file it is checking.
 *
 * V32 (REPORT §436): the ENGLISH lines were re-rendered from the Korean meaning in the V32 copy pass (the owner's
 * request that foreign-language copy be concrete and natural); the Korean pins are the owner's approved source and did
 * not change. Both halves were updated here deliberately, as this file demands.
 *
 * A strings table in a test is usually a smell. Here it is the point: this is the owner's approved copy
 * (한귤 UNIV_20261019 §3), and a change to it should have to be made twice — once in the locale file and
 * once here, deliberately.
 */
import { i18next, loadNamespaces } from '@hangyul/i18n';
import { PLANS, PLAN_PRESENTATION, planPresentationByCode, planText } from '@hangyul/types';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The approved content, by plan code — the owner's V29 service contract (REPORT §380). Written out here, not read
 * from the locale file it checks, so a change to a promise has to be made twice, deliberately.
 */
const APPROVED = {
  BASIC: {
    amount_minor: 17_900,
    ko: {
      description: "유학 방향을 정하고, 나에게 맞는 대학부터 고르고 싶은 학생",
      benefits: [
        "맞춤 유학 진단 상담 + 후속 상담 1회",
        "대학·어학당 최대 3곳 추천",
        "입학 조건·학비·주요 일정 비교",
        "기본 입학 서류 체크리스트",
        "국적별 비자 준비 절차 안내",
      ],
    },
    en: {
      description: "For students who want to set a direction and choose the right universities first",
      benefits: [
        "Personal diagnostic consultation + 1 follow-up consultation",
        "Up to 3 universities or language institutes recommended",
        "Entry requirements, tuition and key dates compared",
        "Essential admission-document checklist",
        "Visa preparation steps for your nationality",
      ],
    },
  },
  ALL_IN_ONE: {
    amount_minor: 34_900,
    ko: {
      description: "대학 지원과 입학 서류 준비까지 함께 받고 싶은 학생",
      benefits: [
        "베이직 전체 포함 · 추천 대학 최대 5곳",
        "대학 지원 최대 2곳 관리",
        "자기소개서·학업계획서 첨삭 최대 2회",
        "입학 서류 검토·보완 가이드",
        "비자 서류 준비 · 기숙사 신청 일정 관리",
      ],
    },
    en: {
      description: "For students who want support through applying and preparing admission documents",
      benefits: [
        "Everything in Basic · up to 5 recommended universities",
        "Up to 2 university applications managed",
        "Up to 2 rounds of statement and study-plan editing",
        "Admission documents reviewed, with notes on what to fix",
        "Help preparing your visa documents · dormitory application dates tracked",
      ],
    },
  },
  PREMIUM: {
    amount_minor: 59_900,
    ko: {
      description: "지원부터 비자, 입국 준비, 한국 초기 정착까지 함께하고 싶은 학생",
      benefits: [
        "올인원 전체 포함 · 추천 대학 최대 7곳",
        "대학 지원 최대 3곳 관리 · 모의 면접 1회",
        "계약한 지원 서류 첨삭 · 횟수 제한 없음",
        "비자 일정 집중 관리 · 기숙사 신청 지원",
        "입국 30일 전부터 정착 30일까지 · 전담 팀 우선 응대",
      ],
    },
    en: {
      description: "For students who want support from applying through visa, arrival and the first weeks in Korea",
      benefits: [
        "Everything in All-in-One · up to 7 recommended universities",
        "Up to 3 applications managed · 1 mock interview",
        "Editing of your contracted application documents, no round limit",
        "Visa documents and key dates closely managed · help with your dormitory application",
        "30 days before arrival to 30 days after · dedicated team, priority replies",
      ],
    },
  },
} as const;

const codes = ['BASIC', 'ALL_IN_ONE', 'PREMIUM'] as const;
const at = (lng: string) => (key: string) => i18next.t(key, { lng }) as string;

beforeAll(async () => {
  // The Korean bundle is not loaded by the test bootstrap (English is), and i18next cannot fall back to a
  // bundle that was never loaded — a missing one looks exactly like a missing translation.
  await loadNamespaces(i18next, 'ko', ['marketing', 'common']);
});

describe('the canonical plan presentation', () => {
  it('is the three plans, at the approved prices, with one recommended', () => {
    expect(PLAN_PRESENTATION.map((p) => p.code)).toEqual([...codes]);
    expect(PLAN_PRESENTATION.map((p) => p.amount_minor)).toEqual(codes.map((c) => APPROVED[c].amount_minor));
    expect(new Set(PLAN_PRESENTATION.map((p) => p.currency))).toEqual(new Set(['USD']));
    expect(PLAN_PRESENTATION.filter((p) => p.recommended).map((p) => p.code)).toEqual(['ALL_IN_ONE']);
  });

  it('carries the price the manifest holds, so nothing downstream can hold its own', () => {
    for (const plan of PLANS) {
      const pres = planPresentationByCode(plan.code);
      expect(pres).not.toBeNull();
      expect(pres!.amount_minor).toBe(plan.amount_minor);
      expect(pres!.recommended).toBe(plan.recommended);
    }
  });

  it('declares exactly five benefit lines per plan', () => {
    for (const p of PLAN_PRESENTATION) expect(p.benefit_keys).toHaveLength(5);
    // Every surface resolves the same keys; there is no second list to drift from.
    expect(PLAN_PRESENTATION.flatMap((p) => p.benefit_keys)).toEqual(
      codes.flatMap((c) => [1, 2, 3, 4, 5].map((n) => `common:v29.pricing.${planPresentationByCode(c)!.slug}.f${n}`)),
    );
  });
});

describe.each(['ko', 'en'] as const)('the approved plan copy (%s)', (lng) => {
  const t = at(lng);
  it.each(codes)('%s reads exactly as approved', (code) => {
    const copy = planText(t, planPresentationByCode(code)!);
    expect(copy.description).toBe(APPROVED[code][lng].description);
    expect(copy.benefits).toEqual([...APPROVED[code][lng].benefits]);
    // A missing translation resolves to the key itself; that must never be what a reader gets.
    expect(copy.name).not.toContain('v29.pricing');
    expect(copy.description).not.toContain('v29.pricing');
  });
});

describe('the V29 contract in words', () => {
  const ko = at('ko');
  it('All-in-One says two editing rounds, Premium says no round limit within the contract — never the V15 numbers', () => {
    const aio = planText(ko, planPresentationByCode('ALL_IN_ONE')!).benefits.join(' ');
    const pre = planText(ko, planPresentationByCode('PREMIUM')!).benefits.join(' ');
    expect(aio).toContain('최대 2회');
    expect(aio).not.toContain('1회 첨삭');
    expect(pre).toContain('계약한 지원 서류');
    expect(pre).not.toContain('최대 2회');
    for (const c of codes) expect(planText(ko, planPresentationByCode(c)!).benefits.join(' ')).not.toMatch(/\d+분/);
  });
});
