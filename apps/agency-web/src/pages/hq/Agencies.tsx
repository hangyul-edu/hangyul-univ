// PRIMARY QUESTION: Which partner agency needs help?
// V9 (REPORT §61 H2): below the load table, process quality per agency (GET /agency/hq/agencies/quality) — response
// time, document first-pass quality, correction loops, deadline compliance, completeness at submission, university and
// embassy extra-document rates, arrival completion — each with cohort and n, n < 5 withheld. Listed by name, never ranked,
// and never by admission rate (decisions belong to universities). Satisfaction is not shown: no verified survey exists.
// V8 HQ Agencies — "which agency can take new students, and which one is in trouble?"
// One table: load against capacity, broken promises and students waiting on the agency (from GET /agency/hq/overview,
// same rules as the Operations failure list), languages for routing; each agency opens its caseload or its Operations.
import { useAuth } from '@hangyul/auth';
import { ErrorState, Segmented, Skeleton } from '@hangyul/ui';
import { PageHeader, SoftBadge, YCard } from '@hangyul/ynex-ui';
import { flagEmoji, formatNumber } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { useT } from '../../components/bits';
import { useMetricText, type QualityMetric } from '../../components/ProcessQuality';
import { usePerms, useUrlFilters } from '../../lib/hooks';

interface HqAgency { id: string; students: number; capacity: number | null; load: number | null; sla_breaches: number; overdue_tasks: number; waiting_on_us: number; ready_to_submit: number; university_requests: number }

function langName(code: string, locale: string) {
  try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code; } catch { return code; }
}

