import { createApiClient, type ApiClient } from '@hangyul/api-client';
import { AuthProvider, useAuth } from '@hangyul/auth';
import { changeLocale, consoleLocale, i18next, initI18n, installKeyRecorder, isRTL, langFromSearch, registerLocalePreloader, resolveLocale, STORAGE_KEY, useLocale, type Namespace } from '@hangyul/i18n';
import { loadIntlFallback } from '@hangyul/utils';
import type { ClientApp } from '@hangyul/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { Logo } from './brand';
import { LocaleSelector, setLocaleSelectorSurface } from './locale-selector';
import { ToastProvider } from './overlays';
import { Button, Callout, Field, Input, Skeleton } from './primitives';

function applyDocumentLocale(code: string) {
  document.documentElement.lang = code;
  document.documentElement.dir = isRTL(code) ? 'rtl' : 'ltr';
}

/**
 * The locale this app should boot in (V14, brief Part 44): explicit `?lang=` first, then the device's saved
 * preference, then the browser. The authenticated account's preference is applied a layer up, once a session
 * exists — see `UserLocale` in the student app — and it sits above the saved preference rather than below it,
 * because any *explicit* in-session choice is now in the URL and already won here.
 */
export function initialLocale(): string {
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  const fromUrl = langFromSearch(window.location.search);
  return resolveLocale(fromUrl ?? saved ?? navigator.language);
}

/**
 * Keep the running app in agreement with `?lang=` (brief Part 44).
 *
 * The URL is the authority, so this is deliberately **one-way**: the selector navigates, this reacts. A
 * two-way sync — URL writes locale, locale writes URL — is how a language picker ends up fighting the back
 * button, because every correction it makes is a new history entry that the previous one undoes.
 *
 * Back and forward therefore work for free: they change the URL, and the language follows.
 */
export function useLocaleFromUrl() {
  const loc = useLocation();
  useEffect(() => {
    const wanted = langFromSearch(loc.search);
    if (!wanted) return;
    const code = resolveLocale(wanted);
    if (code === i18next.language) return;
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
    void changeLocale(code);
  }, [loc.search]);
}

/** Bootstraps i18n, API client, query cache, auth and toasts for a web app. */
export async function bootWebApp(opts: { client: ClientApp; namespaces: Namespace[] }): Promise<{ api: ApiClient; queryClient: QueryClient }> {
  const console_ = opts.client === 'agency' || opts.client === 'university' ? opts.client : null;
  // V29: a console never boots into a locale whose console namespace is incomplete (brief §30).
  const locale = console_ ? consoleLocale(console_, initialLocale()) : initialLocale();
  // V9: the student app offers only locales that pass the student-journey gate (packages/i18n isStudentAppLocale).
  setLocaleSelectorSurface(opts.client === 'student' ? 'student' : console_ ?? 'all');
  registerLocalePreloader(loadIntlFallback);
  await initI18n({ namespaces: ['common', ...opts.namespaces.filter((n) => n !== 'common')] as Namespace[], locale, onLocaleChange: applyDocumentLocale });
  // V23: the dev-only, opt-in key recorder in every web app (no-op unless localStorage hg.recordKeys = '1'), so the
  // localization crawl can measure which keys each customer route actually renders (scripts/qa/v23/l10n-crawl.mjs).
  if (import.meta.env.DEV) installKeyRecorder();
  applyDocumentLocale(locale);
  const api = createApiClient({ baseUrl: '', client: opts.client, getLocale: () => i18next.language });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, err) => {
          const status = (err as unknown as { status?: number })?.status;
          return status ? status >= 500 && count < 2 : count < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
  // V31 (REPORT §424): the API resolves names and labels for the reader's language (Accept-Language). Cached
  // responses fetched in the previous language would keep showing it — refetch them when the language changes.
  i18next.on('languageChanged', () => { void queryClient.invalidateQueries(); });
  return { api, queryClient };
}


export function AppProviders({ api, queryClient, children }: { api: ApiClient; queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function FullPageLoader() {
  const { t } = useLocale('common');
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--hg-bg-canvas)' }} aria-busy="true">
      <div className="hg-stack" style={{ '--hg-gap': '10px', width: 200, alignItems: 'center' } as React.CSSProperties}>
        <span className="hg-sr-only">{t('states.loading')}</span>
        <Skeleton w={120} h={12} />
        <Skeleton w={180} h={8} />
      </div>
    </div>
  );
}

