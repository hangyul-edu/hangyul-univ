/**
 * V10 — does this visitor already have a Student Platform session?
 *
 * The public site signs nobody in; it is a different app (and in production a different host) from the Student
 * Platform. But the brief requires the header's account action to read **Login** for a stranger and **Continue my
 * journey** for a student who is already signed in, and requires personalised actions to resume after login
 * rather than dumping the visitor on a dashboard.
 *
 * `GET /api/v1/auth/session-hint?client=student` answers the first question without rotating anything (see the
 * endpoint's docstring). `studentAction()` answers the second: it returns a URL that either goes straight to the
 * destination or detours through `/login?next=<destination>`, which `LoginScreen` already honours.
 */
import { useQuery } from '@tanstack/react-query';

import { studentUrl } from './env';

export interface SessionHint { authenticated: boolean; name: string | null }

async function fetchHint(): Promise<SessionHint> {
  try {
    const r = await fetch('/api/v1/auth/session-hint?client=student', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) return { authenticated: false, name: null };
    return (await r.json()) as SessionHint;
  } catch {
    // Offline or the API is down: a public page must still render, as a stranger's.
    return { authenticated: false, name: null };
  }
}

export function useStudentSession() {
  const q = useQuery({ queryKey: ['session-hint'], queryFn: fetchHint, staleTime: 60_000, retry: false });
  return { authenticated: q.data?.authenticated ?? false, name: q.data?.name ?? null, ready: !q.isPending };
}

/**
 * Where the product's **one conversion action** should send this visitor (V13, brief Parts 1 and 16).
 *
 * Signed in → the platform. Signed out → **`/start`**, the public quick check, not `/login`.
 *
 * This is the IDP FastLane lesson from `docs/qa/v13/GLOBAL_BENCHMARK.md` applied to our own front door: the
 * question that decides whether a stranger becomes an applicant is "would a Korean university take someone
 * like me?", and `/start` answers it from a handful of questions, with named reasons, without an account.
 * V13's first draft pointed this button at the sign-in page — which is the mechanism, not the goal, and the
 * exact mistake the hero's old "로그인" label was criticised for, moved one layer down where a label change
 * could not reveal it. A button that says 내 유학 준비 and opens a password field has not started anything.
 *
 * `/start` itself offers registration once it has something useful to say, so nothing is lost for the
 * visitor who was ready to sign up anyway.
 */
export function prepareAction(authenticated: boolean, locale?: string): string {
  // V17: the quick check is a **marketing** route now, not a student one. The reasoning above is unchanged
  // and is why it moved: it is the free product, so it belongs where a visitor with no account already is —
  // indexable, shareable, and openable without a round trip to another origin. See `pages/Start.tsx`.
  return authenticated ? studentUrl('/', locale) : localPath('/start', locale);
}

/** A path on this site, carrying the language. `?lang=` remains the locale authority (V14). */
function localPath(path: string, locale?: string): string {
  return locale ? `${path}${path.includes('?') ? '&' : '?'}lang=${encodeURIComponent(locale)}` : path;
}

/**
 * Where a *personalised* action should send this visitor — one that names a specific destination inside the
 * platform ("/explore?tab=saved", "/applications"). Signed in → straight there. Anonymous → the student login
 * with `?next=<path>`, so the action resumes after sign-in instead of being lost.
 *
 * Not for the conversion action: that is `prepareAction` above, and it must not pass through a password field.
 */
export function studentAction(path: string, authenticated: boolean, locale?: string): string {
  if (authenticated) return studentUrl(path, locale);
  return studentUrl(`/login?next=${encodeURIComponent(path)}`, locale);
}

/**
 * Where "베이직으로 시작" should send this visitor (V15, brief Part 4 — the plan handoff).
 *
 * Three things have to survive an authentication boundary: the plan they chose, the language they are
 * reading in, and where they were going. `?lang=` is unchanged — it is still the locale authority — and
 * `plan` rides beside it:
 *
 *     signed out →  /start?plan=all_in_one&lang=vi
 *     signed in  →  /services?plan=all_in_one&lang=vi
 *
 * A signed-out visitor goes to `/start`, not to a password field. That is the V13 rule this section inherits
 * rather than re-litigates: `/start` answers "would a Korean university take someone like me?" without an
 * account and offers registration once it has something useful to say, and the student app carries `plan`
 * through registration in its own `next`. A button that says "start" and opens a login form has not started
 * anything — and the CTA deliberately does **not** open a payment, because the product principle is
 * MARKETING → AUTH → PLATFORM → SERVICE SELECTION.
 */
export function planAction(plan: string, authenticated: boolean, locale?: string): string {
  const q = `plan=${encodeURIComponent(plan)}`;
  if (authenticated) return studentUrl(`/services?${q}`, locale);
  // V17: a signed-out visitor who has *chosen a plan* has already decided; sending them through the quick
  // check would be making them answer three questions to buy something they just picked. They go straight
  // to registration with the plan on the URL, and the student app carries it through to `/services`.
  // The quick check remains the destination of the **undirected** CTA (`prepareAction`), where the visitor
  // has not chosen anything yet and the free answer is the thing that earns the sale.
  return studentUrl(`/register?next=${encodeURIComponent(`/services?${q}`)}`, locale);
}
