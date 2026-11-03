import type { Match } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { otherDegree, verdictOf } from './Explore';

const m = (tier: Match['tier'], reasons: [string, string][]): Match =>
  ({ tier, reasons: reasons.map(([kind, code]) => ({ kind, code, text: '', params: {} })) }) as unknown as Match;

describe('V8 discovery verdicts — missing data is never ineligibility', () => {
  it('unknown grades with no real gap → "needs your grades to check", even when the tier is STRONG', () => {
    expect(verdictOf(m('STRONG', [['met', 'TOPIK_MET'], ['warning', 'GPA_UNKNOWN']]))).toBe('check');
    expect(verdictOf(m('REACH', [['warning', 'EDUCATION_UNKNOWN'], ['warning', 'DEADLINE_SOON']]))).toBe('check');
  });
  it('a published gap stays "not eligible yet" even when grades are also unknown', () => {
    expect(verdictOf(m('NOT_ELIGIBLE', [['missing', 'LANGUAGE_BELOW'], ['warning', 'GPA_UNKNOWN']]))).toBe('notyet');
    expect(verdictOf(m('REACH', [['missing', 'LANGUAGE_GAP_SMALL']]))).toBe('notyet');
  });
  it('known data keeps the V4 groups', () => {
    expect(verdictOf(m('STRONG', [['met', 'GPA_MET']]))).toBe('eligible');
    expect(verdictOf(m('COMPETITIVE', [['warning', 'OVER_BUDGET']]))).toBe('reach');
  });
  it('programs at another degree level leave "For you"', () => {
    expect(otherDegree(m('NOT_ELIGIBLE', [['missing', 'DEGREE_MISMATCH']]))).toBe(true);
    expect(otherDegree(m('STRONG', []))).toBe(false);
  });
});
