import { FullPageLoader, RequireAuth } from '@hangyul/ui';
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';

import { AppLayout } from './components/AppLayout';
import { UniversityProvider } from './lib/university';

/** V22: old Pipeline / board links land on the work table with their filters (the board is gone, REPORT §250 V3). */
function WorkRedirect({ stage }: { stage?: string }) {
  const { search } = useLocation();
  const sp = new URLSearchParams(search);
  sp.delete('view');
  if (stage) { sp.delete('status'); sp.set('stage', stage); }
  const s = sp.toString();
  return <Navigate to={s ? `/?${s}` : '/'} replace />;
}

/** Route-level code splitting: each page ships in its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

export const routes = [
  { path: '/login', lazy: page(() => import('./pages/Login')), hydrateFallbackElement: <FullPageLoader /> },
  // Development tooling, outside the authenticated shell because its job is to get you into it. Note this
  // router's `page()` is used as `lazy: page(…)`, not spread — spreading it renders nothing (REPORT §80.2).
  ...(import.meta.env.DEV ? [{ path: '/__dev', lazy: page(() => import('./pages/DevTools')) }] : []),
  {
    path: '/',
    element: (
      <RequireAuth>
        <UniversityProvider>
          <AppLayout />
        </UniversityProvider>
      </RequireAuth>
    ),
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      /*
       * V22 navigation (REPORT §250 V2): 지원자 (/) · 메시지 · 통계 · 설정. `/applicants` is the same screen as `/`.
       * Offers was a state of an applicant, so it is the "admitted" stage of the strip; the board view is gone.
       * Everything administrative keeps its route and is reached from /manage.
       */
      { index: true, lazy: page(() => import('./pages/Dashboard')) },
      { path: 'applicants', lazy: page(() => import('./pages/Dashboard')) },
      { path: 'applications/:id', lazy: page(() => import('./pages/ApplicationDetail')) },
      { path: 'pipeline', element: <WorkRedirect /> },
      { path: 'offers', element: <WorkRedirect stage="admitted" /> },
      { path: 'funnel', element: <Navigate to="/analytics" replace /> },
      { path: 'students', element: <Navigate to="/cohorts" replace /> },
      { path: 'programs', lazy: page(() => import('./pages/Programs')) },
      { path: 'rules', lazy: page(() => import('./pages/AdmissionRules')) }, // → Programs & rules (keeps ?program=)
      { path: 'documents', lazy: page(() => import('./pages/Documents')) },
      { path: 'scholarships', lazy: page(() => import('./pages/Scholarships')) },
      { path: 'agencies', lazy: page(() => import('./pages/Agencies')) },
      { path: 'cohorts', lazy: page(() => import('./pages/Cohorts')) },
      { path: 'cohorts/:tab', lazy: page(() => import('./pages/Cohorts')) },
      { path: 'lifecycle', lazy: page(() => import('./pages/Cohorts')) },
      { path: 'retention', lazy: page(() => import('./pages/Cohorts')) },
      { path: 'graduation', lazy: page(() => import('./pages/Cohorts')) },
      { path: 'analytics', lazy: page(() => import('./pages/Analytics')) },
      { path: 'messages', lazy: page(() => import('./pages/Messages')) },
      { path: 'messages/:id', lazy: page(() => import('./pages/Messages')) },
      { path: 'exports', lazy: page(() => import('./pages/Exports')) },
      { path: 'partnership', lazy: page(() => import('./pages/Partnership')) },
      { path: 'manage', lazy: page(() => import('./pages/Manage')) },
      { path: 'settings', lazy: page(() => import('./pages/Settings')) },
      { path: 'notifications', lazy: page(() => import('./pages/Notifications')) },
      { path: '*', lazy: page(() => import('./pages/NotFound')) },
    ],
  },
];

/*
 * The router is mounted where the build says it is (V17).
 *
 * `BASE_URL` is Vite's own build-time constant: `/` for the dev server and a normal deployment, and the
 * subdirectory for a bundle served from one — which is how the server-free review build puts four apps
 * side by side under a single origin. Without the basename every route under `/marketing/` missed and the
 * whole app rendered its 404 page, which is exactly what the first review build did.
 *
 * `createBrowserRouter` wants a basename without a trailing slash, and an empty string rather than `/`.
 */
const BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export const router = createBrowserRouter(routes, BASENAME ? { basename: BASENAME } : undefined);
