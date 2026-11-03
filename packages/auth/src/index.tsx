import type { ApiClient } from '@hangyul/api-client';
import type { Role, Session } from '@hangyul/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Platform-neutral auth state (works in React DOM and React Native). */
/** `unavailable` (V32): the service could not be reached while restoring the session — the apps show a branded
 *  "we're getting the service ready" state with Retry instead of a login page that cannot work. */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  api: ApiClient;
  login: (email: string, password: string, orgId?: string) => Promise<Session>;
  logout: () => Promise<void>;
  register: ApiClient['auth']['register'];
  switchOrg: (orgId: string) => Promise<Session>;
  /** Try the session restore again (the service-unavailable state's Retry). */
  retry: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  /** True when the session belongs to Hangyul staff (cross-tenant operations view). */
  isHangyul: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ api, children }: { api: ApiClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(api.session);
  const [status, setStatus] = useState<AuthStatus>(api.isAuthenticated ? 'authenticated' : 'loading');

  useEffect(() => {
    let alive = true;
    const prev = api.config.onSessionChange;
    api.config.onSessionChange = (s) => {
      prev?.(s);
      if (!alive) return;
      setSession(s);
      setStatus(s ? 'authenticated' : 'anonymous');
    };
    if (!api.isAuthenticated) {
      api.auth.restore().then((ok) => { if (alive && !ok) setStatus(api.unavailable ? 'unavailable' : 'anonymous'); });
    }
    return () => { alive = false; api.config.onSessionChange = prev; };
  }, [api]);

  const login = useCallback(async (email: string, password: string, orgId?: string) => {
    const tr = await api.auth.login(email, password, orgId);
    return { user: tr.user, roles: tr.roles, memberships: tr.memberships, active_org: tr.active_org };
  }, [api]);
  const logout = useCallback(() => api.auth.logout(), [api]);
  const retry = useCallback(async () => {
    setStatus('loading');
    const ok = await api.auth.restore();
    if (!ok) setStatus(api.unavailable ? 'unavailable' : 'anonymous');
  }, [api]);
  const switchOrg = useCallback(async (orgId: string) => {
    const tr = await api.auth.switchOrg(orgId);
    return { user: tr.user, roles: tr.roles, memberships: tr.memberships, active_org: tr.active_org };
  }, [api]);

  const value = useMemo<AuthContextValue>(() => {
    const roles = new Set(session?.roles ?? []);
    return {
      status, session, api, login, logout, switchOrg, retry, register: api.auth.register,
      hasRole: (...r: Role[]) => r.some((x) => roles.has(x)),
      isHangyul: [...roles].some((r) => r.startsWith('HANGYUL_')),
    };
  }, [status, session, api, login, logout, switchOrg, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Like useAuth, but returns null outside an AuthProvider (e.g. the marketing site). */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useApi(): ApiClient {
  return useAuth().api;
}

