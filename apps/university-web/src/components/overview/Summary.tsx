/**
 * The executive summary band of the applicant home (2026-11 design pass).
 *
 * Four ruled columns — not cards — that answer, without scrolling at 1440: how many applicants need us, what documents
 * are outstanding, how many offers we made, and what happened after admission. Every figure is either the `total` of
 * the `GET /applications` filter it opens (so the number is the row count behind it) or a field of the admissions
 * funnel / attention / preparation responses; nothing is derived beyond adding two stage counts together.
 *
 * Small samples: a percentage is printed only when the API did not flag the rate (`insufficient_data`); otherwise the
 * text is "Too few to rate" next to the same "n of N" pair. Counts are always shown.
 */
import { useLocale } from '@hangyul/i18n';
import { Skeleton } from '@hangyul/ui';
import { cx, formatNumber } from '@hangyul/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { applicantsLink, type AnalyticsFilters, type ApplicantParams, type ReachedStep } from '../../lib/filters';
import { useAdmissionsFunnel, useApplicationCount, useAttention, usePreparation } from '../../lib/queries';
import { AWAITING_DECISION, type StageKey } from '../../lib/workflow';
import { RateNote, type RateLike } from '../viz/charts';

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

function Col({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="un-sum__col" data-sum={id} aria-labelledby={`sum-${id}`}>
      <h2 className="un-sum__h" id={`sum-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

/** One quiet line under a column's lead figure: label on the left, the count pair and rate on the right. */
function Line({ label, children, to }: { label: ReactNode; children: ReactNode; to?: string }) {
  const inner = <><span className="un-sum__linek">{label}</span><span className="un-sum__linev">{children}</span></>;
  return <li className="un-sum__line">{to ? <Link to={to}>{inner}</Link> : <span>{inner}</span>}</li>;
}

export function ExecutiveSummary({ base, set, byStage, all }: {
  /** The page's scope filters (intake · country · programme · team · degree) — never the headline filter itself. */
  base: AnalyticsFilters;
  set: (patch: Patch) => void;
  byStage: Record<StageKey, number | undefined>;
  all: number | undefined;
}) {
  const { t, locale } = useLocale(['university', 'common']);
  const decide = useApplicationCount({ ...base, status: AWAITING_DECISION });
  const requests = useApplicationCount({ ...base, status: [], requests: 'open' });
  // `/university/attention` and `/university/preparation` do not take an intake or degree filter: under one of those
  // scopes their lines are left out rather than shown for a different population.
  const narrowed = !!base.intake || !!base.degree;
  const prepScoped = narrowed || !!base.nationality || !!base.program_id || !!base.agency_id;
  const attention = useAttention(base);
  const prep = usePreparation();
  const funnel = useAdmissionsFunnel(base);
  const f = funnel.data;
  const a = narrowed ? undefined : attention.data;
  const p = prepScoped ? undefined : prep.data;

  const step = (k: string) => f?.steps.find((s) => s.key === k);
  const drill = (patch: Patch) => applicantsLink({ ...base, ...patch });
  const reached = (k: ReachedStep) => drill({ reached: k });
  const asRate = (m: { value: number | null; numerator: number | null; denominator: number; insufficient_data?: boolean } | undefined | null): RateLike | null => (m ? { ...m } : null);

  // Who acts next, from the same stage counts the pipeline rail shows (each is a table total).
  const known = (['received', 'documents_check', 'in_review', 'decision', 'documents'] as StageKey[]).every((k) => byStage[k] !== undefined);
  const ours = (byStage.received ?? 0) + (byStage.documents_check ?? 0) + (byStage.in_review ?? 0) + (byStage.decision ?? 0);
  const theirs = byStage.documents ?? 0;
  const split = ours + theirs;
  // The four columns fill from five queries. Drawn one by one they pushed the page down three times (CLS 0.65 at 390 px);
  // until every figure is known the summary holds its final size with a quiet skeleton, then renders once.
  const loading = decide.isLoading || requests.isLoading || funnel.isLoading || (!narrowed && attention.isLoading) || (!prepScoped && prep.isLoading) || !known || all === undefined;
  if (loading) {
    return (
      <section className="un-sum uv25-head un-sum--loading" aria-busy="true" aria-label={t('university:v33.sum.label')}>
        {['decide', 'missing', 'offers', 'after'].map((k) => <div key={k} className="un-sum__col"><Skeleton w="55%" h={14} /><Skeleton w="40%" h={36} /><Skeleton h={12} /><Skeleton h={12} /></div>)}
      </section>
    );
  }

  const offered = step('OFFERED');
  const enrolled = step('ENROLLED');
  const after: ReachedStep[] = ['ACCEPTED', 'TUITION_PAID', 'VISA_ISSUED', 'ARRIVED'];
  const verified = p?.documents_verified;

  return (
    <section className="un-sum uv25-head" aria-label={t('university:v33.sum.label')}>
      <Col id="decide" title={t('university:v33.sum.decide.title')}>
        <Fig lead head="decide" n={decide.count} onOpen={() => set({ stage: undefined, status: AWAITING_DECISION })}>
          {all !== undefined ? t('university:v33.sum.decide.ofAll', { n: formatNumber(all, locale) }) : t('university:v25.head.decide')}
        </Fig>
        {known && split > 0 && (
          <div className="un-split" role="img" aria-label={t('university:v33.sum.decide.splitAria', { ours, theirs })}>
            <span className="un-split__bar" aria-hidden>
              {ours > 0 && <i className="is-ours" style={{ flexGrow: ours }} />}
              {theirs > 0 && <i className="is-theirs" style={{ flexGrow: theirs }} />}
            </span>
            <span className="un-split__key" aria-hidden>
              <span><i className="is-ours" /><b className="hg-num">{formatNumber(ours, locale)}</b> {t('university:v33.sum.decide.ours')}</span>
              <span><i className="is-theirs" /><b className="hg-num">{formatNumber(theirs, locale)}</b> {t('university:v33.sum.decide.theirs')}</span>
            </span>
          </div>
        )}
        {a && a.flagged > 0 && (
          <ul className="un-sum__lines">
            <Line label={t('university:applicants.flagged')} to={drill({ flagged: true })}><b className="hg-num">{formatNumber(a.flagged, locale)}</b></Line>
          </ul>
        )}
      </Col>

      <Col id="documents" title={t('university:v33.sum.docs.title')}>
        <Fig lead head="requests" n={requests.count} onOpen={() => set({ stage: undefined, status: [], requests: 'open' })}>{t('university:v33.sum.docs.waiting')}</Fig>
        <ul className="un-sum__lines">
          {a && <Line label={t('university:v33.sum.docs.returned')} to={a.documents_returned ? drill({ requests: 'returned' }) : undefined}><b className="hg-num">{formatNumber(a.documents_returned, locale)}</b></Line>}
          {p && p.requests.total > 0 && (
            <Line label={t('university:v33.sum.docs.answered')}>
              <span className="un-rate__of hg-num">{t('university:metric.ofN', { num: formatNumber(p.requests.answered, locale), den: formatNumber(p.requests.total, locale) })}</span>
            </Line>
          )}
          {p && p.requests.median_days_to_answer !== null && !p.requests.insufficient && (
            <Line label={t('university:v33.sum.docs.median')}><b className="hg-num">{t('university:kpi.days', { count: p.requests.median_days_to_answer })}</b></Line>
          )}
          {verified && verified.denominator > 0 && (
            <Line label={t('university:v33.sum.docs.verified')}><RateNote r={{ ...verified, insufficient_data: verified.value === null }} pctFirst={false} /></Line>
          )}
        </ul>
      </Col>

      <Col id="offers" title={t('university:v33.sum.offers.title')}>
        <Fig lead n={offered?.count} to={reached('OFFERED')}>{t('university:v33.sum.offers.made')}</Fig>
        <ul className="un-sum__lines">
          {f?.metrics?.offer_rate && <Line label={t('university:v33.sum.offers.ofDecided')}><RateNote r={asRate(f.metrics.offer_rate)} pctFirst={false} /></Line>}
          {step('ACCEPTED') && <Line label={t('university:af.stepName.ACCEPTED')} to={step('ACCEPTED')!.count ? reached('ACCEPTED') : undefined}><RateNote r={step('ACCEPTED')!.conversion} pctFirst={false} /></Line>}
          {a && <Line label={t('university:v33.sum.offers.awaiting')} to={a.offers_awaiting_response ? drill({ status: ['OFFERED'] }) : undefined}><b className="hg-num">{formatNumber(a.offers_awaiting_response, locale)}</b></Line>}
          {f && <Line label={t('university:v33.sum.offers.closed')} to={f.rejected + f.withdrawn ? drill({ status: ['REJECTED', 'WITHDRAWN'] }) : undefined}><b className="hg-num">{formatNumber(f.rejected + f.withdrawn, locale)}</b></Line>}
        </ul>
      </Col>

      <Col id="after" title={t('university:v33.sum.after.title')}>
        <Fig lead n={enrolled?.count} to={reached('ENROLLED')}>{t('university:v33.sum.after.enrolled')}</Fig>
        <ul className="un-sum__lines">
          {f?.metrics?.yield && <Line label={t('university:v33.sum.after.ofOffers')}><RateNote r={asRate(f.metrics.yield)} pctFirst={false} /></Line>}
          {after.slice(1).map((k) => {
            const s = step(k);
            if (!s) return null;
            return <Line key={k} label={t(`university:af.stepName.${k}`)} to={s.count ? reached(k) : undefined}><RateNote r={s.conversion} pctFirst={false} /></Line>;
          })}
        </ul>
      </Col>
    </section>
  );
}
