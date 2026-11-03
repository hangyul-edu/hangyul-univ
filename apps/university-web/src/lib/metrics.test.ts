import type { CohortStudent } from '@hangyul/types';

import { cohortSummaries, funnelSteps, incentiveProgress, rateOf, riskWorklist, stageLink, summarizeCohort, termTrend, visaExpiring } from './metrics';

let n = 0;
function student(p: Partial<CohortStudent> & { termCount?: number }): CohortStudent {
  const { termCount = 2, ...rest } = p;
  n += 1;
  return {
    id: `s${n}`, student: `Student ${n}`, nationality: 'VN', cohort: '2024-SPRING', program: 'BBA', agency: null, status: 'ENROLLED',
    enrolled_on: '2024-03-02', expected_graduation: '2028-02-20', visa_expires_on: '2028-02-20',
    terms: Array.from({ length: termCount }, (_, i) => ({ term: `${2024 + Math.floor(i / 2)}-${i % 2 ? 'FALL' : 'SPRING'}`, registered: true, gpa_percent: 80, attendance_percent: 90, academic_standing: 'GOOD', data_source: 'UNIVERSITY_FEED' })),
    risk: null, is_demo: true, ...rest,
  };
}
const TODAY = new Date('2026-09-27T00:00:00');

describe('rateOf', () => {
  it('withholds rates below the minimum sample', () => {
    expect(rateOf(3, 4)).toEqual({ value: null, numerator: 3, denominator: 4, insufficient_data: true });
    expect(rateOf(4, 5)).toEqual({ value: 0.8, numerator: 4, denominator: 5, insufficient_data: false });
  });
});

describe('cohort retention & graduation', () => {
  it('counts retention only among students who reached a second term', () => {
    const list = [
      ...Array.from({ length: 4 }, () => student({ status: 'ENROLLED' })),
      student({ status: 'ON_LEAVE' }),
      student({ status: 'WITHDRAWN' }),
      student({ status: 'WITHDRAWN', termCount: 1 }), // left before a second term: not in the denominator
      student({ status: 'ENROLLED', termCount: 1 }),
    ];
    const s = summarizeCohort('2024-SPRING', list, TODAY);
    expect(s.total).toBe(8);
    expect(s.retention.denominator).toBe(6);
    expect(s.retention.numerator).toBe(5);
    expect(s.retention.value).toBeCloseTo(0.8333, 3);
    expect(s.withdrawn).toBe(2);
    expect(s.onLeave).toBe(1);
  });

  it('is honest when a cohort is small', () => {
    const s = summarizeCohort('2026-SPRING', [student({}), student({})], TODAY);
    expect(s.retention.insufficient_data).toBe(true);
    expect(s.retention.value).toBeNull();
    expect(s.graduation.denominator).toBe(0);
    expect(s.graduation.insufficient_data).toBe(true);
  });

  it('measures graduation only once the expected graduation date has passed', () => {
    const past = { expected_graduation: '2025-02-20', termCount: 4 };
    const list = [
      ...Array.from({ length: 4 }, () => student({ ...past, status: 'GRADUATED', cohort: '2021-SPRING' })),
      student({ ...past, status: 'WITHDRAWN', cohort: '2021-SPRING' }),
      student({ status: 'ENROLLED', cohort: '2021-SPRING', expected_graduation: '2027-02-20' }), // not due yet
    ];
    const [s] = cohortSummaries(list, TODAY);
    expect(s.graduation).toEqual({ value: 0.8, numerator: 4, denominator: 5, insufficient_data: false });
    // graduated students count as retained even without a second-term record
    expect(s.retention.denominator).toBe(6);
  });

  it('groups and sorts cohorts', () => {
    const out = cohortSummaries([student({ cohort: '2025-FALL' }), student({ cohort: '2023-SPRING' }), student({ cohort: '2025-FALL' })], TODAY);
    expect(out.map((c) => [c.cohort, c.total])).toEqual([['2023-SPRING', 1], ['2025-FALL', 2]]);
  });
});

