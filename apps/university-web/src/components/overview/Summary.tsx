/**
 * The University home's review inbox (product-excellence pass, 2026-11-22) and its figure primitive.
 *
 * Every figure is the `total` of the `GET /applications` filter it opens, so the number is the row count behind it.
 * The former executive summary (offer and after-admission rates) and the source-country / monthly-trend signals moved
 * to 통계 (`/analytics`), which already shows them; the home is for today's work.
 */
import { useLocale } from '@hangyul/i18n';
import { Skeleton } from '@hangyul/ui';
import { cx, formatNumber } from '@hangyul/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { AnalyticsFilters, ApplicantParams } from '../../lib/filters';
import { useApplicationCount } from '../../lib/queries';
import { AWAITING_DECISION } from '../../lib/workflow';

type Patch = Partial<ApplicantParams>;

/** A figure that opens exactly the rows it counts; a zero is shown but is not a link. */
function Fig({ n, head, onOpen, to, children, lead, className }: { n: number | undefined; head?: string; onOpen?: () => void; to?: string; children: ReactNode; lead?: boolean; className?: string }) {
  const { locale } = useLocale('common');
  const inner = (
    <>
      <span className="un-sum__n hg-num">{n === undefined ? '–' : formatNumber(n, locale)}</span>
      <span className="un-sum__l">{children}</span>
    </>
  );
  const cls = cx('un-sum__fig uv25-head__item', lead && 'is-lead', !n && 'is-zero', className);
  if (n && onOpen) return <button type="button" className={cls} data-head={head} data-count={n} onClick={onOpen}>{inner}</button>;
  if (n && to) return <Link to={to} className={cls} data-head={head} data-count={n}>{inner}</Link>;
  return <span className={cls} data-head={head} data-count={n ?? ''}>{inner}</span>;
}

/**
 * **The review inbox** (product-excellence pass, 2026-11-22) — what the University home leads with.
 *
 * A reviewer opens the console to act, so the home starts with four actionable figures, each the `total` of the filter
 * it opens: applicants waiting for our decision, open document requests (missing information), submissions received
 * in the last seven days, and the nearest dated step. Outcome rates, source countries and the monthly trend answer
 * "how are we doing?", which is not today's work — they live on 통계 (`/analytics`), one link away.
 *
 * One row of four figures, no columns of ratios: it holds its final height while loading (no layout shift).
 */
export function ReviewInbox({ base, set, soonest, datesUnknown }: {
  base: AnalyticsFilters;
  set: (patch: Patch) => void;
  /** The nearest dated step from the programmes (kind + ISO date), already computed by the page. */
  soonest: { label: string; date: string; to: string } | null;
  /** The programmes could not be read: the next date is unknown, which is not the same as "no dates". */
  datesUnknown?: boolean;
}) {
  const { t } = useLocale(['university', 'common']);
  const decide = useApplicationCount({ ...base, status: AWAITING_DECISION });
  const requests = useApplicationCount({ ...base, status: [], requests: 'open' });
  const fresh = useApplicationCount({ ...base, status: [], submitted_within: 7 });
  const loading = decide.isLoading || requests.isLoading || fresh.isLoading;
  return (
    <section className="un-inbox" aria-label={t('university:v34.inbox.label')} aria-busy={loading || undefined}>
      <div className="un-inbox__item" data-inbox="decide">
        <h2 className="un-inbox__h">{t('university:v34.inbox.decide')}</h2>
        {loading ? <Skeleton w={56} h={36} /> : <Fig lead head="decide" n={decide.count} onOpen={() => set({ stage: undefined, status: AWAITING_DECISION })}>{t('university:v34.inbox.decideText')}</Fig>}
      </div>
      <div className="un-inbox__item" data-inbox="requests">
        <h2 className="un-inbox__h">{t('university:v34.inbox.requests')}</h2>
        {loading ? <Skeleton w={56} h={36} /> : <Fig head="requests" n={requests.count} onOpen={() => set({ stage: undefined, status: [], requests: 'open' })}>{t('university:v34.inbox.requestsText')}</Fig>}
      </div>
      <div className="un-inbox__item" data-inbox="fresh">
        <h2 className="un-inbox__h">{t('university:v34.inbox.fresh')}</h2>
        {loading ? <Skeleton w={56} h={36} /> : <Fig head="fresh" n={fresh.count} onOpen={() => set({ stage: undefined, status: [], submitted_within: 7 })}>{t('university:v34.inbox.freshText')}</Fig>}
      </div>
      <div className="un-inbox__item" data-inbox="date">
        <h2 className="un-inbox__h">{t('university:v34.inbox.date')}</h2>
        {soonest
          ? <Link to={soonest.to} className="un-sum__fig uv25-head__item un-inbox__date"><span className="un-sum__n un-inbox__day hg-num">{soonest.date}</span><span className="un-sum__l">{soonest.label}</span></Link>
          : <span className="un-sum__fig is-zero">{datesUnknown ? <span className="un-sum__n">–</span> : <span className="un-sum__l">{t('university:v34.inbox.noDate')}</span>}</span>}
      </div>
      <Link to="/analytics" className="un-inbox__more hg-link-arrow">{t('university:v34.inbox.insights')}</Link>
    </section>
  );
}
