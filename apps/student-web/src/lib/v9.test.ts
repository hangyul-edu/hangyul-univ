import { describe, expect, it } from 'vitest';

import { fundsAmountFor, groupByWhen, type MoneyLine, type ParsedFunds } from './money';
import { leadRoute, routeLinks, type LanguageRoutes } from './routes';
import { daysLeft, sponsorUrl } from './sponsor';

const line = (key: string, when: MoneyLine['when']): MoneyLine => ({
  key, amount_min: 1, amount_max: 1, currency: 'KRW', period: 'ONCE', payee: 'UNIVERSITY', when, refundable: 'NO', basis: 'OFFICIAL',
  source_url: null, source_label: null, verified_at: null, note_code: null, published_en: null, guard: false, payer: 'STUDENT_FAMILY',
});

describe('V9 money plan', () => {
  it('groups lines by moment in journey order and drops empty moments', () => {
    const g = groupByWhen([line('insurance', 'MONTHLY'), line('application_fee', 'APPLICATION'), line('visa_fee', 'BEFORE_VISA')]);
    expect(g.map((x) => x.when)).toEqual(['APPLICATION', 'BEFORE_VISA', 'MONTHLY']);
  });
  it('picks the funds amount for the university region, never guesses when the region is unknown', () => {
    const f = { amounts: [{ currency: 'KRW', amount: 20_000_000, area: 'CAPITAL' }, { currency: 'KRW', amount: 16_000_000, area: 'OTHER' }] } as ParsedFunds;
    expect(fundsAmountFor(f, 'OTHER')?.amount).toBe(16_000_000);
    expect(fundsAmountFor(f, 'CAPITAL')?.amount).toBe(20_000_000);
    expect(fundsAmountFor(f, null)).toBeNull();
    expect(fundsAmountFor({ amounts: [{ currency: 'USD', amount: 20_000, area: 'ANY' }] } as ParsedFunds, null)?.amount).toBe(20_000);
  });
});

describe('V9 routes', () => {
  const base = { blocked_count: 31, open_now: 0, degree: 'BACHELOR', not_an_offer: true, engine_version: 'x', smallest_step: null, steps: [], english: null } as const;
  it('leads with the Korean language program when one accepts the student now', () => {
    expect(leadRoute({ ...base, korean_first: { count: 10 } } as unknown as LanguageRoutes)).toBe('korean');
    expect(leadRoute({ ...base, korean_first: null, english: { count: 5 } } as unknown as LanguageRoutes)).toBe('english');
    expect(leadRoute({ ...base, korean_first: null } as unknown as LanguageRoutes)).toBe('step');
  });
  it('links each route to exactly the programs it counts', () => {
    expect(routeLinks('BACHELOR')).toEqual({ korean: '/explore?tab=all&degree=LANGUAGE&open_only=1', english: '/explore?tab=all&degree=BACHELOR&language=ENGLISH&open_only=1' });
  });
});

describe('V9 sponsor link', () => {
  it('counts days left and builds the public URL', () => {
    const now = Date.UTC(2026, 9, 10);
    expect(daysLeft(new Date(now + 30 * 86_400_000).toISOString(), now)).toBe(30);
    expect(daysLeft(new Date(now - 86_400_000).toISOString(), now)).toBeLessThan(0);
    expect(sponsorUrl('/sponsor/abc', 'https://app.example')).toBe('https://app.example/sponsor/abc');
  });
});
