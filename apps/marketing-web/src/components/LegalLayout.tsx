/**
 * The layout every Hangyul policy document uses (V12, brief Part 2).
 *
 * What it is not, deliberately: V11's legal pages opened on a full-bleed night photograph of Seoul traffic with
 * the word "Draft" over it, dropped the table of contents and every heading flush against x=0 because the narrow
 * container never applied, and closed with a "Start studying in Korea now" marketing band. A policy is a
 * document somebody reads to find one clause, not a landing page.
 *
 * So: the standard floating Hangyul pill at the top, then a restrained header — eyebrow, title, one line of
 * summary, the effective date — then a single column capped at a real reading measure. Sticky section
 * navigation beside it on wide screens only, where there is room for it without stealing from the measure; a
 * disclosure above the text on anything narrower. No hero image, no card, no closing call to action.
 *
 * The 820px measure is the body width, not the page width: at 16px/1.8 that is roughly 80–90 characters a line
 * in Korean and 95 in English, which is the upper end of comfortable and the width Stripe, Wise and Apple all
 * land near for the same kind of document.
 */
import { useLocale } from '@hangyul/i18n';
import { cx } from '@hangyul/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useNoClosingCta } from './blocks';

export interface LegalSection {
  /** Anchor id, and the i18n key suffix for its heading. */
  id: string;
  heading: string;
  body: ReactNode;
}

/**
 * Highlights the section currently in view. Reading position, not navigation state — so it is observed rather
 * than written to the URL, and a policy page never fills the back button with twelve anchor entries.
 */
function useActiveSection(ids: string[], enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !ids.length) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        // The heading nearest the top that is on screen at all wins; ratio breaks ties on long sections.
        const visible = ids.filter((id) => (seen.get(id) ?? 0) > 0);
        setActive(visible[0] ?? null);
      },
      // Treat the top ~12% of the viewport as "read already": otherwise the section under the fixed header
      // stays highlighted after the reader has scrolled past it.
      { rootMargin: '-12% 0px -70% 0px', threshold: [0, 0.01, 0.5] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids, enabled]);
  return active;
}

export function LegalLayout({
  eyebrow,
  title,
  summary,
  effective,
  sections,
  footNote,
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  /** Rendered only when a real configured date exists. Never "to be confirmed". */
  effective?: string | null;
  sections: LegalSection[];
  footNote?: ReactNode;
}) {
  const { t } = useLocale(['marketing', 'common']);
  // A policy page carries no marketing call to action (brief Part 2).
  useNoClosingCta();

  const ids = useRef(sections.map((s) => s.id));
  ids.current = sections.map((s) => s.id);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    // Guarded because jsdom has no `matchMedia`: unguarded, this threw during render and took the whole
    // page with it, so `/privacy` and `/terms` rendered an error boundary under the live smoke test while
    // being perfectly fine in a browser. A missing `matchMedia` means "assume the narrow layout", which is
    // the same answer the hook already gives before the first match.
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1200px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const active = useActiveSection(ids.current, wide);

  const toc = (
    <ol className="mk-legal__toclist">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className={cx(active === s.id && 'is-current')} aria-current={active === s.id ? 'true' : undefined}>
            <span className="mk-legal__tocn" aria-hidden>{i + 1}</span>
            {s.heading}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mk-legal">
      {/* The header sits *inside* the content column, not above the whole page. Centring it independently of
          the grid left the title and the body text on two different left edges — about 140px apart at 1440px,
          which reads as a broken template however carefully each half is set. One column, one edge. */}
      <div className="mk-legal__grid">
        {/* Wide screens get the sticky rail; everything else gets a disclosure that does not eat the measure. */}
        <nav className="mk-legal__rail" aria-label={t('article.onThisPage')}>
          <p className="mk-legal__railtitle">{t('article.onThisPage')}</p>
          {toc}
        </nav>

        <div className="mk-legal__main">
          <header className="mk-legal__head">
            {eyebrow && <p className="mk-legal__eyebrow">{eyebrow}</p>}
            <h1 className="mk-legal__title">{title}</h1>
            <p className="mk-legal__summary">{summary}</p>
            {effective && <p className="mk-legal__effective">{effective}</p>}
          </header>

          <details className="mk-legal__toc">
            <summary>{t('article.onThisPage')}</summary>
            {toc}
          </details>

          <div className="mk-legal__prose">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mk-legal__section">
                <h2 id={`${s.id}-h`}>
                  <span className="mk-legal__num" aria-hidden>{i + 1}</span>
                  {s.heading}
                </h2>
                {s.body}
              </section>
            ))}
          </div>

          {footNote && <div className="mk-legal__foot">{footNote}</div>}
        </div>
      </div>
    </div>
  );
}

/** A table that wraps on a phone instead of clipping. Used for the processing and retention tables. */
export function LegalTable({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="mk-legal__tablewrap">
      <table className="mk-legal__table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                // The first column is the row's own heading, which is what lets the table linearise
                // readably when it stacks at phone width.
                j === 0
                  ? <th key={j} scope="row" data-label={head[j]}>{cell}</th>
                  : <td key={j} data-label={head[j]}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
