import { FullPageLoader } from '@hangyul/ui';
import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';

import { SiteLayout } from './components/SiteLayout';

const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

/**
 * V11 public information architecture — six routes (REPORT §75.1), down from fourteen.
 *
 * A prospective student needs to want Korea, see where they could study, and sign in. Everything that used to
 * explain the service in prose (`/how-it-works`, `/students`, `/trust`, `/guides/*`) is either a section of the
 * homepage now or was content we could not ship honestly; everything that sold to a university or an agency is
 * gone from the public site entirely.
 *
 * `/credits` is **retired** in V14 (brief Part 3). It existed because 13 of the 19 photographs were licensed
 * CC BY, which requires attribution — so the page was a legal obligation wearing the clothes of a content
 * page, and it read to a prospective student as a research bibliography. The obligation is discharged at the
 * source instead: every photograph on a customer surface is now Hangyul-owned or CC0, recorded in
 * `docs/MEDIA_LICENSE_AUDIT.md`, and none of them requires visible attribution. The factual provenance that
 * page also carried (institution sources, survey years) was never the customer's: it already appears, in a
 * restrained 공식 정보 section, on the university detail page it belongs to.
 *
 * The route redirects rather than 404s, because it was linked from the footer of every page for two versions.
 */
export const REDIRECTS: Record<string, string> = {
  // Each removed path lands on the section that answers the same question. No target is itself a redirect.
  '/how-it-works': '/#services',
  '/students': '/#services',
  '/trust': '/',
  // Retired in V14; redirected rather than removed, because it was in every footer for two versions.
  '/credits': '/',
  '/guides': '/#faq',
  // The B2B pages have no public replacement by design; both consoles keep their own sign-in (footer line).
  '/agencies': '/',
  '/universities-partners': '/',
};

/** `/guides/:slug` and `/guides/country/:code` collapse to the homepage FAQ, whatever the slug was. */
function GuideRedirect() {
  return <Navigate to="/#faq" replace />;
}

export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      { index: true, lazy: page(() => import('./pages/Home')) },
      // V17: the free product. Three questions and a list of universities that fit, no account, no payment
      // — see `pages/Start.tsx` for why it moved here from the student app.
      { path: 'start', lazy: page(() => import('./pages/Start')) },
      { path: 'universities', lazy: page(() => import('./pages/Universities')) },
      { path: 'universities/:slug', lazy: page(() => import('./pages/UniversityDetail')) },
      { path: 'privacy', lazy: page(() => import('./pages/legal/Privacy')) },
      { path: 'terms', lazy: page(() => import('./pages/legal/Terms')) },
      ...Object.entries(REDIRECTS).map(([from, to]) => ({ path: from.slice(1), element: <Navigate to={to} replace /> })),
      { path: 'guides/*', element: <GuideRedirect /> },
      { path: '*', lazy: page(() => import('./pages/NotFound')) },
    ],
  },
];
