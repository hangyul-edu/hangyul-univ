/** `/__dev` — development tooling for the public site. Compiled out of a production build (brief Part 1). */
import { DevToolsPage } from '@hangyul/ui';

import { agencyUrl, studentUrl, universityUrl } from '../lib/env';

export default function DevTools() {
  return (
    <DevToolsPage
      product="marketing"
      title="Hangyul Univ"
      links={[
        { label: 'API documentation', href: '/api/v1/docs' },
        { label: 'Institution directory (regions)', href: '/api/v1/directory/regions' },
        { label: 'Student app', href: studentUrl('/__dev', 'en') },
        { label: 'Agency console', href: agencyUrl('/__dev', 'en') },
        { label: 'University console', href: universityUrl('/__dev', 'en') },
      ]}
      notes={
        <p className="hg-devtools__note">
          The public directory is real data: <code>server/app/data/korean_institutions.json</code>, built by{' '}
          <code>scripts/catalog/import_korean_universities.py</code> from 대학알리미, Study in Korea and Wikidata.
          The application catalogue — programmes, costs, intakes, requirements — is seeded sample data and never
          reaches a public surface.
        </p>
      }
    />
  );
}
