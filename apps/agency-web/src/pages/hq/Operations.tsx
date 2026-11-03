// PRIMARY QUESTION: Where is the ecosystem failing?
// V9 (REPORT §61 H1): the one severity-ordered failure list now includes application blockers, submission blockers
// (failed attempts, confirmations missing), arrival / housing failures and integration failures, and every row expands
// to its exact records in place (no KPI strip repeats it).
/**
 * V8: the page answers "Where is the ecosystem failing?" — one severity-ordered list (critical → high → medium, then by
 * size), each line a sentence with its count, the oldest example and the exact list it opens; then the per-agency table.
 * The V6/V7 stat strip and four-column board (the same counts twice, all equal weight) are gone.
 *
 * V6 Hangyul operations overview — "what is at risk across agencies, universities, services and data right now?"
 * One request (GET /agency/hq/overview). Every number is computed by the API with the predicate of the list it links to,
 * so a count opens exactly those records; numbers without an exact list are shown without a link.
 */
import { useAuth } from '@hangyul/auth';
import { ArrowRight } from '@hangyul/icons';
import { ErrorState, Skeleton } from '@hangyul/ui';
import { flagEmoji, formatDate, formatNumber, formatRelative } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageHeader, YCard } from '@hangyul/ynex-ui';

import { useT } from '../../components/bits';
import { YAvatar } from '../../components/ynex';
import { usePerms } from '../../lib/hooks';

interface Overview {
  generated_at: string;
  sla: {
    documents: { late: number; waiting: number; sla_hours: number; oldest: { student: string | null; category: string; since: string } | null; queue: string };
    essays: { overdue: number; oldest: { student: { name: string }; university: string | null; due_at: string | null } | null; queue: string };
    first_response: { breached: number; at_risk: number; oldest: { student: string | null; due_at: string } | null; queue: string };
    tasks: { overdue: number; queue: string };
  };
  services: {
    open: number; overdue: number; unassigned: number; needs_assignment: number;
    groups: { group: 'pickup' | 'housing' | 'visa' | 'other'; open: number; overdue: number; unassigned: number; needs_assignment: number }[];
    next: { type: string; student: string | null; overdue: boolean; sla_due_at: string | null } | null;
  };
  submissions: { ready: number; queue: string; authorised?: number; authorised_queue?: string };
  university_requests: { open: number; overdue: number; students: number; universities: { name: string; count: number }[]; queue: string };
  freshness: { open: number; groups: { reason: string; total: number; kinds: { kind: string; count: number }[] }[]; queue: string };
  failures: { code: string; severity: 'critical' | 'high' | 'medium'; count: number; link: string; oldest?: { student: string | null; since: string | null } | null; agencies?: string[];
    /** V9: exact records (≤ 20) */ items?: { student: string | null; student_id?: string | null; since?: string | null; detail?: string | number | null; university?: string | null; status?: string; link: string }[] }[];
  all_clear: string[];
  agencies: {
    id: string; name: string; country_code: string | null; students: number; capacity: number | null; load: number | null; overdue_tasks: number; sla_breaches: number;
    documents_late: number; essays_overdue: number; first_response_breached: number; services_overdue: number;
    waiting_on_us: number; ready_to_submit: number; university_requests: number;
  }[];
}

const SEV_TONE = { critical: 'danger', high: 'warning', medium: 'secondary' } as const;

