/**
 * The development-tools page — one per app, at `/__dev` (V12, brief Part 1).
 *
 * V11 put a floating **DEV** chip in the corner of every screen of all four web apps and all three native ones.
 * It was correctly gated to development builds, and it was still wrong: any screenshot of the product, taken by
 * anyone, contained a badge announcing that the product was a development build. The capability was never the
 * problem — its permanent claim on ordinary product chrome was.
 *
 * So the chip is gone from every layout and everything it did lives here, behind a path nobody reaches by
 * accident. Each app mounts this route inside `import.meta.env.DEV`, so a production build contains neither the
 * route, this component, nor the persona list it imports.
 */
import { useEffect, useState } from 'react';

import { DemoAccessDrawer } from './devaccess';

const IS_DEV: boolean = import.meta.env.DEV;

export interface DevToolsLink { label: string; href: string }

interface Health { ok?: boolean; env?: string; error?: string }

/**
 * @param product which app this is, for the persona picker's ordering
 * @param notes   app-specific facts worth stating — e.g. which data on this surface is real and which is seeded
 */
export function DevToolsPage({
  product,
  title,
  notes,
  links = [],
}: {
  product: 'marketing' | 'student' | 'agency' | 'university';
  title: string;
  notes?: React.ReactNode;
  links?: DevToolsLink[];
}) {
  const [personas, setPersonas] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    if (!IS_DEV) return;
    document.title = `Development tools · ${title}`;
    fetch('/healthz')
      .then((r) => r.json())
      .then(setHealth, (e: Error) => setHealth({ ok: false, error: e.message }));
  }, [title]);

  // Defence in depth: the route is already gated, and the component refuses to render anyway.
  if (!IS_DEV) return null;

  return (
    <div className="hg-devtools">
      <p className="hg-devtools__eyebrow">Development build</p>
      <h1 className="hg-devtools__title">Development tools</h1>
      <p className="hg-devtools__lede">
        Everything here exists only in a development build, is unreachable from the product, and is absent from a
        production bundle. Seed data is synthetic: every person, organisation, price and partnership in this
        environment was generated.
      </p>

      <section className="hg-devtools__section">
        <h2>Demo accounts</h2>
        <button type="button" className="hg-devtools__btn" onClick={() => setPersonas(true)}>
          Open the persona picker
        </button>
        <p className="hg-devtools__note">
          Signs in without a password via <code>POST /auth/demo-login</code>, which production refuses outright.
        </p>
      </section>

      <section className="hg-devtools__section">
        <h2>Services</h2>
        <ul>
          <li>
            API <code>/healthz</code>:{' '}
            {health ? (health.ok ? `ok · env ${health.env}` : `failed · ${health.error ?? 'error'}`) : 'checking…'}
          </li>
          {links.map((l) => (
            <li key={l.href}><a href={l.href}>{l.label}</a></li>
          ))}
        </ul>
      </section>

      {notes && (
        <section className="hg-devtools__section">
          <h2>Data provenance</h2>
          {notes}
        </section>
      )}

      <DemoAccessDrawer product={product === 'marketing' ? 'marketing' : product} open={personas} onClose={() => setPersonas(false)} />
    </div>
  );
}
