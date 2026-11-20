import { safeNext } from '@hangyul/ui';
import { describe, expect, it } from 'vitest';

import { planAction, prepareAction, studentAction } from '../lib/session';

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

/**
 * Owner decision 2026-11-19 (requirement 1): 유학 준비 opens the Student login — no anonymous quick check —
 * and resumes at `/match` (unpaid → checkout → matching; paid → matching).
 */
describe('prepareAction (유학 준비)', () => {
  it('sends a stranger to the Student login, resuming at /match', () => {
    expect(prepareAction(false)).toBe('http://localhost:3101/login?next=%2Fmatch');
  });

  it('sends a signed-in student straight to /match', () => {
    expect(prepareAction(true)).toBe('http://localhost:3101/match');
  });

  it('keeps the chosen language on both branches, and never points at the retired /start', () => {
    expect(prepareAction(false, 'vi')).toBe('http://localhost:3101/login?next=%2Fmatch&lang=vi');
    expect(prepareAction(true, 'ko')).toBe('http://localhost:3101/match?lang=ko');
    for (const href of [prepareAction(false, 'ar'), prepareAction(true, 'ar')]) expect(href).not.toMatch(/\/start\b/);
  });

  it('carries a `next` the Student login accepts', () => {
    const next = new URL(prepareAction(false, 'ko')).searchParams.get('next');
    expect(safeNext(next, '/')).toBe('/match');
  });
});

describe('planAction (pricing)', () => {
  it('sends a stranger to the login with the plan carried through `next`', () => {
    expect(planAction('all_in_one', false, 'vi'))
      .toBe('http://localhost:3101/login?next=%2Fservices%3Fplan%3Dall_in_one&lang=vi');
    expect(safeNext(new URL(planAction('basic', false)).searchParams.get('next'), '/')).toBe('/services?plan=basic');
  });

  it('sends a signed-in student straight to the service selection', () => {
    expect(planAction('basic', true, 'ko')).toBe('http://localhost:3101/services?plan=basic&lang=ko');
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
