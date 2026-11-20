/**
 * 261119 (owner requirement 3, Student side): the programme-search parameter builder and the empty-state reason.
 *
 *   - several chips in ONE group are alternatives: one query parameter, repeated (`degree=A&degree=B`) — OR;
 *   - different groups narrow each other: each is its own parameter — AND (server: `catalog.py`, `.in_()` per group);
 *   - an empty or still-preparing catalogue is "being prepared", never "nothing matches" and never ineligibility.
 */
import { describe, expect, it } from 'vitest';

import { activeCount, emptyReason, parseFilters, toQuery, toSearch } from './Explore';

const base = () => parseFilters(new URLSearchParams());

describe('filter parameters', () => {
  it('sends several choices in one group as one repeated parameter (OR)', () => {
    const f = base();
    f.lists.degree = ['BACHELOR', 'MASTER'];
    const sp = toSearch(f);
    expect(sp.getAll('degree')).toEqual(['BACHELOR', 'MASTER']);
    expect(sp.toString()).toBe('degree=BACHELOR&degree=MASTER');
    expect(toQuery(f).degree).toEqual(['BACHELOR', 'MASTER']);
  });

  it('sends different groups as separate parameters (AND)', () => {
    const f = base();
    f.lists.degree = ['BACHELOR'];
    f.lists.language = ['ENGLISH', 'BILINGUAL'];
    f.lists.region = ['SEOUL'];
    f.bools.has_dorm = true;
    f.nums.max_topik = '3';
    f.intake_term = 'FALL';
    const sp = toSearch(f);
    expect(sp.getAll('degree')).toEqual(['BACHELOR']);
    expect(sp.getAll('language')).toEqual(['ENGLISH', 'BILINGUAL']);
    expect(sp.getAll('region')).toEqual(['SEOUL']);
    expect(sp.get('has_dorm')).toBe('1');
    expect(sp.get('max_topik')).toBe('3');
    expect(sp.get('intake_term')).toBe('FALL');
    const q = toQuery(f) as Record<string, unknown>;
    expect(q.has_dorm).toBe(true);
    expect(q.has_scholarship).toBeUndefined();
    expect(q.max_topik).toBe('3');
    expect(activeCount(f)).toBe(7);
  });

  it('round-trips through the URL', () => {
    const f = base();
    f.q = 'Busan';
    f.sort = 'deadline';
    f.lists.field = ['ENGINEERING', 'BUSINESS'];
    f.lists.institution_type = ['NATIONAL'];
    f.bools.open_only = true;
    f.nums.max_tuition = '4500000';
    expect(parseFilters(toSearch(f))).toEqual(f);
  });

  it('leaves out what is not chosen (no empty parameters, default sort omitted)', () => {
    expect(toSearch(base()).toString()).toBe('');
    expect(activeCount(base())).toBe(0);
    const q = toQuery(base()) as Record<string, unknown>;
    expect(q.q).toBeUndefined();
    expect(q.degree).toEqual([]);
    expect(q.max_tuition).toBeUndefined();
  });

  it('removing one chip of a group keeps the others', () => {
    const f = base();
    f.lists.language = ['KOREAN', 'ENGLISH'];
    f.lists.language = f.lists.language.filter((x) => x !== 'KOREAN');
    expect(toSearch(f).getAll('language')).toEqual(['ENGLISH']);
  });
});

describe('why a listing is empty', () => {
  it('an empty or preparing catalogue is "being prepared", with or without filters', () => {
    expect(emptyReason({ state: 'EMPTY', programs_total: 0, universities_total: 0 }, false)).toBe('preparing');
    expect(emptyReason({ state: 'EMPTY', programs_total: 0, universities_total: 0 }, true)).toBe('preparing');
    expect(emptyReason({ state: 'PREPARING', programs_total: 120, universities_total: 30 }, true)).toBe('preparing');
    expect(emptyReason({ state: 'READY', programs_total: 0, universities_total: 0 }, true)).toBe('preparing');
  });

  it('a ready catalogue with filters is "no programme matches these filters"', () => {
    expect(emptyReason({ state: 'READY', programs_total: 812, universities_total: 140 }, true)).toBe('filtered');
  });

  it('an older server that does not say is never read as ineligibility', () => {
    expect(emptyReason(undefined, true)).toBe('filtered');
    expect(emptyReason(undefined, false)).toBe('preparing');
  });
});
