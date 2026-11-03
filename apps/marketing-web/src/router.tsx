import { createBrowserRouter } from 'react-router';

import { routes } from './routes';

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
