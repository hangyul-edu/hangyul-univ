import { useAuth } from '@hangyul/auth';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { permissionsFor, type Perms } from './permissions';

const PICK_KEY = 'hg.university.pick';

export interface UniversityOverview {
  id: string; name_en: string; name_ko: string; slug: string; certification_status: string; is_partner: boolean; brand_color: string | null;
}

interface UniversityCtx {
  /** Id of the university being viewed (null while a Hangyul user hasn't picked one). */
  universityId: string | null;
  /** Value to pass as `university_id` to the API: undefined for university staff (the API scopes by membership). */
  scopeId: string | undefined;
  isHangyul: boolean;
  needsPick: boolean;
  pick: (id: string | null) => void;
  overview: UniversityOverview | undefined;
  overviewQuery: UseQueryResult<{ university: UniversityOverview }>;
  perms: Perms;
}

const Ctx = createContext<UniversityCtx | null>(null);

function readPick(): string | null {
  try { return localStorage.getItem(PICK_KEY); } catch { return null; }
}

export function UniversityProvider({ children }: { children: ReactNode }) {
  const { api, session, isHangyul } = useAuth();
  const [picked, setPicked] = useState<string | null>(() => readPick());
  const ownId = session?.active_org?.university_id ?? null;
  const universityId = isHangyul ? picked : ownId;
  const scopeId = isHangyul ? picked ?? undefined : undefined;

  const overviewQuery = useQuery({
    queryKey: ['university', 'overview', scopeId ?? 'own'],
    queryFn: () => api.university.overview(scopeId),
    enabled: !isHangyul || !!picked,
    staleTime: 5 * 60_000,
  });

  const pick = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(PICK_KEY, id);
      else localStorage.removeItem(PICK_KEY);
    } catch { /* private mode */ }
    setPicked(id);
  }, []);

  const perms = useMemo(() => permissionsFor(session?.roles ?? []), [session?.roles]);

  const value = useMemo<UniversityCtx>(() => ({
    universityId: universityId ?? overviewQuery.data?.university.id ?? null,
    scopeId,
    isHangyul,
    needsPick: isHangyul && !picked,
    pick,
    overview: overviewQuery.data?.university,
    overviewQuery,
    perms,
  }), [universityId, scopeId, isHangyul, picked, pick, overviewQuery, perms]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUniversity(): UniversityCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUniversity must be used inside <UniversityProvider>');
  return v;
}

/** Test helper: provide a fixed context without network. */
export function UniversityTestProvider({ value, children }: { value: Partial<UniversityCtx>; children: ReactNode }) {
  const base: UniversityCtx = {
    universityId: 'u1', scopeId: undefined, isHangyul: false, needsPick: false, pick: () => undefined, overview: undefined,
    overviewQuery: {} as UniversityCtx['overviewQuery'], perms: permissionsFor(['UNIVERSITY_ADMIN']),
  };
  return <Ctx.Provider value={{ ...base, ...value }}>{children}</Ctx.Provider>;
}
