import { brandAssets, CheckCircle2 } from '@hangyul/icons';
import { carryQuery, LoginScreen } from '@hangyul/ui';
import { lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useT } from '../lib/i18n';

function Aside() {
  const { t } = useT();
  const points = [t('login.aside.point1'), t('login.aside.point2'), t('login.aside.point3')];
  return (
    <>
      <div className="st-login-aside__glow" aria-hidden />
      <div className="st-login-aside__top">
        <span className="st-login-aside__eyebrow">{t('login.aside.eyebrow')}</span>
        <h2 className="st-login-aside__title">{t('login.aside.title')}</h2>
        <p className="st-login-aside__text">{t('login.aside.text')}</p>
        <ul className="st-login-aside__list">
          {points.map((p) => (
            <li key={p}><CheckCircle2 aria-hidden /> <span>{p}</span></li>
          ))}
        </ul>
      </div>
      <figure className="st-login-aside__quote">
        <img src={brandAssets.handTangerine} alt="" width={72} height={72} />
        <figcaption>
          <p>{t('login.aside.note')}</p>
        </figcaption>
      </figure>
    </>
  );
}

/**
 * V23 — **테스트 계정으로 로그인** on the Student login page too (REPORT §271 S1). Same component and the same rule as the
 * consoles: a build-time constant decides whether the chunk exists at all, so a production build carries neither the
 * button, its copy nor a single seeded address (`qa:v23` greps the built bundle). The API refuses `/auth/demo-login` in
 * production regardless.
 */
const TEST_LOGIN = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGINS === 'true';
const TestAccountSignIn = TEST_LOGIN ? lazy(() => import('@hangyul/ui/test-access')) : null;

export default function Login() {
  const { t } = useT();
  const loc = useLocation();
  const nav = useNavigate();
  const next = new URLSearchParams(loc.search).get('next');
  return (
    <LoginScreen
      product={t('product')}
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      aside={<Aside />}
      footer={<>
        {TestAccountSignIn && (
          <Suspense fallback={null}>
            <TestAccountSignIn product="student" onDone={() => nav(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true })} />
          </Suspense>
        )}
        <p className="hg-muted hg-small" style={{ textAlign: 'center' }}>
          {/* V10: carry `next=` (and any quick-check prefill) across to sign-up, so a visitor who arrived from
              the public site without an account still lands on the action they clicked. */}
          {t('common:auth.noAccount')} <Link to={`/register${carryQuery(loc.search)}`} className="hg-strong">{t('login.createAccount')}</Link>
          <br /><Link to="/forgot" className="hg-link">{t('common:auth.forgot')}</Link>
        </p>
      </>}
    />
  );
}
