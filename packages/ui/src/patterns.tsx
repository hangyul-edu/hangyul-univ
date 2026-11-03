import { Check, ChevronRight, Info } from '@hangyul/icons';
import { cx, type Tone } from '@hangyul/utils';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { UniversityPhotoRef } from '@hangyul/types';

/**
 * Page-composition patterns for the v2 design language.
 * Prefer these over Card: a Section is a heading plus content with no box; lists are rows separated by hairlines.
 */

export function Section({ title, sub, action, children, ruled, id, className, as: As = 'section', headingLevel = 2 }: {
  title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; ruled?: boolean; id?: string; className?: string; as?: ElementType; headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <As className={cx('hg-section', ruled && 'hg-section--ruled', className)} aria-labelledby={title && id ? `${id}-title` : undefined} id={id}>
      {(title || action) && (
        <div className="hg-section__head">
          <div style={{ minWidth: 0 }}>
            {title && <H className="hg-section__title" id={id ? `${id}-title` : undefined}>{title}</H>}
            {sub && <p className="hg-section__sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </As>
  );
}

/** Status as a coloured dot + words. Use in lists and tables instead of pills. */
export function StatusText({ tone = 'neutral', children, hollow, colored, title }: { tone?: Tone; children: ReactNode; hollow?: boolean; colored?: boolean; title?: string }) {
  return <span className={cx('hg-status', `hg-tone-${tone}`, hollow && 'hg-status--hollow', colored && 'hg-status--text')} title={title}>{children}</span>;
}

/** A row in a hairline-separated list. Renders a link/button when `as` is given. */
export function ListRow({ as: As = 'div', lead, title, meta, end, chevron, className, ...rest }: {
  as?: ElementType; lead?: ReactNode; title: ReactNode; meta?: ReactNode; end?: ReactNode; chevron?: boolean; className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;
}) {
  return (
    <As className={cx('hg-lrow', className)} {...rest}>
      {lead}
      <span className="hg-lrow__main">
        <span className="hg-lrow__title">{title}</span>
        {meta && <span className="hg-lrow__meta">{meta}</span>}
      </span>
      {end && <span className="hg-lrow__end">{end}</span>}
      {chevron && <ChevronRight className="hg-lrow__chev hg-flip-rtl" aria-hidden />}
    </As>
  );
}

/** Small ⓘ with a hover/focus definition. Use for metric definitions. */
export function InfoTip({ text, label }: { text: ReactNode; label?: string }) {
  return (
    <button type="button" className="hg-tip" aria-label={label ?? (typeof text === 'string' ? text : undefined)}>
      <Info aria-hidden />
      <span className="hg-tip__body" role="tooltip">{text}</span>
    </button>
  );
}

export interface MetricItem { label: ReactNode; value: ReactNode; foot?: ReactNode; definition?: string; href?: string; muted?: boolean; as?: ElementType; to?: string }

/** Several numbers in one ruled strip — replaces grids of KPI cards. */
export function Metrics({ items, className }: { items: MetricItem[]; className?: string }) {
  return (
    <div className={cx('hg-metrics', className)}>
      {items.map((m, i) => {
        const As: ElementType = m.as ?? (m.href ? 'a' : 'div');
        return (
          <As key={i} className="hg-metric" {...(m.href ? { href: m.href } : {})} {...(m.to ? { to: m.to } : {})}>
            <span className="hg-metric__label">{m.label}{m.definition && <InfoTip text={m.definition} />}</span>
            <span className={cx('hg-metric__value', m.muted && 'hg-metric__value--muted')}>{m.value}</span>
            {m.foot && <span className="hg-metric__foot">{m.foot}</span>}
          </As>
        );
      })}
    </div>
  );
}

export interface RailStep { key: string; label: ReactNode; meta?: ReactNode }

/** The student's position in the whole Korea journey. Done ✓ · current (tangerine) · upcoming. */
export function JourneyRail({ steps, current, label, compact }: { steps: RailStep[]; current: string; label: string; compact?: boolean }) {
  const idx = Math.max(0, steps.findIndex((s) => s.key === current));
  return (
    <ol className={cx('hg-rail', compact && 'hg-rail--compact')} aria-label={label}>
      {steps.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <li key={s.key} className="hg-rail__item" data-state={state} data-near={Math.abs(i - idx) <= 1 || undefined} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="hg-rail__track"><span className="hg-rail__node">{state === 'done' && <Check aria-hidden />}</span></span>
            <span>
              <span className="hg-rail__label" style={{ display: 'block' }}>{s.label}</span>
              {s.meta && <span className="hg-rail__meta">{s.meta}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** University monogram. Uses the university's brand colour when known, a neutral ink otherwise. */
export function UniMark({ name, color, size, photo }: { name: string; color?: string | null; size?: 'sm' | 'lg'; photo?: UniversityPhotoRef | null }) {
  // V25 (REPORT §313 S3): a campus photograph where the directory holds one; the letter tile only where it does not.
  if (photo?.local_path) {
    const webp = photo.formats?.includes('webp');
    // V26 (REPORT §348): a 36–72 px tile loads the 240-px rendition where the asset records one (every hero does since
    // V26), not the 640 — 337 KB → ~45 KB of images on the first paint of Explore.
    const w = photo.renditions?.includes(240) ? 240 : 640;
    return (
      <span className={cx('hg-mark hg-mark--photo', size === 'sm' && 'hg-mark--sm', size === 'lg' && 'hg-mark--lg')} aria-hidden>
        <picture>
          {webp && <source type="image/webp" srcSet={`/${photo.local_path}-${w}.webp`} />}
          <img src={`/${photo.local_path}-${w}.jpg`} alt="" loading="lazy" decoding="async" width={w} height={w} style={{ objectPosition: `${photo.focal_x}% ${photo.focal_y}%` }} />
        </picture>
      </span>
    );
  }
  return (
    <span className={cx('hg-mark', size === 'sm' && 'hg-mark--sm', size === 'lg' && 'hg-mark--lg')} style={{ background: color ?? 'var(--hg-palette-gray-700)' } as CSSProperties} aria-hidden>
      {(name || '?').replace(/^The\s+/i, '').slice(0, 1)}
    </span>
  );
}

/** Distribution as label + value + thin bar. */
export function Bars({ items, max, format = String, highlight }: { items: { key: string; label: ReactNode; value: number; href?: string }[]; max?: number; format?: (n: number) => string; highlight?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="hg-bars">
      {items.map((it) => (
        <li key={it.key}>
          <span className="hg-truncate">{it.href ? <a href={it.href} className="hg-link">{it.label}</a> : it.label}</span>
          <span className="hg-bars__value">{format(it.value)}</span>
          <span className="hg-bars__track" aria-hidden><span className="hg-bars__fill" style={{ width: `${(it.value / top) * 100}%`, background: highlight === it.key ? 'var(--hg-chart-highlight)' : undefined }} /></span>
        </li>
      ))}
    </ul>
  );
}
