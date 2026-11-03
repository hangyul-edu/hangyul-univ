import { useApi } from '@hangyul/auth';
import type { CostBasis } from '@hangyul/types';
import { formatMoney } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function useBudget(programIds: string[] | undefined, housing?: 'DORM' | 'OFF_CAMPUS') {
  const api = useApi();
  const ids = programIds?.filter(Boolean) ?? [];
  return useQuery({
    queryKey: ['budget', ids.join(','), housing ?? ''],
    queryFn: () => api.me.budget(ids.length ? ids : undefined, housing),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useFx() {
  const api = useApi();
  return useQuery({ queryKey: ['fx'], queryFn: () => api.meta.fx(), staleTime: 3_600_000 });
}

const CUR_KEY = 'hg.student.currency';
export function useDisplayCurrency(): [string, (c: string) => void] {
  const [cur, setCur] = useState<string>(() => { try { return localStorage.getItem(CUR_KEY) || 'KRW'; } catch { return 'KRW'; } });
  return [cur, (c: string) => { setCur(c); try { localStorage.setItem(CUR_KEY, c); } catch { /* ignore */ } }];
}

/** Formats a KRW amount (or range) in the display currency. Converted values are always marked "≈" — they are indicative. */
export function money(krw: number | null | undefined, cur: string, rates: Record<string, number> | undefined, locale: string): string {
  if (krw === null || krw === undefined) return '—';
  if (cur === 'KRW' || !rates?.[cur]) return formatMoney(krw, 'KRW', locale, { compact: true });
  return `≈ ${formatMoney(krw / rates[cur], cur, locale, { compact: true })}`;
}

export function range(lo: number | null | undefined, hi: number | null | undefined, cur: string, rates: Record<string, number> | undefined, locale: string): string {
  if (lo === null || lo === undefined) return '—';
  if (hi === null || hi === undefined || Math.abs(hi - lo) < Math.max(1, lo) * 0.02) return money(lo, cur, rates, locale);
  const a = money(lo, cur, rates, locale);
  const b = money(hi, cur, rates, locale).replace(/^≈ /, '');
  return `${a} – ${b}`;
}

/**
 * i18n key for a cost basis label. SAMPLE (seeded catalog figures, development only) is shown as the product's
 * honest "Not yet verified" — no development wording per row; the environment is disclosed once by DevAccess.
 */
export const basisLabelKey = (b: CostBasis): string => (b === 'SAMPLE' ? 'common:freshness.unverified' : `budget.basis.${b}`);

export const BASIS_TONE: Record<CostBasis, 'success' | 'neutral' | 'info' | 'warning'> = { OFFICIAL: 'success', SAMPLE: 'neutral', ESTIMATE: 'info', UNKNOWN: 'warning' };
