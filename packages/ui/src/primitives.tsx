import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, Info, Lock, SearchX } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx, initials, type Tone } from '@hangyul/utils';
import {
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// ---------------------------------------------------------------- Button
export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'soft' | 'ghost' | 'danger' | 'success' | 'link';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  iconOnly?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, loading, icon, iconEnd, iconOnly, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('hg-btn', variant !== 'secondary' && `hg-btn--${variant}`, size !== 'md' && `hg-btn--${size}`, block && 'hg-btn--block', iconOnly && 'hg-btn--icon', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="hg-spinner" aria-hidden /> : icon}
      {children}
      {iconEnd}
    </button>
  );
});

/** Anchor styled as a button. `as` may be 'a' (pass href) or a router Link (pass to). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ButtonLink({ as: As = 'a', variant = 'secondary', size = 'md', block, icon, iconEnd, className, children, ...rest }: {
  as?: React.ElementType; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; block?: boolean; icon?: ReactNode; iconEnd?: ReactNode; className?: string; children?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;
}) {
  return (
    <As className={cx('hg-btn', variant !== 'secondary' && `hg-btn--${variant}`, size !== 'md' && `hg-btn--${size}`, block && 'hg-btn--block', className)} {...rest}>
      {icon}
      {children}
      {iconEnd}
    </As>
  );
}

// ---------------------------------------------------------------- Card
interface CardProps extends HTMLAttributes<HTMLDivElement> { pad?: boolean; warm?: boolean; flat?: boolean; interactive?: boolean; as?: 'div' | 'section' | 'article' }
export function Card({ pad, warm, flat, interactive, className, as: As = 'div', ...rest }: CardProps) {
  return <As className={cx('hg-card', pad && 'hg-card--pad', warm && 'hg-card--warm', flat && 'hg-card--flat', interactive && 'hg-card--interactive', className)} {...rest} />;
}
export function CardHeader({ title, subtitle, actions, bordered, id }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; bordered?: boolean; id?: string }) {
  return (
    <div className={cx('hg-card__header', bordered && 'hg-card__header--bordered')}>
      <div style={{ minWidth: 0 }}>
        <h2 className="hg-card__title" id={id}>{title}</h2>
        {subtitle && <div className="hg-card__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="hg-row" style={{ flex: 'none', gap: 8 }}>{actions}</div>}
    </div>
  );
}
export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => <div className={cx('hg-card__body', className)} {...rest} />;
export const CardFooter = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => <div className={cx('hg-card__footer', className)} {...rest} />;

// ---------------------------------------------------------------- Badge
export function Badge({ tone = 'neutral', dot, size, outline, icon, children, className, title }: { tone?: Tone; dot?: boolean; size?: 'sm'; outline?: boolean; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cx('hg-badge', `hg-tone-${tone}`, dot && 'hg-badge--dot', size === 'sm' && 'hg-badge--sm', outline && 'hg-badge--outline', className)} title={title}>
      {icon}
      {children}
    </span>
  );
}

export function Chip({ pressed, onClick, children, icon, ...rest }: { pressed?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button type="button" className="hg-chip" aria-pressed={pressed} onClick={onClick} {...rest}>
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Progress
export function Progress({ value, tone, size, label }: { value: number; tone?: 'success' | 'info'; size?: 'sm'; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('hg-progress', tone && `hg-progress--${tone}`, size === 'sm' && 'hg-progress--sm')} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="hg-progress__bar" style={{ width: `${v}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 88, stroke = 9, children, color, label }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="hg-ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)}%`}>
      <svg width={size} height={size} aria-hidden>
        <circle className="hg-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className="hg-ring__value" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={color ? { stroke: color } : undefined} />
      </svg>
      <div className="hg-ring__label" style={{ fontSize: size * 0.24 }}>{children ?? `${Math.round(v)}%`}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Stat / KPI
export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: ReactNode;
  foot?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  definition?: string;
  insufficient?: boolean;
  invertDelta?: boolean;
}
export function Stat({ label, value, delta, deltaLabel, foot, icon, tone = 'brand', definition, insufficient, invertDelta }: StatProps) {
  const { t } = useLocale('common');
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  return (
    <Card className="hg-stat" title={definition}>
      <div className="hg-row hg-between" style={{ alignItems: 'flex-start' }}>
        <div className="hg-stat__label">{label}</div>
        {icon && <div className={cx('hg-stat__icon', `hg-tone-${tone}`)}>{icon}</div>}
      </div>
      {insufficient ? (
        <div className="hg-stat__value hg-stat__value--muted">{t('states.insufficientData')}</div>
      ) : (
        <div className="hg-stat__value">{value}</div>
      )}
      <div className="hg-stat__foot">
        {delta !== undefined && delta !== null && !insufficient && (
          <span className={cx('hg-delta', good ? 'hg-delta--up' : 'hg-delta--down')}>
            {up ? <ArrowUpRight aria-hidden /> : <ArrowDownRight aria-hidden />}
            {Math.abs(delta)}%
          </span>
        )}
        {deltaLabel && <span>{deltaLabel}</span>}
        {foot}
      </div>
      {definition && <span className="hg-sr-only">{definition}</span>}
    </Card>
  );
}

// ---------------------------------------------------------------- Forms
export function Field({ label, hint, error, optional, children, htmlFor, className }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; optional?: boolean; children: ReactNode; htmlFor?: string; className?: string }) {
  const { t } = useLocale('common');
  return (
    <div className={cx('hg-field', className)}>
      {label && (
        <label className="hg-label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="hg-label__opt">({t('form.optional')})</span>}
        </label>
      )}
      {children}
      {error ? <div className="hg-error" role="alert">{typeof error === 'string' && /^[a-z]+\.[a-zA-Z.]+$/.test(error) ? t(error) : error}</div> : hint ? <div className="hg-hint">{hint}</div> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { size?: never; compact?: boolean; invalid?: boolean }>(function Input({ className, compact, invalid, ...rest }, ref) {
  return <input ref={ref} className={cx('hg-input', compact && 'hg-input--sm', className)} aria-invalid={invalid || undefined} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={cx('hg-textarea', className)} aria-invalid={invalid || undefined} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; compact?: boolean }>(function Select({ className, invalid, compact, ...rest }, ref) {
  return <select ref={ref} className={cx('hg-select', compact && 'hg-input--sm', className)} aria-invalid={invalid || undefined} {...rest} />;
});
/**
 * A **filter** select for toolbars (V30, REPORT §409). Not a form field — `Select` stays the form control.
 *
 * The toolbar defect it replaces: a native `<select>` sizes itself to its LONGEST option, so a filter whose
 * current value is "전체" rendered as a 109–160 px box with a 24 px word pinned to one edge and the chevron
 * pinned to the other, and nothing in it said what "전체" referred to (the category name was screen-reader
 * only). Here the visible face is `category · value ⌄` as ONE group, sized to the text actually shown, and
 * the native `<select>` is stretched invisibly over the whole face — so the hit area is the whole control,
 * the option list is the platform's own (keyboard, screen readers, mobile wheels), and nothing is
 * re-implemented. `active` marks a filter that is narrowing the results.
 */
