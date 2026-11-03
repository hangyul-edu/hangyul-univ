import type { ApiClient } from '@hangyul/api-client';
import type { Role, Session } from '@hangyul/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Platform-neutral auth state (works in React DOM and React Native). */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  api: ApiClient;
  login: (email: string, password: string, orgId?: string) => Promise<Session>;
  /** Development-only one-click persona sign-in (Demo access). */
  demoLogin: (email: string) => Promise<Session>;
  logout: () => Promise<void>;
  register: ApiClient['auth']['register'];
  switchOrg: (orgId: string) => Promise<Session>;
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
      api.auth.restore().then((ok) => { if (alive && !ok) setStatus('anonymous'); });
    }
    return () => { alive = false; api.config.onSessionChange = prev; };
  }, [api]);

  const login = useCallback(async (email: string, password: string, orgId?: string) => {
    const tr = await api.auth.login(email, password, orgId);
    return { user: tr.user, roles: tr.roles, memberships: tr.memberships, active_org: tr.active_org };
  }, [api]);
  const demoLogin = useCallback(async (email: string) => {
    const tr = await api.auth.demoLogin(email);
    return { user: tr.user, roles: tr.roles, memberships: tr.memberships, active_org: tr.active_org };
  }, [api]);
  const logout = useCallback(() => api.auth.logout(), [api]);
  const switchOrg = useCallback(async (orgId: string) => {
    const tr = await api.auth.switchOrg(orgId);
    return { user: tr.user, roles: tr.roles, memberships: tr.memberships, active_org: tr.active_org };
  }, [api]);

  const value = useMemo<AuthContextValue>(() => {
    const roles = new Set(session?.roles ?? []);
    return {
      status, session, api, login, demoLogin, logout, switchOrg, register: api.auth.register,
      hasRole: (...r: Role[]) => r.some((x) => roles.has(x)),
      isHangyul: [...roles].some((r) => r.startsWith('HANGYUL_')),
    };
  }, [status, session, api, login, demoLogin, logout, switchOrg]);

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

// V6: the Demo access personas live in './demo-personas' (import '@hangyul/auth/demo-personas'), loaded only by
// development builds so production bundles never contain demo account emails.
export type { DemoPersona, DemoProduct } from './demo-personas';
