/**
 * V11 site chrome — the Koreanasha foundation, with the header defect removed (REPORT §74.6, §75).
 *
 *   header  = the floating white pill (`kn-header`), Koreanasha's signature, and nothing else. It has **no
 *             scrolled state**: the same inset, radius, width, background, border, shadow and control sizes at
 *             every scroll position, exactly as the original's single `main.css:293` rule behaves. V10's
 *             `useStickyHeader(96)` → `.is-stuck { inset: 0; border-radius: 0 }` morph is gone, and with it the
 *             only piece of header state there was, so nothing can fall out of sync with anything.
 *   mobile  = the accessible Offcanvas ported in V7, restyled as a light sheet.
 *   closing = `kn-cta` band
 *   footer  = kept from V7/V9, with the B2B column removed from the student's reading path.
 *
 * What changed from V9, and why:
 *   - The primary navigation is **student-only**. The "Partners ∨" dropdown (For universities / For agencies) is
 *     gone from the header, and the footer's Partners column is replaced by one discreet "Partner sign-in" line
 *     under the copyright. Those products keep their own login URLs; they are not part of a student's journey.
 *   - The account action is **Login**, not "Get started" → /register. If a student session already exists in this
 *     browser the same slot reads "Continue my journey" and goes to the Student Platform.
 *   - The brand mark is the BI-kit lockup, not type set in CSS.
 */
import { Menu } from '@hangyul/icons';
import { ArrowRightIcon, Offcanvas, Reveal } from '@hangyul/koreanasha-ui';
import { useLocale } from '@hangyul/i18n';
import { LocaleSelector, Logo, RouteScrollManager, useLocaleFromUrl } from '@hangyul/ui';
import { cx } from '@hangyul/utils';
import { useEffect, useState } from 'react';

import { ClosingCtaContext, type ClosingCtaContent } from './blocks';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import '../styles/site.css';
import { LEGAL_ENTITY } from '../lib/legal/entity';
import { SOCIAL_ICON_PATH, SOCIAL_LINKS, type SocialPlatform } from '../lib/social';
import { LocaleLink, useLocaleHref } from './LocaleLink';
import { prepareAction, useStudentSession } from '../lib/session';
import { usePhone } from '../lib/usePhone';

/**
 * Three destinations. The catalogue is a real page; services and questions are sections of the homepage, which
 * is what Koreanasha's own header does (`#koreanasha-services`, `#faq`) and what brief Part 4 asks for — an
 * anchor does not need a route. The labels are Koreanasha's own nav strings.
 */
const PRIMARY = [
  { to: '/universities', key: 'nav.universities' },
  { to: '/#services', key: 'v11.nav.services' },
  { to: '/#faq', key: 'v11.nav.faq' },
] as const;

/**
 * The product's one conversion action, wherever it appears (V13, brief Part 1).
 *
 * The header, the hero and the closing band must agree, or the site teaches a visitor two different things
 * about what it wants them to do. V12 had the header advertising the account action in tangerine while the
 * hero advertised the directory in tangerine; whichever a visitor read first was contradicted by the other.
 *
 * The label is the goal, not the mechanism. Signed out it reads "내 유학 준비" / "Start my preparation" and
 * goes to the sign-in page, which is where a preparation actually starts; signed in it reads "내 유학 준비" /
 * "Continue my journey" and goes to the platform. There is no separate "Log in" control: this button is
 * already the way in, and a second door next to it is one more thing competing for the same decision.
 */
function AccountAction({ size, block }: { size?: 'sm' | 'lg'; block?: boolean }) {
  const { t, locale } = useLocale(['marketing', 'common']);
  const { authenticated } = useStudentSession();
  // The header pill uses the short form of the label (V14). Same destination, same `data-cta`, same meaning —
  // but one or two words, because a header button that is a full sentence breaks the pill in every language
  // with longer words than Korean, and truncating it would make the product's one conversion action
  // unreadable. The full phrase is kept where there is room for it: the hero and the closing band.
  const short = size === 'sm';
  const label = authenticated ? t('v10.account.continue') : t(short ? 'v14.cta.prepareShort' : 'v13.cta.prepare');
  const href = prepareAction(authenticated, locale);
  const className = cx('kn-btn kn-btn--primary', size === 'sm' && 'kn-btn--sm', size === 'lg' && 'kn-btn--lg', block && 'kn-btn--block');
  // The accessible name stays the full phrase, so nothing is lost for a screen reader.
  const aria = authenticated ? undefined : t('v13.cta.prepare');
  // V24 (REPORT §290 V24-3): → like every other in-product forward action. ↗ promised "another site", and the
  // student platform is the same product; ↗ is kept for genuinely external links (an official university site).
  const inner = <>{label}<ArrowRightIcon /></>;

  /*
   * Signed out, `prepareAction` returns `/start` — a route in **this** app. Rendering it as a bare `<a>`
   * made the product's one conversion action a full document reload: a white flash, the React tree and the
   * query cache thrown away and rebuilt, and the language re-resolved from the URL. (It was also half of
   * the V18 scroll defect: a new document meant a new `"default"` location key, which is the slot
   * react-router's `ScrollRestoration` had just written Home's offset into.) Signed in it returns an
   * absolute URL on the Student Platform, which is a different origin and must stay a real `<a>`.
   */
  if (/^https?:|^\/\//.test(href)) {
    return <a className={className} href={href} data-cta="primary" aria-label={aria}>{inner}</a>;
  }
  return <Link className={className} to={href} data-cta="primary" aria-label={aria}>{inner}</Link>;
}

