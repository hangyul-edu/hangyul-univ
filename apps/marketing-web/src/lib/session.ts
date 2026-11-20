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
    const r = await fetch('/api/v1/auth/session-hint?client=student', { credentials: 'include', headers: { accept: 'application/json', 'ngrok-skip-browser-warning': '1' } });
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
 * Where the product's **one conversion action** — 유학 준비 — sends this visitor (owner decision 2026-11-19).
 *
 * Signed out → the **Student login**, with `next=/match`. Signed in → `/match` directly.
 *
 * `/match` is the Student app's personalised-matching entry: a student without a paid plan is taken to checkout
 * first, a student with one goes straight to choosing universities. The anonymous Quick Fit that used to sit
 * between this button and the account (`/start`, V13–V32) is retired: the public directory already shows what
 * Korean universities are like, and matching against a student's own profile happens inside the platform, after
 * sign-in and purchase. `/start` itself now redirects here (routes.tsx and the Vercel redirect).
 *
 * The login page links to sign-up carrying the same `next`, so a new visitor loses nothing. `?lang=` (the locale
 * authority, V14) rides beside `next`, which is always an in-app path the Student login re-validates (`safeNext`).
 */
export const MATCH_PATH = '/match';

export function prepareAction(authenticated: boolean, locale?: string): string {
  return studentAction(MATCH_PATH, authenticated, locale);
}

/**
 * Where a *personalised* action should send this visitor — one that names a specific destination inside the
 * platform ("/explore?tab=saved", "/applications"). Signed in → straight there. Anonymous → the student login
 * with `?next=<path>`, so the action resumes after sign-in instead of being lost.
 *
 * The conversion action (`prepareAction` above) is this rule applied to `/match`.
 */
export function studentAction(path: string, authenticated: boolean, locale?: string): string {
  if (authenticated) return studentUrl(path, locale);
  return studentUrl(`/login?next=${encodeURIComponent(path)}`, locale);
}

/**
 * Where a plan CTA on the pricing section ("베이직으로 시작") sends this visitor (V15, brief Part 4 — the plan
 * handoff; owner decision 2026-11-19 for the signed-out branch).
 *
 * Three things have to survive the authentication boundary: the plan they chose, the language they are reading
 * in, and where they were going:
 *
 *     signed out →  <student>/login?next=%2Fservices%3Fplan%3Dall_in_one&lang=vi
 *     signed in  →  <student>/services?plan=all_in_one&lang=vi
 *
 * Signed out goes to the **login**, like every other way into the platform; the login page links to sign-up
 * carrying `next`, so a new visitor registers and still lands on `/services` with the plan selected. The CTA
 * deliberately does **not** open a payment: MARKETING → AUTH → PLATFORM → SERVICE SELECTION.
 */
export function planAction(plan: string, authenticated: boolean, locale?: string): string {
  return studentAction(`/services?plan=${encodeURIComponent(plan)}`, authenticated, locale);
}
