import type { ApplicationStrategy, StrategyItem } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { itemCode, itemTitle, LANE_CODES, splitForWorkspace, strategyLine } from './success';

const t = (key: string, opts?: Record<string, unknown>) => (opts && 'defaultValue' in opts && opts.defaultValue === '' ? '' : key);

function it_(p: Partial<StrategyItem>): StrategyItem {
  return { code: 'DOC_FIX', severity: 'blocker', owner: 'student', title: 'Transcript needs a correction', why: null, params: {}, action: null, sample: false, ...p };
}
function s(items: StrategyItem[], scope: ApplicationStrategy['scope'] = 'prep'): Pick<ApplicationStrategy, 'scope' | 'state' | 'counts' | 'items'> {
  const blocker = items.filter((i) => i.severity === 'blocker').length;
  const improve = items.filter((i) => i.severity === 'improve').length;
  return { scope, items, counts: { blocker, improve, info: items.length - blocker - improve }, state: blocker ? 'BLOCKED' : improve ? 'IMPROVABLE' : 'READY' };
}

describe('strategy line (Applications list)', () => {
  it('says Blocked by the first blocker', () => {
    const l = strategyLine(s([it_({}), it_({ code: 'BUDGET_OVER', severity: 'improve' })]));
    expect(l?.kind).toBe('blocked');
    expect(l?.first?.code).toBe('DOC_FIX');
    expect(l?.count).toBe(2);
  });
  it('counts improvements, never info', () => {
    const l = strategyLine(s([it_({ code: 'BUDGET_OVER', severity: 'improve' }), it_({ code: 'UNIVERSITY_NOTE', severity: 'info' })]));
    expect(l).toEqual({ kind: 'improve', count: 1, first: expect.objectContaining({ code: 'BUDGET_OVER' }) });
  });
  it('is Ready with nothing counted, silent after a decision or when review has nothing', () => {
    expect(strategyLine(s([it_({ code: 'UNIVERSITY_NOTE', severity: 'info' })]))?.kind).toBe('ready');
    expect(strategyLine(s([], 'closed'))).toBeNull();
    expect(strategyLine(s([], 'review'))).toBeNull();
  });
});

describe('workspace block does not repeat the lanes', () => {
  it('splits checklist items from strategic ones', () => {
    const r = splitForWorkspace(s([it_({}), it_({ code: 'ESSAY_WRITE' }), it_({ code: 'LANGUAGE_RECOMMENDED', severity: 'improve', sample: true }), it_({ code: 'INTERVIEW_REQUIRED', severity: 'info' })]));
    expect(r.inLanes).toBe(2);
    expect(r.extra.map((i) => i.code)).toEqual(['LANGUAGE_RECOMMENDED']);
    expect(r.info.map((i) => i.code)).toEqual(['INTERVIEW_REQUIRED']);
    expect([...LANE_CODES].every((c) => c === c.toUpperCase())).toBe(true);
  });
});

describe('item text', () => {
  it('uses the apostille wording when the path is an apostille', () => {
    expect(itemCode({ code: 'DOC_LEGALIZE', params: { path: 'APOSTILLE' } })).toBe('DOC_LEGALIZE_APOSTILLE');
    expect(itemCode({ code: 'DOC_LEGALIZE', params: { path: 'CONSULAR_LEGALIZATION' } })).toBe('DOC_LEGALIZE');
  });
  it('falls back to the API English title when no translation exists', () => {
    expect(itemTitle(t, 'en', it_({ code: 'UNKNOWN_CODE', title: 'Fallback' }))).toBe('Fallback');
  });
});
