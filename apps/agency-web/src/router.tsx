import { RequireAuth } from '@hangyul/ui';
import { createBrowserRouter, Navigate, useSearchParams, type RouteObject } from 'react-router';

import { AppLayout } from './components/AppLayout';
import { PageFallback } from './components/PageFallback';

/** Route-level code splitting: each page module default-exports its component. */
const page = (load: () => Promise<{ default: React.ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

/** V8: Deadlines and Consultations are Tasks views now; old links land on the matching view (query kept). */
function ToTasks({ view }: { view: string }) {
  const [sp] = useSearchParams();
  const next = new URLSearchParams(sp);
  // Consultations' own sub-view (?view=follow_up) becomes the meetings bucket; ?days= carries over for deadlines.
  const old = next.get('view');
  if (old && view === 'meetings') next.set('bucket', old);
  next.set('view', view);
  return <Navigate replace to={`/tasks?${next.toString()}`} />;
}

/** V23 §272 A1 — the old Documents/Essays paths open the right Review mode **with their query intact**. Server links
 *  (`/documents?doc=…`, `/documents?student=…`, `/essays?view=overdue`) were landing on the unfiltered queue. */
function ToReview({ mode }: { mode: 'documents' | 'writing' }) {
  const [sp] = useSearchParams();
  const next = new URLSearchParams(sp);
  next.set('mode', mode);
  return <Navigate replace to={`/review?${next.toString()}`} />;
}

export const routes: RouteObject[] = [
  { path: '/login', ...page(() => import('./pages/Login')) },
  // Development tooling, outside the authenticated shell because its job is to get you into it.
  // The whole branch is compiled out of a production build (brief Part 1).
  ...(import.meta.env.DEV ? [{ path: '/__dev', ...page(() => import('./pages/DevTools')) }] : []),
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    hydrateFallbackElement: <PageFallback />,
    children: [
      { index: true, ...page(() => import('./pages/Dashboard')) },
      { path: 'performance', ...page(() => import('./pages/Performance')) },
      { path: 'students', ...page(() => import('./pages/Students')) },
      { path: 'students/:id', ...page(() => import('./pages/StudentWorkspace')) },
      // V22: the process strip on Today replaced the kanban (REPORT §249 G1).
      { path: 'pipeline', element: <Navigate replace to="/" /> },
      // V23 crawl: student-side paths reach staff through shared notifications and activity rows. Each opens the staff
      // screen for the same work instead of the 404 (arrival/housing cases are concierge services; writing is Work).
      { path: 'writing', element: <Navigate replace to="/review?mode=writing" /> },
      { path: 'arrival', element: <Navigate replace to="/services" /> },
      { path: 'housing', element: <Navigate replace to="/services" /> },
      { path: 'visa', element: <Navigate replace to="/students?view=visa" /> },
      { path: 'profile', element: <Navigate replace to="/settings" /> },
      { path: 'scholarships', element: <Navigate replace to="/students" /> },
      { path: 'matches', element: <Navigate replace to="/students" /> },
      { path: 'consultations', element: <ToTasks view="meetings" /> },
      { path: 'tasks', ...page(() => import('./pages/Tasks')) },
      { path: 'services', ...page(() => import('./pages/Services')) },
      { path: 'vendors', ...page(() => import('./pages/Vendors')) },
      { path: 'deadlines', element: <ToTasks view="deadlines" /> },
      { path: 'messages', ...page(() => import('./pages/Messages')) },
      { path: 'messages/:id', ...page(() => import('./pages/Messages')) },
      // V11: one Review area with Documents/Writing modes; the old paths keep working and open the right mode.
      { path: 'review', ...page(() => import('./pages/Review')) },
      { path: 'manage', ...page(() => import('./pages/Manage')) },
      { path: 'documents', element: <ToReview mode="documents" /> },
      { path: 'essays', element: <ToReview mode="writing" /> },
      { path: 'essays/insights', ...page(() => import('./pages/WritingInsights')) },
      { path: 'essays/:id',...page(() => import('./pages/EssayEditor')) },
      { path: 'applications', ...page(() => import('./pages/Applications')) },
      { path: 'applications/:id', ...page(() => import('./pages/Applications')) },
      { path: 'universities', ...page(() => import('./pages/Catalog')) },
      { path: 'universities/:slug', ...page(() => import('./pages/UniversityDetail')) },
      { path: 'templates', ...page(() => import('./pages/Templates')) },
      { path: 'team', ...page(() => import('./pages/Team')) },
      { path: 'payments', ...page(() => import('./pages/Payments')) },
      { path: 'audit', ...page(() => import('./pages/Audit')) },
      { path: 'submissions', ...page(() => import('./pages/Submissions')) },
      { path: 'hq', ...page(() => import('./pages/hq/Operations')) },
      { path: 'hq/agencies', ...page(() => import('./pages/hq/Agencies')) },
      { path: 'hq/manage', ...page(() => import('./pages/hq/Manage')) },
      { path: 'hq/accounts', ...page(() => import('./pages/hq/Accounts')) },
      { path: 'hq/assignments', ...page(() => import('./pages/hq/AssignmentOverride')) },
      { path: 'hq/sources', ...page(() => import('./pages/hq/Sources')) },
      { path: 'hq/readiness', ...page(() => import('./pages/hq/Readiness')) },
      { path: 'notifications', ...page(() => import('./pages/Notifications')) },
      { path: 'settings', ...page(() => import('./pages/Settings')) },
      { path: '*', ...page(() => import('./pages/NotFound')) },
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