function Header() {
  const { t } = useLocale(['marketing', 'common']);
  const lang = useLocaleHref();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  return (
    <header>
      {/* No state class: the pill is the pill, at the top of the page and 4,000 px down it. */}
      <div className="kn-header">
        <div className="kn-header__inner">
          <div className="kn-header__brand"><Logo as={LocaleLink} href="/" /></div>
          <div className="kn-header__spacer" />
          <nav className="kn-nav d-none d-xl-block" aria-label={t('nav.primary')}>
            <ul>
              {/* A hash link is a position on this page, not another page: `NavLink` would mark every one of
                  them current while the home route is active, so only the real route gets the current marker. */}
              {PRIMARY.map((n) => (
                <li key={n.to}>
                  {n.to.includes('#')
                    ? <LocaleLink to={n.to}>{t(n.key)}</LocaleLink>
                    : <NavLink to={lang(n.to)}>{t(n.key)}</NavLink>}
                </li>
              ))}
            </ul>
          </nav>
          <div className="kn-header__spacer" />
          <div className="kn-header__right">
            {/* The account action is the header's one job and stays visible at 320 px; the language switcher
                moves into the menu below 576 px, where three controls would crowd the pill. */}
            <span className="d-none d-sm-inline-flex"><LocaleSelector compact /></span>
            <AccountAction size="sm" />
            <button type="button" className="kn-burger d-xl-none" aria-label={t('common:a11y.openMenu')} aria-expanded={open} onClick={() => setOpen(true)}>
              <Menu aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <Offcanvas open={open} onClose={() => setOpen(false)} title={t('nav.menu')} closeLabel={t('common:actions.close')} logo={<Logo as={LocaleLink} href="/" />}>
        <nav className="kn-mnav" aria-label={t('nav.primary')}>
          <NavLink to={lang('/')} end>{t('common:nav.home')}</NavLink>
          {PRIMARY.map((n) => (n.to.includes('#')
            ? <LocaleLink key={n.to} to={n.to}>{t(n.key)}</LocaleLink>
            : <NavLink key={n.to} to={lang(n.to)}>{t(n.key)}</NavLink>))}
        </nav>
        {/* Language stays in the main menu on phones, never in the footer (brief Part 43): on a phone the
            header is the only chrome a reader sees before they decide whether this site speaks to them. */}
        <div className="kn-mnav__foot">
          <AccountAction block />
          <div className="kn-mnav__lang"><span>{t('common:actions.language')}</span><LocaleSelector /></div>
        </div>
      </Offcanvas>
    </header>
  );
}

