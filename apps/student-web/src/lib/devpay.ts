/**
 * The local **paid-state** action: what it is gated on, and what has to be refetched after it runs.
 *
 * This is QA tooling, not a product feature. It exists because inspecting the paid student product
 * otherwise costs a real card transaction every time, and a plan is bought once per account.
 *
 * Three things keep it out of the product:
 *
 *   1  **the build flag** below — a production bundle is built with neither `DEV` nor the opt-in, so the
 *      button is not in it;
 *   2  **the server**, which answers 404 to `POST /me/orders/dev-complete` unless `HG_ENV` is
 *      development/test or `HG_TEST_PAYMENT_BYPASS` is explicitly set, and which the student app asks about
 *      through `/me/payments/config` before rendering anything (`test_payment_bypass`);
 *   3  the fact that it **never touches the payment provider** — no Toss call, no card, no billing key. It
 *      performs the same order activation a successful payment performs and nothing else.
 *
 * The real payment path is untouched: the primary CTA on `/services` still creates an order and charges the
 * card through `/me/orders/{id}/pay-with-card` (REPORT §236).
 */

/** What the flag can be read from. A plain object so the gate is testable without a build. */
export interface BypassEnv {
  DEV?: boolean;
  VITE_ENABLE_TEST_PAYMENT_BYPASS?: string;
}

/**
 * On in a dev server, off in a production build, and overridable either way.
 *
 * `=== 'true'` turns it on in any build (a preview deployment somebody is testing against); `=== 'false'`
 * turns it off in a dev server, which is what a QA sweep that must see the production composition sets.
 */
export function bypassEnabled(env: BypassEnv): boolean {
  const flag = env.VITE_ENABLE_TEST_PAYMENT_BYPASS;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.DEV === true;
}

export const TEST_PAYMENT_BYPASS_BUILD = bypassEnabled(import.meta.env as unknown as BypassEnv);

/**
 * Everything that changes the moment an order is paid — by card or by the local action.
 *
 * `services` carries the plan itself and is what the route paywall reads (`lib/queries.ts` → `useMyPlan`),
 * so it is invalidated **and awaited** before the app navigates: a navigation that outran the refetch would
 * be bounced straight back to `/services?gate=…` by a cache that still said "no plan".
 */
export const PAID_STATE_QUERY_KEYS = [
  'services', 'plan', 'dashboard', 'profile', 'tasks', 'applications', 'conversations', 'notifications',
] as const;
