// PRIMARY QUESTION: Where is my operation failing today?
// V9 (REPORT §59 A9): the six questions are answered at the top (oldest blocked case, overloaded counselor by weighted
// load, SLA breaches, deadlines at risk, slowest stage, unassigned paid case), each one click to its exact records;
// "oldest blocked" and "unassigned paid" have their own first-class lists; load = the Team page's weighted points.
// V8 manager Operations — "where are my operations breaking?" (GET /agency/ops, services/agency_ops.py).
// Six questions, each answered by one chart or list that drills down to the exact records it counts:
//   backlog trend · case ageing by stage · counselor load vs capacity · SLA failures · deadlines at risk · slow stages.
// Definitions come from the API and are printed under each section, so the page and the numbers never disagree.
import { useAuth } from '@hangyul/auth';
import { Callout, FilterSelect, Skeleton } from '@hangyul/ui';
import { Col, ProgressRow, Row, SoftBadge, YCard } from '@hangyul/ynex-ui';
import { formatDate, formatNumber, formatRelative } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { ColumnChart } from '../components/charts';
import { useT } from '../components/bits';
import { usePerms, useUrlFilters } from '../lib/hooks';
import { useOps, type Ops } from '../lib/v8';

const BUCKET_TONE: Record<string, string> = { '0_7': 'ok', '8_14': 'watch', '15_30': 'late', '30_plus': 'stuck' };

/**
 * V30 (REPORT §412): the definition is the console's own translated sentence, keyed by the metric id. The API
 * still sends its English definition; it is only the fallback for a metric the console has no copy for yet —
 * printing it verbatim put English paragraphs on every Korean operations page.
 */
function Def({ id, text }: { id: string; text: string }) {
  const { t } = useT();
  return <p className="ag8-def">{t(`v30.def.ops.${id}`, { defaultValue: text, n: MIN_STAYS })}</p>;
}
const MIN_STAYS = 5;

