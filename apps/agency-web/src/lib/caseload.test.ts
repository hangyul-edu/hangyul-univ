import { describe, expect, it } from 'vitest';

import { countByStep, inLane, laneCounts, matchesFilters, stageTones } from './caseload';
import { CLOSED_KEY, STAGE_GROUPS, stagesFor, type StripKey } from './stages';

type R = Parameters<typeof matchesFilters>[0];
const row = (id: string, pipeline_stage: R['pipeline_stage'], waiting_on: R['waiting_on'], extra: Partial<R> = {}): R =>
  ({ id, pipeline_stage, waiting_on, nationality: 'VN', target_intake: '2027-SPRING', target_degree: 'BACHELOR', ...extra });

const rows: R[] = [
  row('a', 'DOCUMENT_PREPARATION', 'agency'), row('b', 'DOCUMENT_PREPARATION', 'counselor'),
  row('c', 'APPLIED', 'university'), row('d', 'APPLIED', 'student', { nationality: 'TH' }),
  row('e', 'INTERVIEW', 'student'), row('f', 'WAITLISTED', 'university'), row('g', 'REJECTED', null),
];
const tiers = new Map([['a', 1], ['c', 2], ['d', 1]]);
const keys: StripKey[] = [...STAGE_GROUPS.map((g) => g.key), CLOSED_KEY];

describe('caseload counts open exactly the rows they count', () => {
  it('a stage count equals the rows left after the stage filter', () => {
    const counts = countByStep(rows, keys);
    for (const k of keys) expect(rows.filter((r) => matchesFilters(r, { stages: stagesFor(k) })).length).toBe(counts[k]);
    expect(counts.documents).toBe(2); expect(counts.review).toBe(2); expect(counts.closed).toBe(1);
    expect(keys.reduce((a, k) => a + counts[k], 0)).toBe(rows.length);
  });
  it('a lane count equals the rows left after the lane filter, inside any stage', () => {
    for (const k of [null, ...keys]) {
      const staged = rows.filter((r) => matchesFilters(r, { stages: stagesFor(k) }));
      const n = laneCounts(staged, tiers);
      for (const lane of ['act', 'ours', 'student', 'university'] as const) expect(staged.filter((r) => inLane(r, lane, tiers)).length).toBe(n[lane]);
    }
    expect(laneCounts(rows, tiers)).toEqual({ act: 2, ours: 2, student: 2, university: 2 });
  });
  it('drops rows that contradict a field filter (nationality, waiting party, waiting views)', () => {
    expect(rows.filter((r) => matchesFilters(r, { nationality: 'TH' })).map((r) => r.id)).toEqual(['d']);
    expect(rows.filter((r) => matchesFilters(r, { waiting: 'us' })).map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows.filter((r) => matchesFilters(r, { view: 'waiting_student' })).map((r) => r.id)).toEqual(['d', 'e']);
    // a server-only view (urgent) is not second-guessed on the client
    expect(rows.filter((r) => matchesFilters(r, { view: 'urgent' })).length).toBe(rows.length);
  });
  it('marks a stage urgent when it holds a tier-1 student, waiting only when the whole stage waits outside the team', () => {
    expect(stageTones(rows, tiers, true)).toMatchObject({ documents: 'urgent', submitted: 'urgent', review: 'waiting', closed: 'normal' });
    // with a partial page "waiting" cannot be claimed
    expect(stageTones(rows, tiers, false).review).toBe('normal');
  });
});
