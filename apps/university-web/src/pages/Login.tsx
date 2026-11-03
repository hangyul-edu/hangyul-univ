import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import type { SSOLookup } from '@hangyul/types';
import { ChartColumn, ClipboardCheck, FileSearch, ShieldCheck, Users } from '@hangyul/icons';
import { ButtonLink } from '@hangyul/ui';
import { AuthCover } from '@hangyul/ynex-ui';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { StaffLoginScreen } from '../components/security/StaffLoginScreen';

/**
 * "Continue with your university account" — shown only when the email typed above belongs to a domain whose
 * organisation has single sign-on configured (see docs/SSO.md). The sign-in form (StaffLoginScreen, V29 — LoginScreen's
 * markup plus two-step verification) owns the email field (`#email`), so we listen to it rather than duplicating it.
 */
function SSOOption() {
  const { t } = useLocale('university');
  const { api } = useAuth();
  const [sso, setSso] = useState<SSOLookup | null>(null);
  useEffect(() => {
    const input = document.getElementById('email') as HTMLInputElement | null;
    if (!input) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onInput = () => {
      clearTimeout(timer);
      const v = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setSso(null); return; }
      timer = setTimeout(() => { api.sso.lookup(v).then(setSso).catch(() => setSso(null)); }, 350);
    };
    input.addEventListener('input', onInput);
    return () => { input.removeEventListener('input', onInput); clearTimeout(timer); };
  }, [api]);
  if (!sso?.sso) return null;
  if (!sso.available) return <p className="uc-note">{t('login.ssoUnavailable', { org: sso.organization ?? '' })}</p>;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
      <ButtonLink href={`${sso.start_url}&client=university`} block size="lg">{t('login.ssoContinue')}</ButtonLink>
      <p className="uc-note">{sso.enforced ? t('login.ssoEnforced', { org: sso.organization ?? '' }) : t('login.ssoHint', { org: sso.organization ?? '' })}</p>
    </div>
  );
}

/**
 * The test-account sign-in (V16, REPORT §134), lazily imported behind a build-time constant — see the note
 * in the Agency console's `Login.tsx` for why a runtime guard is not equivalent. Which seeded account the
 * one click uses, and why, lives with the personas in `@hangyul/auth/demo-personas`.
 */
const TEST_LOGIN = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGINS === 'true';
const TestAccountSignIn = TEST_LOGIN ? lazy(() => import('@hangyul/ui/test-access')) : null;

export default function Login() {
  const { t } = useLocale('university');
  const nav = useNavigate();
  const points = [
    { icon: <Users aria-hidden />, title: t('v8.login.p1Title'), text: t('v8.login.p1Text') },
    { icon: <FileSearch aria-hidden />, title: t('v8.login.p2Title'), text: t('v8.login.p2Text') },
    { icon: <ClipboardCheck aria-hidden />, title: t('v8.login.p3Title'), text: t('v8.login.p3Text') },
    { icon: <ChartColumn aria-hidden />, title: t('v8.login.p4Title'), text: t('v8.login.p4Text') },
  ];
  // V8: branded YNEX sign-in-cover (navy = university) — the shared form beside what the console is for.
  // V29: the form is StaffLoginScreen (LoginScreen's markup + the two-step verification steps).
  return (
    <AuthCover tone="navy" eyebrow={t('product')} title={t('v8.login.asideTitle')} lead={t('v8.login.asideLead')} points={points}
      foot={<><ShieldCheck aria-hidden size={16} />{t('v8.login.asideFoot')}</>}>
      <StaffLoginScreen product={t('product')} title={t('login.title')} subtitle={t('login.subtitle')}
        footer={<>
          <SSOOption />
          {TestAccountSignIn && (
            <Suspense fallback={null}>
              <TestAccountSignIn product="university" onDone={() => nav('/', { replace: true })} />
            </Suspense>
          )}
        </>} />
    </AuthCover>
  );
}
