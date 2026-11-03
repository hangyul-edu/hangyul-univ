// V7: YNEX (licensed template) is the console foundation — template CSS first, shared base, then the YNEX skin.
import '@hangyul/ynex-ui/styles.scss';
import '@hangyul/ui/styles.css';
import '@hangyul/ynex-ui/skin.scss';
import './styles/base.css';
// V22 — the white console surface: last import on purpose, it re-points what the skin above defined (REPORT §249 G7).
import '@hangyul/ui/console-v22.css';
// V26: every screen composition in one canonical file, after the white surface (REPORT §347).
import './styles/screens.css';

import { AppProviders, bootWebApp } from '@hangyul/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from './router';

bootWebApp({ client: 'agency', namespaces: ['agency', 'success', 'dossier', 'writing', 'visaroute', 'concierge'] }).then(({ api, queryClient }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders api={api} queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
});
