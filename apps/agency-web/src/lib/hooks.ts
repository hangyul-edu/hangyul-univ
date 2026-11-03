import type { ApiClient } from '@hangyul/api-client';
import { useAuth } from '@hangyul/auth';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export type TeamResponse = Awaited<ReturnType<ApiClient['agency']['team']>>;
export type TeamMember = TeamResponse['members'][number];

/**
 * V22 (REPORT §246): one permission per agency. Every agency member is `AGENCY_ADMIN` and can do everything the
 * console offers; only Hangyul's own staff are distinguished (`isHangyul`, `ops`). The API enforces all of this —
 * the UI no longer hides anything behind owner/manager/counselor/reviewer, because those roles no longer exist.
 */
export function usePerms() {
  const { hasRole, isHangyul, session } = useAuth();
  return {
    isHangyul,
    /** Hangyul ops/admin — can override assignments, check sources, manage university accounts. */
    ops: hasRole('HANGYUL_OPERATIONS', 'HANGYUL_SUPER_ADMIN'),
    userId: session?.user.id ?? '',
    orgName: session?.active_org?.org_name ?? '',
  };
}

export function useTeam() {
  const { api } = useAuth();
  return useQuery({ queryKey: ['agency', 'team'], queryFn: () => api.agency.team(), staleTime: 5 * 60_000 });
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Read/write a set of URL search params as typed filters (so filtered lists are linkable from the dashboard). */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const set = (patch: Partial<Record<K, string | null>>, resetPage = true) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch) as [string, string | null | undefined][]) {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });
  };
  const clear = () => setParams(new URLSearchParams(), { replace: true });
  const active = keys.filter((k) => k !== ('page' as K) && k !== ('sort' as K) && values[k]).length;
  return { values, set, clear, active, params };
}

/** Keyboard shortcuts that ignore keystrokes typed into form fields. */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (document.querySelector('.hg-modal, .hg-drawer')) return;
      const fn = map[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(e); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [map, enabled]);
}
