import { useOptionalAuth, type DemoPersona, type DemoProduct } from '@hangyul/auth';
import { ArrowUpRight } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { useEffect, useRef, useState } from 'react';

import { Drawer } from './overlays';

type Env = Record<string, string | boolean | undefined>;
const env = (): Env => ((import.meta as unknown as { env?: Env }).env ?? {});

/** Build-time constant (Vite replaces both): a normal production build folds it to `false` and drops the persona chunk,
 *  so demo account emails never ship. Development builds, or demo deployments built with VITE_DEMO_LOGINS=true. */
const DEMO_BUILD: boolean = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGINS === 'true';
const loadPersonas = DEMO_BUILD ? () => import('@hangyul/auth/demo-personas') : null;

export function demoAccessEnabled(): boolean {
  return DEMO_BUILD;
}

const trim = (u: string) => u.replace(/\/$/, '');
export function productUrl(product: DemoProduct): string {
  const e = env();
  const map: Record<DemoProduct, [string | boolean | undefined, string]> = {
    student: [e.VITE_STUDENT_APP_URL, 'http://localhost:3101'],
    agency: [e.VITE_AGENCY_APP_URL, 'http://localhost:3102'],
    university: [e.VITE_UNIVERSITY_APP_URL, 'http://localhost:3103'],
  };
  const [v, d] = map[product];
  return trim(typeof v === 'string' && v ? v : d);
}

const GROUPS: DemoPersona['group'][] = ['student', 'agency', 'university', 'hangyul'];
/** The product you are in lists its own personas first (Hangyul staff sign in to the agency console). */
const personaGroupFirst = (g: DemoPersona['group'], product: DemoProduct | 'marketing') =>
  g === product || (product === 'agency' && g === 'hangyul');

/*
 * `DevAccess` — the floating "DEV · Demo access" chip — was deleted in V12 and its last call site went with
 * it, but the component and its `.hg-devchip` z-index rule stayed, and the rule was still being compiled into
 * the agency and university production stylesheets. V12's §91.5 recorded that it had removed the chip by hand
 * and had not re-run the dead-CSS sweep; this is what that sweep would have found.
 *
 * `DemoAccessDrawer` below and `useDemoParamLogin` are **not** dead — `devtools.tsx` and `app.tsx` use them
 * for the `/__dev` persona picker, which exists only in a development build.
 */
export function DemoAccessDrawer({ product, open, onClose }: { product: DemoProduct | 'marketing'; open: boolean; onClose: () => void }) {
  const { demoLogin } = useAuthSafe();
  const { t } = useLocale('common');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<readonly DemoPersona[]>([]);
  useEffect(() => {
    if (open && loadPersonas && personas.length === 0) loadPersonas().then((m) => setPersonas(m.DEMO_PERSONAS), (e: Error) => setError(e.message));
  }, [open, personas.length]);

  const choose = async (p: DemoPersona) => {
    setError(null);
    if (p.product !== product || !demoLogin) {
      window.location.assign(`${productUrl(p.product)}/login?demo=${encodeURIComponent(p.email)}`);
      return;
    }
    setBusy(p.email);
    try {
      await demoLogin(p.email);
      window.location.assign('/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const groupTitle: Record<DemoPersona['group'], string> = { student: 'Student', agency: 'Agency', university: 'University', hangyul: 'Hangyul' };
  return (
    <Drawer open={open} onClose={onClose} title="Demo access" side="end" width={420}>
      <div className="hg-demo-access">
        <p className="hg-muted hg-small">
          {t('devAccess.intro', { defaultValue: 'Development environment. Every person, organisation and number here is synthetic seed data. Choose a persona to sign in — no password needed.' })}
        </p>
        {error && <p className="hg-small" style={{ color: 'var(--hg-status-danger-fg)' }}>{error}</p>}
        {[...GROUPS].sort((a, b) => Number(personaGroupFirst(b, product)) - Number(personaGroupFirst(a, product))).map((g) => (
          <section key={g} aria-labelledby={`demo-g-${g}`}>
            <h3 id={`demo-g-${g}`} className="hg-demo-access__group">{groupTitle[g]}</h3>
            <ul className="hg-demo-access__list">
              {personas.filter((p) => p.group === g).map((p) => {
                const elsewhere = p.product !== product;
                return (
                  <li key={p.email}>
                    <button type="button" className="hg-demo-access__item" onClick={() => choose(p)} disabled={!!busy} aria-busy={busy === p.email}>
                      <span className="hg-demo-access__role">{p.role}</span>
                      <span className="hg-demo-access__who">{p.name} · {p.context}</span>
                      {elsewhere && <ArrowUpRight aria-label={`Opens the ${p.product} app`} className="hg-demo-access__out" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Drawer>
  );
}

/** Marketing has no auth session that can sign into the apps, so the picker always hands off via `?demo=`. */
function useAuthSafe(): { demoLogin?: (email: string) => Promise<unknown> } {
  return useOptionalAuth() ?? {};
}

/** On a login page: `?demo=<email>` signs in as that persona (development only). */
export function useDemoParamLogin(onDone: () => void) {
  const { demoLogin } = useAuthSafe();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (ran.current || !demoAccessEnabled() || !demoLogin) return;
    const email = new URLSearchParams(window.location.search).get('demo');
    if (!email) return;
    ran.current = true;
    demoLogin(email).then(onDone, (e: Error) => setError(e.message));
  }, [demoLogin, onDone]);
  return error;
}
