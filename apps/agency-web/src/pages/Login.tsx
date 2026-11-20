import { FileCheck, ListChecks, ShieldCheck, ListFilter, Timer } from '@hangyul/icons';
import { AuthEntryGate } from '@hangyul/ui';
import { AuthCover } from '@hangyul/ynex-ui';

import { useT } from '../components/bits';
import { StaffLoginScreen } from '../components/security/StaffLoginScreen';

export default function Login() {
  const { t } = useT();
  const points = [
    { icon: <ListFilter aria-hidden />, title: t('login.p1Title'), text: t('login.p1Text') },
    { icon: <Timer aria-hidden />, title: t('login.p2Title'), text: t('login.p2Text') },
    { icon: <FileCheck aria-hidden />, title: t('login.p3Title'), text: t('login.p3Text') },
    { icon: <ListChecks aria-hidden />, title: t('login.p4Title'), text: t('login.p4Text') },
  ];
  // V8: branded YNEX sign-in-cover — the shared form beside a cover that says what the console is for.
  // V29: the form is StaffLoginScreen (LoginScreen's markup + the two-step verification steps).
  // 261119: an already-signed-in visitor is sent on before the first frame (no flash of the sign-in form).
  return (
    <AuthEntryGate>
      <AuthCover eyebrow={t('shell.product')} title={t('login.asideTitle')} lead={t('login.asideLead')} points={points}
        foot={<><ShieldCheck aria-hidden size={16} />{t('login.asideFoot')}</>}>
        <StaffLoginScreen product={t('shell.product')} title={t('login.title')} subtitle={t('login.subtitle')} />
      </AuthCover>
    </AuthEntryGate>
  );
}