function Backlog({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const weeks = ops.backlog.weeks;
  const last = weeks[weeks.length - 1];
  const data = weeks.map((w) => ({ week: formatDate(w.week_end, locale, { month: 'short', day: 'numeric' }), tasks: w.tasks, documents: w.documents, essays: w.essays }));
  const change = ops.backlog.change;
  return (
    <YCard as="section" id="ops-backlog" title={t('v8.ops.backlog.title')}
      tools={<SoftBadge tone={change > 0 ? 'danger' : change < 0 ? 'success' : 'secondary'}>{change > 0 ? t('v8.ops.backlog.up', { count: change }) : change < 0 ? t('v8.ops.backlog.down', { count: -change }) : t('v8.ops.backlog.flat')}</SoftBadge>}>
      <p className="ag8-q">{t('v8.ops.backlog.q')}</p>
      <ColumnChart title={t('v8.ops.backlog.title')} data={data} xKey="week" stacked height={220}
        series={[{ key: 'tasks', label: t('v8.ops.backlog.tasks') }, { key: 'documents', label: t('v8.ops.backlog.documents') }, { key: 'essays', label: t('v8.ops.backlog.essays') }]} />
      <ul className="ag8-drill" aria-label={t('v8.ops.openNow')}>
        <li><Link to={ops.backlog.links.tasks}>{t('v8.ops.backlog.openTasks', { count: last?.tasks ?? 0 })}</Link></li>
        <li><Link to={ops.backlog.links.documents}>{t('v8.ops.backlog.openDocs', { count: last?.documents ?? 0 })}</Link></li>
        <li><Link to={ops.backlog.links.essays}>{t('v8.ops.backlog.openEssays', { count: last?.essays ?? 0 })}</Link></li>
      </ul>
      <Def id="backlog" text={ops.definitions.backlog} />
    </YCard>
  );
}

function Ageing({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const [cell, setCell] = useState<{ phase: string; bucket: string } | null>(null);
  const rows = useMemo(() => {
    const list = ops.ageing.students.filter((s) => !cell || (s.phase === cell.phase && s.bucket === cell.bucket));
    return list.slice(0, cell ? 50 : 8);
  }, [ops, cell]);
  const oldest = ops.ageing.oldest;
  return (
    <YCard as="section" id="ops-ageing" title={t('v8.ops.ageing.title')}>
      <p className="ag8-q">{t('v8.ops.ageing.q')}</p>
      {oldest && (
        <p className="ag8-callout">
          {t('v8.ops.ageing.oldest', { name: oldest.student ?? '—', count: oldest.days, stage: t(`pipeline.${oldest.stage}`) })}{' '}
          <Link to={oldest.link}>{t('v8.ops.open')}</Link>
        </p>
      )}
      <table className="ag8-matrix">
        <caption className="visually-hidden">{t('v8.ops.ageing.caption')}</caption>
        <thead>
          <tr><th scope="col">{t('v8.ops.ageing.phase')}</th>{ops.ageing.buckets.map((b) => <th key={b} scope="col">{t(`v8.ops.bucket.${b}`)}</th>)}<th scope="col">{t('v8.ops.total')}</th></tr>
        </thead>
        <tbody>
          {ops.ageing.phases.map((p) => (
            <tr key={p.phase}>
              <th scope="row">{t(`today.phase.${p.phase}`)}</th>
              {ops.ageing.buckets.map((b) => {
                const n = p.buckets[b] ?? 0;
                const on = cell?.phase === p.phase && cell.bucket === b;
                return (
                  <td key={b}>
                    {n > 0 ? (
                      <button type="button" className="ag8-cell" data-tone={BUCKET_TONE[b]} aria-pressed={on}
                        aria-label={t('v8.ops.ageing.cellLabel', { count: n, phase: t(`today.phase.${p.phase}`), bucket: t(`v8.ops.bucket.${b}`) })}
                        onClick={() => setCell(on ? null : { phase: p.phase, bucket: b })}>{formatNumber(n, locale)}</button>
                    ) : <span className="ag8-cell ag8-cell--zero">0</span>}
                  </td>
                );
              })}
              <td className="hg-num fw-semibold">{formatNumber(p.total, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="ag8-sub">
        {cell ? t('v8.ops.ageing.cellList', { phase: t(`today.phase.${cell.phase}`), bucket: t(`v8.ops.bucket.${cell.bucket}`) }) : t('v8.ops.ageing.longest')}
        {cell && <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => setCell(null)}>{t('actions.clearFilters')}</button>}
      </h3>
      <ul className="ag8-rows">
        {rows.map((s) => (
          <li key={s.student_id}>
            <Link to={s.link}>{s.student ?? '—'}</Link>
            <span className="text-muted">{t(`pipeline.${s.stage}`)}{s.counselor?.name ? ` · ${s.counselor.name}` : ''}</span>
            <span className="ag8-rows__n hg-num" data-tone={BUCKET_TONE[s.bucket]}>{t('v8.ops.days', { count: s.days })}</span>
          </li>
        ))}
      </ul>
      <Def id="ageing" text={ops.definitions.ageing} />
    </YCard>
  );
}

function Load({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const l = ops.load;
  if (!l) return null;
  const max = Math.max(1, ...l.counselors.map((c) => Math.max(c.points ?? c.active_cases, c.capacity ?? 0)));
  const over = l.counselors.filter((c) => c.overloaded);
  return (
    <YCard as="section" id="ops-load" title={t('v8.ops.load.title')} tools={<Link to="/team" className="fs-12 text-muted">{t('v9.ops.weightsLink')}</Link>}>
      <p className="ag8-q">{t('v8.ops.load.q')}</p>
      <p className="ag8-callout">
        {over.length > 0 ? <strong className="text-danger">{t('v8.ops.load.over', { count: over.length })}</strong> : t('v9.ops.noneOver')}
        {l.unassigned > 0 && <> · <Link to="/students?view=unassigned">{t('v8.ops.load.unassigned', { count: l.unassigned })}</Link></>}
      </p>
      {l.counselors.map((c) => (
        <ProgressRow key={c.user_id} to={`/students?counselor=${c.user_id}`} label={c.name} max={max} value={c.points ?? c.active_cases}
          tone={c.overloaded ? 'danger' : c.load !== null && c.load > 0.85 ? 'warning' : 'primary'}
          display={c.capacity !== null ? t('v9.ops.pointsOf', { n: formatNumber(c.points ?? 0, locale), cap: formatNumber(c.capacity, locale) }) : t('v9.ops.points', { n: formatNumber(c.points ?? 0, locale) })}
          sub={<>{t('v9.ops.cases', { count: c.active_cases })}{c.overdue_tasks > 0 && <> · <span className="text-danger fw-semibold">{t('v7.today.overdueN', { count: c.overdue_tasks })}</span></>}
            {c.sla_risk ? <> · <span className="text-danger">{t('v9.ops.slaRisk', { count: c.sla_risk })}</span></> : null}
            {c.on_leave_until ? <> · {t('v9.team.onLeave', { date: formatDate(c.on_leave_until, locale, { month: 'short', day: 'numeric' }) })}</> : null}</>} />
      ))}
      <Def id="load" text={ops.definitions.load} />
    </YCard>
  );
}

/** The six manager questions, answered in one row; each opens exactly its records. */
function Questions({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const q = ops.questions;
  if (!q) return null;
  const cells = [
    { k: 'blocked', label: t('v9.ops.q.blocked'), to: '#ops-blocked', bad: !!q.oldest_blocked.count,
      value: q.oldest_blocked.top ? t('v9.ops.days', { count: q.oldest_blocked.top.days }) : t('v9.ops.none'),
      sub: q.oldest_blocked.top ? `${q.oldest_blocked.top.student ?? '—'} · ${t(`v9.waiting.party.${q.oldest_blocked.top.waiting_on}`)}` : null },
    { k: 'overloaded', label: t('v9.ops.q.overloaded'), to: '#ops-load', bad: !!q.overloaded.count,
      value: q.overloaded.count === null ? '—' : formatNumber(q.overloaded.count, locale),
      sub: q.overloaded.top ? `${q.overloaded.top.name} · ${q.overloaded.top.load != null ? `${Math.round(q.overloaded.top.load * 100)}%` : ''}` : null },
    { k: 'sla', label: t('v9.ops.q.sla'), to: '#ops-sla', bad: q.sla_breaches.count > 0, value: formatNumber(q.sla_breaches.count, locale), sub: null },
    { k: 'deadlines', label: t('v9.ops.q.deadlines'), to: '#ops-deadlines', bad: q.deadline_risk.count > 0, value: formatNumber(q.deadline_risk.count, locale),
      sub: q.deadline_risk.top ? `${q.deadline_risk.top.student ?? '—'} · ${t('v8.ops.deadlines.inDays', { count: q.deadline_risk.top.days_left })}` : null },
    { k: 'stage', label: t('v9.ops.q.stage'), to: '#ops-stages', bad: false,
      value: q.slowest_stage.top ? t(`appStatus.${q.slowest_stage.top.status}`) : t('v9.ops.tooFew'),
      sub: q.slowest_stage.top?.median_days != null ? t('v8.ops.stages.median', { count: q.slowest_stage.top.median_days }) : null },
    { k: 'unpaid', label: t('v9.ops.q.unpaid'), to: '#ops-unpaid', bad: q.unassigned_paid.count > 0, value: formatNumber(q.unassigned_paid.count, locale),
      sub: q.unassigned_paid.top ? `${q.unassigned_paid.top.student ?? '—'} · ${t('v9.ops.days', { count: q.unassigned_paid.top.days })}` : null },
  ];
  return (
    <nav className="ag9-qs" aria-label={t('v9.ops.questions')}>
      {cells.map((c) => (
        <a key={c.k} href={c.to} className="ag9-qs__cell" data-bad={c.bad || undefined}>
          <span className="ag9-qs__label">{c.label}</span>
          <span className="ag9-qs__value">{c.value}</span>
          {c.sub && <span className="ag9-qs__sub">{c.sub}</span>}
        </a>
      ))}
    </nav>
  );
}

function Blocked({ ops }: { ops: Ops }) {
  const { t } = useT();
  const b = ops.blocked;
  if (!b) return null;
  return (
    <YCard as="section" id="ops-blocked" title={t('v9.ops.blocked.title')} count={b.count}>
      <p className="ag8-q">{t('v9.ops.blocked.q', { count: b.days })}</p>
      {b.items.length === 0 ? <p className="text-muted mb-0">{t('v9.ops.blocked.none', { count: b.days })}</p> : (
        <ul className="ag8-rows">
          {b.items.slice(0, 8).map((i) => (
            <li key={i.student_id}>
              <Link to={i.link}>{i.student ?? '—'}</Link>
              <span className="text-muted">{t(`v9.waiting.party.${i.waiting_on}`)}{i.reason ? ` · ${t(`v9.waiting.reason.${i.reason}`, { count: 1, defaultValue: '' })}` : ''}{i.counselor?.name ? ` · ${i.counselor.name}` : ''}</span>
              <span className="ag8-rows__n text-danger fw-semibold">{t('v9.ops.days', { count: i.days })}</span>
            </li>
          ))}
          {b.items.length > 8 && <li className="text-muted">{t('v9.team.andMore', { count: b.items.length - 8 })}</li>}
        </ul>
      )}
      <Def id="blocked" text={ops.definitions.blocked ?? ''} />
    </YCard>
  );
}

function UnassignedPaid({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const u = ops.unassigned_paid;
  if (!u) return null;
  return (
    <YCard as="section" id="ops-unpaid" title={t('v9.ops.unpaid.title')} count={u.count}>
      <p className="ag8-q">{t('v9.ops.unpaid.q')}</p>
      {u.items.length === 0 ? <p className="text-muted mb-0">{t('v9.ops.unpaid.none')}</p> : (
        <ul className="ag8-rows">
          {u.items.map((i) => (
            <li key={i.student_id}>
              <Link to={i.link}>{i.student ?? '—'}</Link>
              <span className="text-muted">{i.product ?? ''} · {t(`v9.ops.unpaid.${i.missing}`)}{i.paid_at ? ` · ${formatDate(i.paid_at, locale, { month: 'short', day: 'numeric' })}` : ''}</span>
              <span className="ag8-rows__n fw-semibold">{t('v9.ops.days', { count: i.days })}</span>
            </li>
          ))}
        </ul>
      )}
      <Def id="unassigned_paid" text={ops.definitions.unassigned_paid ?? ''} />
    </YCard>
  );
}

function Sla({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const parts = [
    { key: 'first_response', label: t('v8.ops.sla.first') },
    { key: 'document_review', label: t('v8.ops.sla.docs') },
    { key: 'essay_review', label: t('v8.ops.sla.essays') },
  ] as const;
  const total = parts.reduce((a, p) => a + ops.sla[p.key].count, 0);
  return (
    <YCard as="section" id="ops-sla" title={t('v8.ops.sla.title')} count={formatNumber(total, locale)}>
      <p className="ag8-q">{t('v8.ops.sla.q')}</p>
      {total === 0 ? <p className="text-muted mb-0">{t('v8.ops.sla.none')}</p> : parts.map((p) => {
        const s = ops.sla[p.key];
        if (!s.count) return null;
        return (
          <div key={p.key} className="ag8-slagroup">
            <h3 className="ag8-sub"><Link to={s.link}>{p.label}</Link> <SoftBadge tone="danger">{formatNumber(s.count, locale)}</SoftBadge></h3>
            <ul className="ag8-rows">
              {s.items.slice(0, 5).map((i, n) => (
                <li key={n}>
                  <Link to={i.link}>{i.student ?? '—'}</Link>
                  <span className="text-muted">{i.category ? t(`docCategory.${i.category}`) : i.essay_type ? t(`essayType.${i.essay_type}`) : ''}{i.reviewer ? ` · ${i.reviewer}` : ''}</span>
                  <span className="ag8-rows__n text-danger">{i.since ? t('v8.ops.since', { when: formatRelative(i.since, locale) }) : ''}</span>
                </li>
              ))}
              {s.items.length > 5 && <li><Link to={s.link}>{t('v8.ops.allN', { count: s.items.length })}</Link></li>}
            </ul>
          </div>
        );
      })}
      <Def id="sla" text={ops.definitions.sla} />
    </YCard>
  );
}

function Deadlines({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const d = ops.deadlines;
  return (
    <YCard as="section" id="ops-deadlines" title={t('v8.ops.deadlines.title')} count={formatNumber(d.count, locale)}>
      <p className="ag8-q">{t('v8.ops.deadlines.q', { count: d.days })}</p>
      {d.items.length === 0 ? <p className="text-muted mb-0">{t('v8.ops.deadlines.none', { count: d.days })}</p> : (
        <ul className="ag8-rows">
          {d.items.map((i) => (
            <li key={i.application_id}>
              <Link to={i.link}>{i.student ?? '—'}</Link>
              <span className="text-muted">{i.university}{i.counselor?.name ? ` · ${i.counselor.name}` : ''}</span>
              <span className="ag8-rows__n">
                <span className={i.days_left <= 3 ? 'text-danger fw-semibold' : 'fw-semibold'}>{t('v8.ops.deadlines.inDays', { count: i.days_left })}</span>
                {' · '}{(i as { guide_review?: boolean }).guide_review ? t('v27.guide.missingTitle') : t('ws.itemsRemain', { count: i.items_remaining })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Def id="deadlines" text={ops.definitions.deadlines} />
    </YCard>
  );
}

function Stages({ ops }: { ops: Ops }) {
  const { t, locale } = useT();
  const rated = ops.stages.filter((s) => s.median_days !== null);
  const max = Math.max(1, ...rated.map((s) => s.median_days ?? 0));
  const slowest = rated[0];
  return (
    <YCard as="section" id="ops-stages" title={t('v8.ops.stages.title')}>
      <p className="ag8-q">{t('v8.ops.stages.q')}</p>
      {slowest && <p className="ag8-callout">{t('v8.ops.stages.slowest', { stage: t(`appStatus.${slowest.status}`), count: slowest.median_days ?? 0, n: slowest.n })}</p>}
      {rated.map((s) => (
        <ProgressRow key={s.status} to={s.link} label={t(`appStatus.${s.status}`)} max={max} value={s.median_days ?? 0} tone={s === slowest ? 'warning' : 'primary'}
          display={s.median_days !== null ? t('v8.ops.stages.median', { count: s.median_days }) : t('v8.ops.stages.tooFew', { n: s.n, min: ops.min_n })}
          sub={t('v8.ops.stages.now', { count: s.current, n: formatNumber(s.current, locale) })} />
      ))}
      {ops.stages.length > rated.length && (
        <details className="ag8-more">
          <summary>{t('v8.ops.stages.unrated', { count: ops.stages.length - rated.length, min: ops.min_n })}</summary>
          <ul className="ag8-rows">
            {ops.stages.filter((s) => s.median_days === null).map((s) => (
              <li key={s.status}><Link to={s.link}>{t(`appStatus.${s.status}`)}</Link><span className="text-muted">{t('v8.ops.stages.tooFew', { n: s.n, min: ops.min_n })}</span><span className="ag8-rows__n">{t('v8.ops.stages.now', { count: s.current, n: formatNumber(s.current, locale) })}</span></li>
            ))}
          </ul>
        </details>
      )}
      <Def id="stages" text={ops.definitions.stages} />
    </YCard>
  );
}

export function OperationsView() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const f = useUrlFilters(['agency_id'] as const);
  const agencies = useQuery({ queryKey: ['agency', 'agencies'], queryFn: () => api.agency.agencies(), enabled: perms.isHangyul });
  const q = useOps(perms.isHangyul ? f.values.agency_id || undefined : undefined);
  const ops = q.data;
  return (
    <div className="ag8-ops">
      <div className="ag8-ops__bar">
        <p className="text-muted fs-12 mb-0">{ops ? t('v8.ops.generated', { when: formatRelative(ops.generated_at, locale) }) : ' '}</p>
        {perms.isHangyul && (
          <FilterSelect size="sm" label={t('hq.ag.agency')} value={f.values.agency_id} onChange={(e) => f.set({ agency_id: e.target.value })}>
            <option value="">{t('hq.allAgencies')}</option>
            {(agencies.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        )}
      </div>
      {q.isError ? <Callout tone="danger">{t('states.error')}</Callout> : !ops ? <Skeleton h={480} /> : (
        <>
          <Questions ops={ops} />
          <Row>
            <Col xl={7}><Blocked ops={ops} /></Col>
            <Col xl={5}><UnassignedPaid ops={ops} /></Col>
          </Row>
          <Row>
            <Col xl={6}><Sla ops={ops} /></Col>
            <Col xl={6}><Deadlines ops={ops} /></Col>
          </Row>
          <Row>
            <Col xl={7}><Ageing ops={ops} /></Col>
            <Col xl={5}>{ops.load ? <Load ops={ops} /> : <Callout tone="info">{t('v8.ops.load.pickAgency')}</Callout>}</Col>
          </Row>
          <Row>
            <Col xl={7}><Backlog ops={ops} /></Col>
            <Col xl={5}><Stages ops={ops} /></Col>
          </Row>
        </>
      )}
    </div>
  );
}
