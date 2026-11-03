/**
 * V17 — the two pieces of logic that decide something a student cannot see being decided.
 *
 *   `access`      which routes an account without a purchase may open
 *   `apphandoff`  which URLs this app will send a student to after a payment
 *
 * The second is the one that matters most: `?return=` comes off a query string, so a page that forwards a
 * student to whatever it is handed is an open redirect with a payment confirmation for cover.
 */
import { ApiError } from '@hangyul/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gateRedirect, isOpenToUnpaid } from './access';
import { appReturn, clearAppReturn, rememberAppReturn } from './apphandoff';
import { entitlementRefusal } from './upgrade';

class Store implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('the paywall is on the service, not on the account', () => {
  it('leaves a student their own account and their own information', () => {
    for (const p of ['/services', '/profile', '/settings', '/more', '/support', '/notifications', '/family', '/help']) {
      expect(isOpenToUnpaid(p), p).toBe(true);
    }
  });

  it('leaves discovery and public facts open, aliases included', () => {
    // `/matches` and `/saved` are `<Navigate>` to `/explore?tab=…`. Gating an alias of an open page is not
    // a stricter paywall, it is an inconsistent one — and it is what the e2e lifecycle spec caught.
    for (const p of ['/explore', '/matches', '/saved', '/compare', '/budget', '/scholarships', '/universities/kaist']) {
      expect(isOpenToUnpaid(p), p).toBe(true);
    }
  });

  it('gates home, because home is the managed service', () => {
    expect(isOpenToUnpaid('/')).toBe(false);
  });

  it('closes the managed service', () => {
    for (const p of ['/applications', '/documents', '/essays', '/visa', '/housing', '/arrival', '/messages', '/tasks']) {
      expect(isOpenToUnpaid(p), p).toBe(false);
    }
  });

  it('never closes a route that would strand the student', () => {
    // A paywall that redirects the login page has made the product unreachable, and one that redirects the
    // payment return has taken money and then hidden the receipt.
    for (const p of ['/login', '/register', '/services/payment/success', '/services/payment/fail']) {
      expect(isOpenToUnpaid(p), p).toBe(true);
    }
  });

  it('a nested managed route is closed too, not just its root', () => {
    expect(isOpenToUnpaid('/applications/9f1c-…/documents')).toBe(false);
  });

  it('carries where the student was trying to go, so /services can explain itself', () => {
    const to = gateRedirect('/applications/abc', '?tab=offers');
    expect(to.startsWith('/services?')).toBe(true);
    const sp = new URLSearchParams(to.slice(to.indexOf('?') + 1));
    expect(sp.get('gate')).toBe('applications');
    expect(sp.get('from')).toBe('/applications/abc?tab=offers');
  });
});

describe('the native handoff will not forward a student anywhere it is told to', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', new Store());
    clearAppReturn();
  });

  it('accepts the app’s own scheme', () => {
    rememberAppReturn('hangyul-student://services');
    expect(appReturn()).toBe('hangyul-student://services');
  });

  it('accepts Expo Go’s wrapper around it', () => {
    rememberAppReturn('exp+hangyul-student://expo-development-client/?url=x');
    expect(appReturn()).toBe('exp+hangyul-student://expo-development-client/?url=x');
  });

  it('refuses every other scheme and host', () => {
    for (const href of [
      'https://evil.example/collect',
      'http://localhost:3101/services',
      'javascript:alert(1)',
      'hangyul-agency://services',
      'hangyul-studentX://services',
      'data:text/html,<script>1</script>',
      'intent://scan/#Intent;scheme=zxing;end',
      '//evil.example/',
    ]) {
      rememberAppReturn(href);
      expect(appReturn(), href).toBeNull();
    }
  });

  it('is spent once used', () => {
    rememberAppReturn('hangyul-student://services');
    clearAppReturn();
    expect(appReturn()).toBeNull();
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
    expect(() => rememberAppReturn('hangyul-student://services')).not.toThrow();
    expect(appReturn()).toBeNull();
  });
});

describe('an upgrade is offered only when the server actually refused', () => {
  const err = (status: number, detail: unknown) => new ApiError(status, 'x', { detail });

  it('reads the refusal the entitlement service sends', () => {
    expect(entitlementRefusal(err(409, {
      error: 'entitlement_exceeded', entitlement_key: 'essay_review_rounds', limit: 0, used: 0, add_on_available: true,
      reason: 'NOT_INCLUDED', add_on_code: 'EXTRA_ESSAY_ROUND',
    }))).toEqual({ entitlement_key: 'essay_review_rounds', limit: 0, used: 0, add_on_available: true,
      reason: 'NOT_INCLUDED', add_on_code: 'EXTRA_ESSAY_ROUND' });
  });

  it('ignores everything that is not one', () => {
    for (const e of [
      null,
      undefined,
      new Error('boom'),
      err(409, 'Validation failed'),               // a 409 with a plain message is a different conflict
      err(500, { error: 'entitlement_exceeded' }), // the status is part of the contract
      err(409, { error: 'something_else', entitlement_key: 'essay_review_rounds' }),
      err(409, { error: 'entitlement_exceeded' }), // no key: nothing to offer
      // A duck-typed object is not an ApiError. An upgrade sheet raised by anything that happens to have
      // the right fields is an upgrade sheet an unrelated bug can raise.
      Object.assign(new Error('x'), { status: 409, body: { detail: { error: 'entitlement_exceeded', entitlement_key: 'mock_interviews' } } }),
    ]) {
      expect(entitlementRefusal(e)).toBeNull();
    }
  });
});
