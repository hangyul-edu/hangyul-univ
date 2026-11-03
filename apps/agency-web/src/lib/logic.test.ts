import { describe, expect, it } from 'vitest';

import {
  appendReason, bucketTasks, commentRange, findCardStage, highlightSegments, moveCard, parseIntake, resolveMentions, slaState, sumByCurrency,
  taskBucket, validateReview, weekKey, appWaitingOn, languageName, lowerKeepAcronyms, taskTitle, taskWaitingOn,
} from './logic';

type Card = { id: string; full_name: string; pipeline_stage: string };
const cols = (): Record<string, Card[]> => ({
  NEW_LEAD: [{ id: 'a', full_name: 'An', pipeline_stage: 'NEW_LEAD' }, { id: 'b', full_name: 'Bao', pipeline_stage: 'NEW_LEAD' }],
  QUALIFIED: [{ id: 'c', full_name: 'Chi', pipeline_stage: 'QUALIFIED' }],
  APPLIED: [],
});

describe('kanban move logic', () => {
  it('moves a card to the top of the target column and updates its stage', () => {
    const before = cols();
    const after = moveCard(before, 'b', 'QUALIFIED');
    expect(after.NEW_LEAD.map((c) => c.id)).toEqual(['a']);
    expect(after.QUALIFIED.map((c) => c.id)).toEqual(['b', 'c']);
    expect(after.QUALIFIED[0].pipeline_stage).toBe('QUALIFIED');
  });

  it('is immutable (optimistic update can be rolled back from the snapshot)', () => {
    const before = cols();
    moveCard(before, 'a', 'APPLIED');
    expect(before.NEW_LEAD).toHaveLength(2);
    expect(before.APPLIED).toHaveLength(0);
    expect(before.NEW_LEAD[0].pipeline_stage).toBe('NEW_LEAD');
  });

  it('returns the same object for no-op moves', () => {
    const before = cols();
    expect(moveCard(before, 'a', 'NEW_LEAD')).toBe(before);
    expect(moveCard(before, 'missing', 'APPLIED')).toBe(before);
    expect(moveCard(before, 'a', 'NOT_A_STAGE')).toBe(before);
  });

  it('finds the column a card is in', () => {
    expect(findCardStage(cols(), 'c')).toBe('QUALIFIED');
    expect(findCardStage(cols(), 'zzz')).toBeNull();
  });
});

describe('document review reason validation', () => {
  it('lets verification through without a reason', () => {
    expect(validateReview('VERIFIED', '')).toBeNull();
    expect(validateReview('VERIFIED', undefined)).toBeNull();
  });
  it('requires a reason to request changes', () => {
    expect(validateReview('NEEDS_CORRECTION', '')).toBe('review.reasonRequired');
    expect(validateReview('NEEDS_CORRECTION', '   ')).toBe('review.reasonRequired');
    expect(validateReview('NEEDS_CORRECTION', null)).toBe('review.reasonRequired');
  });
  it('rejects reasons too short to be actionable', () => {
    expect(validateReview('NEEDS_CORRECTION', 'blurry')).toBe('review.reasonTooShort');
    expect(validateReview('NEEDS_CORRECTION', 'Scan is cut off on page 2')).toBeNull();
  });
  it('appends quick-reason templates without duplicating them', () => {
    expect(appendReason('', 'Apostille missing.')).toBe('Apostille missing.');
    expect(appendReason('Page 2 is blurry', 'Apostille missing.')).toBe('Page 2 is blurry. Apostille missing.');
    expect(appendReason('Apostille missing.', 'Apostille missing.')).toBe('Apostille missing.');
  });
});