/** "Where is the ecosystem failing?" — severity first, then size; each row opens exactly the records it counts. */
function Failures({ d }: { d: Overview }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState<string | null>(null);
  // V8 codes keep their v8 wording; V9 codes (application_blocked, submission_issue, …) live under v9.hq.f.
  const fLine = (code: string, count: number) => t(`v8.hq.f.${code}.line`, { count, n: formatNumber(count, locale), defaultValue: t(`v9.hq.f.${code}.line`, { count, n: formatNumber(count, locale) }) });
  const fShort = (code: string) => t(`v8.hq.f.${code}.short`, { defaultValue: t(`v9.hq.f.${code}.short`) });
  return (
    <YCard as="section" id="hq-failing" title={t('v8.hq.failing')} count={formatNumber(d.failures.length, locale)} flush
      footer={d.all_clear.length > 0 ? <p className="ag-attn__clear mb-0 fs-12 text-muted">{t('v8.hq.clear', { list: d.all_clear.map((c) => fShort(c)).join(' · ') })}</p> : undefined}>
      {d.failures.length === 0 ? <p className="ag-allclear mb-0 p-3">{t('v8.hq.nothing')}</p> : (
        <ol className="list-unstyled mb-0 ag8-fail">
          {d.failures.map((f) => (
            <li key={f.code} className="ag8-fail__row ag9-fail" data-sev={f.severity}>
              <span className={`badge bg-${SEV_TONE[f.severity]}-transparent ag8-fail__sev`}>{t(`v8.hq.sev.${f.severity}`)}</span>
              <span className="ag8-fail__main">
                <span className="ag8-fail__what">{fLine(f.code, f.count)}</span>
                {f.oldest?.since && <span className="ag8-fail__ex">{t('v8.hq.oldest', { name: f.oldest.student ?? '—', when: formatRelative(f.oldest.since, locale) })}</span>}
                {f.agencies && f.agencies.length > 0 && <span className="ag8-fail__ex">{f.agencies.join(' · ')}</span>}
              </span>
              <span className="ag9-fail__acts">
                {(f.items?.length ?? 0) > 0 && (
                  <button type="button" className="btn btn-sm btn-light" aria-expanded={open === f.code} onClick={() => setOpen(open === f.code ? null : f.code)}>
                    {t('v9.hq.records', { count: f.items!.length })}
                  </button>
                )}
                <Link to={f.link} className="btn btn-sm btn-primary-light ag8-fail__open">{t('v8.hq.open')}<span className="visually-hidden"> — {fShort(f.code)}</span></Link>
              </span>
              {open === f.code && f.items && (
                <ul className="ag9-fail__list">
                  {f.items.map((i, n) => (
                    <li key={n}>
                      <Link to={i.link}>{i.student ?? (i.detail != null ? t(`v9.ready.item.${i.detail}`, { defaultValue: t(`v8.ready.item.${i.detail}`, { defaultValue: String(i.detail) }) }) : '—')}</Link>
                      {i.student && i.detail != null && <span className="text-muted"> · {typeof i.detail === 'number' ? t('ws.itemsRemain', { count: i.detail }) : t(`docCategory.${i.detail}`, { defaultValue: t(`concierge:type.${i.detail}`, { defaultValue: String(i.detail) }) })}</span>}
                      {i.university && <span className="text-muted"> · {i.university}</span>}
                      {i.status && <span className="text-muted"> · {t(`v8.ready.status.${i.status}`, { defaultValue: i.status })}</span>}
                      {i.since && <span className="text-muted"> · {/^\d{4}-\d{2}-\d{2}$/.test(i.since) ? formatDate(i.since, locale, { month: 'short', day: 'numeric' }) : formatRelative(i.since, locale)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </YCard>
  );
}

function AgencyTable({ d }: { d: Overview }) {
  const { t, locale } = useT();
  const n = (v: number) => formatNumber(v, locale);
  const num = (v: number, to?: string, danger?: boolean) => {
    if (v === 0) return <span className="ag-hq-zero">0</span>;
    const cls = danger ? 'ag-hq-num ag-overdue' : 'ag-hq-num';
    return to ? <Link to={to} className={cls}>{n(v)}</Link> : <span className={cls}>{n(v)}</span>;
  };
  const breakdown = (a: Overview['agencies'][number]) => [
    a.documents_late ? t('hq.ag.bDocs', { count: a.documents_late }) : null,
    a.essays_overdue ? t('hq.ag.bEssays', { count: a.essays_overdue }) : null,
    a.first_response_breached ? t('hq.ag.bFirst', { count: a.first_response_breached }) : null,
    a.services_overdue ? t('hq.ag.bServices', { count: a.services_overdue }) : null,
  ].filter(Boolean).join(' · ');
  const base = (a: { id: string }) => `/students?agency=${a.id}`;
  const maxStudents = Math.max(1, ...d.agencies.map((a) => a.students));
  return (
    <YCard id="hq-agencies" title={t('hq.agencies')} count={d.agencies.length} flush className="ag-hq-agencies"
      tools={<Link to="/hq/agencies" className="fs-12 text-muted ag7-cardlink">{t('hq.capacity')}<ArrowRight aria-hidden className="hg-flip-rtl" /></Link>}
      footer={<p className="text-muted fs-12 mb-0">{t('hq.ag.foot')} {t('v7.hq.barNote')}</p>}>
      <div className="ag-hq-tablewrap">
        <table className="hg-table ag-hq-table">
          <caption className="hg-sr-only">{t('hq.agencies')}</caption>
          <thead><tr>
            <th scope="col">{t('hq.ag.agency')}</th>
            <th scope="col">{t('hq.ag.students')}</th>
            <th scope="col" className="hg-table__num">{t('v8.hq.load')}</th>
            <th scope="col" className="hg-table__num">{t('hq.ag.sla')}</th>
            <th scope="col" className="hg-table__num">{t('hq.ag.tasks')}</th>
            <th scope="col" className="hg-table__num">{t('hq.ag.waiting')}</th>
            <th scope="col" className="hg-table__num">{t('hq.ag.ready')}</th>
            <th scope="col" className="hg-table__num">{t('hq.ag.requests')}</th>
          </tr></thead>
          <tbody>
            {d.agencies.map((a) => (
              <tr key={a.id} data-risk={a.sla_breaches > 0 || undefined}>
                <th scope="row">
                  <span className="d-flex align-items-center gap-2 min-w-0">
                    <YAvatar name={a.name} size="sm" square />
                    <span className="ag-hq-agency">
                      <Link to={base(a)} className="ag-hq-agency__name">{a.country_code && <span aria-hidden>{flagEmoji(a.country_code)} </span>}{a.name}</Link>
                      {a.sla_breaches > 0 && <span className="ag-hq-agency__why">{breakdown(a)}</span>}
                    </span>
                  </span>
                </th>
                <td className="ag7-loadcell">
                  <span className="d-flex align-items-center gap-2">
                    <span className="progress progress-xs flex-fill" role="presentation"><span className="progress-bar bg-primary" style={{ width: `${(a.students / maxStudents) * 100}%` }} /></span>
                    {num(a.students, base(a))}
                  </span>
                </td>
                <td className="hg-table__num">{a.load === null ? <span className="ag-hq-zero">—</span> : <span className={a.load > 1 ? 'ag-hq-num ag-overdue' : 'ag-hq-num'} title={t('v8.hq.loadOf', { n: a.students, cap: a.capacity })}>{formatNumber(Math.round(a.load * 100), locale)}%</span>}</td>
                <td className="hg-table__num">{num(a.sla_breaches, undefined, true)}</td>
                <td className="hg-table__num">{num(a.overdue_tasks)}</td>
                <td className="hg-table__num">{num(a.waiting_on_us, `${base(a)}&view=waiting_us`)}</td>
                <td className="hg-table__num">{num(a.ready_to_submit)}</td>
                <td className="hg-table__num">{num(a.university_requests, `${base(a)}&view=requested`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="ag-hq-cards">
          {d.agencies.map((a) => (
            <li key={a.id}>
              <Link to={base(a)} className="ag-hq-agency__name">{a.name}</Link>
              {a.sla_breaches > 0 && <span className="ag-hq-agency__why">{breakdown(a)}</span>}
              <dl className="ag-hq-cards__kv">
                <div><dt>{t('hq.ag.students')}</dt><dd>{num(a.students, base(a))}</dd></div>
                <div><dt>{t('hq.ag.sla')}</dt><dd>{num(a.sla_breaches, undefined, true)}</dd></div>
                <div><dt>{t('hq.ag.tasks')}</dt><dd>{num(a.overdue_tasks)}</dd></div>
                <div><dt>{t('hq.ag.waiting')}</dt><dd>{num(a.waiting_on_us, `${base(a)}&view=waiting_us`)}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </YCard>
  );
}

export default function Operations() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const q = useQuery({ queryKey: ['hq', 'overview'], queryFn: () => api.get<Overview>('/agency/hq/overview'), refetchInterval: 120_000, enabled: perms.isHangyul });
  const d = q.data;
  return (
    <div className="ag7 ag-hq ag7-hq">
      <PageHeader eyebrow={t('hq.context')} title={t('hq.title')}
        sub={<>{t('hq.question')}{d && <span className="ag-hq-updated"> · {t('hq.updated', { time: formatDate(d.generated_at, locale, { hour: 'numeric', minute: '2-digit' }) })}</span>}</>} />
      {!perms.isHangyul ? <ErrorState error={{ status: 404 }} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !d ? (
        <div className="hg-stack"><Skeleton h={220} r={8} /><Skeleton h={180} r={8} /></div>
      ) : (
        <>
          <Failures d={d} />
          <AgencyTable d={d} />
        </>
      )}
    </div>
  );
}
