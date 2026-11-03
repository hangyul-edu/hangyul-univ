import { useAuth } from '@hangyul/auth';
import { Bell, Building2, Check, ChevronDown, ChevronsUpDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { NotificationItem } from '@hangyul/types';
import { cx, formatRelative } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { RouteScrollManager } from './route-scroll';

import { Logo, TranslationNotice } from './brand';
import { LocaleSelector } from './locale-selector';
import { Drawer, Popover } from './overlays';
import { Avatar, Button } from './primitives';

export interface NavItem { to: string; label: string; icon: ReactNode; badge?: number; alert?: boolean; end?: boolean }
export interface NavSection { title?: string; items: NavItem[] }

// ------------------------------------------------------------- Notifications

/**
 * The unread count as it is **drawn**, which is not the same as the number (V16, REPORT §133.4).
 *
 *   0        nothing. A badge that can show zero is a badge the eye learns to ignore.
 *   1–99     the number, on a 17 px disc. Two tabular 11 px digits fit; three do not, at any weight.
 *   100+     `99+`, and the disc is allowed to become a 24 px pill — there is no honest disc for three
 *            glyphs, and a 17 px circle with `99+` crammed into it is the lozenge V16 is removing.
 *
 * It returns `null` rather than an empty string so the caller cannot render an empty element, which is how
 * a stray 2 px dot appears next to a bell with nothing to say.
 */
export function unreadBadge(n: number): { text: string; wide: boolean } | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 99 ? { text: '99+', wide: true } : { text: String(Math.floor(n)), wide: false };
}

/**
 * The notification control — **one** coherent icon button with a badge attached to it (V16, brief Part 3).
 *
 * What it replaced: a bare `<span class="hg-bell">` wrapping a ghost button, with a 19 × 16 pill positioned
 * 5 px inside the button's top-right corner. Three things made that read as "a tiny orange circle floating
 * outside the control": the badge was wider than it was tall; at `top: 5px` it sat *over* an 18 px icon
 * rather than at its corner, eating the bell's dome; and its 2 px ring was painted `--hg-surface` (#FFF) on
 * a header painted `--hg-bg-canvas`, so the ring was the wrong colour and the badge had no edge.
 *
 * The fix is geometric and is all in CSS (`.hg-bell` in layout.css). What this component contributes is the
 * two things CSS cannot know: the **open state** (so the button, not the badge, carries it) and an
 * **optimistic** unread count, so marking everything read empties the badge on the click rather than on the
 * refetch.
 */
