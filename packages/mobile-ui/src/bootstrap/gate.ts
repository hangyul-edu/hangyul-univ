/**
 * Owner pass 261119 (req 2) — what the root shows for a session state. Pure, so the student app unit-tests it.
 *
 * While the session restores the answer is always the neutral brand splash — never a sign-in or sign-up form that a
 * moment later becomes the other one, or the app.
 */
export type AuthStatusLike = 'loading' | 'unavailable' | 'anonymous' | 'authenticated' | (string & {});
export type GateView = 'splash' | 'unavailable' | 'auth' | 'app';

export function authGateView(status: AuthStatusLike, hold = false): GateView {
  if (status === 'loading') return 'splash';
  if (status === 'unavailable') return 'unavailable';
  if (status === 'anonymous' || hold) return 'auth';
  return 'app';
}
