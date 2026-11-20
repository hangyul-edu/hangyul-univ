/**
 * **What an account gets, and what a purchase gets (V17, REPORT §148).**
 *
 * Before V17 an account *was* the product: signing up put a student on the full dashboard with a document
 * locker, an application workspace and a visa case, and there was nothing left for the three plans to sell.
 * The free product is now the public one — a quick check and the university pages on the marketing site,
 * reachable with no account at all — and Hangyul's **managed service** is what the plans buy.
 *
 * The line is drawn around the *service*, not around the account. A student who has signed up but not paid
 * keeps everything that is theirs:
 *
 *   gated      / · /applications · /documents · /essays · /visa · /housing · /arrival · /messages · /tasks
 *   open        everything else
 *
 * The rule behind that list, in one sentence: **a plan buys Hangyul's labour, not access to your own
 * information or to public facts.** A counsellor, a document review, an essay review, a managed application
 * and a visa case are work people do; a saved university, a budget estimate built from published tuition, a
 * scholarship listing and a student's own profile are not.
 *
 * Locking someone out of their own profile because they have not bought anything would be a different and
 * worse product. Locking them out of a counsellor, a document review and a visa case is the product.
 *
 * Home is gated because it *is* the managed service — next actions, deadlines, the document locker's state.
 * For an unpaid student it would be an empty dashboard, and an empty dashboard explains nothing; the plan
 * screen with a reason on it does.
 *
 * **`/match` is gated (261119, owner requirement 1).** Personalised matching and university selection is the
 * first thing a plan buys: marketing `유학 준비` → sign-in → (no plan) the plan screen with `from=/match` → after
 * paying, back to `/match`. The anonymous quick check (`/start`) is retired, and its aliases (`/start`,
 * `/eligibility`, `/matches`) are redirects *outside* the shell to `/match`, so they are gated exactly as it is.
 *
 * `/explore` and its alias `/saved` stay open deliberately: it is the same discovery the public site offers,
 * and a student who has signed up should not have *less* than an anonymous visitor. The aliases matter more
 * than they look — `/matches` and `/saved` are `<Navigate>` to `/explore?tab=…`, so gating them would put a
 * paywall in front of a page that is open at its real URL, which is not a stricter rule but an incoherent
 * one. The e2e lifecycle spec walks exactly that path, and found it.
 */

/** Routes a signed-in student may use before they have bought a plan. Everything else needs one. */
const OPEN = [
  // The account, and the student's own information.
  '/services', '/profile', '/settings', '/more', '/support', '/notifications', '/family', '/help',
  // Discovery and public facts — the same things an anonymous visitor gets, plus the aliases of /explore.
  // `/explore` stays open; its "For you" tab shows a student without a plan the way to one (pages/Explore.tsx).
  '/explore', '/universities', '/saved', '/compare', '/budget', '/scholarships',
  '/sponsor',
];

/** Paths that are always reachable, whatever the plan state — auth and payment return included. */
const ALWAYS = ['/login', '/register', '/services/payment'];

export function isOpenToUnpaid(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (ALWAYS.some((a) => p === a || p.startsWith(`${a}/`))) return true;
  return OPEN.some((a) => p === a || p.startsWith(`${a}/`));
}

/**
 * Where an unpaid student is sent, carrying **why**. The reason is not decoration: `/services` uses it to
 * say "지원 관리는 플랜을 선택한 뒤 이용할 수 있어요" rather than dropping someone on a pricing page with no
 * explanation of how they got there, which is the thing that makes a paywall feel like an error.
 */
export function gateRedirect(pathname: string, search: string): string {
  const from = `${pathname}${search || ''}`;
  const out = new URLSearchParams({ gate: pathname.replace(/^\//, '').split('/')[0] || 'home', from });
  // A plan chosen on the public pricing section (`?plan=`) stays preselected on the plan screen.
  const plan = new URLSearchParams(search).get('plan');
  if (plan) out.set('plan', plan);
  return `/services?${out.toString()}`;
}

/**
 * Where a student goes after buying a plan: the gated route they were sent from (`?from=`), when it is a safe in-app
 * path that is not the plan screen itself; otherwise `null` (stay on the plan screen, which then shows the plan).
 * `from=app` is the native-app handoff (`lib/apphandoff.ts`), not a path.
 */
export function purchaseReturn(from: string | null | undefined): string | null {
  if (!from || from[0] !== '/' || from[1] === '/' || from[1] === '\\') return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(from)) return null;
  if (/^\/(services|login|register|forgot)(?:[/?#]|$)/.test(from)) return null;
  return from;
}