/**
 * V32 — the service could not be reached. Branded, calm, localized, with one action; never a raw transport message,
 * never stale or synthetic data in its place. Shown by `RequireAuth` when the session restore finds no API, and
 * available to the consoles' own shells.
 */
export function ServiceUnavailable({ onRetry, product }: { onRetry?: () => void; product?: string }) {
  const { t } = useLocale('common');
  return (
    <div className="hg-unavailable" role="status">
      <div className="hg-unavailable__card">
        <Logo tag={product} />
        <h1 className="hg-title-md">{t('states.unavailableTitle')}</h1>
        <p className="hg-muted">{t('states.unavailableText')}</p>
        {onRetry && <Button onClick={onRetry}>{t('actions.retry')}</Button>}
      </div>
    </div>
  );
}

export function RequireAuth({ children, loginPath = '/login' }: { children: ReactNode; loginPath?: string }) {
  const { status, retry } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unavailable') return <ServiceUnavailable onRetry={() => void retry()} />;
  if (status === 'anonymous') return <Navigate to={`${loginPath}?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

/** Calm single-column sign-in used by student, agency and university apps. `aside` is accepted for compatibility but not rendered. */
/** Accept only a same-app absolute path, so a crafted `?next=` cannot bounce a freshly signed-in user off-site. */
export function safeNext(value: string | null | undefined, fallback: string): string {
  if (!value || value[0] !== '/' || value[1] === '/' || value[1] === '\\') return fallback;
  return value;
}

/**
 * The query a login page should hand on to "Create an account", so a visitor who arrived from the public site
 * with a return path (and possibly quick-check answers to prefill) does not lose either by not having an account
 * yet. Returns a leading "?" or an empty string.
 */
export function carryQuery(search: string): string {
  const q = new URLSearchParams(search);
  const out = q.toString();
  return out ? `?${out}` : '';
}

export function LoginScreen({ product, title, subtitle, aside, footer, afterLogin = '/' }: {
  product: string;
  title: ReactNode;
  subtitle?: ReactNode;
  aside: ReactNode;
  footer?: ReactNode;
  afterLogin?: string;
}) {
  const { login, status } = useAuth();
  const { t } = useLocale('common');
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // V10: the marketing site now sends people here with `?next=<student path>` so a personalised action resumes
  // after sign-in. `next` arrives from a URL, so only an in-app absolute path is accepted — anything else
  // (`//evil.com`, `https://…`, a backslash form) falls back to the app's own landing route.
  const next = safeNext(new URLSearchParams(loc.search).get('next'), afterLogin);

  useEffect(() => { if (status === 'authenticated') nav(next, { replace: true }); }, [status, nav, next]);

  const submit = async (e?: FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault();
    const values = override ?? { email, password };
    // V9: plain checks (same messages as @hangyul/validation's loginSchema) so zod stays out of every app's entry chunk.
    const errs: Record<string, string> = {};
    if (!values.email.trim()) errs.email = 'validation.required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errs.email = 'validation.email';
    if (!values.password) errs.password = 'validation.required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await login(values.email, values.password);
      nav(next, { replace: true });
    } catch (err) {
      const s = (err as { status?: number }).status;
      const unreachable = (err as { unreachable?: boolean }).unreachable;
      setFormError(s === 401 ? t('auth.invalid') : unreachable ? t('states.unavailableText') : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  void aside;

  return (
    <div className="hg-login">
      <header className="hg-login__top">
        <Logo tag={product} />
        <LocaleSelector compact />
      </header>
      <main className="hg-login__main">
        <div className="hg-login__panel">
          <div className="hg-login__intro">
            <h1 className="hg-title-lg">{title}</h1>
            {subtitle && <p className="hg-muted">{subtitle}</p>}
          </div>
          <form onSubmit={submit} noValidate className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
            {formError && <Callout tone="danger">{formError}</Callout>}
            <Field label={t('auth.email')} htmlFor="email" error={errors.email}>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
            </Field>
            <Field label={t('auth.password')} htmlFor="password" error={errors.password}>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
            </Field>
            <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('actions.signIn')}</Button>
          </form>
          {footer}
        </div>
      </main>
      <footer className="hg-login__foot hg-subtle hg-xs">{t('footer.rights', { year: new Date().getFullYear() })}</footer>
    </div>
  );
}
