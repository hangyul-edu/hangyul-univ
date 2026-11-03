import type { StrategyItem } from '@hangyul/types';
import { formatDate, formatMoney } from '@hangyul/utils';

/** V5 success — agency presentation helpers (mirror of apps/student-web/src/lib/success.ts; server: services/strategy.py). */
type TFn = (key: string, opts?: Record<string, unknown>) => string;

const MONEY = new Set(['low', 'high', 'budget']);
const DATES = new Set(['deadline', 'date', 'when', 'due']);

export function itemParams(t: TFn, locale: string, p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p ?? {})) {
    if (MONEY.has(k) && typeof v === 'number') out[k] = formatMoney(v, 'KRW', locale, { compact: true });
    else if (DATES.has(k) && typeof v === 'string') out[k] = formatDate(v, locale, { month: 'short', day: 'numeric' });
    else out[k] = v;
  }
  const name = typeof p?.category === 'string' ? t(`common:docCategory.${p.category}`, { defaultValue: String(p.label ?? p.category) })
    : typeof p?.essay_type === 'string' ? t(`common:essayType.${p.essay_type}`, { defaultValue: String(p.label ?? '') })
    : typeof p?.label === 'string' ? p.label : null;
  if (name) { out.label = name; out.labelLower = name; }
  return out;
}

export function agencyItemTitle(t: TFn, locale: string, it: Pick<StrategyItem, 'code' | 'title' | 'params'>): string {
  const code = it.code === 'DOC_LEGALIZE' && it.params?.path === 'APOSTILLE' ? 'DOC_LEGALIZE_APOSTILLE' : it.code;
  const s = t(`success:agencyItem.${code}`, { ...itemParams(t, locale, it.params), defaultValue: '' });
  return s && !s.includes('{{') ? s : it.title;
}
