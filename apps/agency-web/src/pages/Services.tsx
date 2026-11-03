// PRIMARY QUESTION: Which service cases need us now?
// V9 (REPORT §55 #27): with no view in the URL the queue opens on the first view that has cases (overdue first), never on
// an empty "needs owner" tab while cases wait elsewhere. Explicit links (?view=…) are respected.
/**
 * Services queue (V5 concierge): every post-admission service case — pickups, dormitory, housing search, residence card,
 * help requests — in one queue with operational views. Row → case drawer.
 */
import { useAuth } from '@hangyul/auth';
import { CheckCircle2, Store } from '@hangyul/icons';
import type { ServiceView } from '@hangyul/types';
import { ButtonLink, EmptyState, ErrorState, PageHeader, FilterSelect, Skeleton, Tabs } from '@hangyul/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { FilterBar } from '../components/bits';
import { ServiceCaseDrawer, ServiceList, useCT } from '../components/ServiceCases';
import { useUrlFilters } from '../lib/hooks';

const VIEWS: ServiceView[] = ['needs_assignment', 'waiting_student', 'waiting_provider', 'scheduled', 'today', 'overdue', 'completed'];

function Quality() {
  const { t } = useCT();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['services', 'metrics'], queryFn: () => api.concierge.metrics(90), staleTime: 300_000 });
  if (!q.data) return null;
  const m = q.data;
  const pct = (r: { value: number | null; insufficient: boolean; numerator: number; denominator: number }) =>
    r.insufficient ? t('metrics.withheld', { n: r.denominator }) : `${Math.round((r.value ?? 0) * 100)}% (${r.numerator}/${r.denominator})`;
  const items: [string, string, string][] = [
    ['completion', pct(m.completion), t('agency:v30.def.svc.completion', { defaultValue: m.completion.definition })],
    ['sla', pct(m.sla_breach), t('agency:v30.def.svc.sla', { defaultValue: m.sla_breach.definition })],
    ['arrival', pct(m.arrival_support_completion), t('agency:v30.def.svc.arrival', { defaultValue: m.arrival_support_completion.definition })],
    ['feedback', m.feedback.insufficient ? t('metrics.withheld', { n: m.feedback.n }) : `${Math.round((m.feedback.share_yes ?? 0) * 100)}% (${m.feedback.yes}/${m.feedback.n})`, m.feedback.definition],
    ['resolution', m.time_to_resolution_hours.insufficient ? t('metrics.withheld', { n: m.time_to_resolution_hours.n }) : t('metrics.hours', { count: m.time_to_resolution_hours.median ?? 0 }), t('agency:v30.def.svc.resolution', { defaultValue: m.time_to_resolution_hours.definition })],
  ];
  return (
    <details className="hg-panel">
      <summary style={{ padding: '12px 16px', cursor: 'pointer' }} className="hg-small hg-strong">{t('metrics.title')} <span className="hg-subtle">· {t('metrics.period', { n: m.n_cases })}</span></summary>
      <div className="cq-metrics">
        {items.map(([k, v, def]) => (
          <div key={k} className="cq-metric"><span className="cq-metric__label">{t(`metrics.${k}`)}</span><span className="cq-metric__value">{v}</span><span className="cq-metric__def">{def}</span></div>
        ))}
        <div className="cq-metric"><span className="cq-metric__label">{t('metrics.counts')}</span>
          <span className="hg-small">{t('metrics.countsLine', { pickups: m.counts.pickups_completed, noShows: m.counts.no_shows, issues: m.counts.student_issues, housing: m.counts.housing_confirmed })}</span></div>
      </div>
    </details>
  );
}

export default function Services() {
  const { t } = useCT();
  const { api } = useAuth();
  const f = useUrlFilters(['view', 'type', 'owner', 'case'] as const);
  const explicit = VIEWS.includes(f.values.view as ServiceView) ? (f.values.view as ServiceView) : null;
  // Counts for every view come with any page of the queue; read them once to pick the opening view.
  const probe = useQuery({ queryKey: ['services', { view: 'needs_assignment', type: f.values.type || undefined, owner: f.values.owner || undefined }],
    queryFn: () => api.concierge.queue({ view: 'needs_assignment', type: f.values.type || undefined, owner: f.values.owner || undefined }), enabled: !explicit });
  const OPEN_ORDER: ServiceView[] = ['overdue', 'needs_assignment', 'today', 'waiting_provider', 'waiting_student', 'scheduled', 'completed'];
  const auto = probe.data ? OPEN_ORDER.find((v) => (probe.data.counts[v] ?? 0) > 0) ?? 'needs_assignment' : 'needs_assignment';
  const view = explicit ?? auto;
  const query = { view, type: f.values.type || undefined, owner: f.values.owner || undefined };
  const q = useQuery({ queryKey: ['services', query], queryFn: () => api.concierge.queue(query), enabled: !!explicit || !!probe.data });
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('staff.title')} subtitle={t('staff.subtitle')}
        actions={<ButtonLink as={Link} to="/vendors" size="sm" variant="ghost" icon={<Store />}>{t('vendors.title')}</ButtonLink>} />
      <Tabs label={t('staff.title')} value={view} onChange={(v) => f.set({ view: v })}
        tabs={VIEWS.map((v) => ({ value: v, label: t(`view.${v}`), count: q.data ? q.data.counts[v] : undefined }))} />
      <div className="hg-panel ag-table-panel">
        <div className="ag-card-toolbar">
          <FilterBar active={[f.values.type, f.values.owner].filter(Boolean).length} onClear={() => f.set({ type: null, owner: null })}>
            <FilterSelect size="sm" label={t('staff.type')} value={f.values.type} onChange={(e) => f.set({ type: e.target.value })}>
              <option value="">{t('staff.allTypes')}</option>
              {(q.data?.types ?? []).map((x) => <option key={x} value={x}>{t(`type.${x}`)}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('staff.owner')} value={f.values.owner} onChange={(e) => f.set({ owner: e.target.value })}>
              <option value="">{t('staff.anyOwner')}</option>
              <option value="me">{t('staff.mine')}</option>
              <option value="unassigned">{t('staff.unassigned')}</option>
            </FilterSelect>
          </FilterBar>
        </div>
        {q.isPending ? <div style={{ padding: 16 }} className="hg-stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={40} r={6} />)}</div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
            : <ServiceList items={q.data!.items} onOpen={(id) => f.set({ case: id }, false)}
                empty={<EmptyState icon={<CheckCircle2 />} title={t(`staff.empty.${view}`)} text={t('staff.emptyText')} />} />}
      </div>
      <Quality />
      <ServiceCaseDrawer id={f.values.case || null} onClose={() => f.set({ case: null }, false)} />
    </div>
  );
}
