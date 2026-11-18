// PRIMARY QUESTION: Who needs attention now?
//
// Today = the attention lanes (act now · our turn · waiting on the student / the university), the pipeline rail
// (All → nine stages → Closed) and ONE work table, most urgent first (components/Caseload, components/Pipeline).
// Every count on the board is a filter of that table and equals the rows it opens (lib/caseload.ts); the ranked Today
// queue supplies the order, the "act now" lane and the reason shown in each row's "Current situation". No KPI cards.
import { useAuth } from '@hangyul/auth';
import { PageHeader } from '@hangyul/ynex-ui';
import { dayPart, formatDate } from '@hangyul/utils';

import { useT } from '../components/bits';
import { Caseload } from '../components/Caseload';
import { usePerms } from '../lib/hooks';

export default function Dashboard() {
  const { session } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const name = session?.user.preferred_name || session?.user.full_name?.split(' ').slice(-1)[0] || '';
  return (
    <div className="ag7 ag22-today">
      <PageHeader
        title={t(`today.${dayPart(new Date())}`, { name })}
        sub={`${formatDate(new Date().toISOString(), locale, { weekday: 'long', month: 'long', day: 'numeric' })} · ${perms.isHangyul ? t('dash.subHq') : perms.orgName}`}
      />
      <Caseload mode="today" />
    </div>
  );
}
