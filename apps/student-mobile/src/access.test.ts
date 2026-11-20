import { describe, expect, it } from 'vitest';

import { authGateView } from '../../../packages/mobile-ui/src/bootstrap/gate';
import { authModeFor, catalogPreparing, checkoutReturnPath, emptyReason, matchGated, planState, POST_SIGNUP_PATH } from './access';

describe('auth entry (req 2): the requested mode is the first frame', () => {
  it('opens sign-up for the sign-up routes and ?mode=signup', () => {
    expect(authModeFor('/register')).toBe('signup');
    expect(authModeFor('/signup')).toBe('signup');
    expect(authModeFor('/sign-up/')).toBe('signup');
    expect(authModeFor('/', { mode: 'signup' })).toBe('signup');
    expect(authModeFor('/', { mode: ['register'] })).toBe('signup');
  });
  it('opens sign-in for /login, the root, unknown paths and ?mode=login', () => {
    expect(authModeFor('/login')).toBe('login');
    expect(authModeFor('/')).toBe('login');
    expect(authModeFor(undefined)).toBe('login');
    expect(authModeFor('/registered-universities')).toBe('login');
    expect(authModeFor('/register', { mode: 'login' })).toBe('login');
  });
  it('shows the neutral splash — never a form — while the session restores', () => {
    expect(authGateView('loading')).toBe('splash');
    expect(authGateView('loading', true)).toBe('splash');
    expect(authGateView('unavailable')).toBe('unavailable');
    expect(authGateView('anonymous')).toBe('auth');
    expect(authGateView('authenticated', true)).toBe('auth');
    expect(authGateView('authenticated')).toBe('app');
  });
});

describe('matching after login and payment (req 1)', () => {
  it('gates only on a definite "no plan"', () => {
    expect(planState({ isPending: true, isError: false })).toBe('loading');
    expect(planState({ isPending: false, isError: true })).toBe('unknown');
    expect(planState({ isPending: false, isError: false, data: { plan: null } })).toBe('unpaid');
    expect(planState({ isPending: false, isError: false, data: { plan: { code: 'BASIC' } } })).toBe('paid');
    expect(matchGated('unpaid')).toBe(true);
    expect(matchGated('unknown')).toBe(false);
    expect(matchGated('loading')).toBe(false);
  });
  it('returns from checkout to matching when it was started there', () => {
    expect(checkoutReturnPath('match')).toBe('/match');
    expect(checkoutReturnPath(['match'])).toBe('/match');
    expect(checkoutReturnPath(undefined)).toBe('/services');
    expect(checkoutReturnPath('home')).toBe('/services');
    expect(POST_SIGNUP_PATH).toBe('/match');
  });
});

describe('catalogue empty states (university data)', () => {
  it('says "being prepared" for an empty or preparing catalogue, "no match" only for a ready one with filters', () => {
    expect(emptyReason({ state: 'PREPARING', programs_total: 0, universities_total: 0 }, true)).toBe('preparing');
    expect(emptyReason({ state: 'READY', programs_total: 0, universities_total: 3 }, true)).toBe('preparing');
    expect(emptyReason({ state: 'READY', programs_total: 120, universities_total: 30 }, true)).toBe('filtered');
    expect(emptyReason(undefined, true)).toBe('filtered');
    expect(emptyReason(undefined, false)).toBe('preparing');
    expect(catalogPreparing({ state: 'EMPTY', programs_total: 0, universities_total: 0 })).toBe(true);
    expect(catalogPreparing({ state: 'READY', programs_total: 5, universities_total: 1 })).toBe(false);
    expect(catalogPreparing(undefined)).toBe(false);
  });
});
