/**
 * Chart primitives (Recharts). Import from '@hangyul/ui/charts' behind React.lazy so dashboards ship charts
 * in a separate chunk. Every chart renders a visually-hidden data table for screen readers.
 *
 * V11 (REPORT §77.2 / §78.4): this module exported four chart types and the product rendered exactly **one**.
 * `TrendChart`, `BarList` and `DonutChart` had no call site anywhere in any app — they were a chart library we
 * had written for ourselves, and the donut is on the brief's own list of things not to use. Removing them also
 * drops Recharts' `Pie`, `PieChart`, `Cell`, `Line`, `LineChart`, `Area` and `AreaChart` from the bundle.
 * A chart earns its place by answering a question that leads to a decision; one that is never rendered answers
 * nothing at all.
 */
import { chart as palette } from '@hangyul/design-tokens';
import type { CSSProperties } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Resolve a chart token at runtime so surfaces can re-theme charts (consoles use the blue palette, REPORT §36). */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
export const CHART_COLORS: string[] = palette.categorical.map((c, i) => cssVar(`--hg-chart-${i + 1}`, c));
const GRID = cssVar('--hg-chart-grid', palette.grid);
const axis = { stroke: cssVar('--hg-chart-axis', palette.axis), fontSize: 12, tickLine: false, axisLine: false } as const;

function Summary({ rows, columns, title }: { rows: Record<string, unknown>[]; columns: { key: string; label: string }[]; title: string }) {
  return (
    <div className="hg-sr-only"><table>
      <caption>{title}</caption>
      <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key}>{String(r[c.key] ?? '')}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="hg-chart-tooltip">
      {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="hg-row" style={{ gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span className="hg-muted">{p.name}</span>
          <strong className="hg-num" style={{ marginInlineStart: 'auto' }}>{format ? format(p.value ?? 0) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export interface SeriesDef { key: string; label: string; color?: string }

export function ColumnChart({ data, xKey, series, height = 260, title, stacked, horizontal, onSelect, yFormat }: {
  data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; height?: number; title: string; stacked?: boolean; horizontal?: boolean; onSelect?: (row: Record<string, unknown>) => void; yFormat?: (v: number) => string;
}) {
  return (
    <div className="hg-chart" style={{ '--h': `${height}px` } as CSSProperties}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 8 : -12, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={GRID} />
          {horizontal ? (
            <>
              <XAxis type="number" {...axis} allowDecimals={false} tickFormatter={yFormat} />
              <YAxis type="category" dataKey={xKey} {...axis} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axis} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 56 : 30} />
              <YAxis {...axis} allowDecimals={false} width={44} tickFormatter={yFormat} />
            </>
          )}
          <Tooltip content={<TooltipBox format={yFormat} />} cursor={{ fill: 'rgba(107,113,123,0.07)' }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId={stacked ? 'a' : undefined} fill={s.color ?? CHART_COLORS[i]} radius={stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              onClick={onSelect ? (d) => onSelect(d as unknown as Record<string, unknown>) : undefined} style={{ cursor: onSelect ? 'pointer' : undefined }} maxBarSize={32} />
          ))}
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        </BarChart>
      </ResponsiveContainer>
      <Summary title={title} rows={data} columns={[{ key: xKey, label: xKey }, ...series.map((s) => ({ key: s.key, label: s.label }))]} />
    </div>
  );
}

export default { ColumnChart };
