import '@testing-library/jest-dom/vitest';

import { initI18n } from '@hangyul/i18n';

// Real English strings so tests assert what students actually read.
// `marketing` is in the list for the same reason it is in `main.tsx`: the approved plan content lives in
// that namespace and the student plan screen renders it (`@hangyul/types` → `PLAN_PRESENTATION`).
await initI18n({ namespaces: ['common', 'student', 'success', 'dossier', 'writing', 'visaroute', 'concierge', 'marketing'], locale: 'en' });
