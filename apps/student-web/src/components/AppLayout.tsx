import { useApi } from '@hangyul/auth';
import {
  BookOpenCheck, ChevronDown, Compass, FileText, GraduationCap, Home, House, LifeBuoy, Menu, MessageCircle,
  Plane, Settings, ShoppingBag, Stamp, User, Users,
} from '@hangyul/icons';
import { Button, Popover, RequireAuth, StudentShell, type NavItem } from '@hangyul/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';

import { CompareProvider } from '../lib/compare';
import { useT } from '../lib/i18n';
import { KOREA_STAGES, NAV_SLOTS, SLOT_PATH, navStage, type NavSlot, type NavStage } from '../lib/nav';
import { useConversations, useDashboard, useMyPlan } from '../lib/queries';
import { gateRedirect, isOpenToUnpaid } from '../lib/access';
import { CompareTray } from './CompareTray';

export interface MoreLink { to: string; label: string; icon: ReactNode; hint: string; group: 'prepare' | 'korea' | 'account' }

/** The current navigation stage (V8): from the cached dashboard; "apply" until it arrives. */
export function useNavStage(): NavStage {
  const d = useDashboard();
  return navStage(d.data?.journey.stage, d.data?.visa?.status);
}

/**
 * The menu behind the rail (REPORT §76.3). V10 listed sixteen destinations here; V11 lists at most ten, and
 * usually seven, because three of them were doing a job something else already does:
 *
 *   Tasks      removed — the home screen *is* the student's task list, so this was the same page twice.
 *   Compare    removed — comparison is a mode of Universities, reached from the catalogue itself.
 *   Korea      visa / housing / arrival appear only once an offer makes them real, instead of sitting in the
 *              menu for months as steps the student cannot take yet.
 *
 * Every route still exists and every deep link still resolves (`Routes.tsx` is unchanged); what changed is
 * which of them claim a permanent slot in the student's mental model.
 *
 * V22 (REPORT §248 S4) takes two more out of the menu, keeping their routes:
 *
 *   Essays     reached from Documents' "Writing" link (`/essays` still resolves).
 *   Budget     a section of Compare (`/budget` redirects to `/compare#budget`).
 *   Notifications were never here — the bell is the entry point and `/notifications` still resolves.
 */
export function useMoreLinks(): MoreLink[] {
  const { t } = useT();
  const stage = useNavStage();
  const slots = new Set(NAV_SLOTS.map((s) => SLOT_PATH[s]));
  const korea = KOREA_STAGES.includes(stage);
  const late = stage === 'arrival' || stage === 'admitted';
  const all: MoreLink[] = [
    // Prepare — the documents and writing a student may want to see across all their applications at once.
    { to: '/documents', label: t('common:nav.documents'), icon: <FileText />, hint: t('more.hint.documents'), group: 'prepare' },
    { to: '/scholarships', label: t('common:nav.scholarships'), icon: <GraduationCap />, hint: t('more.hint.scholarships'), group: 'prepare' },
    // The family (sponsor) link lives next to the money it mostly explains.
    { to: '/family', label: t('v9.family.nav'), icon: <Users />, hint: t('v9.family.navHint'), group: 'prepare' },
    // Korea — only when the student is actually going there.
    ...(korea ? [
      { to: '/visa', label: t('common:nav.visa'), icon: <Stamp />, hint: t('more.hint.visa'), group: 'korea' as const },
      { to: '/housing', label: t('common:nav.housing'), icon: <House />, hint: t('more.hint.housing'), group: 'korea' as const },
      { to: '/arrival', label: t('common:nav.arrival'), icon: <Plane />, hint: t('more.hint.arrival'), group: 'korea' as const },
    ] : []),
    // One help entry: concierge help once Korea is near, team support before that. Both routes stay valid.
    late
      ? { to: '/help', label: t('concierge:help.navLabel'), icon: <LifeBuoy />, hint: t('concierge:help.navHint'), group: 'korea' }
      : { to: '/support', label: t('more.support'), icon: <LifeBuoy />, hint: t('more.hint.support'), group: 'account' },
    { to: '/profile', label: t('common:nav.profile'), icon: <User />, hint: t('more.hint.profile'), group: 'account' },
    { to: '/services', label: t('common:nav.services'), icon: <ShoppingBag />, hint: t('more.hint.services'), group: 'account' },
    { to: '/settings', label: t('common:nav.settings'), icon: <Settings />, hint: t('more.hint.settings'), group: 'account' },
  ];
  return all.filter((l) => !slots.has(l.to));
}