describe('task grouping', () => {
  const now = new Date(2026, 8, 27, 10, 0); // Sun 27 Sep 2026, 10:00 local
  const at = (d: number, h = 12) => new Date(2026, 8, d, h).toISOString();
  it('buckets by due date relative to now', () => {
    expect(taskBucket({ due_at: at(26), overdue: false }, now)).toBe('overdue');
    expect(taskBucket({ due_at: at(28), overdue: true }, now)).toBe('overdue');
    expect(taskBucket({ due_at: at(27, 18), overdue: false }, now)).toBe('today');
    expect(taskBucket({ due_at: at(30), overdue: false }, now)).toBe('week');
    expect(taskBucket({ due_at: at(29 + 10), overdue: false }, now)).toBe('later');
    expect(taskBucket({ due_at: null, overdue: false }, now)).toBe('noDate');
  });
  it('keeps input order inside each bucket', () => {
    const g = bucketTasks([{ id: 1, due_at: at(26), overdue: true }, { id: 2, due_at: null, overdue: false }, { id: 3, due_at: at(25), overdue: true }], now);
    expect(g.overdue.map((x) => x.id)).toEqual([1, 3]);
    expect(g.noDate).toHaveLength(1);
  });
});

describe('first-response SLA', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  it('is met when the response came before the deadline', () => {
    expect(slaState('2026-09-27T10:00:00Z', '2026-09-27T08:00:00Z', now)).toEqual({ state: 'met', hours: 2 });
  });
  it('is late when the response came after the deadline', () => {
    expect(slaState('2026-09-27T10:00:00Z', '2026-09-27T13:00:00Z', now).state).toBe('late');
  });
  it('is pending / breached without a response', () => {
    expect(slaState('2026-09-27T15:00:00Z', null, now)).toEqual({ state: 'pending', hours: 3 });
    expect(slaState('2026-09-27T09:00:00Z', null, now)).toEqual({ state: 'breached', hours: -3 });
  });
  it('is none without a deadline', () => {
    expect(slaState(null, null, now).state).toBe('none');
  });
});

