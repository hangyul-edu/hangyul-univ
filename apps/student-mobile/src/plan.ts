/**
 * **The plan, and how the app pays for it** (V17, brief §35–37).
 *
 * The rule that must not bend is *one backend state machine*. The web app's checkout is the only place a
 * Toss payment window is opened, `POST /me/orders` is the only place an order is created, and
 * `POST /me/payments/toss/confirm` is the only place one is confirmed. A second implementation of any of
 * those inside the native app is a second source of truth about whether a student has paid — which is how
 * a student ends up charged twice, or charged once and unentitled.
 *
 * So the native app does not implement payment. It hands off:
 *
 *     Linking.openURL(`${web}/services?plan=…&return=hangyul-student://services`)
 *       → the system browser, where the student's web session and the Toss 결제창 live
 *       → Toss redirects to `/services/payment/success`, the web app confirms the order
 *       → the web page sends the student back to `hangyul-student://services`
 *       → this screen refetches `/me/services` and the plan is simply there
 *
 * The **system** browser, not an in-app one: 3-D Secure and an overseas card issuer's own app both need
 * to leave the page and come back, and a WebView is where that breaks. It also means the payment never
 * touches a surface this app controls, which is the same reason Hangyul stores no card data at all.
 */
import { useApi } from '@hangyul/auth';
import { getApiBaseUrl } from '@hangyul/mobile-ui';
import { PLANS, type PlanCode } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

/** Where the student web app lives, by the same first-match-wins rule as `getApiBaseUrl`. */
export function getWebAppUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STUDENT_WEB_URL;
  const extra = (Constants.expoConfig?.extra ?? {}) as { webUrl?: string };
  // Last resort: the API host on the web app's dev port. Wrong in production, and loudly so — which is
  // better than silently opening a page that does not exist.
  return (fromEnv || extra.webUrl || getApiBaseUrl().replace(/:\d+$/, ':3101')).replace(/\/$/, '');
}

/** `/me/services`: the plan, the three products, the allowances and any pending order. */
export function useServices() {
  const api = useApi();
  return useQuery({ queryKey: ['me', 'services'], queryFn: () => api.me.services(), staleTime: 60_000 });
}

/**
 * Open checkout in the system browser.
 *
 * `plan` is the slug the web app reads from `?plan=`; `return` is the deep link the web app sends the
 * student back to once the order is confirmed. Both are read by code that already exists — nothing here
 * is a native-only path through the payment.
 */
export async function openCheckout(plan: PlanCode | null, locale: string): Promise<boolean> {
  const def = plan ? PLANS.find((p) => p.code === plan) : null;
  const back = Linking.createURL('/services');
  // Built by hand rather than with `new URL(...)`: React Native's `URL` is a polyfill and `searchParams`
  // on it has come and gone between versions, so a query string assembled that way is a dependency on
  // which Hermes build is underneath. `encodeURIComponent` is in the language.
  const q = [
    def ? `plan=${encodeURIComponent(def.slug)}` : null,
    `lang=${encodeURIComponent(locale)}`,
    `return=${encodeURIComponent(back)}`,
    // `from=app` is for the web screen's own copy, so it can say "결제가 끝나면 앱으로 돌아갑니다" rather
    // than leaving a student wondering why they are suddenly in a browser.
    'from=app',
  ].filter(Boolean).join('&');
  const href = `${getWebAppUrl()}/services?${q}`;
  if (!(await Linking.canOpenURL(href))) return false;
  await Linking.openURL(href);
  return true;
}