/** One closing band per page. Pages override its content through `CtaBand`; the default is explore-or-login. */
function ClosingCta({ content }: { content: ClosingCtaContent | null }) {
  const { t } = useLocale(['marketing', 'common']);
  // Pages that must not carry a marketing call to action (the legal documents) say so explicitly.
  if (content?.hidden) return null;
  return (
    <section className="kn-band kn-band--flush-top" aria-labelledby="cta-title">
      <div className="kn-container">
        {/* V19: the closing band was the one section on the page with no entrance. Every heading, photograph
            and price above it arrives; the conversion moment simply existed, which read as the page having
            run out of design before it ran out of page. `rise`, like the section heads it follows. */}
        <Reveal variant="rise" className="kn-cta">
          <div>
            <h2 id="cta-title" className="kn-cta__title">{content?.title ?? t('v11.cta.title')}</h2>
            <p className="kn-cta__text">{content?.lede ?? t('v11.cta.text')}</p>
            {content?.note && <p className="kn-cta__text" style={{ marginTop: 12, fontSize: 'var(--hg-text-base)' }}>{content.note}</p>}
          </div>
          <div className="kn-cta__actions">
            {/* Same hierarchy as the hero and the header: prepare is primary, the directory supports it.
                The white pill this replaces was the heavier of the two on a near-black band. */}
            {content?.actions ?? (
              <>
                {/* V24-2: the same height as the secondary beside it — the smaller of the two was the primary. */}
                <AccountAction size="lg" />
                <LocaleLink to="/universities" className="kn-btn kn-btn--quiet-onphoto kn-btn--lg">{t('v11.hero.explore')}<ArrowRightIcon /></LocaleLink>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The company information a Korean consumer service publishes (V14, brief Parts 48–50).
 *
 * One quiet line-wrapped row under the columns, not a boxed "회사 정보" panel: this is a legal obligation a
 * reader satisfies in two seconds, not a section of the site. The labels translate; the names and the two
 * registration numbers never do — a 통신판매업 신고번호 is a string issued by a Korean authority and
 * transliterating it would make it wrong.
 *
 * A field with no owner-supplied value is simply absent. `LEGAL_ENTITY` holds nine such fields and this
 * renders none of them as a placeholder, which is the same rule the privacy policy and terms follow.
 */
function BusinessInfo() {
  const { t } = useLocale(['marketing', 'common']);
  const e = LEGAL_ENTITY;
  const rows: [string, React.ReactNode][] = [];
  if (e.representative) rows.push([t('v14.legal.representative'), e.representative]);
  if (e.businessDivisionContact) rows.push([t('v14.legal.division'), e.businessDivisionContact]);
  if (e.supportEmail) rows.push([t('v14.legal.email'), <a href={`mailto:${e.supportEmail}`}>{e.supportEmail}</a>]);
  if (e.businessRegistrationNumber) rows.push([t('v14.legal.brn'), e.businessRegistrationNumber]);
  if (e.ecommerceRegistrationNumber) rows.push([t('v14.legal.ecommerce'), e.ecommerceRegistrationNumber]);
  if (!rows.length) return null;
  return (
    <dl className="kn-footer__biz">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

/** The talkhangyul.com glyph treatment, copied: one colour for YouTube/Reddit/Facebook (currentColor = --brand),
 *  the official gradient for Instagram, TikTok's cyan/magenta offset (see lib/social.ts for the source). */
function SocialGlyph({ platform }: { platform: SocialPlatform }) {
  const d = SOCIAL_ICON_PATH[platform];
  if (platform === 'Instagram') {
    return (
      <>
        <defs>
          <linearGradient id="hg-social-instagram-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#f58529" />
            <stop offset="30%" stopColor="#dd2a7b" />
            <stop offset="65%" stopColor="#8134af" />
            <stop offset="100%" stopColor="#515bd4" />
          </linearGradient>
        </defs>
        <path d={d} fill="url(#hg-social-instagram-gradient)" />
      </>
    );
  }
  if (platform === 'TikTok') {
    return (
      <g>
        <path d={d} fill="#25f4ee" transform="translate(-0.7 0)" />
        <path d={d} fill="#fe2c55" transform="translate(0.7 0)" />
        <path d={d} fill="#161823" />
      </g>
    );
  }
  return <path d={d} />;
}

/**
 * 소셜 미디어 (V23, REPORT §269 M1) — Hangyul's five channels, exactly as the talkhangyul.com footer lists them.
 * A quiet heading and one row of 20 px glyphs in 40 px targets: no cards, no labels under the icons. Five targets
 * are 200 px wide, so the row never wraps on a 320 px phone.
 */
function SocialLinks() {
  const { t } = useLocale(['marketing', 'common']);
  return (
    <div className="kn-footer__social">
      <p className="kn-footer__social-title" id="kn-footer-social">{t('v23.footer.social')}</p>
      <ul className="kn-footer__social-list" aria-labelledby="kn-footer-social">
        {SOCIAL_LINKS.map(({ platform, href, brand, tint }) => (
          <li key={platform}>
            <a
              className="kn-footer__social-link"
              data-platform={platform}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('v23.footer.socialLabel', { platform })}
              style={{ '--brand': brand, '--brand-tint': tint } as React.CSSProperties}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
                <SocialGlyph platform={platform} />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  const { t } = useLocale(['marketing', 'common']);
  const phone = usePhone();
  /**
   * A customer footer, and only a customer footer (V12, brief Part 11). V11 carried a "Partner sign-in" line
   * with links to the University and Agency consoles under the copyright. Those are separate products on
   * separate URLs; a prospective student has no use for knowing they exist, and a marketing footer that offers
   * three audiences a door is a marketing footer that has stopped being about the customer. It is gone, and it
   * is not replaced with "Partner portal", "B2B login" or "For institutions" — the consoles keep their own
   * sign-in pages, which is how the people who work in them already reach them.
   */
  const cols: { title: string; links: { to: string; label: string }[] }[] = [
    {
      title: t('v12.footer.explore'),
      links: [
        { to: '/universities', label: t('v12.directory.navShort') },
      ],
    },
    {
      title: t('v12.footer.service'),
      links: [
        { to: '/#services', label: t('v11.nav.services') },
        { to: '/#faq', label: t('v11.nav.faq') },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { to: '/privacy', label: t('common:footer.privacy') },
        { to: '/terms', label: t('common:footer.terms') },
        // No "사진 출처" link: `/credits` is retired (brief Part 3). Every photograph on a customer surface is
        // now Hangyul-owned or CC0, so there is no attribution for a customer to be sent to read, and a
        // bibliography is not part of anyone's journey. See docs/MEDIA_LICENSE_AUDIT.md.
      ],
    },
  ];
  return (
    <footer className="kn-footer">
      <div className="kn-container">
        <div className="kn-footer__top">
          <div className="kn-footer__brand">
            {/* `below`: the footer lockup is ~3,600 px down every page and was loading eagerly (V20 §48). */}
            <Logo as={LocaleLink} href="/" below />
            <p className="kn-footer__statement">{t('footer.statement')}</p>
            <SocialLinks />
            <div className="kn-footer__lang"><LocaleSelector /></div>
          </div>
          <div className="kn-footer__cols">
            {cols.map((c) => (
              /* On phones each column folds to its title; open on larger screens (V8). */
              <details key={c.title} className="kn-fcol" open={!phone}>
                <summary className="kn-fcol__title">{c.title}</summary>
                <nav aria-label={c.title}>
                  <ul>{c.links.map((l) => <li key={l.label}><LocaleLink to={l.to}>{l.label}</LocaleLink></li>)}</ul>
                </nav>
              </details>
            ))}
          </div>
        </div>
        {/* The two standing disclaimers that used to sit here — "Universities make all admission decisions…"
            and "Hangyul does not issue visas…" — are gone from every page (brief Part 5). The limitation they
            expressed is stated once, in the terms, article 6. */}
        <div className="kn-footer__bottom">
          <BusinessInfo />
          <p className="kn-footer__copy">{t('common:footer.rights', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const { t } = useLocale(['marketing', 'common']);
  // `?lang=` is the authority for the current language (brief Part 44). One-way: the selector navigates, this
  // reacts — so the browser's back and forward buttons move between languages for free.
  useLocaleFromUrl();
  const loc = useLocation();
  const home = loc.pathname === '/';
  // V22: `?embed=1` renders a legal page without the site chrome, for the native app's in-app document sheet
  // (REPORT §267). The canonical page is served, not a copy — so the mobile bundle can never carry stale legal copy.
  const embed = new URLSearchParams(loc.search).get('embed') === '1';
  useEffect(() => {
    if (embed) document.documentElement.dataset.embed = '1'; else delete document.documentElement.dataset.embed;
  }, [embed]);
  const [cta, setCta] = useState<ClosingCtaContent | null>(null);
  // Anchor links such as /#check scroll to the section after navigation.
  useEffect(() => {
    if (!loc.hash) return;
    const id = loc.hash.slice(1);
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const tmr = setTimeout(go, 60);
    return () => clearTimeout(tmr);
  }, [loc.pathname, loc.hash]);
  return (
    <div className="ed kn" data-page={home ? 'home' : 'inner'}>
      <a href="#main" className="hg-skip-link">{t('common:a11y.skipToContent')}</a>
      <Header />
      <ClosingCtaContext.Provider value={setCta}>
        <main id="main" tabIndex={-1} className="ed-main">
          <Outlet />
          <ClosingCta content={cta} />
        </main>
      </ClosingCtaContext.Provider>
      <Footer />
      {/* V19: replaces react-router's `<ScrollRestoration />`, whose `"default"` location key was shared
          by the first history entry of every document and so carried Home's offset onto `/start`. See
          `@hangyul/ui › route-scroll`. */}
      <RouteScrollManager />
    </div>
  );
}
