import type { MessageTemplate } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { groupTemplates, langOfCountry, pickVariant } from './templates';

const tpl = (id: string, locale: string, group = 'g1', scope: MessageTemplate['scope'] = 'ORG'): MessageTemplate =>
  ({ id, title: id, body: id, kind: 'GENERAL', scope, locale, group_key: group, mine: false, can_edit: false, updated_at: '' });

describe('template language variants (V9 A5)', () => {
  const v = [tpl('en', 'en'), tpl('ko', 'ko'), tpl('vi', 'vi')];
  it("picks the student's language first", () => {
    expect(pickVariant(v, 'vi', 'ko')).toEqual({ t: v[2], matchedStudent: true });
    expect(pickVariant(v, 'vi-VN', 'en').t.id).toBe('vi');
  });
  it('falls back to the console language, then English, then the first variant', () => {
    expect(pickVariant(v, 'ne', 'ko')).toEqual({ t: v[1], matchedStudent: false });
    expect(pickVariant(v, null, 'ja').t.id).toBe('en');
    expect(pickVariant([tpl('x', 'mn')], 'vi', 'ja').t.id).toBe('x');
  });
  it('groups by scope and group key; templates without a group stay single', () => {
    const groups = groupTemplates([...v, tpl('team-en', 'en', 'g1', 'TEAM'), { ...tpl('solo', 'en'), group_key: undefined }], 'vi', 'en');
    expect(groups.map((g) => g.picked.id)).toEqual(['vi', 'team-en', 'solo']);
    expect(groups[0].variants).toHaveLength(3);
  });
  it('maps nationality to a language', () => {
    expect(langOfCountry('vn')).toBe('vi');
    expect(langOfCountry('XX')).toBeNull();
  });
});
