import type { DossierFinding, DossierRow } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { findingText, needsCheck, packageLine, reasonText, rowAction, summaryText } from './dossier';

// A t() that returns '' for every key → exercises the English API fallbacks; `tk` echoes keys to check which key is used.
const none = () => '';
const tk = (key: string, o?: Record<string, unknown>) => `${key}${o && 'count' in o ? `:${o.count}` : ''}`;
const fmt = (iso: string) => `D(${iso})`;

function row(p: Partial<DossierRow>): DossierRow {
  return { category: 'BANK_STATEMENT', label: 'Bank', state: 'todo', document: null, other_versions: [], superseded: [], applications: [], ready_count: 0,
    needed_count: 1, summary: { code: 'S_MISSING', params: { count: 1 }, text: 'x' }, findings: [], essay: null, ...p };
}
const doc = { id: 'd1' } as DossierRow['document'];
const use = (status: DossierRow['applications'][number]['status']) =>
  ({ application_id: 'a', university: 'U', requirement_id: 'r', label: 'L', status, document_id: 'd1', reason: { code: status, params: {}, text: '' }, sent: false, max_age_days: null });

describe('dossier helpers', () => {
  it('falls back to the API text and formats ISO dates in params', () => {
    expect(reasonText(none, { code: 'TOO_OLD', params: { issued: '2026-08-10' }, text: 'English' }, fmt)).toBe('English');
    const t = (_k: string, o?: Record<string, unknown>) => `issued ${o?.issued}`;
    expect(reasonText(t, { code: 'TOO_OLD', params: { issued: '2026-08-10' }, text: '' }, fmt)).toBe('issued D(2026-08-10)');
  });

  it('builds the partial summary from the inner reason', () => {
    const t = (k: string, o?: Record<string, unknown>) => (k === 'dossier:summary.S_PARTIAL' ? `ok ${o?.ready}. ${o?.reason}` : k === 'dossier:reason.TOO_OLD' ? 'too old' : '');
    const s = { code: 'S_PARTIAL', params: { ready: 'Pusan', reason: 'x', reason_code: 'TOO_OLD', reason_params: {} }, text: 'fallback' };
    expect(summaryText(t, s, fmt)).toBe('ok Pusan. too old');
  });

  it('picks one row action from the most pressing use', () => {
    expect(rowAction(row({ document: null }))).toBe('upload');
    expect(rowAction(row({ document: null, essay: { id: 'e', status: 'DRAFT' } }))).toBe('write');
    expect(rowAction(row({ document: doc, applications: [use('READY'), use('NEEDS_NEW_VERSION')] }))).toBe('uploadNewer');
    expect(rowAction(row({ document: doc, applications: [use('NEEDS_LEGALIZATION'), use('NEEDS_FIX')] }))).toBe('fix');
    expect(rowAction(row({ document: doc, state: 'ready', applications: [use('READY')] }))).toBe('view');
  });

  it('collapses zero counts in the package line and says when complete', () => {
    expect(packageLine(tk, { total: 12, ready: 10, student: 1, counselor: 1, request: 0, complete: false }))
      .toBe('dossier:package.line · dossier:package.student:1 · dossier:package.counselor:1');
    expect(packageLine(tk, { total: 8, ready: 8, student: 0, counselor: 0, request: 0, complete: true })).toBe('dossier:package.complete');
  });

  it('translates category codes inside finding params', () => {
    const f = { id: 'f', document_id: 'd', code: 'WRONG_TYPE', text_code: 'WRONG_TYPE', severity: 'WARNING', params: { detected_code: 'PASSPORT', category_code: 'TRANSCRIPT' },
      explanation: 'en', action: null, status: 'OPEN', version: 1 } as DossierFinding;
    const t = (k: string, o?: Record<string, unknown>) => (k.startsWith('common:') ? k.split('.')[1] : `${o?.detected}/${o?.category}`);
    expect(findingText(t, f, fmt)).toBe('passport/transcript');
  });

  it('only asks about values that differ from the profile', () => {
    expect(needsCheck([{ status: 'SUGGESTED', matches_profile: true }, { status: 'SUGGESTED', matches_profile: false }, { status: 'CONFIRMED', matches_profile: false }])).toHaveLength(1);
  });
});
