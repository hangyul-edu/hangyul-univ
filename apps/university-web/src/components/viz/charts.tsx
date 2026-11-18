/**
 * University console charts (2026-11 design pass) — dependency-free HTML/SVG, so every mark can be a link to the
 * applicants it counts and the whole set costs a few KB in the route chunk (Recharts stays behind `components/charts`).
 *
 * Rules every chart here follows (docs/ANALYTICS.md, docs/SECURITY.md, dataviz):
 *  - a denominator is always printed ("12 of 26"); a percentage only when the API did not flag the sample as too small
 *    (`insufficient_data` / value === null) — then the text says "Too few to rate" and NO bar or shade is drawn for it;
 *  - one ink (`--hg-chart-1`) for a single series; tangerine (`--hg-chart-highlight`) only for the one mark a chart is
 *    about, and that mark also carries a text label, so nothing depends on colour;
 *  - values and labels wear text tokens; the track is `--hg-surface-sunken` (data tracks only);
 *  - a screen-reader table or list carries the same numbers as the picture.
 */
import { ArrowDownRight } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { cx, formatNumber, formatPercent } from '@hangyul/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

export interface RateLike { value: number | null; numerator: number | null; denominator: number; insufficient_data?: boolean; insufficient?: boolean }

/** True when a rate may not be shown as a percentage (the API's own flag, or no value, or an empty denominator). */
export function withheld(r: RateLike | null | undefined): boolean {
  return !r || r.value === null || r.value === undefined || !!r.insufficient_data || !!r.insufficient || !r.denominator;
}

