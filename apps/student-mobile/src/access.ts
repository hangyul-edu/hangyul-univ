/**
 * Owner pass 261119 — the native mirror of the web's `apps/student-web/src/lib/access.ts` + `/match` rules, kept pure
 * (no React Native) so it is unit-tested in Node (`access.test.ts`).
 *
 *  - req 2: the signed-out screen opens in the mode that was asked for (`/register`, `/signup`, `?mode=signup`) on the
 *    very first frame — the mode is computed from the route before render, never switched by an effect afterwards.
 *  - req 1: personalised matching is what a plan buys. Signed in without a plan → the plan (checkout hands off to the
 *    web, `src/plan.ts`) and back to `/match`; with a plan → matching and university selection. Only a *definite*
 *    "no plan" gates — loading or an error is "not known" and never shows a paywall.
 *  - req 3: an empty catalogue listing says "programme information is being prepared", never "nothing fits you".
 */
import type { CatalogStatus } from '@hangyul/types';

export type AuthMode = 'login' | 'signup';
type Params = Record<string, string | string[] | undefined>;

const SIGNUP_PATHS = /^\/(register|signup|sign-up)(?:[/?#]|$)/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The signed-out screen to render first. Anything unrecognised is sign-in. */
export function authModeFor(pathname: string | null | undefined, params: Params = {}): AuthMode {
  const mode = (first(params.mode) ?? '').toLowerCase();
  if (mode === 'signup' || mode === 'register') return 'signup';
  if (mode === 'login' || mode === 'signin') return 'login';
  return SIGNUP_PATHS.test(pathname ?? '') ? 'signup' : 'login';
}

export type PlanState = 'loading' | 'unknown' | 'unpaid' | 'paid';

/** `/me/services` → plan state. Mirrors web `Explore`: `unpaid` only when the answer is a definite "no plan". */
export function planState(q: { isPending: boolean; isError: boolean; data?: { plan: unknown } | null }): PlanState {
  if (q.isPending) return 'loading';
  if (q.isError || !q.data) return 'unknown';
  return q.data.plan ? 'paid' : 'unpaid';
}

/** Where personalised matching lives, and where checkout returns to when it was started from there. */
export const MATCH_PATH = '/match';
/** The plan screen opened from the matching gate (`gate=match`), as the web's `MATCH_PLAN_PATH`. */
export const MATCH_PLAN_PATH = '/services?gate=match';

/** Where a just-registered student lands: the matching route, which itself shows the plan when there is none. */
export const POST_SIGNUP_PATH = MATCH_PATH;

/** The in-app path checkout returns to: `/match` when the plan screen was opened from the matching gate. */
export function checkoutReturnPath(gate: string | string[] | undefined): string {
  return first(gate) === 'match' ? MATCH_PATH : '/services';
}

/** Is the "For you" tab the path to a plan rather than a list? */
export const matchGated = (s: PlanState) => s === 'unpaid';

/** Why a catalogue listing is empty — the same rule as web `emptyReason` (pages/Explore.tsx). */
export type EmptyReason = 'preparing' | 'filtered';
export function emptyReason(catalog: CatalogStatus | undefined | null, filtered: boolean): EmptyReason {
  if (catalog && (catalog.state !== 'READY' || catalog.programs_total === 0)) return 'preparing';
  if (filtered) return 'filtered';
  return 'preparing';
}

/** No personal matches: is that because the catalogue itself is not ready? (Unknown → not claimed.) */
export const catalogPreparing = (catalog: CatalogStatus | undefined | null) => !!catalog && (catalog.state !== 'READY' || catalog.programs_total === 0);