describe('essay highlighting', () => {
  const body = 'I passed TOPIK level 4 this spring. I love Busan.';
  it('uses stored anchors when they still match the quote', () => {
    expect(commentRange(body, { anchor_start: 2, anchor_end: 8, quote: 'passed' })).toEqual([2, 8]);
  });
  it('falls back to the quote when anchors are missing or stale', () => {
    expect(commentRange(body, { anchor_start: null, anchor_end: null, quote: 'Busan' })).toEqual([43, 48]);
    expect(commentRange(body, { anchor_start: 0, anchor_end: 5, quote: 'Busan' })).toEqual([43, 48]);
    expect(commentRange(body, { anchor_start: null, anchor_end: null, quote: 'Seoul' })).toBeNull();
  });
  it('splits text into annotated segments that rebuild the original', () => {
    const segs = highlightSegments(body, [
      { id: 'c1', anchor_start: 2, anchor_end: 22, quote: 'passed TOPIK level 4' },
      { id: 'c2', anchor_start: null, anchor_end: null, quote: 'TOPIK' },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(body);
    const topik = segs.find((s) => s.text === 'TOPIK')!;
    expect(topik.commentIds.sort()).toEqual(['c1', 'c2']);
    expect(segs[0]).toMatchObject({ text: 'I ', commentIds: [] });
  });
});

describe('misc helpers', () => {
  it('resolves @mentions still present in the body', () => {
    const team = [{ user_id: 'u1', full_name: 'Trương Mỹ Linh' }, { user_id: 'u2', full_name: 'Lê Hoàng Long' }];
    expect(resolveMentions('Hi @Trương Mỹ Linh please check', team)).toEqual(['u1']);
    expect(resolveMentions('No mentions', team)).toEqual([]);
  });
  it('parses intakes', () => {
    expect(parseIntake('2027-SPRING')).toEqual({ year: 2027, term: 'SPRING' });
    expect(parseIntake(null)).toBeNull();
    expect(parseIntake('garbage')).toBeNull();
  });
  it('groups dates by week starting Monday', () => {
    expect(weekKey(new Date(2026, 8, 27, 12).toISOString())).toBe('2026-09-21');
    expect(weekKey(new Date(2026, 8, 28, 12).toISOString())).toBe('2026-09-28');
  });
  it('sums money per currency without converting', () => {
    const rows = [{ a: 100, c: 'USD' }, { a: 50, c: 'USD' }, { a: 1000, c: 'KRW' }];
    expect(sumByCurrency(rows, (r) => r.a, (r) => r.c)).toEqual({ USD: 150, KRW: 1000 });
  });
});

describe('shortRelative', () => {
  it('is compact and never truncates in a narrow column', async () => {
    const { shortRelative } = await import('./logic');
    const now = new Date('2026-09-29T12:00:00Z');
    expect(shortRelative('2026-09-29T11:56:00Z', 'en', now)).toBe('4m ago');
    expect(shortRelative('2026-09-29T09:00:00Z', 'en', now)).toBe('3h ago');
    expect(shortRelative('2026-09-27T12:00:00Z', 'en', now)).toBe('2d ago');
    expect(shortRelative(null)).toBe('—');
  });
});

describe('V4 plain language', () => {
  it('keeps acronyms when lower-casing document types', () => {
    expect(lowerKeepAcronyms('TOPIK certificate')).toBe('TOPIK certificate');
    expect(lowerKeepAcronyms('Bank balance certificate')).toBe('bank balance certificate');
    expect(lowerKeepAcronyms('IELTS / TOEFL score')).toBe('IELTS / TOEFL score');
  });
  it('renders task titles with acronyms intact', () => {
    const t = (k: string, o?: Record<string, unknown>) => (k === 'common:docCategory.TOPIK' ? 'TOPIK certificate' : k === 'common:task.reviewDocument' ? `Review ${o?.category}` : k);
    expect(taskTitle(t, { title: 'Review topik certificate', title_key: 'task.reviewDocument', title_params: { category: 'TOPIK' } })).toBe('Review TOPIK certificate');
    expect(taskTitle(t, { title: 'Plain' })).toBe('Plain');
  });
  it('translates service types inside task titles (no raw AIRPORT_PICKUP)', () => {
    const t = (k: string, o?: Record<string, unknown>) => (k === 'concierge:type.AIRPORT_PICKUP' ? 'Airport pickup' : k === 'common:task.concierge.handle' ? `${o?.type}: ${o?.student}` : k);
    expect(taskTitle(t, { title: 'x', title_key: 'task.concierge.handle', title_params: { type: 'AIRPORT_PICKUP', student: 'Huy' } })).toBe('Airport pickup: Huy');
  });
  it('names languages instead of showing codes', () => {
    expect(languageName('vi', 'en')).toBe('Vietnamese');
    expect(languageName(null)).toBeNull();
  });
});

describe('V4 waiting on', () => {
  it('maps application states per the state map', () => {
    expect(appWaitingOn('READY')).toBe('us');
    expect(appWaitingOn('ADDITIONAL_DOCUMENTS')).toBe('student');
    expect(appWaitingOn('UNIVERSITY_REVIEW')).toBe('university');
    expect(appWaitingOn('VISA_SUBMITTED')).toBe('external');
    expect(appWaitingOn('ENROLLED')).toBeNull();
  });
  it('says who a task waits on', () => {
    const base = { status: 'OPEN', task_type: 'GENERAL' };
    expect(taskWaitingOn({ ...base, status: 'BLOCKED' })).toEqual({ kind: 'blocked' });
    expect(taskWaitingOn({ ...base, depends_on: { title: 'Get apostille', done: false } })).toEqual({ kind: 'after', title: 'Get apostille' });
    expect(taskWaitingOn({ ...base, visible_to_student: true })).toEqual({ kind: 'student' });
    expect(taskWaitingOn({ ...base, task_type: 'INTERVIEW', application_status: 'INTERVIEW' })).toEqual({ kind: 'university' });
    expect(taskWaitingOn({ ...base, task_type: 'DOCUMENT_REVIEW', application_status: 'DOCUMENT_PREPARATION' })).toEqual({ kind: 'us' });
    expect(taskWaitingOn(base)).toEqual({ kind: 'us' });
  });
});
