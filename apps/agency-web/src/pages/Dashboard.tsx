// PRIMARY QUESTION: What is the state of my students, and who needs me now?
//
// V22 Today (REPORT §249 G1, brief §52) — WORKFLOW + WORK QUEUE on one screen. The process strip at the top is the one
// mental model (신규 → 상담 → 서류 준비 → 지원 준비 → 제출 → 대학 심사 → 합격 → 비자 → 입국·완료); a step filters the one
// work table beneath it, and the step's count is that table's total. The V9–V13 ranked queue did not go away: its rank
// orders the rows when no step is selected, and its reasons are the "Next action" / "Waiting on" columns. No KPI cards,
// no second list of the same work; the V9 "Waiting on" panel and 14-day timeline are folded into the toolbar (the
// waiting-on filter carries the counts, the meta text carries the deadlines), because beside an eight-column table at
// 1440 they pushed the table below the fold. Top 10 rows fit 1440 × 900 with the strip visible.
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