export default function Agencies() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const f = useUrlFilters(['sort'] as const);
  const sort = f.values.sort === 'issues' ? 'issues' : 'load';
  const list = useQuery({ queryKey: ['agency', 'agencies'], queryFn: () => api.agency.agencies() });
  const hq = useQuery({ queryKey: ['hq', 'overview'], queryFn: () => api.get<{ agencies: HqAgency[] }>('/agency/hq/overview'), enabled: perms.isHangyul });
  const health = new Map((hq.data?.agencies ?? []).map((a) => [a.id, a]));
  const rows = [...(list.data ?? [])].map((a) => ({ ...a, h: health.get(a.id), load: a.capacity ? a.active_cases / a.capacity : null }));
  rows.sort((a, b) => (sort === 'load'
    ? (b.load ?? -1) - (a.load ?? -1)
    : ((b.h?.sla_breaches ?? 0) - (a.h?.sla_breaches ?? 0)) || ((b.h?.overdue_tasks ?? 0) - (a.h?.overdue_tasks ?? 0))));
  const room = rows.filter((r) => r.load !== null && r.load < 0.85);
  return (
    <div className="ag7 ag8-agencies">
      <PageHeader eyebrow={t('hq.context')} title={t('sidebar.agencies')} sub={t('v8.agencies.sub')}
        actions={<Segmented label={t('v8.agencies.sortBy')} value={sort} onChange={(v) => f.set({ sort: v === 'load' ? null : v })}
          options={[{ value: 'load', label: t('v8.agencies.byLoad') }, { value: 'issues', label: t('v8.agencies.byIssues') }]} />} />
      {list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <Skeleton h={260} /> : (
        <YCard flush title={t('v8.agencies.title')} count={rows.length}
          footer={<p className="text-muted fs-12 mb-0">{t('v8.agencies.room', { count: room.length, names: room.map((r) => r.name).join(', ') || '—' })} {t('agencies.nearFullHint')}</p>}>
          <ul className="list-unstyled mb-0 ag8-agrows">
            {rows.map((a) => {
              const pct = a.load === null ? null : Math.round(a.load * 100);
              const tone = a.load === null ? 'secondary' : a.load >= 1 ? 'danger' : a.load >= 0.85 ? 'warning' : 'success';
              const issues = [
                a.h?.sla_breaches ? t('v8.agencies.breaches', { count: a.h.sla_breaches }) : null,
                a.h?.overdue_tasks ? t('v8.agencies.overdue', { count: a.h.overdue_tasks }) : null,
                a.h?.waiting_on_us ? t('v8.agencies.waiting', { count: a.h.waiting_on_us }) : null,
              ].filter(Boolean);
              return (
                <li key={a.id} className="ag8-agrow">
                  <span className="ag8-agrow__who">
                    <Link to={`/students?agency=${a.id}`} className="fw-semibold">{a.country_code && <span aria-hidden>{flagEmoji(a.country_code)} </span>}{a.name}</Link>
                    <span className="text-muted fs-12">{a.languages.map((l) => langName(l, locale)).join(', ')}</span>
                  </span>
                  <span className="ag8-agrow__load">
                    <span className="d-flex justify-content-between fs-12"><span>{t('v8.agencies.cases', { n: formatNumber(a.active_cases, locale), cap: a.capacity ?? '—' })}</span>{pct !== null && <SoftBadge tone={tone}>{pct}%</SoftBadge>}</span>
                    <span className="progress progress-xs" role="presentation"><span className={`progress-bar bg-${tone}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></span>
                  </span>
                  <span className="ag8-agrow__issues">
                    {!a.h ? <span className="text-muted fs-12">…</span> : issues.length ? <span className="text-danger fs-12 fw-semibold">{issues.join(' · ')}</span> : <span className="text-muted fs-12">{t('v8.agencies.ok')}</span>}
                  </span>
                  <span className="ag8-agrow__go">
                    <Link to={`/students?agency=${a.id}`} className="btn btn-sm btn-light">{t('v8.agencies.caseload')}</Link>
                    <Link to={`/performance?agency_id=${a.id}`} className="btn btn-sm btn-primary-light">{t('v8.nav.operations')}</Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </YCard>
      )}
      {perms.isHangyul && <PartnerQuality />}
    </div>
  );
}

function PartnerQuality() {
  const { api } = useAuth();
  const { t } = useT();
  const text = useMetricText();
  const q = useQuery({ queryKey: ['hq', 'agency-quality'], queryFn: () => api.get<{ days: number; keys: string[]; note: string; agencies: { id: string; name: string; country_code: string | null; students: number; registration_status: string; metrics: Record<string, QualityMetric> }[] }>('/agency/hq/agencies/quality') });
  const d = q.data;
  return (
    <YCard as="section" title={t('v9.pq.title')} flush footer={<p className="text-muted fs-12 mb-0">{t('v9.pq.foot', { days: d?.days ?? 180 })}</p>}>
      {!d ? <div className="p-3"><Skeleton h={200} /></div> : (
        <div className="ag9-pq">
          {d.agencies.map((a) => (
            <section key={a.id} className="ag9-pq__agency" aria-labelledby={`pq-${a.id}`}>
              <h3 className="ag9-pq__name" id={`pq-${a.id}`}>{a.country_code && <span aria-hidden>{flagEmoji(a.country_code)} </span>}{a.name}
                <span className="text-muted fs-12 fw-normal"> · {t('v9.pq.students', { count: a.students })} · {t(`v9.identity.reg.${a.registration_status}`, { defaultValue: t('v9.identity.notRecorded') })}</span></h3>
              <dl className="ag9-pq__grid">
                {d.keys.map((k) => {
                  const m = a.metrics[k];
                  return m ? (
                    <div key={k} data-withheld={m.withheld || undefined} title={`${m.definition} (${t('v9.q.cohort', { days: d.days })}, n = ${m.n})`}>
                      <dt>{t(`v9.q.m.${k}`)}</dt><dd>{text(m)}{!m.withheld && <span className="text-muted fs-11"> · n {m.n}</span>}</dd>
                    </div>
                  ) : null;
                })}
              </dl>
            </section>
          ))}
        </div>
      )}
    </YCard>
  );
}
