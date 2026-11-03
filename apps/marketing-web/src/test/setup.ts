import '@testing-library/jest-dom/vitest';

import { initI18n } from '@hangyul/i18n';

// Real English strings so tests assert what users actually read.
await initI18n({ namespaces: ['marketing', 'common'], locale: 'en' });
