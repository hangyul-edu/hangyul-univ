/** `/__dev` — development tooling for the university app. Compiled out of a production build (brief Part 1). */
import { DevToolsPage } from '@hangyul/ui';

export default function DevTools() {
  return (
    <DevToolsPage
      product="university"
      title="Hangyul university"
      links={[{ label: 'API documentation', href: '/api/v1/docs' }, { label: 'openapi.json', href: '/openapi.json' }]}
      notes={
        <p className="hg-devtools__note">
          Every student, counsellor, organisation, application, price and partnership in this environment is
          seeded sample data. The only real dataset in the product is the public Korean institution directory
          (<code>server/app/data/korean_institutions.json</code>).
        </p>
      }
    />
  );
}
