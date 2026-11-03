import { applicationWaitingOn, normalizeWaiting, waitingMatches } from '@hangyul/utils';
import { describe, expect, it } from 'vitest';

describe('V9 waiting-on vocabulary (@hangyul/utils)', () => {
  it('keeps the status-only answers of V4–V8', () => {
    expect(applicationWaitingOn('READY')).toBe('agency');
    expect(applicationWaitingOn('OFFERED')).toBe('student');
    expect(applicationWaitingOn('UNIVERSITY_REVIEW')).toBe('university');
    expect(applicationWaitingOn('VISA_SUBMITTED')).toBe('external');
    expect(applicationWaitingOn('ENROLLED')).toBe('none');
  });
  it('names who exactly holds staff work when the context is known', () => {
    expect(applicationWaitingOn('PROFILE_REVIEW', { counselorAssigned: true })).toBe('counselor');
    expect(applicationWaitingOn('PROFILE_REVIEW', { counselorAssigned: false })).toBe('agency');
    expect(applicationWaitingOn('READY', { hasAgency: false })).toBe('hangyul');
  });
  it('follows the submission: handed off → student, reported without evidence → external', () => {
    expect(applicationWaitingOn('READY', { counselorAssigned: true, handedOff: true })).toBe('student');
    expect(applicationWaitingOn('READY', { unconfirmed: true })).toBe('external');
    expect(applicationWaitingOn('SUBMITTED', { unconfirmed: true })).toBe('external');
  });
  it('accepts the legacy "us" alias', () => {
    expect(normalizeWaiting('us')).toBe('agency');
    expect(normalizeWaiting('nobody')).toBeNull();
    expect(waitingMatches('us', 'counselor')).toBe(true);
    expect(waitingMatches('us', 'student')).toBe(false);
    expect(waitingMatches('student', 'student')).toBe(true);
  });
});
