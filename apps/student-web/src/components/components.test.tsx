import type { ChecklistItem, MatchReason } from '@hangyul/types';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { highlightSegments } from '../lib/essay';
import { studentActions } from '../pages/ApplicationDetail';
import { parseFilters, toSearch, activeCount } from '../pages/Explore';
import { visaTimeline } from '../pages/Visa';
import { renderUI } from '../test/utils';
import { ReasonList, sortReasons } from './bits';
import { ChecklistRow, checklistHref } from './ChecklistRow';

const reasons: MatchReason[] = [
  { kind: 'met', code: 'TOPIK_EXCEEDS', text: 'TOPIK 4 exceeds the minimum (level 3).', params: { have: 4, min: 3 } },
  { kind: 'missing', code: 'GPA_BELOW', text: 'GPA below the published minimum.', params: {} },
  { kind: 'info', code: 'SOMETHING_NEW_FROM_API', text: 'A brand-new reason the UI has no translation for.', params: {} },
];

describe('match reasons', () => {
  it('translates by code with params and falls back to the API text', () => {
    renderUI(<ReasonList reasons={reasons} />);
    expect(screen.getByText('TOPIK level 4, above the minimum of level 3')).toBeInTheDocument();   // V31 wording (REPORT §430)
    expect(screen.getByText('GPA below the published minimum')).toBeInTheDocument();
    expect(screen.getByText('A brand-new reason the UI has no translation for.')).toBeInTheDocument();
    // Status is not conveyed by colour alone.
    expect(screen.getAllByText(/^(Met|Missing|Note):/)).toHaveLength(3);
  });

  it('puts what is missing first', () => {
    expect(sortReasons(reasons).map((r) => r.kind)).toEqual(['missing', 'met', 'info']);
  });
});

const item = (over: Partial<ChecklistItem>): ChecklistItem => ({
  requirement_id: 'r1', category: 'TRANSCRIPT', label: 'Academic transcript', required: true, legalization_required: true, translation_required: true,
  notes: null, document_id: 'd1', status: 'NEEDS_CORRECTION', ready: false, reused: true, action_code: 'FIX',
  action: 'The transcript needs an apostille before it can be used.', verification_status: 'CURRENT', ...over,
});

describe('application checklist', () => {
  it('shows the plain-language action and links a fix to the document in the vault', () => {
    renderUI(<ul><ChecklistRow item={item({})} /></ul>);
    expect(screen.getByText('The transcript needs an apostille before it can be used.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '/documents?doc=d1');
    // Requirement flags read as one quiet line of words.
    expect(screen.getByText(/Apostille \/ legalization · Certified translation · Reused from vault/)).toBeInTheDocument();
  });

  it('opens the upload flow for missing documents and offers no button while in review', () => {
    renderUI(<ul><ChecklistRow item={item({ document_id: null, status: 'MISSING', action_code: 'UPLOAD', action: null, reused: false })} /></ul>);
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute('href', '/documents?upload=TRANSCRIPT');
    expect(screen.getByText('Upload this document.')).toBeInTheDocument();
    expect(checklistHref({ action_code: 'IN_REVIEW', document_id: 'd1', category: 'PASSPORT' })).toBeNull();
    expect(checklistHref({ action_code: 'LEGALIZE', document_id: 'd9', category: 'TRANSCRIPT' })).toBe('/documents?doc=d9');
  });
});

describe('student-only transitions', () => {
  it('orders the primary action first and withdraw last', () => {
    expect(studentActions(['WITHDRAWN', 'SUBMITTED'])).toEqual(['SUBMITTED', 'WITHDRAWN']);
    expect(studentActions(['OFFER_ACCEPTED', 'WITHDRAWN'])).toEqual(['OFFER_ACCEPTED', 'WITHDRAWN']);
    expect(studentActions(['UNIVERSITY_REVIEW'])).toEqual([]);
  });
});

describe('essay highlights', () => {
  it('wraps reviewer quotes without overlapping', () => {
    const body = 'I passed TOPIK level 4 this spring and love Busan.';
    const segs = highlightSegments(body, [
      { id: 'c1', quote: 'passed TOPIK level 4 this spring' },
      { id: 'c2', quote: 'TOPIK level 4' },
      { id: 'c3', quote: 'Busan' },
      { id: 'c4', quote: 'not in the text' },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(body);
    expect(segs.filter((s) => s.commentId).map((s) => s.commentId)).toEqual(['c1', 'c3']);
  });
});

describe('explore filters live in the URL', () => {
  it('round-trips and counts active filters', () => {
    const sp = new URLSearchParams('q=seoul&degree=BACHELOR&degree=MASTER&max_topik=4&open_only=1&sort=deadline');
    const f = parseFilters(sp);
    expect(f.lists.degree).toEqual(['BACHELOR', 'MASTER']);
    expect(activeCount(f)).toBe(4);
    expect(parseFilters(toSearch(f))).toEqual(f);
  });
});

describe('visa timeline', () => {
  it('marks past, current and future steps', () => {
    const tl = visaTimeline('DOCUMENT_PREPARATION');
    expect(tl.find((s) => s.key === 'WAITING_FOR_ADMISSION')?.state).toBe('done');
    expect(tl.find((s) => s.key === 'DOCUMENT_PREPARATION')?.state).toBe('active');
    expect(tl.find((s) => s.key === 'ISSUED')?.state).toBe('todo');
    expect(tl.some((s) => s.key === 'REJECTED')).toBe(false);
  });
});