describe('lifecycle funnel', () => {
  it('computes stage conversion and refuses to print >100% conversions', () => {
    const steps = funnelSteps([
      { stage: 'INTERESTED', count: 13 }, { stage: 'PREPARING', count: 2 }, { stage: 'APPLIED', count: 9 }, { stage: 'ADMITTED', count: 5 },
      { stage: 'TUITION_PAID', count: 4 }, { stage: 'ENROLLED', count: 43 }, { stage: 'RETAINED', count: 36 }, { stage: 'GRADUATED', count: 0 },
    ]);
    const by = Object.fromEntries(steps.map((s) => [s.stage, s]));
    expect(by.INTERESTED.conversion).toBeNull();
    expect(by.PREPARING.conversionNote).toBe('aggregate');
    expect(by.APPLIED.conversionNote).toBe('aggregate');
    expect(by.ADMITTED.conversion).toBeCloseTo(5 / 9);
    expect(by.TUITION_PAID.conversion).toBeCloseTo(0.8);
    expect(by.ENROLLED.conversion).toBeNull();
    expect(by.ENROLLED.conversionNote).toBe('mixedPopulation');
    expect(by.RETAINED.conversion).toBeCloseTo(36 / 43);
    expect(by.GRADUATED.conversion).toBe(0);
  });

  it('maps stages to drill-down targets and keeps PREPARING private', () => {
    expect(stageLink('PREPARING')).toBeNull();
    expect(stageLink('INTERESTED')).toBeNull();
    expect(stageLink('VISA_ISSUED')).toEqual({ kind: 'applicants', status: ['VISA_ISSUED', 'ENROLLED'] });
    expect(stageLink('GRADUATED')).toEqual({ kind: 'cohorts', tab: 'graduation' });
  });
});

describe('student lifecycle worklists', () => {
  it('lists enrolled students whose visa expires within 60 days, soonest first, including lapsed visas', () => {
    const list = [
      student({ student: 'Later', visa_expires_on: '2026-11-20' }),
      student({ student: 'Soon', visa_expires_on: '2026-10-05' }),
      student({ student: 'Lapsed', visa_expires_on: '2026-09-01' }),
      student({ student: 'Far', visa_expires_on: '2027-09-01' }),
      student({ student: 'Graduated', status: 'GRADUATED', visa_expires_on: '2026-10-01' }),
    ];
    expect(visaExpiring(list, 60, TODAY).map((s) => s.student)).toEqual(['Lapsed', 'Soon', 'Later']);
  });

  it('orders the risk worklist by number of flags', () => {
    const list = [student({ student: 'A', risk: { flags: ['LOW_ATTENDANCE'] } }), student({ student: 'B', risk: { flags: ['LOW_ATTENDANCE', 'NOT_REGISTERED'] } }), student({ student: 'C' })];
    expect(riskWorklist(list).map((s) => s.student)).toEqual(['B', 'A']);
  });

  it('averages term GPA chronologically and withholds thin terms', () => {
    const list = Array.from({ length: 5 }, () => student({ termCount: 3 }));
    list.push(student({ termCount: 4 }));
    const trend = termTrend(list);
    expect(trend.map((t) => t.term)).toEqual(['2024-SPRING', '2024-FALL', '2025-SPRING', '2025-FALL']);
    expect(trend[0].gpa).toBe(80);
    expect(trend[3].gpa).toBeNull(); // only one record
    expect(trend[0].feed).toBe(6);
  });
});

describe('incentive progress', () => {
  it('finds the next tier', () => {
    const p = incentiveProgress([{ min_enrolled: 40, bonus_krw: 12 }, { min_enrolled: 20, bonus_krw: 5 }], 23);
    expect(p.reached.map((t) => t.min_enrolled)).toEqual([20]);
    expect(p.next?.min_enrolled).toBe(40);
    expect(p.toNext).toBe(17);
    expect(p.max).toBe(40);
  });
});
