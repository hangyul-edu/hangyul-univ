/**
 * **Coming back to the native app after paying** (V17, brief §37).
 *
 * The native app does not implement payment — it opens this web app's checkout in the system browser
 * (`apps/student-mobile/src/plan.ts`), because one payment state machine is the rule that must not bend.
 * What it needs in return is a way back, and the obstacle is that Toss decides where the browser lands:
 * `success_url` and `fail_url` are built by the server and the `?return=` the app passed is long gone by
 * the time the student is looking at a confirmation.
 *
 * So the link is kept in `sessionStorage` for the length of that browser session, which is exactly the
 * span of the Toss round trip and no longer. It is **offered**, never followed automatically: a payment
 * confirmation that navigates itself to a custom scheme is blocked by most browsers, and in the ones where
 * it works it looks like a hijack.
 *
 * `read` validates. A `?return=` from a query string is attacker-controlled, and a page that forwards a
 * student to any scheme it is handed is an open redirect with a confirmation page for cover — so only this
 * app's own scheme is accepted, plus Expo's development forms, and only off a production build.
 */
const KEY = 'hg.student.appReturn';

/** The native app's registered scheme (`app.json` → `expo.scheme`), and Expo Go's wrapper around it. */
const ALLOWED = [/^hangyul-student:\/\//i, /^exp\+hangyul-student:\/\//i];
/** Expo's dev client serves the app over a LAN URL; only ever outside production. */
const DEV_ALLOWED = [/^exp:\/\/(127\.0\.0\.1|localhost|\d+\.\d+\.\d+\.\d+)(:\d+)?\//i];

function permitted(href: string): boolean {
  if (ALLOWED.some((re) => re.test(href))) return true;
  return !import.meta.env.PROD && DEV_ALLOWED.some((re) => re.test(href));
}

/** Remember where to send the student once the payment is confirmed. Rejects anything else silently. */
export function rememberAppReturn(href: string | null): void {
  if (!href || !permitted(href)) return;
  try { sessionStorage.setItem(KEY, href); } catch { /* private mode: the handoff degrades to a web CTA */ }
}

/** The remembered link, or `null`. Re-validated on the way out, because storage is not a trust boundary. */
export function appReturn(): string | null {
  try {
    const href = sessionStorage.getItem(KEY);
    return href && permitted(href) ? href : null;
  } catch {
    return null;
  }
}

/** Once the student has gone back, the link is spent. */
export function clearAppReturn(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
