/**
 * Launch-final route inventory and viewport matrix — the single list every launch-final check reads.
 *
 * `public`  — reachable without a session.
 * `preview` — signed-in routes, visited in Design Preview mode (synthetic fixtures; no API, no real session).
 */
export const PREVIEW_KEY = 'hg.designPreview';

export const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

export const ROUTES = {
  marketing: {
    public: ['/', '/universities', '/universities/seoul-national-university', '/privacy', '/terms', '/no-such-page'],
    preview: [],
  },
  student: {
    public: ['/login', '/register', '/forgot'],
    previewVariant: 'paid',
    preview: [
      '/', '/explore', '/applications', '/documents', '/essays', '/tasks', '/messages', '/notifications', '/services',
      '/scholarships', '/compare', '/family', '/visa', '/housing', '/arrival', '/help', '/support', '/profile', '/settings', '/more',
      // Detail pages (synthetic ids from packages/api-client/src/preview/student*.json).
      '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56', '/applications/c62c31ff-5e45-4b21-bca1-bc9b924275d4',
      '/applications/38899d7f-dc4d-43a5-bc6a-db7448c5e103', '/messages/0b312dca-149b-40e0-94f7-f67e002cca7d',
      '/essays/b180b72a-e7b9-4ac3-a91a-6df3eac7bf35', '/essays/15d2d4d4-abaf-485c-9bad-a9b08f6eebe2',
      '/documents?doc=ad758056-5c28-4758-802c-0e081958c47f', '/universities/pusan-national-university',
      '/universities/pusan-national-university?tab=admissions', '/universities/pusan-national-university?tab=costs',
      '/universities/kyungpook-national-university', '/universities/sungkyunkwan-university', '/budget',
    ],
  },
  agency: {
    public: ['/login'],
    preview: [
      '/', '/students', '/tasks', '/review', '/applications', '/messages', '/services', '/performance', '/universities',
      '/templates', '/team', '/payments', '/submissions', '/notifications', '/settings',
      // Detail pages and views (synthetic ids from packages/api-client/src/preview/agency*.json).
      '/tasks?view=meetings',
      '/tasks?view=deadlines',
      '/review?mode=writing',
      '/review?mode=writing&view=team',
      '/review?mode=submissions',
      '/messages/84a80fb9-97f6-4d60-b78f-1e13baf3021a',
      '/messages/b0191681-6a63-4866-a258-6eea2983cee1',
      '/services?view=completed',
      '/vendors',
      '/performance?tab=quality',
      '/performance?tab=outcomes',
      '/universities?tab=universities',
      '/universities/pusan-national-university',
      '/universities/dgist-interdisciplinary',
      '/manage',
      '/audit',
      '/essays/insights',
      '/essays/95f997a0-7831-4532-a64b-dec254e8944a',
      '/essays/b180b72a-e7b9-4ac3-a91a-6df3eac7bf35',
      '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e',
      '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=application',
      '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=communication',
      '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=profile',
      '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=more',
      '/students/c5894db1-f0f6-42bd-b48a-18bfc6ed2c8e?tab=application',
      '/students/7f477f2a-7359-4440-8892-7d073d3ae6a8?tab=application',
      '/students/dec626aa-9d83-4718-b023-482c769eab24?tab=application',
      '/students/dec626aa-9d83-4718-b023-482c769eab24?tab=more',
      '/students/1dfe6951-2f8f-4811-bf2c-a19109808104?tab=profile',
      '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56',
      '/applications/d43b2511-2103-4f9b-afe9-13558701cd97',
      '/applications/99bfc3d4-d053-49b5-b265-4a375d5de565',
      '/submissions?state=issue&application=b9ef1722-e9ee-4b37-bed3-d45622b360fe',
    ],
  },
  university: {
    public: ['/login'],
    preview: [
      '/', '/applicants', '/programs', '/documents', '/scholarships', '/cohorts', '/analytics', '/messages', '/exports',
      '/partnership', '/manage', '/settings', '/notifications',
      // Detail pages and views (synthetic ids from packages/api-client/src/preview/university*.json).
      '/agencies', '/cohorts/list', '/cohorts/risk', '/cohorts/visa', '/rules?program=3a7db8ee-6e17-46b4-8d2a-2ffdd95a400c',
      '/applicants?stage=in_review',
      '/applications/8a3d287f-9d03-4198-8e72-7bfa14a2a3a8', '/applications/176e12ab-679d-467f-8510-be86e1b20ca3',
      '/applications/d4589e32-883d-4e5d-8f4b-01164033b71a', '/applications/2fbf0f72-9ff1-55af-8cb8-aa40c1819fc1',
      '/applications/698809ad-6474-57cc-b7c1-14e7c7bd5631', '/applications/30f9a80f-d47e-532b-af69-e83c706d7bbb',
      '/messages/e19abc3c-03f5-53f1-80b7-96a4c4fbfc42', '/messages/f348e906-b8d4-5683-a858-e08b0d374769',
    ],
  },
};
