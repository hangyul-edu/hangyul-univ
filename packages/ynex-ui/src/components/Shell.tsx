// React port of the YNEX vertical layout: partials/sidebar.html + partials/header.html + menu-styles/_vertical.scss.
// The template's defaultmenu.js / sticky.js / SimpleBar are replaced by React state:
//   <html data-nav-layout="vertical" data-menu-styles="light|dark" data-header-styles="light" data-vertical-style="overlay"
//         data-toggled="close|open|icon-overlay-close" data-icon-overlay="open">
// Markup and class names follow the template so its CSS applies unchanged.
import { Menu } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { LocaleSelector, Logo, NotificationBell, RouteScrollManager, UserMenu, type NavSection } from '@hangyul/ui';
import { cx } from '@hangyul/utils';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

const DESKTOP = '(min-width: 992px)';

function setRootAttrs(attrs: Record<string, string | null>) {
  const el = document.documentElement;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) el.removeAttribute(k);
    else el.setAttribute(k, v);
  }
}

export interface YnexShellProps {
  product: 'agency' | 'university' | 'hq';
  productLabel: string;
  sections: NavSection[];
  /** YNEX menu colour: `light` (agency workbench) or `dark` (navy — university, Hangyul operations). */
  menu?: 'light' | 'dark';
  children: ReactNode;
  search?: ReactNode;
  orgLabel?: ReactNode;
  topExtra?: ReactNode;
  /** Optional context strip above the page (e.g. Hangyul operations scope). */
  context?: ReactNode;
}

export function YnexShell({ product, productLabel, sections, menu = 'light', children, search, orgLabel, topExtra, context }: YnexShellProps) {
  const { t } = useLocale('common');
  const loc = useLocation();
  const storageKey = `hg.${product}.sb`;
  // V9: the sidebar is always labelled unless the user collapses it (their choice is remembered). On 992–1279 px it is a
  // narrower labelled column (CSS, `_hangyul-skin.scss`) instead of V8's automatic icon rail, which cost wayfinding.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      // V8 stored an automatic choice under the old key; only an explicit V9 choice counts.
      return localStorage.getItem(`${storageKey}.v9`) === '1';
    } catch { return false; }
  });
  const [userChose, setUserChose] = useState(() => { try { return localStorage.getItem(`${storageKey}.v9`) != null; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);
  useEffect(() => { if (userChose) { try { localStorage.setItem(`${storageKey}.v9`, collapsed ? '1' : '0'); } catch { /* private mode */ } } }, [collapsed, storageKey, userChose]);

  // Consoles are light-only (REPORT §19); the template's layout state lives on <html>.
  useEffect(() => {
    delete document.documentElement.dataset.theme;
    setRootAttrs({
      'data-nav-layout': 'vertical',
      'data-theme-mode': 'light',
      'data-header-styles': 'light',
      'data-menu-styles': menu,
      'data-vertical-style': 'overlay',
      'data-page-style': 'regular',
      'data-width': 'fullwidth',
      'data-menu-position': 'fixed',
      'data-header-position': 'fixed',
    });
  }, [menu]);
  useEffect(() => {
    setRootAttrs({
      'data-toggled': desktop ? (collapsed ? 'icon-overlay-close' : null) : (mobileOpen ? 'open' : 'close'),
      'data-icon-overlay': desktop && collapsed && hoverOpen ? 'open' : null,
    });
  }, [desktop, collapsed, mobileOpen, hoverOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggle = () => { if (desktop) { setUserChose(true); setCollapsed((c) => !c); } else setMobileOpen((o) => !o); };
  const navHidden = !desktop && !mobileOpen;

  return (
    <>
      {/* V19: the consoles had no route-scroll handling at all, so opening an applicant from halfway down a
          list put the reader halfway down the applicant. One shared policy — see `@hangyul/ui ›
          route-scroll`. */}
      <RouteScrollManager />
      <a href="#main" className="hg-skip-link">{t('a11y.skipToContent')}</a>
      <div className="page" data-product={product}>
        <header className="app-header">
          <div className="main-header-container container-fluid">
            <div className="header-content-left">
              <div className="header-element">
                <div className="horizontal-logo"><Logo as={Link} /></div>
              </div>
              <div className="header-element">
                <button
                  type="button"
                  className="sidemenu-toggle header-link"
                  onClick={toggle}
                  aria-expanded={desktop ? !collapsed : mobileOpen}
                  aria-controls="sidebar"
                  aria-label={desktop ? (collapsed ? t('a11y.expandSidebar') : t('a11y.collapseSidebar')) : t('a11y.openMenu')}
                >
                  <Menu className="header-link-icon" aria-hidden />
                </button>
              </div>
              {orgLabel && <div className="header-element yx-org d-none d-lg-flex">{orgLabel}</div>}
              {search && <div className="header-element yx-search d-none d-md-flex">{search}</div>}
            </div>
            <div className="header-content-right">
              {topExtra && <div className="header-element">{topExtra}</div>}
              <div className="header-element yx-headlink"><LocaleSelector compact /></div>
              <div className="header-element yx-headlink"><NotificationBell /></div>
              <div className="header-element yx-headlink yx-profile"><UserMenu /></div>
            </div>
          </div>
        </header>

        <aside
          className="app-sidebar sticky"
          id="sidebar"
          aria-label={productLabel}
          inert={navHidden ? true : undefined}
          onMouseEnter={() => setHoverOpen(true)}
          onMouseLeave={() => setHoverOpen(false)}
        >
          <div className="main-sidebar-header">
            {/* V10: the lockup is a real image now, so a navy sidebar needs the light-ink variant — CSS can no
                longer recolour it. The header's own copy above stays dark-ink on its white bar. */}
            <Logo as={Link} tag={productLabel} tone={menu === 'dark' ? 'light' : 'dark'} />
          </div>
          <div className="main-sidebar" id="sidebar-scroll">
            <nav className="main-menu-container nav nav-pills flex-column sub-open" aria-label={productLabel}>
              <ul className="main-menu">
                {sections.map((s, i) => (
                  <SidebarSection key={i} title={s.title} items={s.items} />
                ))}
              </ul>
            </nav>
          </div>
        </aside>
        <div id="responsive-overlay" className={cx(mobileOpen && !desktop && 'active')} onClick={() => setMobileOpen(false)} aria-hidden />

        <div className="main-content app-content">
          <main id="main" tabIndex={-1} className="container-fluid yx-main">
            {context}
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function SidebarSection({ title, items }: NavSection) {
  return (
    <>
      {title && <li className="slide__category"><span className="category-name">{title}</span></li>}
      {items.map((it) => (
        <li key={it.to} className="slide">
          <NavLink to={it.to} end={it.end} className={({ isActive }) => cx('side-menu__item', isActive && 'active')}>
            <span className="side-menu__icon" aria-hidden>{it.icon}</span>
            <span className="side-menu__label">{it.label}</span>
            {it.badge ? (
              <span className={cx('badge yx-navbadge', it.alert ? 'bg-primary-transparent' : 'bg-light text-muted')}>
                {it.badge > 99 ? '99+' : it.badge}
              </span>
            ) : null}
          </NavLink>
        </li>
      ))}
    </>
  );
}
