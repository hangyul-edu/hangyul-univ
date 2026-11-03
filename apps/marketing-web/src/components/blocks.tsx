import { ArrowRight, ArrowUpRight, Check, Plus } from '@hangyul/icons';
import { SectionTitle } from '@hangyul/eduan-ui';
import { useLocale } from '@hangyul/i18n';
import { cx } from '@hangyul/utils';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { LocaleLink } from './LocaleLink';

import { SLOTS } from '../media/slots';
import { Markdown } from '../lib/markdown';
import { Photo } from './Photo';

export type Tone = 'canvas' | 'muted' | 'ink' | 'white' | 'green' | 'warm';

export function Section({ id, tone = 'canvas', className, children, labelledBy, tight }: { id?: string; tone?: Tone; className?: string; children: ReactNode; labelledBy?: string; tight?: boolean }) {
  return (
    <section id={id} className={cx('mk-section ed-section', `mk-section--${tone}`, `ed-section--${tone}`, tight && 'mk-section--tight ed-section--tight', className)} aria-labelledby={labelledBy}>
      <div className="container">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('mk-eyebrow', className)}>{children}</p>;
}

export function SectionHead({ id, eyebrow, title, lede, center, action, className }: { id?: string; eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; center?: boolean; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('ed-head', center && 'ed-head--center', className)}>
      <SectionTitle id={id} subtitle={eyebrow} title={title} text={lede} center={center} />
      {action && <div className="ed-head__action">{action}</div>}
    </div>
  );
}

/**
 * Inner-page header = Eduan `breadcrumb-area` (centred title + crumb trail, 330 px band) on a Hangyul photograph
 * with the h6 banner gradient, so the transparent h6 header reads over it on every page.
 */
export function PageHero({ eyebrow, title, lede, actions, children, crumbs, photo, align = 'center' }: {
  eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode; children?: ReactNode;
  tone?: 'canvas' | 'ink' | 'green'; crumbs?: ReactNode; photo?: string; align?: 'center' | 'start';
}) {
  const { t } = useLocale(['marketing', 'common']);
  return (
    <section className={cx('breadcrumb-area ed-crumbband', align === 'start' && 'ed-crumbband--start')}>
      <Photo slug={photo ?? SLOTS.pageHeader} alt="" className="ed-crumbband__img" priority />
      <div className="container">
        <div className="breadcrumb-content">
          {eyebrow && <span className="ed-crumbband__eyebrow">{eyebrow}</span>}
          <h1 className="breadcrumb-title">{title}</h1>
          {lede && <p className="ed-crumbband__lede">{lede}</p>}
          {actions && <div className="ed-crumbband__actions">{actions}</div>}
          {children}
          <nav className="breadcrumb-list" aria-label={t('nav.breadcrumb')}>
            {crumbs ?? (<><LocaleLink to="/">{t('common:nav.home')}</LocaleLink><span aria-current="page">{title}</span></>)}
          </nav>
        </div>
      </div>
    </section>
  );
}

export function CheckList({ items, tone = 'brand' }: { items: ReactNode[]; tone?: 'brand' | 'ink' | 'light' }) {
  return (
    <ul className={cx('mk-checks', `mk-checks--${tone}`)}>
      {items.map((it, i) => (
        <li key={i}><span className="mk-checks__icon" aria-hidden><Check /></span><span>{it}</span></li>
      ))}
    </ul>
  );
}

export function Cite({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="mk-cite" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight aria-hidden size={12} />
    </a>
  );
}

export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const inner = <>{children}<ArrowRight aria-hidden size={16} className="hg-flip-rtl" /></>;
  if (/^https?:/.test(to)) return <a href={to} className={cx('mk-arrow', className)}>{inner}</a>;
  return <LocaleLink to={to} className={cx('mk-arrow', className)}>{inner}</LocaleLink>;
}

/** Accessible accordion built on <details>/<summary> (keyboard + screen-reader support for free). */
export function Faq({ items }: { items: { q: string; a: string; markdown?: boolean }[] }) {
  return (
    <div className="mk-faq">
      {items.map((it, i) => (
        <details key={i} className="mk-faq__item">
          <summary>
            <span>{it.q}</span>
            <span className="mk-faq__icon" aria-hidden><Plus /></span>
          </summary>
          <div className="mk-faq__body">
            {it.markdown ? <Markdown source={it.a} minHeading={4} /> : <p>{it.a}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}

export interface ClosingCtaContent { title?: ReactNode; lede?: ReactNode; actions?: ReactNode; note?: ReactNode; hidden?: boolean }
export const ClosingCtaContext = createContext<(c: ClosingCtaContent | null) => void>(() => undefined);

/**
 * Page-specific closing call to action. V7: rendered by the site layout's single Eduan `h6_cta-area` band (so a page
 * never shows two CTAs); this component only hands its content to that band.
 */
/**
 * Suppress the closing band for this page entirely (V12). The legal documents use it: a policy is not a place
 * to sell, and V11's privacy page ended on "Start studying in Korea now." `null` is not enough, because the
 * layout renders its *default* band for `null` — this is the explicit "no band here" state.
 */
export function useNoClosingCta() {
  const set = useContext(ClosingCtaContext);
  useEffect(() => { set({ hidden: true }); return () => set(null); }, [set]);
}

export function CtaBand(props: ClosingCtaContent) {
  const set = useContext(ClosingCtaContext);
  const latest = useRef(props);
  latest.current = props;
  // JSX props get a new identity every render; key the hand-off on the text only, or layout ↔ page would loop.
  const key = [props.title, props.lede, props.note].map((v) => (typeof v === 'string' ? v : '')).join('\u0000');
  useEffect(() => { set({ ...latest.current }); return () => set(null); }, [set, key]);
  return null;
}

/**
 * **The opening of a marketing subpage** (V19).
 *
 * Every public page that is not the homepage starts the same way — a question as the `<h1>`, one sentence
 * under it, both left-aligned on the page's own measure — and until V19 each page wrote that anatomy itself.
 * The directory had `.mk-dir__title` / `.mk-dir__lede`; the quick check used the *homepage's* centred
 * `SectionHead`, which is why `/start` was the one subpage whose head sat on a different axis from its own
 * form, and the legal pages had a third variant again.
 *
 * Centred is right for a section of a long editorial page, where the heading is an interruption the reader
 * scrolls into. It is wrong for the top of a page, where the heading is the first thing on the page and
 * everything below it — a form, a search field, a list — is left-aligned. Two axes in one viewport is most
 * of what made `/start` feel unfinished.
 *
 * The clearance above it is **not** this component's job: that belongs to `<Band pageTop>` (or, on the pages
 * that predate it, `--kn-page-top`), because the pill's footprint is a property of the page shell and not of
 * the words in it.
 */
export function PageIntro({ id, title, lede, children, className }: {
  id?: string; title: ReactNode; lede?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <div className={cx('mk-pagehead', className)}>
      <h1 id={id} className="mk-pagehead__title">{title}</h1>
      {lede && <p className="mk-pagehead__lede">{lede}</p>}
      {children}
    </div>
  );
}
