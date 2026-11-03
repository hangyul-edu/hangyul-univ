/**
 * V22 Insights charts — horizontal bars, built in plain HTML so every bar is a link (REPORT §250 V4).
 *
 * dataviz rules applied: one ink for a single series (`--hg-chart-1`), tangerine (`--hg-chart-highlight`) only for the
 * one highlighted bar, bars ≤ 24 px thick with a 4 px rounded data-end and a square baseline, values at the tip in text
 * ink (never in the series colour), a legend only when there are two series, hover detail on every mark, and a
 * withheld (n below the minimum) value drawn as text instead of a bar that would assert what the text refuses to say.
 */
import { useLocale } from '@hangyul/i18n';
import { cx, formatNumber } from '@hangyul/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface BarRow {
  key: string;
  label: ReactNode;
  /** Bar length (0‥max). Ignored when `withheld`. */
  value: number;
  /** Text at the tip; defaults to the formatted value. */
  display?: ReactNode;
  /** Secondary text under the tip value (e.g. "3 of 11"). */
  sub?: ReactNode;
  /** Where the bar drills to — the filtered applicant table. */
  to?: string;
  /** The one bar the section is about (tangerine). */
  highlight?: boolean;
  /** Below the minimum sample: no bar, the display text says why. */
  withheld?: boolean;
  /** Native hover detail. */
  title?: string;
}

export function HBars({ rows, label, max, dense }: { rows: BarRow[]; label: string; max?: number; dense?: boolean }) {
  const { locale } = useLocale('common');
  const m = Math.max(1, max ?? Math.max(0, ...rows.filter((r) => !r.withheld).map((r) => r.value)));
  return (
    <ol className={cx('uv22-bars', dense && 'uv22-bars--dense')} aria-label={label}>
      {rows.map((r) => {
        const inner = (
          <>
            <span className="uv22-bar__k">{r.label}</span>
            <span className="uv22-bar__track" aria-hidden>
              {!r.withheld && <span className={cx('uv22-bar__fill', r.highlight && 'is-highlight')} style={{ width: `${Math.min(100, (r.value / m) * 100)}%` }} />}
            </span>
            <span className={cx('uv22-bar__v hg-num', r.withheld && 'is-withheld')}>
              {r.display ?? formatNumber(r.value, locale)}
              {r.sub && <span className="uv22-bar__sub">{r.sub}</span>}
            </span>
          </>
        );
        return (
          <li key={r.key} className={cx('uv22-bar', r.highlight && 'is-highlight')} data-bar={r.key} data-value={r.withheld ? '' : r.value}>
            {r.to ? <Link to={r.to} className="uv22-bar__a" title={r.title}>{inner}</Link> : <span className="uv22-bar__a is-static" title={r.title}>{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export interface PairedRow {
  key: string;
  label: ReactNode;
  to?: string;
  title?: string;
  /** Two measures in the same unit (0‥1 rates); `null` = withheld. */
  a: { value: number | null; display: ReactNode };
  b: { value: number | null; display: ReactNode };
}

/** Two series per row (ink · grey), with the legend the second series requires. Both measures share one 0‥100 % axis. */
export function PairedBars({ rows, label, legend }: { rows: PairedRow[]; label: string; legend: [ReactNode, ReactNode] }) {
  const seg = (v: number | null, display: ReactNode, cls: string) => (
    <span className="uv22-pair__row">
      <span className="uv22-bar__track" aria-hidden>{v !== null && <span className={cx('uv22-bar__fill', cls)} style={{ width: `${Math.min(100, v * 100)}%` }} />}</span>
      <span className={cx('uv22-bar__v hg-num', v === null && 'is-withheld')}>{display}</span>
    </span>
  );
  return (
    <div className="uv22-pair">
      <ul className="uv22-legend" aria-label={label}>
        <li><span className="uv22-legend__swatch is-a" aria-hidden />{legend[0]}</li>
        <li><span className="uv22-legend__swatch is-b" aria-hidden />{legend[1]}</li>
      </ul>
      <ol className="uv22-bars uv22-bars--paired" aria-label={label}>
        {rows.map((r) => {
          const inner = (
            <>
              <span className="uv22-bar__k">{r.label}</span>
              <span className="uv22-pair__bars">
                {seg(r.a.value, r.a.display, 'is-a')}
                {seg(r.b.value, r.b.display, 'is-b')}
              </span>
            </>
          );
          return (
            <li key={r.key} className="uv22-bar uv22-bar--paired" data-bar={r.key}>
              {r.to ? <Link to={r.to} className="uv22-bar__a" title={r.title}>{inner}</Link> : <span className="uv22-bar__a is-static" title={r.title}>{inner}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
