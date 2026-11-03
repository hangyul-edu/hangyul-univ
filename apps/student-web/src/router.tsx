import { FullPageLoader } from '@hangyul/ui';
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import AppLayout from './components/AppLayout';
import { RouteError } from './pages/NotFound';

/** Route-level code splitting: each page is its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

export const routes: RouteObject[] = [
  { path: '/login', ...page(() => import('./pages/Login')) },
  // Development tooling, outside the authenticated shell because its job is to get you into it.
  // The whole branch is compiled out of a production build (brief Part 1).
  ...(import.meta.env.DEV ? [{ path: '/__dev', ...page(() => import('./pages/DevTools')) }] : []),
  { path: '/register', ...page(() => import('./pages/Register')) },
  { path: '/forgot', ...page(() => import('./pages/ForgotPassword')) },
  { path: '/start', ...page(() => import('./pages/Start')) },
  // V9 S3: the read-only family (sponsor) view — public, no login; the token is the only key.
  { path: '/sponsor/:token', ...page(() => import('./pages/Sponsor')) },
  { path: '/eligibility', element: <Navigate to="/start" replace /> },
  { path: '/onboarding', element: <Navigate to="/profile" replace /> },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      { index: true, ...page(() => import('./pages/Dashboard')) },
      { path: 'explore', ...page(() => import('./pages/Explore')) },
      { path: 'universities/:slug', ...page(() => import('./pages/University')) },
      { path: 'matches', element: <Navigate to="/explore?tab=foryou" replace /> },
      { path: 'saved', element: <Navigate to="/explore?tab=saved" replace /> },
      // V23 crawl: an old task link pointed at /writing; the student's writing lives at /essays.
      { path: 'writing', element: <Navigate to="/essays" replace /> },
      { path: 'compare', ...page(() => import('./pages/Compare')) },
      { path: 'budget', ...page(() => import('./pages/Budget')) },
      { path: 'family', ...page(() => import('./pages/Family')) },
      { path: 'applications', ...page(() => import('./pages/Applications')) },
      { path: 'applications/:id', ...page(() => import('./pages/ApplicationDetail')) },
      { path: 'documents', ...page(() => import('./pages/Documents')) },
      { path: 'essays', ...page(() => import('./pages/Essays')) },
      { path: 'essays/:id', ...page(() => import('./pages/EssayEditor')) },
      { path: 'tasks', ...page(() => import('./pages/Tasks')) },
      { path: 'messages', ...page(() => import('./pages/Messages')) },
      { path: 'messages/:id', ...page(() => import('./pages/Messages')) },
      { path: 'notifications', ...page(() => import('./pages/Notifications')) },
      { path: 'visa', ...page(() => import('./pages/Visa')) },
      { path: 'housing', ...page(() => import('./pages/Housing')) },
      { path: 'arrival', ...page(() => import('./pages/Arrival')) },
      { path: 'help', ...page(() => import('./pages/Help')) },
      { path: 'scholarships', ...page(() => import('./pages/Scholarships')) },
      { path: 'services', ...page(() => import('./pages/Services')) },
      // Toss returns the buyer to these two paths; the server's own `success_url` / `fail_url` are built
      // from them, so they are a contract, not a convenience. They sit inside the authenticated shell
      // because confirming a payment requires the session that created the order.
      { path: 'services/payment/success', lazy: async () => ({ Component: (await import('./pages/PaymentReturn')).PaymentSuccess }) },
      { path: 'services/payment/fail', lazy: async () => ({ Component: (await import('./pages/PaymentReturn')).PaymentFail }) },
      { path: 'support', ...page(() => import('./pages/Support')) },
      { path: 'profile', ...page(() => import('./pages/Profile')) },
      { path: 'settings', ...page(() => import('./pages/Settings')) },
      { path: 'more', ...page(() => import('./pages/More')) },
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
