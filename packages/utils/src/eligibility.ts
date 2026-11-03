import type { Match } from '@hangyul/types';

/**
 * V8 eligibility groups — one rule for every product (docs/STATE_MAP.md "Eligibility vocabulary").
 * Missing information is never ineligibility: a result whose only open questions are the student's own unknown
 * grades/education is `check` ("needs your grades"), whatever its engine tier.
 */
export type EligibilityGroup = 'eligible' | 'reach' | 'check' | 'notyet';
export const ELIGIBILITY_GROUPS: EligibilityGroup[] = ['eligible', 'reach', 'check', 'notyet'];
const UNKNOWN = new Set(['EDUCATION_UNKNOWN', 'GPA_UNKNOWN']);

export function eligibilityGroup(m: Pick<Match, 'tier' | 'reasons'>): EligibilityGroup {
  const open = m.reasons.filter((r) => r.kind === 'missing' || r.kind === 'warning');
  if (open.some((r) => UNKNOWN.has(r.code)) && !open.some((r) => r.kind === 'missing')) return 'check';
  if (m.tier === 'STRONG') return 'eligible';
  if (m.tier === 'COMPETITIVE') return 'reach';
  return 'notyet'; // a named, published gap (one-step-away REACH included)
}

/** A program at another degree level than the student is looking for: a preference, not a verdict. */
export const isOtherDegree = (m: Pick<Match, 'reasons'>): boolean => m.reasons.some((r) => r.code === 'DEGREE_MISMATCH');
