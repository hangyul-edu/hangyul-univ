import { FileCheck, ListChecks, ShieldCheck, ListFilter, Timer } from '@hangyul/icons';
import { AuthCover } from '@hangyul/ynex-ui';
import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';

import { useT } from '../components/bits';
import { StaffLoginScreen } from '../components/security/StaffLoginScreen';

/**
 * The test-account sign-in (V16, REPORT §134) is **lazily imported behind a build-time constant**.
 *
 * Both halves of this expression are literals Vite substitutes at build time, so a production build with
 * `VITE_DEMO_LOGINS` unset folds it to `false`, drops the branch, and never emits the chunk — along with
 * the seeded addresses it reaches through `@hangyul/auth/demo-personas`.
 *
 * A runtime guard inside the component is **not** equivalent, and this is not a theoretical distinction:
 * the first build of this feature returned `null` from the component when the flag was off, and
 * `npm run qa:v16` found `테스트 계정으로 로그인` and three `@demo.hangyul.kr` addresses in the emitted
 * production bundle anyway. A component that is imported and rendered keeps its strings whatever it
 * returns. The gate greps the bundle precisely so this cannot regress to a guard again.
 */
const TEST_LOGIN = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGINS === 'true';
const TestAccountSignIn = TEST_LOGIN ? lazy(() => import('@hangyul/ui/test-access')) : null;

export default function Login() {
  const { t } = useT();
  const nav = useNavigate();
  const points = [
    { icon: <ListFilter aria-hidden />, title: t('login.p1Title'), text: t('login.p1Text') },
    { icon: <Timer aria-hidden />, title: t('login.p2Title'), text: t('login.p2Text') },
    { icon: <FileCheck aria-hidden />, title: t('login.p3Title'), text: t('login.p3Text') },
    { icon: <ListChecks aria-hidden />, title: t('login.p4Title'), text: t('login.p4Text') },
  ];
  // V8: branded YNEX sign-in-cover — the shared form beside a cover that says what the console is for.
  // V29: the form is StaffLoginScreen (LoginScreen's markup + the two-step verification steps).
  return (
    <AuthCover eyebrow={t('shell.product')} title={t('login.asideTitle')} lead={t('login.asideLead')} points={points}
      foot={<><ShieldCheck aria-hidden size={16} />{t('login.asideFoot')}</>}>
      <StaffLoginScreen product={t('shell.product')} title={t('login.title')} subtitle={t('login.subtitle')}
        footer={TestAccountSignIn ? (
          <Suspense fallback={null}>
            <TestAccountSignIn product="agency" onDone={() => nav('/', { replace: true })} />
          </Suspense>
        ) : null} />
    </AuthCover>
  );
}