function MoreMenu() {
  const { t } = useT();
  const links = useMoreLinks();
  return (
    <>
      <span className="hg-desktop-only">
        <Popover width={248} align="end" trigger={(p) => <Button variant="ghost" size="sm" iconEnd={<ChevronDown />} {...p}>{t('more.title')}</Button>}>
          {(close) => (
            <nav aria-label={t('more.title')}>
              {(['prepare', 'korea', 'account'] as const).map((g) => (
                <div key={g}>
                  <div className="hg-menu-label">{t(`more.group.${g}`)}</div>
                  {links.filter((l) => l.group === g).map((l) => (
                    <Link key={l.to} to={l.to} className="hg-menu-item" onClick={close}>{l.icon}<span className="hg-grow">{l.label}</span></Link>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </Popover>
      </span>
      {/* V17: there is no mobile branch here any more. 더보기 was a sixth control in a 390 px top bar and is
          now the fifth **bottom** tab (brief §34) — the same destination, in the place a phone user's thumb
          already is. The desktop popover is unchanged. */}
    </>
  );
}

/* V19: `ScrollToTop` is gone. It reset the scroll on every pathname change and could never restore one,
   so Back from an application to the middle of the applications list always landed at the top. The policy
   now lives in `StudentShell` via `@hangyul/ui › RouteScrollManager`, which handles POP, hash targets and
   query-only changes as well. */

function Shell() {
  const { t } = useT();
  const api = useApi();
  const conv = useConversations();
  const docs = useQuery({ queryKey: ['documents', {}], queryFn: () => api.documents.list({ page_size: 100 }), staleTime: 60_000 });
  const unread = (conv.data ?? []).reduce((s, c) => s + c.unread, 0);
  const fix = (docs.data?.items ?? []).filter((d) => d.status === 'NEEDS_CORRECTION' || d.status === 'EXPIRED').length;

  // Four fixed destinations. A document needing correction still has to be noticeable, so that count rides on
  // Applications — the place the student fixes it — rather than bringing a Documents tab back into the rail.
  const SLOT: Record<NavSlot, Omit<NavItem, 'to'>> = {
    home: { label: t('common:nav.home'), icon: <Home />, end: true },
    universities: { label: t('common:nav.universities'), icon: <Compass /> },
    applications: { label: t('common:nav.applications'), icon: <BookOpenCheck />, badge: fix },
    messages: { label: t('common:nav.messages'), icon: <MessageCircle />, badge: unread },
  };
  const links: NavItem[] = NAV_SLOTS.map((s) => ({ to: SLOT_PATH[s], ...SLOT[s] }));
  /*
   * **The bottom bar is five, and 더보기 is the fifth** (V17, brief §34).
   *
   * The rail stays the four fixed destinations it has been since V11 — they are the four questions a
   * student has, and they do not rotate with the journey. What changes is that the menu stops living in the
   * top bar, where it was a sixth control at 390 px and the only way to reach eight secondary destinations.
   *
   * It is a tab rather than a sheet because the destination already exists: `/more` is a real page with the
   * links grouped by journey, and making it a tab costs one slot and removes one control from the header.
   */
  const tabs: NavItem[] = [...links, { to: '/more', label: t('common:nav.journey'), icon: <Menu /> }];
  return (
    <CompareProvider>
      <PlanGate />
      <StudentShell links={links} tabs={tabs} right={<MoreMenu />}>
        <Outlet />
      </StudentShell>
      <CompareTray />
    </CompareProvider>
  );
}

/**
 * **The paywall** (V17, REPORT §148).
 *
 * A signed-in student with no paid plan is sent to `/services` when they ask for a managed-service route,
 * carrying the route they asked for so the plan screen can say why they are there. Everything that belongs
 * to the *account* rather than to the *service* stays open — see `lib/access.ts` for the line and why it is
 * drawn there.
 *
 * It renders nothing. It is a redirect, expressed as a component so it sits inside the router's context and
 * runs on every navigation, and it waits for the plan query rather than guessing: redirecting on a
 * still-loading answer would throw a paying student onto a pricing page every time they opened the app.
 *
 * **V19 — an unknown answer is not a "no".** That reasoning was right and the implementation only covered
 * half of it: the guard tested `isLoading`, so the moment `GET /me/plan` *failed* the query left the
 * loading state with no data, `paid` evaluated to `false`, and a student who had paid was redirected to the
 * pricing page with `?gate=documents` on the URL — telling them to buy something they already own because
 * the server returned a 500 or the train went into a tunnel. The V19 error matrix found it on the
 * `offline` and `500` rows of every gated page (REPORT §207); no existing test could have, because they
 * all run against a healthy API.
 *
 * A gate may only act on a definite answer. An error, or no data at all, means "not known", and the right
 * behaviour for "not known" is to let the page render and show its own error state — a student who cannot
 * reach the API has a connectivity problem, not an entitlement problem.
 */
function PlanGate() {
  const q = useMyPlan();
  const loc = useLocation();
  const nav = useNavigate();
  const paid = !!q.data?.plan;
  const known = !q.isLoading && !q.isError && q.data !== undefined;
  useEffect(() => {
    if (!known || paid) return;
    if (isOpenToUnpaid(loc.pathname)) return;
    nav(gateRedirect(loc.pathname, loc.search), { replace: true });
  }, [known, paid, loc.pathname, loc.search, nav]);
  return null;
}

export default function AppLayout() {
  return (
    <RequireAuth>
      <Shell />
    </RequireAuth>
  );
}
