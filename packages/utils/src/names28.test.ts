import { describe, expect, it } from 'vitest';
import { scholarshipName } from './workflow27';

// V28 (UX_AUDIT MK-4): published names only — Korean name (or Korean description) on Korean screens, official English elsewhere.
describe('scholarshipName', () => {
  const s = { name: '외국인 장학금 — TOPIK 4·5급', name_en: 'International scholarship', name_display_ko: '외국인 장학금 (TOPIK 4급, 5급 자격증소지자)', name_official_en: 'Global Scholarship A' };
  it('uses the Korean display name on Korean screens', () => expect(scholarshipName(s, 'ko')).toBe(s.name_display_ko));
  it('uses the official English name elsewhere', () => expect(scholarshipName(s, 'vi')).toBe('Global Scholarship A'));
  it('falls back to the stored English, then the stored name', () => {
    expect(scholarshipName({ ...s, name_official_en: null }, 'en')).toBe('International scholarship');
    expect(scholarshipName({ name: '장학금', name_en: null }, 'en')).toBe('장학금');
    expect(scholarshipName({ name: '장학금', name_en: 'X', name_display_ko: null }, 'ko')).toBe('장학금');
  });
});