export function NotificationBell({ pollMs = 30000 }: { pollMs?: number }) {
  const { api } = useAuth();
  const { t, locale } = useLocale('common');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications.list(), refetchInterval: pollMs });
  // `null` = trust the server. A number = the reader has just acted and the server has not caught up yet.
  // It is cleared whenever a fetch lands, so it can never become a stale count of its own.
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);
  const served = q.data?.unread ?? 0;
  useEffect(() => { setOptimistic(null); }, [q.dataUpdatedAt]);
  const unread = optimistic ?? served;
  const badge = unreadBadge(unread);
  const text = (n: NotificationItem) => {
    const k = n.title_key.startsWith('notify.') ? n.title_key : '';
    const translated = k ? t(k, { ...n.params, defaultValue: '' }) : '';
    return translated && !translated.includes('{{') ? translated : n.text;
  };
  const markAll = async () => {
    // Guarded, not debounced: two clicks on 모두 읽음 used to issue two requests and two invalidations, and
    // the second refetch landing first is exactly how a cleared badge flickers its old number back.
    if (marking) return;
    setMarking(true);
    setOptimistic(0);
    try { await api.notifications.readAll(); } catch { setOptimistic(null); }
    finally { setMarking(false); qc.invalidateQueries({ queryKey: ['notifications'] }); }
  };
  const readOne = (n: NotificationItem) => {
    if (n.read) return;
    setOptimistic(Math.max(0, unread - 1));
    api.notifications.read(n.id)
      .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }), () => setOptimistic(null));
  };
  return (
    <Popover
      className="hg-notif-panel"
      trigger={(p) => (
        <span className="hg-bell" data-open={p['aria-expanded'] || undefined}>
          <Button variant="ghost" iconOnly icon={<Bell />}
            aria-label={`${t('nav.notifications')}${unread ? ` (${unread})` : ''}`} {...p} />
          {/* `aria-hidden`, because the count is already in the button's own accessible name — announcing it
              twice is how a screen reader says "알림 3, 3". */}
          {badge && <span className="hg-bell__count" data-wide={badge.wide || undefined} aria-hidden>{badge.text}</span>}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="hg-notif__head">
            <strong>{t('nav.notifications')}</strong>
            {unread > 0 && (
              <Button variant="link" size="sm" disabled={marking} onClick={markAll}>{t('notify.markAllRead')}</Button>
            )}
          </div>
          {(q.data?.items ?? []).length === 0 && <div className="hg-state hg-state--compact"><div className="hg-state__text">{t('notify.empty')}</div></div>}
          {(q.data?.items ?? []).map((n) => (
            <Link key={n.id} to={n.link ?? '#'} className="hg-notif" data-unread={!n.read}
              onClick={() => { readOne(n); close(); }}>
              <span className="hg-notif__mark" aria-hidden />
              <span className="hg-grow">
                <span className="hg-notif__text">{text(n)}</span>
                <span className="hg-notif__when">{formatRelative(n.at, locale)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Popover>
  );
}

// ------------------------------------------------------------- User & org menu
export function UserMenu({ extra }: { extra?: ReactNode }) {
  const { session, logout, switchOrg } = useAuth();
  const { t } = useLocale('common');
  if (!session) return null;
  const orgs = session.memberships;
  return (
    <Popover
      width={280}
      trigger={(p) => (
        // One control, not an avatar sitting next to some text (brief Part 3.7). The whole row is the
        // button, it has the same 38 px height as the icon buttons beside it, and it carries the same
        // hover and open surface — so the group reads as four controls of one family rather than as three
        // controls and a photograph. The chevron is what makes it legible as a menu before it is clicked.
        <button type="button" className="hg-account" data-open={p['aria-expanded'] || undefined} aria-label={session.user.full_name} {...p}>
          <Avatar name={session.user.full_name} size={26} />
          <span className="hg-account__who hg-desktop-only">
            <span className="hg-account__name hg-truncate">{session.user.preferred_name || session.user.full_name}</span>
            {session.active_org && <span className="hg-account__role hg-truncate">{t(`role.${session.active_org.role}`)}</span>}
          </span>
          <ChevronDown className="hg-account__chev hg-desktop-only" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div style={{ padding: '10px 10px 12px' }}>
            <div className="hg-strong hg-truncate">{session.user.full_name}</div>
            <div className="hg-subtle hg-xs hg-truncate">{session.user.email}</div>
          </div>
          {orgs.length > 1 && (
            <>
              <div className="hg-menu-label">{t('actions.switchOrg')}</div>
              {orgs.map((m) => (
                <button key={m.org_id} className="hg-menu-item" onClick={async () => { close(); await switchOrg(m.org_id); window.location.assign('/'); }}>
                  <Building2 aria-hidden />
                  <span className="hg-grow hg-truncate">{m.org_name}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{t(`role.${m.role}`)}</span></span>
                  {session.active_org?.org_id === m.org_id && <Check aria-hidden />}
                </button>
              ))}
              <hr className="hg-divider" style={{ margin: '6px 0' }} />
            </>
          )}
          {extra}
          {extra && <hr className="hg-divider" style={{ margin: '4px 0' }} />}
          <button className="hg-menu-item" onClick={async () => { close(); await logout(); }}>
            <LogOut aria-hidden /> {t('actions.signOut')}
          </button>
        </div>
      )}
    </Popover>
  );
}

/**
 * Consoles are light-only in V3: dark mode was never QA'd to the same standard (see REPORT §19),
 * and a mediocre dark theme is worse than none. Any stored preference is cleared.
 */
function useLightOnly(storageKey: string) {
  useEffect(() => {
    delete document.documentElement.dataset.theme;
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);
}

// ------------------------------------------------------------- Console shell
export function ConsoleShell({ product, productLabel, sections, variant = 'light', children, search, orgLabel, topExtra }: {
  product: 'agency' | 'university';
  productLabel: string;
  sections: NavSection[];
  variant?: 'light' | 'ink';
  children: ReactNode;
  search?: ReactNode;
  orgLabel?: ReactNode;
  topExtra?: ReactNode;
}) {
  const { t } = useLocale('common');
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(`hg.${product}.sb`) === '1'; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  useLightOnly(`hg.${product}.theme`);
  const loc = useLocation();
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);
  useEffect(() => { try { localStorage.setItem(`hg.${product}.sb`, collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed, product]);

  const nav = (
    <nav className="hg-sidebar__nav" aria-label={productLabel}>
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <div className="hg-sidebar__section">{s.title}</div>}
          {s.items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cx('hg-navlink', isActive && 'active')} title={collapsed ? it.label : undefined}>
              {it.icon}
              <span className="hg-truncate">{it.label}</span>
              {it.badge ? <span className={cx('hg-navlink__badge', it.alert && 'hg-navlink__badge--alert')}>{it.badge > 99 ? '99+' : it.badge}</span> : null}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <a href="#main" className="hg-skip-link">{t('a11y.skipToContent')}</a>
      <div className="hg-shell" data-collapsed={collapsed}>
        <aside className="hg-sidebar" data-variant={variant}>
          <div className="hg-sidebar__brand">
            <Logo as={Link} tag={productLabel} />
          </div>
          {nav}
          <div className="hg-sidebar__foot">
            <button className="hg-navlink" style={{ width: '100%', border: 0, background: 'none' }} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? t('a11y.expandSidebar') : t('a11y.collapseSidebar')}>
              {collapsed ? <PanelLeftOpen className="hg-flip-rtl" /> : <PanelLeftClose className="hg-flip-rtl" />}
              <span>{collapsed ? '' : t('a11y.collapseSidebar')}</span>
            </button>
          </div>
        </aside>
        <div className="hg-main">
          <header className="hg-topbar">
            <Button className="hg-mobile-only" variant="ghost" iconOnly icon={<Menu />} onClick={() => setMobileOpen(true)} aria-label={t('a11y.openMenu')} />
            <span className="hg-mobile-only"><Logo as={Link} /></span>
            {orgLabel && <div className="hg-desktop-only">{orgLabel}</div>}
            <div className="hg-topbar__search hg-desktop-only">{search}</div>
            <div className="hg-grow" />
            {topExtra}
            <div className="hg-snav__tools">
              <LocaleSelector compact />
              <NotificationBell />
            </div>
            <UserMenu />
          </header>
          <main id="main" className="hg-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title={productLabel} side="start" width={300} sheet={false}>
        <div className="hg-sidebar" data-variant={variant} style={{ display: 'flex', position: 'static', height: 'auto', border: 0, margin: -20, background: 'transparent' }}>
          {search && <div style={{ padding: '12px 12px 0' }}>{search}</div>}
          {orgLabel && <div style={{ padding: '12px 16px 0' }}>{orgLabel}</div>}
          {nav}
        </div>
      </Drawer>
    </>
  );
}

// ------------------------------------------------------------- Student shell
export function StudentShell({ links, tabs, children, right }: {
  links: NavItem[];
  tabs: NavItem[];
  children: ReactNode;
  right?: ReactNode;
}) {
  const { t } = useLocale('common');
  return (
    <div className="hg-sshell">
      {/* V19: the one route-scroll policy, in the shell rather than in each app. It replaces the student
          app's own `useEffect(() => window.scrollTo({top: 0}), [pathname])`, which could not restore on
          Back. See `./route-scroll`. */}
      <RouteScrollManager />
      <a href="#main" className="hg-skip-link">{t('a11y.skipToContent')}</a>
      <header className="hg-snav">
        <div className="hg-snav__inner">
          <Logo as={Link} />
          <nav className="hg-snav__links" aria-label={t('a11y.primaryNav')}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('hg-snav__link', isActive && 'active')}>
                {l.label}
                {l.badge ? <span className="hg-snav__count" aria-label={`(${l.badge})`}>{l.badge > 9 ? '9+' : l.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="hg-grow" />
          {/*
            The right-hand group, not four siblings. 더보기 is a navigation menu, the locale and the bell are
            two icon buttons of one family, and the account is the session — so they are spaced optically
            rather than evenly (see `.hg-snav__tools`). An even rhythm across four unlike controls is what
            made this row read as a toolbar.
          */}
          {right}
          <div className="hg-snav__tools">
            <LocaleSelector compact />
            <NotificationBell />
          </div>
          <UserMenu />
        </div>
      </header>
      <TranslationNotice ns="student" surface="student" />
      <main id="main" className="hg-scontent" tabIndex={-1}>{children}</main>
      <nav className="hg-tabbar" aria-label={t('a11y.primaryNav')}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => cx(isActive && 'active')}>
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge ? <span className="hg-tabbar__dot" aria-label={`${tab.badge}`} /> : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function OrgBadge({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="hg-row" style={{ gap: 8, padding: '0 4px' }}>
      <Building2 size={16} aria-hidden className="hg-subtle" />
      <span className="hg-truncate" style={{ maxWidth: 260 }}>
        <span className="hg-medium hg-small" style={{ display: 'block', lineHeight: 1.3 }}>{name}</span>
        {sub && <span className="hg-subtle hg-xs" style={{ display: 'block', lineHeight: 1.3 }}>{sub}</span>}
      </span>
      <ChevronsUpDown size={14} className="hg-subtle" aria-hidden style={{ display: 'none' }} />
    </div>
  );
}