export const FilterSelect = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  /** The category, always visible ("학교 유형", "Status"). Also the select's accessible name. */
  label: string;
  /** Hide the visible category when the toolbar already names it (the accessible name stays). */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  /** The filter is narrowing results (a non-default value) — drawn as selected. */
  active?: boolean;
  /** For stretching inside a drawer/sheet column. */
  block?: boolean;
  /**
   * The reset option (value `""`) is shown on the face as a short "전체 / All" after the category, so the face
   * reads "국가 · 전체" rather than "국가 · 모든 국가". The option list keeps its own full wording. Pass `false`
   * to show the option text instead, or a string to override.
   */
  allLabel?: string | false;
}>(function FilterSelect({ label, hideLabel, size = 'md', active, block, allLabel, className, children, onChange, style, ...rest }, ref) {
  const { t } = useLocale('common');
  const inner = useRef<HTMLSelectElement | null>(null);
  const [text, setText] = useState('');
  const faceOf = (sel: HTMLSelectElement | null) => {
    const opt = sel?.selectedOptions[0];
    if (!opt) return '';
    if (opt.value === '' && allLabel !== false && !hideLabel) return allLabel ?? t('common:v30.filter.all');
    return opt.text;
  };
  // The face shows the option's own text, whatever its children are; re-read after every render (options or
  // value may have changed) and before paint, so there is never a frame with an empty face.
  useLayoutEffect(() => {
    const next = faceOf(inner.current);
    if (next !== text) setText(next);
  });
  return (
    <span
      className={cx('hg-fsel', size === 'sm' && 'hg-fsel--sm', block && 'hg-fsel--block', className)}
      data-control="select" data-active={(active ?? (rest.value !== undefined && rest.value !== '')) || undefined} style={style}
    >
      <span className="hg-fsel__face" aria-hidden>
        {!hideLabel && <span className="hg-fsel__label">{label}</span>}
        <span className="hg-fsel__value">{text}</span>
        <ChevronDown className="hg-fsel__chev" />
      </span>
      <select
        ref={(el) => { inner.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
        className="hg-fsel__native" aria-label={label}
        onChange={(e) => { setText(faceOf(e.target)); onChange?.(e); }}
        {...rest}
      >
        {children}
      </select>
    </span>
  );
});
export function SearchInput({ icon, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }) {
  return (
    <div className="hg-input-icon">
      {icon}
      <input type="search" className="hg-input" {...rest} />
    </div>
  );
}
export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId();
  return (
    <label className="hg-check" htmlFor={rest.id ?? id}>
      <input type="checkbox" id={rest.id ?? id} {...rest} />
      <span>{label}</span>
    </label>
  );
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="hg-switch" onClick={() => onChange(!checked)} />;
}

/**
 * Large tappable choice cards — used for progressive onboarding instead of dropdowns.
 *
 * **Keyboard (V19).** In single-select mode this is an ARIA `radiogroup`, and a radiogroup has one stop in
 * the tab order, not one per option: Tab moves to the group, the arrow keys move *within* it, and Home/End
 * jump to the ends. Before V19 every card was separately tabbable with no arrow handling at all, so a
 * keyboard user on `/start` met six tab stops for two questions and the arrow keys did nothing — the
 * markup claimed a pattern the behaviour did not implement, which is worse for a screen-reader user than
 * plain buttons would have been. Multi-select is a `group` of checkboxes, where one stop each *is* correct,
 * so the roving index applies to the radio case only.
 */
export function OptionCards<V extends string>({ options, value, onChange, multiple, min = 200, label, className }: {
  options: { value: V; label: ReactNode; sub?: ReactNode; icon?: ReactNode }[];
  value: V | V[] | null | undefined;
  onChange: (v: V | V[]) => void;
  multiple?: boolean;
  min?: number;
  label: string;
  className?: string;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const group = useRef<HTMLDivElement>(null);
  // The one stop in the tab order: the checked card, or the first card when nothing is chosen yet.
  const activeIndex = Math.max(0, options.findIndex((o) => selected.has(o.value)));

  const move = (from: number, delta: number | 'home' | 'end') => {
    const to = delta === 'home' ? 0
      : delta === 'end' ? options.length - 1
      : (from + delta + options.length) % options.length;
    onChange(options[to].value);
    // Selection follows focus, which is the expected radiogroup behaviour; focus has to follow it back.
    group.current?.querySelectorAll<HTMLButtonElement>('.hg-option')[to]?.focus();
  };

  return (
    <div ref={group} className={cx('hg-options', className)} role={multiple ? 'group' : 'radiogroup'} aria-label={label}
      style={{ '--hg-min': `${min}px` } as CSSProperties}>
      {options.map((o, i) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className="hg-option"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            tabIndex={multiple || i === activeIndex ? 0 : -1}
            onKeyDown={multiple ? undefined : (e) => {
              const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
                : e.key === 'Home' ? 'home' as const
                : e.key === 'End' ? 'end' as const
                : null;
              if (d === null) return;
              e.preventDefault();
              move(i, d);
            }}
            onClick={() => {
              if (!multiple) return onChange(o.value);
              const next = new Set(selected);
              if (on) next.delete(o.value);
              else next.add(o.value);
              onChange([...next]);
            }}
          >
            {o.icon && <span className="hg-option__icon" aria-hidden>{o.icon}</span>}
            <span>
              {o.label}
              {o.sub && <span className="hg-option__sub">{o.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Tabs & segmented
export function Tabs<V extends string>({ tabs, value, onChange, label }: { tabs: { value: V; label: ReactNode; count?: number }[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <div className="hg-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" type="button" className="hg-tab" aria-selected={tab.value === value} onClick={() => onChange(tab.value)}>
          {tab.label}
          {tab.count !== undefined && <span className="hg-tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Segmented<V extends string>({ options, value, onChange, label }: { options: { value: V; label: ReactNode }[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <div className="hg-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Avatar
/** Quiet, neutral avatars: people are identified by name, not by random colour. */
const AV_TINTS = [['#EFEEEB', '#4A4640'], ['#E8EDF3', '#3C4A5C'], ['#EAF1EC', '#35503E'], ['#F1ECF3', '#51405A'], ['#F3EEE6', '#5A4A33']];
export function Avatar({ name, size = 36, src }: { name: string; size?: number; src?: string }) {
  const hash = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [bg, fg] = AV_TINTS[hash % AV_TINTS.length];
  return (
    <span className="hg-avatar" style={{ '--s': `${size}px`, '--av': bg, '--av-fg': fg } as CSSProperties} aria-hidden>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------- States
export function EmptyState({ icon, title, text, action, compact, headingLevel }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; compact?: boolean; headingLevel?: 1 | 2 | 3 }) {
  const Title = headingLevel ? (`h${headingLevel}` as const) : 'div';
  return (
    <div className={cx('hg-state', compact && 'hg-state--compact')}>
      <div className="hg-state__icon" aria-hidden>{icon ?? <SearchX />}</div>
      <Title className="hg-state__title">{title}</Title>
      {text && <div className="hg-state__text">{text}</div>}
      {action}
    </div>
  );
}
export function ErrorState({ error, onRetry, compact }: { error?: unknown; onRetry?: () => void; compact?: boolean }) {
  const { t } = useLocale('common');
  const status = (error as { status?: number })?.status;
  if (status === 403 || status === 404) {
    return <EmptyState compact={compact} icon={<Lock />} title={status === 403 ? t('states.forbidden') : t('states.notFound')} text={status === 403 ? t('states.forbiddenDetail') : undefined} />;
  }
  return (
    <div className={cx('hg-state', compact && 'hg-state--compact')} role="alert">
      <div className="hg-state__icon" aria-hidden><AlertTriangle /></div>
      <div className="hg-state__title">{t('states.error')}</div>
      {/* V30 (REPORT §409): only a SERVER's 4xx message is shown (the API localizes it via Accept-Language). A client
          timeout (408, "Request timed out after 20s") or a network TypeError ("Failed to fetch") is engineering text
          in English — the reader gets the localized "couldn't load, check your connection" sentence instead. */}
      <div className="hg-state__text">{(error as Error)?.message && typeof status === 'number' && status >= 400 && status < 500 && status !== 408 ? (error as Error).message : t('states.errorDetail')}</div>
      {onRetry && <Button size="sm" onClick={onRetry}>{t('actions.retry')}</Button>}
    </div>
  );
}
export function Skeleton({ w = '100%', h = 16, r, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="hg-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />;
}
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { t } = useLocale('common');
  return (
    <Card pad aria-busy="true">
      <span className="hg-sr-only">{t('states.loading')}</span>
      <div className="hg-stack" style={{ '--hg-gap': '12px' } as CSSProperties}>
        <Skeleton w="40%" h={18} />
        {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} w={`${90 - i * 12}%`} />)}
      </div>
    </Card>
  );
}

/** One place to render loading / error / empty / permission states for a query. */
export function QueryState<T>({ query, empty, isEmpty, skeleton, children }: {
  query: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <>{skeleton ?? <SkeletonCard />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

// ---------------------------------------------------------------- Callout
export function Callout({ tone = 'info', title, children, icon, action }: { tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'danger' ? AlertCircle : tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={cx('hg-callout', `hg-tone-${tone}`)} role={tone === 'danger' ? 'alert' : undefined}>
      {icon ?? <Icon aria-hidden />}
      <div className="hg-grow">
        {title && <div className="hg-callout__title">{title}</div>}
        {children && <div className="hg-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function DescriptionList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="hg-dl">
      {items.map((it, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{it.label}</dt>
          <dd>{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  const { t } = useLocale('common');
  return (
    <header className="hg-page-head">
      <div style={{ minWidth: 0 }}>
        {crumbs && <nav className="hg-crumbs" aria-label={t('a11y.breadcrumb')}>{crumbs}</nav>}
        <h1 className="hg-page-head__title">{title}</h1>
        {subtitle && <p className="hg-page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="hg-page-head__actions">{actions}</div>}
    </header>
  );
}

export function Grid({ cols = 1, md, lg, gap, min, children, className, style }: { cols?: number; md?: number; lg?: number; gap?: number; min?: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  if (min) return <div className={cx('hg-grid-auto', className)} style={{ '--hg-min': `${min}px`, '--hg-gap': gap ? `${gap}px` : undefined, ...style } as CSSProperties}>{children}</div>;
  return (
    <div
      className={cx('hg-grid', className)}
      data-md={md ? '' : undefined}
      data-lg={lg ? '' : undefined}
      style={{ '--hg-cols': cols, '--hg-md-cols': md ?? cols, '--hg-lg-cols': lg ?? md ?? cols, '--hg-gap': gap ? `${gap}px` : undefined, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}