/** "46% · 12 of 26", or "Too few to rate · 4 of 4". The count pair is always printed. */
export function RateNote({ r, className, pctFirst = true }: { r: RateLike | null | undefined; className?: string; pctFirst?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  if (!r || !r.denominator) return <span className={cx('un-rate', className)}>—</span>;
  const of = t('university:metric.ofN', { num: formatNumber(r.numerator ?? 0, locale), den: formatNumber(r.denominator, locale) });
  const w = withheld(r);
  const pct = w ? <span className="un-rate__low">{t('university:af.lowN')}</span> : <span className="un-rate__pct hg-num">{formatPercent(r.value as number, locale, 0)}</span>;
  return (
    <span className={cx('un-rate', className)} data-withheld={w || undefined}>
      {pctFirst ? <>{pct}<span className="un-rate__of hg-num">{of}</span></> : <><span className="un-rate__of hg-num">{of}</span>{pct}</>}
    </span>
  );
}

// ------------------------------------------------------------------ funnel with conversion between steps

export interface FunnelStep {
  key: string;
  label: ReactNode;
  count: number;
  /** Conversion from the step before (null on the first step). */
  conversion: RateLike | null;
  to?: string;
  title?: string;
}

/**
 * Funnel bars: step · bar · count · conversion from the step before (percentage + "n of N"). The step with the lowest
 * rated conversion is marked in words ("Largest drop") and in tangerine; withheld conversions are text only.
 */
export function StepFunnel({ steps, label, dropKey, dense, base }: { steps: FunnelStep[]; label: string; dropKey?: string | null; dense?: boolean; base?: number }) {
  const { t, locale } = useLocale(['university', 'common']);
  const max = Math.max(1, base ?? steps[0]?.count ?? 0);
  return (
    <ol className={cx('un-funnel', dense && 'un-funnel--dense')} aria-label={label}>
      {steps.map((s, i) => {
        const drop = s.key === dropKey;
        const inner = (
          <>
            <span className="un-funnel__k">{s.label}</span>
            <span className="un-funnel__track" aria-hidden><span className={cx('un-funnel__fill', drop && 'is-drop')} style={{ inlineSize: `${Math.min(100, (s.count / max) * 100)}%` }} /></span>
            <span className="un-funnel__n hg-num">{formatNumber(s.count, locale)}</span>
            <span className="un-funnel__conv">
              {i === 0 || !s.conversion ? <span className="un-funnel__base">{i === 0 ? t('university:v33.viz.base') : '—'}</span> : <RateNote r={s.conversion} />}
              {drop && <span className="un-funnel__drop"><ArrowDownRight aria-hidden />{t('university:v22.in.largestDrop')}</span>}
            </span>
          </>
        );
        return (
          <li key={s.key} className={cx('un-funnel__row uv22-bar', drop && 'is-drop')} data-bar={s.key} data-value={s.count} data-drop={drop || undefined}>
            {s.to ? <Link to={s.to} className="un-funnel__a uv22-bar__a" title={s.title}>{inner}</Link> : <span className="un-funnel__a is-static" title={s.title}>{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ ranked horizontal bars

export interface RankRow {
  key: string;
  label: ReactNode;
  /** Bar length. */
  value: number;
  /** Text after the bar; defaults to "value of total". */
  note?: ReactNode;
  /** Small second line under the label. */
  sub?: ReactNode;
  to?: string;
  title?: string;
  highlight?: boolean;
  /** No bar: the note explains why (small sample). */
  withheld?: boolean;
}

/**
 * Ranked horizontal bars. `total` prints the denominator on every row ("8 of 29") and, when the total is at least
 * `min`, the share; below `min` the share is not computed.
 */
export function RankBars({ rows, label, total, max, min = 5, dense }: { rows: RankRow[]; label: string; total?: number; max?: number; min?: number; dense?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  const m = Math.max(1, max ?? Math.max(0, ...rows.filter((r) => !r.withheld).map((r) => r.value)));
  return (
    <ol className={cx('un-rank', dense && 'un-rank--dense')} aria-label={label}>
      {rows.map((r) => {
        const note = r.note ?? (total !== undefined ? (
          <>
            <span className="un-rank__of hg-num">{t('university:metric.ofN', { num: formatNumber(r.value, locale), den: formatNumber(total, locale) })}</span>
            {total >= min && <span className="un-rank__pct hg-num">{formatPercent(r.value / total, locale, 0)}</span>}
          </>
        ) : <span className="un-rank__of hg-num">{formatNumber(r.value, locale)}</span>);
        const inner = (
          <>
            <span className="un-rank__k"><span className="un-rank__label">{r.label}</span>{r.sub && <span className="un-rank__sub">{r.sub}</span>}</span>
            <span className="un-rank__track" aria-hidden>{!r.withheld && <span className={cx('un-rank__fill', r.highlight && 'is-highlight')} style={{ inlineSize: `${Math.min(100, (r.value / m) * 100)}%` }} />}</span>
            <span className={cx('un-rank__v', r.withheld && 'is-withheld')}>{note}</span>
          </>
        );
        return (
          <li key={r.key} className="un-rank__row uv22-bar" data-bar={r.key} data-value={r.withheld ? '' : r.value}>
            {r.to ? <Link to={r.to} className="un-rank__a uv22-bar__a" title={r.title}>{inner}</Link> : <span className="un-rank__a is-static" title={r.title}>{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ monthly trend line

export interface MonthPoint { month: string; value: number }

/** The current calendar month as YYYY-MM (the last bucket of a monthly series is still filling when it equals this). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Last complete month against the one before it — only from months the series actually contains. */
export function monthOverMonth(pts: MonthPoint[], now = new Date()): { last: MonthPoint; prev: MonthPoint; delta: number; partial: MonthPoint | null } | null {
  if (pts.length < 2) return null;
  const tail = pts[pts.length - 1];
  const partial = tail.month === currentMonth(now) ? tail : null;
  const complete = partial ? pts.slice(0, -1) : pts;
  if (complete.length < 2) return null;
  const last = complete[complete.length - 1];
  const prev = complete[complete.length - 2];
  return { last, prev, delta: last.value - prev.value, partial };
}

/**
 * Submitted applications per calendar month. One line, a marker per month; the peak and the latest month are labelled,
 * every point has a hover/focus value and (when `linkFor` is given) opens that month's applicants. A month still in
 * progress is drawn hollow with a dashed segment, so an incomplete bucket is never read as a fall.
 */
export function MonthTrend({ points, title, linkFor, height = 200, compact }: { points: MonthPoint[]; title: string; linkFor?: (month: string) => string; height?: number; compact?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  const nav = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(compact ? 420 : 720);
  useEffect(() => {
    const el = wrap.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((es) => { const w = Math.round(es[0].contentRect.width); if (w > 0) setW(Math.max(240, w)); });
    ro.observe(el); return () => ro.disconnect();
  }, [points.length]);
  if (!points.length) return null;
  const H = height; const L = 30; const R = 14; const T = 22; const B = 26;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const fmtMonth = (m: string, long = false) => new Intl.DateTimeFormat(locale, long ? { month: 'long', year: 'numeric' } : { month: 'short' }).format(new Date(`${m}-15T00:00:00`));
  const lastIdx = points.length - 1;
  const partial = points[lastIdx].month === currentMonth();
  const solid = partial ? points.slice(0, -1) : points;
  const line = solid.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = solid.length > 1 ? `${line} L${x(solid.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const step = (W - L - R) / Math.max(1, points.length - 1);
  const every = step >= 44 ? 1 : step >= 26 ? 2 : 3;
  const total = points.reduce((a, p) => a + p.value, 0);
  const go = (m: string) => { if (linkFor) nav(linkFor(m)); };
  return (
    <div className={cx('un-trend uv25-trend', compact && 'un-trend--compact')} ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={`${title} — ${t('university:v33.viz.trendTotal', { n: formatNumber(total, locale) })}`}>
        {[0, 0.5, 1].map((g) => <line key={g} className="un-trend__grid" x1={L} x2={W - R} y1={y(max * g)} y2={y(max * g)} />)}
        <text className="un-trend__axis" x={L - 8} y={y(max) + 4} textAnchor="end">{formatNumber(max, locale)}</text>
        <text className="un-trend__axis" x={L - 8} y={y(0) + 4} textAnchor="end">0</text>
        {area && <path className="un-trend__area" d={area} />}
        <path className="un-trend__line" d={line} />
        {partial && points.length > 1 && <line className="un-trend__line is-partial" x1={x(lastIdx - 1)} y1={y(points[lastIdx - 1].value)} x2={x(lastIdx)} y2={y(points[lastIdx].value)} />}
        {points.map((p, i) => {
          const link = !!linkFor && p.value > 0;
          const isPartial = partial && i === lastIdx;
          const labelled = (i === peak && p.value > 0) || i === lastIdx;
          const aria = `${fmtMonth(p.month, true)}: ${formatNumber(p.value, locale)}${isPartial ? ` (${t('university:v33.viz.soFar')})` : ''}`;
          return (
            <g key={p.month} className={cx('un-trend__pt', link && 'is-link', isPartial && 'is-partial', labelled && 'is-labelled')} role={link ? 'link' : undefined} tabIndex={link ? 0 : undefined}
              aria-label={link ? aria : undefined} onClick={link ? () => go(p.month) : undefined}
              onKeyDown={link ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(p.month); } } : undefined}>
              <rect className="un-trend__hit" x={x(i) - step / 2} y={0} width={step} height={H - B} />
              <circle cx={x(i)} cy={y(p.value)} r={i === lastIdx || i === peak ? 4 : 3} />
              <text className="un-trend__val" x={Math.min(W - R, Math.max(L, x(i)))} y={y(p.value) - 10} textAnchor={i === lastIdx ? 'end' : 'middle'}>{formatNumber(p.value, locale)}</text>
              <title>{aria}</title>
              {((lastIdx - i) % every === 0) && <text className="un-trend__axis" x={x(i)} y={H - 6} textAnchor={i === lastIdx ? 'end' : 'middle'}>{fmtMonth(p.month)}</text>}
            </g>
          );
        })}
      </svg>
      <table className="hg-sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">{t('university:v33.viz.month')}</th><th scope="col">{t('university:v25.in.submitted')}</th></tr></thead>
        <tbody>{points.map((p, i) => <tr key={p.month}><th scope="row">{fmtMonth(p.month, true)}</th><td>{p.value}{partial && i === lastIdx ? ` (${t('university:v33.viz.soFar')})` : ''}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ heat matrix (cohort × stage)

export interface MatrixCell {
  /** null = not tracked for this row ("—"). */
  count: number | null;
  /** Share of the row's base, 0‥1 — null when it may not be shown (base below the minimum): the cell is then unshaded. */
  share: number | null;
  /** Printed instead of the bare count (e.g. "86% · 6 of 7", or "Too few to rate · 1 of 1"). */
  text?: ReactNode;
  title?: string;
}
export interface MatrixRow { key: string; label: ReactNode; to?: string; onSelect?: () => void; selected?: boolean; cells: MatrixCell[]; tail?: ReactNode[] }
export interface MatrixCol { key: string; label: ReactNode; group?: string; sep?: boolean }

/** Sequential single-hue step for a share (5 steps); text flips to white on the two darkest. */
function shade(share: number): number { return share <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(share * 5))); }

/**
 * Cohort matrix: rows are groups (entry cohorts, countries…), columns are stages. Each cell prints its count; the shade
 * is the cell's share of the row's base and is drawn only when that base meets the minimum sample — a small cohort
 * shows plain counts. Colour is therefore redundant with the number, never the only carrier.
 */
export function HeatMatrix({ cols, rows, caption, groups, tailCols }: {
  cols: MatrixCol[]; rows: MatrixRow[]; caption: string;
  groups?: { label: ReactNode; span: number; sep?: boolean }[];
  tailCols?: { key: string; label: ReactNode }[];
}) {
  const { locale } = useLocale('common');
  return (
    <div className="un-matrix__wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="un-matrix">
        <caption className="hg-sr-only">{caption}</caption>
        <thead>
          {groups && (
            <tr className="un-matrix__groups">
              <th scope="col" rowSpan={2} className="un-matrix__corner">{caption}</th>
              {groups.map((g, i) => <th key={i} scope="colgroup" colSpan={g.span} className={cx(g.sep && 'is-sep')}>{g.label}</th>)}
            </tr>
          )}
          <tr>
            {!groups && <th scope="col" className="un-matrix__corner">{caption}</th>}
            {cols.map((c) => <th key={c.key} scope="col" className={cx('un-matrix__col', c.sep && 'is-sep')}>{c.label}</th>)}
            {tailCols?.map((c, i) => <th key={c.key} scope="col" className={cx('un-matrix__tail', i === 0 && 'is-sep')}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} aria-selected={r.selected || undefined}>
              <th scope="row" className="un-matrix__row">
                {r.to ? <Link to={r.to}>{r.label}</Link> : r.onSelect ? <button type="button" className="un-matrix__rowbtn" onClick={r.onSelect} aria-pressed={!!r.selected}>{r.label}</button> : r.label}
              </th>
              {r.cells.map((c, i) => (
                <td key={cols[i].key} className={cx('un-matrix__cell', cols[i].sep && 'is-sep')} title={c.title} data-label={typeof cols[i].label === 'string' ? cols[i].label : undefined}>
                  {c.count === null ? <span className="un-matrix__na">—</span> : (
                    <span className={cx('un-matrix__chip hg-num', c.text !== undefined && 'has-text')} data-shade={c.share === null ? undefined : shade(c.share)}>{c.text ?? formatNumber(c.count, locale)}</span>
                  )}
                </td>
              ))}
              {r.tail?.map((x, i) => <td key={i} className={cx('un-matrix__tail', i === 0 && 'is-sep')} data-label={typeof tailCols?.[i]?.label === 'string' ? (tailCols[i].label as string) : undefined}>{x}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The legend a shaded matrix needs: five steps of one hue, low → high, with the rule for unshaded cells. */
export function MatrixLegend({ low, high, note }: { low: ReactNode; high: ReactNode; note?: ReactNode }) {
  return (
    <p className="un-matrix__legend">
      <span>{low}</span>
      <span className="un-matrix__scale" aria-hidden>{[1, 2, 3, 4, 5].map((s) => <i key={s} data-shade={s} />)}</span>
      <span>{high}</span>
      {note && <span className="un-matrix__legendnote">{note}</span>}
    </p>
  );
}

/** A chart with the plain-language title that says what it shows, an optional lead figure and a source/rule footnote. */
export function Figure({ title, sub, children, foot, action, id }: { title: ReactNode; sub?: ReactNode; children: ReactNode; foot?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <figure className="un-figure uv22-chart" id={id}>
      <figcaption className="un-figure__head">
        <span className="un-figure__titles">
          <span className="un-figure__title">{title}</span>
          {sub && <span className="un-figure__sub">{sub}</span>}
        </span>
        {action}
      </figcaption>
      {children}
      {foot && <p className="un-figure__foot">{foot}</p>}
    </figure>
  );
}
