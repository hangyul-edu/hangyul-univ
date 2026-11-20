import type { DossierPackage, DossierRow } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import {
  BASE_SET, buildLayout, canHide, canRemove, defaultExpanded, groupOf, groupSummary, HOME_GROUP, itemStatus, type DocGroup,
} from './docGroups';

const use = (status: DossierRow['applications'][number]['status'], app = 'a1', university = 'Pusan National University') =>
  ({ application_id: app, university, requirement_id: 'r', label: 'L', status, document_id: null, reason: { code: status, params: {}, text: '' }, sent: false, max_age_days: null });
const doc = (status: NonNullable<DossierRow['document']>['status'], extra: Partial<NonNullable<DossierRow['document']>> = {}) =>
  ({ id: `d-${status}`, category: 'PASSPORT', title: 't', status, issuing_country: 'VN', issue_date: null, expires_on: null, language: null, current_version: 1,
    updated_at: null, latest_file: null, translation: 'NOT_NEEDED', legalization: { path: 'NONE', status: 'NOT_REQUIRED' }, rejection_reason: null, is_demo: true, ...extra }) as NonNullable<DossierRow['document']>;
function row(p: Partial<DossierRow>): DossierRow {
  return { category: 'PASSPORT', label: 'x', state: 'todo', document: null, other_versions: [], superseded: [], applications: [use('MISSING')], ready_count: 0,
    needed_count: 1, summary: { code: 'S_MISSING', params: { count: 1 }, text: '' }, findings: [], essay: null, ...p };
}
const pkg = (id: string, deadline: string) => ({ application: { id, status: 'DRAFT', university: 'U', university_id: 'u', program: 'P', deadline, sent: false }, summary: { total: 0, ready: 0, student: 0, counselor: 0, request: 0, complete: false }, items: [] }) as DossierPackage;
const tk = (k: string, o?: Record<string, unknown>) => `${k.replace('dossier:groups.summary.', '')}${o && 'count' in o ? `:${o.count}` : ''}`;

describe('document taxonomy', () => {
  it('maps every category to a meaningful group', () => {
    expect(HOME_GROUP.TRANSCRIPT).toBe('academic');
    expect(HOME_GROUP.FAMILY_RELATION_CERTIFICATE).toBe('identity');
    expect(HOME_GROUP.IELTS).toBe('language');
    expect(HOME_GROUP.SPONSOR_DOCUMENT).toBe('financial');
    expect(HOME_GROUP.STUDY_PLAN).toBe('writing');
    expect(HOME_GROUP.CONSENT_FORM).toBe('university');
    expect(HOME_GROUP.RECOMMENDATION).toBe('additional');
  });
  it('moves an extra kind of document a university asks for into the university-specific group', () => {
    expect(groupOf('PORTFOLIO', false)).toBe('additional');
    expect(groupOf('PORTFOLIO', true)).toBe('university');
    expect(groupOf('TOPIK', true)).toBe('language');
  });
});

describe('item status', () => {
  it('derives the student-facing status from the row', () => {
    expect(itemStatus(null)).toBe('missing');
    expect(itemStatus(row({}))).toBe('missing');
    expect(itemStatus(row({ document: doc('NEEDS_CORRECTION'), applications: [use('NEEDS_FIX')] }))).toBe('fix');
    expect(itemStatus(row({ document: doc('EXPIRED') }))).toBe('expired');
    expect(itemStatus(row({ document: doc('VERIFIED'), applications: [use('NEEDS_LEGALIZATION')] }))).toBe('action');
    expect(itemStatus(row({ state: 'review', document: doc('NEEDS_REVIEW'), applications: [use('IN_REVIEW')] }))).toBe('review');
    expect(itemStatus(row({ state: 'ready', document: doc('VERIFIED'), applications: [use('READY')] }))).toBe('verified');
    expect(itemStatus(row({ state: 'review', essay: { id: 'e', status: 'AGENCY_REVIEW' } }))).toBe('review');
  });
});

