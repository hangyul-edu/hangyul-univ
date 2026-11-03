import { FileCheck, GraduationCap, PenLine } from '@hangyul/icons';
import { PageHeader } from '@hangyul/ynex-ui';
import { lazy, Suspense, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useNavCounts } from '../components/AppLayout';
import { PageFallback } from '../components/PageFallback';
import { useT } from '../components/bits';

/**
 * Review — one destination for the two things a counsellor reviews (REPORT §77.1).
 *
 * V10 had `/documents` and `/essays` as separate top-level navigation concepts. They are the same job, done by
 * the same person, in the same sitting: open the queue, judge the work, send it back or pass it. Splitting them
 * made the counsellor choose a *module* before choosing a *case*.
 *
 * They are modes here, not nested tabs: the Writing queue already has its own view tabs, and a second tab row
 * above them would be exactly the "too many tabs" the brief names. The mode switch sits in the page header, and
 * the chosen queue renders underneath with its own actions.
 */
const DocumentQueue = lazy(() => import('./DocumentQueue'));
const Essays = lazy(() => import('./Essays'));
// V22 (REPORT §249 G2): Applications is the third mode of the same area — a submission is a state of an application,
// and an application is a stage of the same student whose documents and writing are reviewed here.
const Applications = lazy(() => import('./Applications'));

type Mode = 'documents' | 'writing' | 'applications';

export default function Review() {
  const { t } = useT();
  const counts = useNavCounts();
  const [sp, setSp] = useSearchParams();
  const mode: Mode = sp.get('mode') === 'writing' ? 'writing' : sp.get('mode') === 'applications' ? 'applications' : 'documents';
  const go = (m: Mode) => { const n = new URLSearchParams(sp); n.set('mode', m); setSp(n, { replace: true }); };

  const modes: { id: Mode; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'documents', label: t('sidebar.documents'), icon: <FileCheck size={15} aria-hidden />, count: counts.queue },
    { id: 'writing', label: t('sidebar.essays'), icon: <PenLine size={15} aria-hidden />, count: counts.essays },
    { id: 'applications', label: t('nav.applications'), icon: <GraduationCap size={15} aria-hidden />, count: counts.submissions },
  ];

  return (
    <div className="ag-revhub">
      <PageHeader
        title={t('v22.nav.work')}
        sub={t('v11.review.sub')}
        actions={
          <div className="ag-revhub__modes" role="group" aria-label={t('v11.review.title')}>
            {modes.map((m) => (
              <button key={m.id} type="button" className="ag-revhub__mode" aria-pressed={mode === m.id} onClick={() => go(m.id)}>
                {m.icon}<span>{m.label}</span>
                {m.count ? <span className="ag-revhub__count">{m.count}</span> : null}
              </button>
            ))}
          </div>
        }
      />
      <Suspense fallback={<PageFallback />}>
        {mode === 'applications' && counts.submissions > 0 && (
          /* V23 §272 A4: the badge counts submissions that need the team (failed, unconfirmed, authorised), which is the
             Submissions queue — so the count opens exactly that, instead of sitting over a list it does not describe. */
          <Link className="ag23-subcall" to="/submissions">
            <strong>{t('v23.work.submissionsNeed', { count: counts.submissions })}</strong>
            <span aria-hidden>→</span>
          </Link>
        )}
        {mode === 'documents' ? <DocumentQueue embedded /> : mode === 'writing' ? <Essays embedded /> : <Applications embedded />}
      </Suspense>
    </div>
  );
}
