import { safeNext } from '@hangyul/ui';
import { describe, expect, it } from 'vitest';

import { studentAction } from '../lib/session';

/**
 * V10 (REPORT §68.5): a personalised action on the public site must resume inside the Student Platform after
 * login rather than dropping the visitor on a dashboard — and the return path it carries must not be able to
 * send a freshly signed-in student off-site.
 */
describe('studentAction', () => {
  it('goes straight to the destination when a student session already exists', () => {
    expect(studentAction('/explore?tab=saved', true)).toBe('http://localhost:3101/explore?tab=saved');
  });

  it('detours an anonymous visitor through the login, carrying the destination', () => {
    expect(studentAction('/explore?tab=saved', false))
      .toBe('http://localhost:3101/login?next=%2Fexplore%3Ftab%3Dsaved');
  });

  it('keeps the chosen language on both branches', () => {
    expect(studentAction('/documents', true, 'ko')).toBe('http://localhost:3101/documents?lang=ko');
    expect(studentAction('/documents', false, 'ko')).toBe('http://localhost:3101/login?next=%2Fdocuments&lang=ko');
  });
});

describe('safeNext', () => {
  it('accepts an in-app absolute path', () => {
    expect(safeNext('/visa', '/')).toBe('/visa');
    expect(safeNext('/applications?id=1', '/')).toBe('/applications?id=1');
  });

  it('refuses anything that could leave the app', () => {
    for (const hostile of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil', '', null, undefined]) {
      expect(safeNext(hostile, '/')).toBe('/');
    }
  });
});
