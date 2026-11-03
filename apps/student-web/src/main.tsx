import '@hangyul/ui/styles.css';
import './styles/app.css';

import { installKeyRecorder } from '@hangyul/i18n';
import { AppProviders, bootWebApp } from '@hangyul/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { UserLocale } from './components/UserLocale';
import { router } from './router';

// V20 — `marketing` joins the student bundle because the shared university components
// (`@hangyul/ui/university`) read their strings from it. That is deliberate: one set of components
// drawing one content record has to have one set of strings, or the public page and the signed-in page
// drift apart again (brief §54). It is ~30 KB of JSON the app already ships for 33 locales.
bootWebApp({ client: 'student', namespaces: ['student', 'success', 'dossier', 'writing', 'visaroute', 'concierge', 'marketing'] }).then(({ api, queryClient }) => {
  // V9 l10n manifest: dev-only, opt-in key recorder (localStorage hg.recordKeys = '1' → window.__hgKeys). No-op otherwise.
  if (import.meta.env.DEV) installKeyRecorder();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders api={api} queryClient={queryClient}>
        <UserLocale />
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
});
