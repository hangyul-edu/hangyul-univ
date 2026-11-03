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
 * `/explore` and its two aliases stay open deliberately: it is the same discovery the public site offers,
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
  '/explore', '/universities', '/matches', '/saved', '/compare', '/budget', '/scholarships',
  '/start', '/sponsor',
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
  return `/services?gate=${encodeURIComponent(pathname.replace(/^\//, '').split('/')[0] || 'home')}&from=${encodeURIComponent(from)}`;
}