describe('layout', () => {
  const rows = [
    row({ category: 'TRANSCRIPT', document: doc('NEEDS_CORRECTION'), applications: [use('NEEDS_FIX', 'a1'), use('NEEDS_FIX', 'a2', 'Kyungpook National University')], needed_count: 2 }),
    row({ category: 'GRADUATION_CERTIFICATE', state: 'ready', document: doc('VERIFIED'), applications: [use('READY', 'a1'), use('READY', 'a2')], needed_count: 2, ready_count: 2 }),
    row({ category: 'PASSPORT', state: 'ready', document: doc('VERIFIED'), applications: [use('READY', 'a1')], ready_count: 1 }),
    row({ category: 'RECOMMENDATION', state: 'extra', document: doc('VERIFIED'), applications: [], needed_count: 0 }),
  ];
  const d = { rows, packages: [pkg('a1', '2026-12-04'), pkg('a2', '2026-12-21')], optional: [{ category: 'IELTS' as const, universities: ['Kyungpook National University'] }] };

  it('groups by category, keeps empty optional groups out of the page and lists them under +', () => {
    const l = buildLayout(d);
    expect(l.groups.map((g) => g.id)).toEqual(['academic', 'identity', 'additional']);
    expect(l.addable.map((a) => a.id)).toEqual(['language', 'financial', 'writing', 'university']);
    expect(l.addable.find((a) => a.id === 'language')?.optional).toBe(1);
    const academic = l.groups[0];
    expect(academic.required).toBe(true);
    expect(academic.items[0].category).toBe('TRANSCRIPT'); // what needs the student first
    expect(academic.items[0].deadline).toBe('2026-12-04');
    expect(academic.items[0].universities.map(({ name, count }) => ({ name, count }))).toEqual([{ name: 'Pusan National University', count: 1 }, { name: 'Kyungpook National University', count: 1 }]);
    // The Korean name rides along so a Korean screen never shows the English one (owner 261119 p5).
    expect(academic.items[0].universities.every((u) => 'name_ko' in u)).toBe(true);
    expect(l.groups[2].required).toBe(false);
  });

  it('computes completion over required items only', () => {
    expect(buildLayout(d).progress).toEqual({ done: 2, total: 3, pct: 67 });
  });

  it('summarises a collapsed section in one line and opens only sections that need the student', () => {
    const l = buildLayout(d);
    const [academic, identity, additional] = l.groups;
    expect(groupSummary(tk, academic.counts)).toBe('required:2 · done:1 · fix:1');
    expect(groupSummary(tk, identity.counts)).toBe('required:1 · allDone');
    expect(groupSummary(tk, additional.counts)).toBe('optional:1 · done:1');
    expect(defaultExpanded(academic)).toBe(true);
    expect(defaultExpanded(identity)).toBe(false);
  });

  it('shows an opened optional group with the suggested items, and an added record', () => {
    const l = buildLayout(d, [{ id: 's1', type: 'award' }], ['language']);
    const lang = l.groups.find((g) => g.id === 'language')!;
    expect(lang.items.map((i) => [i.category, i.source, i.required])).toEqual([['IELTS', 'optional', false]]);
    const add = l.groups.find((g) => g.id === 'additional')!;
    expect(add.items.some((i) => i.source === 'added' && i.slot?.type === 'award')).toBe(true);
  });

  it('protects required items and uploaded files', () => {
    const l = buildLayout(d, [{ id: 's1', type: 'award' }], ['language']);
    const all = l.groups.flatMap((g) => g.items);
    expect(all.filter((i) => i.required).every((i) => !canRemove(i))).toBe(true);
    expect(all.filter((i) => i.row?.document).every((i) => !canRemove(i))).toBe(true);
    expect(canRemove(all.find((i) => i.source === 'added')!)).toBe(true);
    const byId = (id: string) => l.groups.find((g) => g.id === id) as DocGroup;
    expect(canHide(byId('academic'))).toBe(false);
    expect(canHide(byId('additional'))).toBe(false); // holds an uploaded recommendation letter
    expect(canHide(byId('language'))).toBe(true);
  });

  it('a typed record (IELTS) is answered by its row once a file exists — no duplicate entry', () => {
    const withIelts = { ...d, rows: [...rows, row({ category: 'IELTS', state: 'extra', document: doc('VERIFIED'), applications: [], needed_count: 0 })] };
    const l = buildLayout(withIelts, [{ id: 's2', type: 'IELTS' }]);
    expect(l.groups.find((g) => g.id === 'language')!.items.filter((i) => i.category === 'IELTS')).toHaveLength(1);
  });

  it('with no application, shows the minimal base set as required', () => {
    const l = buildLayout({ rows: [], packages: [] });
    expect(l.hasApplications).toBe(false);
    expect(l.groups.flatMap((g) => g.items).map((i) => i.category).sort()).toEqual([...BASE_SET].sort());
    expect(l.groups.flatMap((g) => g.items).every((i) => i.required && i.source === 'base')).toBe(true);
  });
});
