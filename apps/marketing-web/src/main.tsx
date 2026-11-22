// V10: Koreanasha (owner-authorised; a customised Eduan build — REPORT §65.1) is the marketing foundation.
// Order: the shared Eduan/Bootstrap chassis → shared base → app styles → Eduan glue → the Koreanasha layer last,
// so Koreanasha's header, hero, bands and cards win wherever the two overlap.
import '@hangyul/eduan-ui/styles.scss';
import '@hangyul/ui/styles.css';
import './styles/base.css';
import '@hangyul/eduan-ui/site.scss';
import '@hangyul/koreanasha-ui/styles.scss';

import { AppProviders, bootWebApp } from '@hangyul/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from './router';

// Performance (product-excellence pass): start the first screen's route chunk while i18n boots. Without this the
// chunk was requested only after boot finished and the router resolved the lazy route — one more round trip in front
// of the LCP element (the home hero headline, a directory or campus photo). The router's lazy import then resolves
// from the module cache.
{
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') void import('./pages/Home');
  else if (path === '/universities') void import('./pages/Universities');
  else if (path.startsWith('/universities/')) void import('./pages/UniversityDetail');
}

// Public site: no login required anywhere. Auth providers are still mounted so shared components work.
bootWebApp({ client: 'marketing', namespaces: ['marketing'] }).then(({ api, queryClient }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders api={api} queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
});
