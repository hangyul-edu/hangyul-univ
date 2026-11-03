// YNEX content components (React ports of template markup; class names unchanged so YNEX CSS applies).
// Sources: partials/page-header.html, index-8 (HRM) stat cards + "Upcoming Events" timeline-widget,
// index-10 (Courses) table progress, navs_tabs.html, file-manager.html (three-pane split), crm-contacts.html card header.
import { cx } from '@hangyul/utils';
import { Children, isValidElement, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';

export type YxTone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'teal' | 'orange' | 'purple' | 'light';

/** partials/page-header.html — title (+ context line) left, actions / breadcrumb right. */
export function PageHeader({ title, sub, actions, crumbs, eyebrow }: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  crumbs?: { label: ReactNode; to?: string }[];
  eyebrow?: ReactNode;
}) {
  return (
    <div className="d-md-flex d-block align-items-center justify-content-between my-4 page-header-breadcrumb yx-pagehead">
      <div className="yx-pagehead__text">
        {eyebrow && <div className="yx-pagehead__eyebrow">{eyebrow}</div>}
        <h1 className="page-title fw-semibold fs-18 mb-0">{title}</h1>
        {sub && <div className="text-muted yx-pagehead__sub">{sub}</div>}
      </div>
      {(actions || crumbs) && (
        <div className="yx-pagehead__end mt-md-0 mt-2">
          {crumbs && (
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                {crumbs.map((c, i) => (
                  <li key={i} className={cx('breadcrumb-item', i === crumbs.length - 1 && 'active')} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                    {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {actions && <div className="btn-list">{actions}</div>}
        </div>
      )}
    </div>
  );
}

/** card custom-card — header with the YNEX accent bar title, optional tools; body; footer. */
export function YCard({ title, count, tools, children, footer, className, bodyClass, flush, id, as: As = 'div', headerClass, style }: {
  title?: ReactNode;
  count?: ReactNode;
  tools?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClass?: string;
  /** body without padding (tables / lists that run edge to edge) */
  flush?: boolean;
  id?: string;
  as?: 'div' | 'section' | 'article';
  headerClass?: string;
  style?: CSSProperties;
}) {
  const hid = useId();
  return (
    <As className={cx('card custom-card', className)} id={id} aria-labelledby={title ? hid : undefined} style={style}>
      {(title || tools) && (
        <div className={cx('card-header justify-content-between', headerClass)}>
          {title && (
            <h2 className="card-title" id={hid}>
              {title}
              {count != null && <span className="badge bg-light text-default rounded ms-1 fs-12 align-middle yx-count">{count}</span>}
            </h2>
          )}
          {tools && <div className="yx-cardtools">{tools}</div>}
        </div>
      )}
      {children != null && <div className={cx('card-body', flush && 'p-0', bodyClass)}>{children}</div>}
      {footer && <div className="card-footer">{footer}</div>}
    </As>
  );
}

/**
 * index-8 (HRM) `hrm-main-card`: coloured top rule, square tinted icon avatar, label, value, caption, trend.
 * Rendered as a link when `to` is given — every number in a console drills down to exactly those records.
 */
export function StatCard({ tone = 'primary', icon, label, value, caption, trend, to, onClick, selected }: {
  tone?: YxTone;
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  trend?: { text: ReactNode; tone: 'success' | 'danger' | 'muted' };
  to?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const body = (
    <div className="card-body">
      <div className="d-flex align-items-top">
        {icon && <div className="me-3"><span className={cx('avatar', `bg-${tone}-transparent`, 'yx-staticon')} aria-hidden>{icon}</span></div>}
        <div className="flex-fill min-w-0">
          <span className="fw-semibold text-muted d-block mb-2 yx-stat__label">{label}</span>
          <div className="fw-semibold mb-1 yx-stat__value">{value}</div>
          {caption && <div className="fs-12 text-muted yx-stat__caption">{caption}</div>}
        </div>
        {trend && <div><span className={cx('fs-13 fw-semibold', trend.tone === 'muted' ? 'text-muted' : `text-${trend.tone}`)}>{trend.text}</span></div>}
      </div>
    </div>
  );
  const cls = cx('card custom-card hrm-main-card yx-stat', tone, (to || onClick) && 'yx-stat--link', selected && 'yx-stat--selected');
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** index-8 "Upcoming Events" `timeline-widget`: big date + weekday, title, meta line with a soft badge. */
export function DateTimeline({ items, empty }: {
  items: { key: string; day: ReactNode; weekday: ReactNode; title: ReactNode; meta?: ReactNode; badge?: { text: ReactNode; tone: YxTone }; to?: string; end?: ReactNode; urgent?: boolean }[];
  empty?: ReactNode;
}) {
  if (!items.length) return <>{empty}</>;
  return (
    <ul className="list-unstyled timeline-widget mb-0 my-2">
      {items.map((it) => {
        const inner = (
          <div className="d-flex align-items-top">
            <div className="me-4 text-center yx-tl__date">
              <span className={cx('d-block fs-20 fw-semibold', it.urgent ? 'text-danger' : 'text-primary')}>{it.day}</span>
              <span className="d-block fs-12 text-muted">{it.weekday}</span>
            </div>
            <div className="d-flex flex-wrap flex-fill align-items-top justify-content-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="mb-1 timeline-widget-content text-wrap">{it.title}</p>
                {(it.meta || it.badge) && (
                  <p className="mb-0 fs-12 text-muted">
                    {it.meta}
                    {it.badge && <span className={cx('badge ms-2', `bg-${it.badge.tone}-transparent`)}>{it.badge.text}</span>}
                  </p>
                )}
              </div>
              {it.end && <div className="fs-12 text-muted text-nowrap">{it.end}</div>}
            </div>
          </div>
        );
        return (
          <li key={it.key} className="timeline-widget-list">
            {it.to ? <Link to={it.to} className="yx-tl__link">{inner}</Link> : inner}
          </li>
        );
      })}
    </ul>
  );
}

/** index-10 "My Courses" inline progress (progress progress-xs) used in tables and ranked lists. */
export function ProgressRow({ label, value, max, display, tone = 'primary', to, sub }: {
  label: ReactNode; value: number; max: number; display?: ReactNode; tone?: YxTone; to?: string; sub?: ReactNode;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const content = (
    <>
      <div className="d-flex align-items-center justify-content-between mb-1 gap-2">
        <span className="fw-semibold text-truncate">{label}{sub && <span className="text-muted fw-normal fs-12 ms-2">{sub}</span>}</span>
        <span className="fw-semibold text-nowrap">{display ?? value}</span>
      </div>
      <div className="progress progress-xs" role="presentation">
        <div className={cx('progress-bar', `bg-${tone}`)} style={{ width: `${pct}%` }} />
      </div>
    </>
  );
  return to ? <Link to={to} className="yx-prow yx-prow--link">{content}</Link> : <div className="yx-prow">{content}</div>;
}

/** navs_tabs.html `nav nav-tabs tab-style-2` with roving focus (WAI-ARIA tabs). */
export function YTabs<T extends string>({ tabs, value, onChange, label, className }: {
  tabs: { id: T; label: ReactNode; count?: number; alert?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const dir = document.documentElement.dir === 'rtl' ? -d : d;
    const n = (i + dir + tabs.length) % tabs.length;
    refs.current[n]?.focus();
    onChange(tabs[n].id);
  };
  return (
    <ul className={cx('nav nav-tabs tab-style-2 yx-tabs', className)} role="tablist" aria-label={label}>
      {tabs.map((tb, i) => (
        <li className="nav-item" role="presentation" key={tb.id}>
          <button
            ref={(el) => { refs.current[i] = el; }}
            type="button" role="tab" id={`tab-${tb.id}`} aria-selected={tb.id === value} tabIndex={tb.id === value ? 0 : -1}
            className={cx('nav-link', tb.id === value && 'active')} onClick={() => onChange(tb.id)} onKeyDown={(e) => onKey(e, i)}
          >
            {tb.label}
            {tb.count != null && tb.count > 0 && <span className={cx('badge rounded-pill ms-1', tb.alert ? 'bg-danger-transparent' : 'bg-light text-muted')}>{tb.count}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Soft badge (`badge bg-*-transparent`) — always text, never colour alone. */
export function SoftBadge({ tone = 'primary', children, className }: { tone?: YxTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', tone === 'light' ? 'bg-light text-default' : `bg-${tone}-transparent`, className)}>{children}</span>;
}

/** file-manager.html / mail.html three-pane workspace: list · main · side. Collapses to one column below 1200 px. */
export function SplitPane({ list, main, side, className }: { list?: ReactNode; main: ReactNode; side?: ReactNode; className?: string }) {
  return (
    <div className={cx('yx-split', !list && 'yx-split--nolist', !side && 'yx-split--noside', className)}>
      {list && <div className="yx-split__list">{list}</div>}
      <div className="yx-split__main">{main}</div>
      {side && <div className="yx-split__side">{side}</div>}
    </div>
  );
}

/** Bootstrap grid helper: <Row><Col xl={8}>…</Col></Row> (keeps template column classes greppable). */
export function Row({ children, className, g }: { children: ReactNode; className?: string; g?: 2 | 3 | 4 }) {
  return <div className={cx('row', g != null && `g-${g}`, className)}>{children}</div>;
}
export function Col({ children, className, xxl, xl, lg, md, sm, xs }: { children: ReactNode; className?: string; xxl?: number; xl?: number; lg?: number; md?: number; sm?: number; xs?: number }) {
  return (
    <div className={cx(xs ? `col-${xs}` : 'col-12', sm ? `col-sm-${sm}` : null, md ? `col-md-${md}` : null, lg ? `col-lg-${lg}` : null, xl ? `col-xl-${xl}` : null, xxl ? `col-xxl-${xxl}` : null, className)}>
      {children}
    </div>
  );
}

/** crm-contacts.html avatar list row (index "Top Deals"): avatar + two lines + end value. */
export function AvatarList({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return <ul className="list-unstyled crm-top-deals mb-0 yx-alist">{items.map((c, i) => <li key={i}>{c}</li>)}</ul>;
}
