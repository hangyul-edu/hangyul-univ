import type { ApplicationDetail, ChecklistItem, EssaySummary } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { reviewIsLate } from './format';
import { buildWorkspace, heroItem, lc } from './workspace';

const t = (key: string, opts?: Record<string, unknown>) => (opts && Object.keys(opts).length ? `${key}|${JSON.stringify(opts)}` : key);
const ctx = { counselor: 'Linh', formatDate: (d: string) => d.slice(0, 10) };

function item(p: Partial<ChecklistItem>): ChecklistItem {
  return {
    requirement_id: p.category ?? 'x', category: 'PASSPORT', label: 'Passport copy', required: true, legalization_required: false, translation_required: false,
    notes: null, document_id: null, status: 'MISSING', ready: false, reused: false, action_code: 'UPLOAD', action: null, verification_status: 'DEMO', ...p,
  } as ChecklistItem;
}
function essay(p: Partial<EssaySummary>): EssaySummary {
  return { id: `e-${p.essay_type}`, owner_user_id: 'u', title: 't', essay_type: 'STUDY_PLAN', status: 'DRAFT', prompt: null, word_limit: null, due_date: '2026-10-20',
    current_version: 1, application_id: 'a', reviewer: null, word_count: 0, updated_at: '2026-09-01', open_comments: 0, ...p } as EssaySummary;
}
function app(checklist: ChecklistItem[], essays: EssaySummary[] = [], extra: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: 'a', status: 'DOCUMENT_PREPARATION', university: { name_en: 'Pusan National University' }, program: { name_en: 'Media' },
    intake: { application_deadline: '2026-10-20', term: 'SPRING', year: 2027 }, checklist, essays, document_requests: [], history: [], submitted_at: null, ...extra,
  } as unknown as ApplicationDetail;
}

describe('application workspace model', () => {
  const checklist = [
    item({ category: 'PASSPORT', label: 'Passport copy', status: 'VERIFIED', ready: true, action_code: null }),
    item({ category: 'TRANSCRIPT', label: 'Academic transcript', status: 'NEEDS_CORRECTION', action_code: 'FIX', action: 'Needs an apostille.', document_id: 'd1' }),
    item({ category: 'BANK_STATEMENT', label: 'Bank balance certificate', status: 'NEEDS_REVIEW', action_code: 'IN_REVIEW', review_since: '2026-08-01T00:00:00Z', review_overdue: true }),
    item({ category: 'FAMILY_RELATION_CERTIFICATE', label: 'Family relationship certificate' }),
    item({ category: 'PERSONAL_STATEMENT', label: 'Personal statement' }),
    item({ category: 'STUDY_PLAN', label: 'Study plan' }),
  ];
  const essays = [essay({ essay_type: 'PERSONAL_STATEMENT', status: 'AGENCY_REVIEW' }), essay({ essay_type: 'STUDY_PLAN', status: 'DRAFT' })];
  const items = buildWorkspace(app(checklist, essays), t, ctx);

  it('puts every requirement in exactly one lane', () => {
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    // The personal statement is being read by the counselor: it is NOT also an upload task for the student.
    const ps = items.filter((i) => i.key === 'PERSONAL_STATEMENT');
    expect(ps).toHaveLength(1);
    expect(ps[0].lane).toBe('team');
    // The study plan essay and the study plan document are one item.
    const sp = items.filter((i) => i.key === 'STUDY_PLAN');
    expect(sp).toHaveLength(1);
    expect(sp[0].title).toContain('writeEssay');
  });

  it('says a stalled review honestly', () => {
    const bank = items.find((i) => i.key === 'BANK_STATEMENT')!;
    expect(bank.lane).toBe('team');
    expect(bank.state).toBe('late');
    expect(bank.detail).toBe('v4.review.late');
  });

  it('names the single next item: the fix comes first', () => {
    const hero = heroItem(items)!;
    expect(hero.key).toBe('TRANSCRIPT');
    expect(hero.title).toContain('v4.ws.you.doc.FIX');
    expect(hero.title).toContain('academic transcript');
    expect(hero.due).toBe('2026-10-20');
    expect(hero.href).toBe('/documents?doc=d1');
  });

  it('collapses verified documents into one done line', () => {
    const done = items.filter((i) => i.state === 'done' && i.lane === 'team');
    expect(done).toHaveLength(1);
    expect(done[0].detail).toBe('Passport copy');
  });

  it('a university request becomes the hero with its note and due date', () => {
    const a = app(checklist, essays, { document_requests: [{ id: 'r1', label: 'Recent bank certificate', note: 'Issued within 30 days', status: 'OPEN', due_date: '2026-10-05' }] } as never);
    const hero = heroItem(buildWorkspace(a, t, ctx))!;
    expect(hero.requestId).toBe('r1');
    expect(hero.detail).toBe('Issued within 30 days');
    expect(hero.due).toBe('2026-10-05');
  });
});

describe('copy helpers', () => {
  it('sentence-cases labels mid-sentence but keeps acronyms', () => {
    expect(lc('Family relationship certificate')).toBe('family relationship certificate');
    expect(lc('TOPIK certificate')).toBe('TOPIK certificate');
  });
  it('flags reviews past the 48 h target', () => {
    const now = Date.parse('2026-09-29T00:00:00Z');
    expect(reviewIsLate('2026-09-28T12:00:00Z', now)).toBe(false);
    expect(reviewIsLate('2026-09-26T00:00:00Z', now)).toBe(true);
    expect(reviewIsLate(null, now)).toBe(false);
  });
});

describe('lc (mid-sentence labels)', () => {
  it('lowers a plain capitalised first word only', () => {
    expect(lc('Family relationship certificate')).toBe('family relationship certificate');
    expect(lc('TOPIK certificate')).toBe('TOPIK certificate');
    expect(lc('E2E recent bank certificate')).toBe('E2E recent bank certificate');
    expect(lc('GKS application form')).toBe('GKS application form');
  });
});
