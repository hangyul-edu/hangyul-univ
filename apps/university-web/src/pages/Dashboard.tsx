// PRIMARY QUESTION: "Where is every applicant in our process, and which ones need us?"
//
// 2026-11 design pass. The home is an executive overview over one work table, in this order:
//   1. the summary band (components/overview/Summary) — who needs a decision, which documents are outstanding, offers
//      made, what happened after admission — four ruled columns, every figure a link to the rows it counts;
//   2. two supporting signals, lazily loaded (components/overview/Signals) — source countries and the monthly trend;
//   3. the pipeline rail (lib/workflow.ts): the stage counts ARE the table's totals for the same filter;
//   4. one toolbar row (search + filters + sort) and the applicant table.
// `/applicants` renders this same screen without the summary's supporting signals collapsed away — it is one screen.
import { useAuth } from '@hangyul/auth';
import { ChevronRight, Download, Filter, Flag, Search, Users } from '@hangyul/icons';
import { useLocale, localName } from '@hangyul/i18n';
import type { Application, ApplicationStatus } from '@hangyul/types';
import { DEGREE_LEVELS } from '@hangyul/types';
import {
  Badge, Button, Checkbox, DataTable, Drawer, EmptyState, ErrorState, Field, FilterSelect, PageHeader, Select, Skeleton, StageStrip, StatusText, useToast, type ColumnDef, type Stage,
} from '@hangyul/ui';
import { countryName, cx, downloadBlob, formatDate, formatNumber, formatRelative } from '@hangyul/utils';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Country } from '../components/common';
import { useFilterOptions } from '../components/FilterBar';
import { ExecutiveSummary } from '../components/overview/Summary';
import { BulkActions } from '../components/v8/BulkActions';
import { NeedText } from '../components/v8/NeedText';
import { decisionNeed } from '../lib/v8';
import { StatusSoft } from '../components/ynex';
import { activeChips, parseApplicantParams, REACHED_STEPS, writeApplicantParams, type ApplicantParams, type ApplicantSort, type ChipKey } from '../lib/filters';
import { intakeText } from '../lib/format';
import { VISIBLE_STATUSES } from '../lib/permissions';
import { useAgencyDirectory, useApplicantQuery, useApplicationCount, useApplications, usePrograms, useTeam } from '../lib/queries';
import { useUniversity } from '../lib/university';
import { listFilters } from '../lib/v9';
import { awaitingDecision, CLOSED_STATUSES, documentsText, nextDeadline, STAGES, stageFilter, stageFor, withStage, type StageKey } from '../lib/workflow';

/** Charts never block the work table: the two supporting signals ship in their own chunk. */
const OverviewSignals = lazy(() => import('../components/overview/Signals'));

type T = ReturnType<typeof useLocale>['t'];

function DocumentsCell({ a }: { a: Application }) {
  const { t } = useLocale(['university', 'common']);
  if (a.open_document_requests) return <StatusText tone="warning">{t('university:applicants.requested', { count: a.open_document_requests })}</StatusText>;
  if (a.status === 'ADDITIONAL_DOCUMENTS' && a.returned_document_requests) return <StatusText tone="info">{t('university:v4.docs.returned', { count: a.returned_document_requests })}</StatusText>;
  const d = a.documents;
  if (!d || !d.required) return <span className="hg-subtle">—</span>;
  const all = d.verified >= d.required;
  return (
    <span className={all ? 'uc-docs-ok hg-num' : 'hg-num'} title={t('university:v4.docs.title', { verified: d.verified, required: d.required, shared: d.shared })}>
      {t('university:v4.docs.verified', { verified: d.verified, required: d.required })}
    </span>
  );
}

/**
 * The small filters. `inline` = the four that sit in the toolbar (intake · country · programme · needs us);
 * everything else waits in the drawer behind "More filters".
 */
/**
 * V30 (REPORT §409): in the toolbar a filter is a `FilterSelect` (`category · value ⌄`, content-sized); in the
 * drawer it stays a labelled form field. Same options, same handler, two presentations.
 */
function FilterPick({ inline, id, label, value, onChange, children }: {
  inline?: boolean; id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode;
}) {
  if (inline) return <FilterSelect id={id} size="sm" label={label} value={value} onChange={(e) => onChange(e.target.value)}>{children}</FilterSelect>;
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} compact value={value} onChange={(e) => onChange(e.target.value)}>{children}</Select>
    </Field>
  );
}

function FilterFields({ p, set, idp, inline }: { p: ApplicantParams; set: (patch: Partial<ApplicantParams>) => void; idp: string; inline?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  const o = useFilterOptions();
  const team = useTeam();
  const members = team.data ?? [];
  const status = p.stage ? '' : p.status.length === 1 ? p.status[0] : p.status.length ? 'custom' : '';
  return (
    <>
      <FilterPick inline={inline} id={`${idp}-intake`} label={t('university:filters.intake')} value={p.intake ?? ''} onChange={(v) => set({ intake: v || undefined })}>
          <option value="">{t('university:filters.allIntakesOption')}</option>
          {[...new Set([...(p.intake ? [p.intake] : []), ...o.intakes])].map((k) => <option key={k} value={k}>{intakeText(k, t)}</option>)}
      </FilterPick>
      <FilterPick inline={inline} id={`${idp}-nat`} label={t('university:v8.aq.country')} value={p.nationality ?? ''} onChange={(v) => set({ nationality: v || undefined })}>
          <option value="">{t('university:filters.allNationalities')}</option>
          {[...new Set([...(p.nationality ? [p.nationality] : []), ...o.nationalities])].map((c) => <option key={c} value={c}>{countryName(c, locale)}</option>)}
      </FilterPick>
      <FilterPick inline={inline} id={`${idp}-program`} label={t('university:filters.program')} value={p.program_id ?? ''} onChange={(v) => set({ program_id: v || undefined })}>
          <option value="">{t('university:filters.allPrograms')}</option>
          {o.programs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </FilterPick>
      {/* Required action / missing item: the two server filters that say what a decision is waiting for. One control,
          because an application is in exactly one of these states (lib/v8.ts decisionNeed). */}
      <FilterPick inline={inline} id={`${idp}-need`} label={t('university:v33.list.need')} value={p.requests ? `requests:${p.requests}` : p.eligibility ? `eligibility:${p.eligibility}` : ''}
        onChange={(v) => { const [k, x] = v.split(':'); set({ requests: k === 'requests' ? (x as ApplicantParams['requests']) : undefined, eligibility: k === 'eligibility' ? (x as ApplicantParams['eligibility']) : undefined }); }}>
          <option value="">{t('university:filters.all')}</option>
          <option value="eligibility:MEETS">{t('university:v9.chip.eligibility.MEETS')}</option>
          <option value="eligibility:BELOW">{t('university:v9.chip.eligibility.BELOW')}</option>
          <option value="eligibility:TO_CHECK">{t('university:v9.chip.eligibility.TO_CHECK')}</option>
          <option value="requests:open">{t('university:v4.aq.requests.open')}</option>
          <option value="requests:returned">{t('university:v4.aq.requests.returned')}</option>
      </FilterPick>
      <div className={cx('uc-filter-check', inline && 'uv22-tool')}>
        <Checkbox label={t('university:applicants.flaggedOnly')} checked={p.flagged === true} onChange={(e) => set({ flagged: e.target.checked ? true : undefined })} />
      </div>
      {!inline && (
        <>
          <Field label={t('university:applicants.status')} htmlFor={`${idp}-status`}>
            <Select id={`${idp}-status`} compact value={status} onChange={(e) => set({ stage: undefined, status: e.target.value ? [e.target.value as ApplicationStatus] : [] })}>
              <option value="">{p.stage ? t(`university:v22.stage.${p.stage}`) : t('university:filters.all')}</option>
              {status === 'custom' && <option value="custom">{t('university:applicants.customStatus', { count: p.status.length })}</option>}
              {VISIBLE_STATUSES.map((s) => <option key={s} value={s}>{t(`common:appStatus.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('university:filters.degree')} htmlFor={`${idp}-degree`}>
            <Select id={`${idp}-degree`} compact value={p.degree ?? ''} onChange={(e) => set({ degree: (e.target.value || undefined) as ApplicantParams['degree'] })}>
              <option value="">{t('university:filters.allDegrees')}</option>
              {DEGREE_LEVELS.map((d) => <option key={d} value={d}>{t(`common:degreeShort.${d}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('university:filters.agency')} htmlFor={`${idp}-agency`}>
            <Select id={`${idp}-agency`} compact value={p.agency_id ?? ''} onChange={(e) => set({ agency_id: e.target.value || undefined })}>
              <option value="">{t('university:filters.allAgencies')}</option>
              {o.agencies.map((a) => <option key={a.id} value={a.id}>{a.name ?? t('university:agencies.unnamed')}</option>)}
            </Select>
          </Field>
          <Field label={t('university:reviewer.label')} htmlFor={`${idp}-rev`}>
            <Select id={`${idp}-rev`} compact value={p.reviewer ?? ''} onChange={(e) => set({ reviewer: e.target.value || undefined })}>
              <option value="">{t('university:v8.chip.anyReviewer')}</option>
              <option value="me">{t('university:v8.chip.reviewerMe')}</option>
              <option value="none">{t('university:v8.chip.reviewerNone')}</option>
              {members.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
            </Select>
          </Field>
          <Field label={t('university:v8.chip.reachedLabel')} htmlFor={`${idp}-reached`}>
            <Select id={`${idp}-reached`} compact value={p.reached ?? ''} onChange={(e) => set({ reached: (e.target.value || undefined) as ApplicantParams['reached'] })}>
              <option value="">{t('university:filters.all')}</option>
              {REACHED_STEPS.map((k) => <option key={k} value={k}>{t(`university:af.stepName.${k}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('university:v33.list.updated')} htmlFor={`${idp}-upd`}>
            <Select id={`${idp}-upd`} compact value={p.updated_within ? String(p.updated_within) : ''} onChange={(e) => set({ updated_within: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">{t('university:v33.list.anyTime')}</option>
              {[7, 30, 90].map((d) => <option key={d} value={d}>{t('university:v25.chip.days', { count: d })}</option>)}
              {p.updated_within && ![7, 30, 90].includes(p.updated_within) && <option value={p.updated_within}>{t('university:v25.chip.days', { count: p.updated_within })}</option>}
            </Select>
          </Field>
        </>
      )}
    </>
  );
}

/** Every active secondary filter as a removable chip, so a drill-down from Insights shows exactly what it is filtered by. */
function FilterChips({ p, set, onClear }: { p: ApplicantParams; set: (patch: Partial<ApplicantParams>) => void; onClear: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const o = useFilterOptions();
  const agencies = useAgencyDirectory();
  const team = useTeam();
  const chips = activeChips(p).filter((k) => !(p.stage && k === 'admin_check' && stageFilter(p.stage).admin_check));
  const customStatus = !p.stage && p.status.length > 0;
  if (!chips.length && !customStatus) return null;
  const value = (k: ChipKey): string => {
    switch (k) {
      case 'intake': return p.intake && /^\d{4}-/.test(p.intake) ? intakeText(p.intake, t) : t('university:v8.chip.oneIntake');
      case 'degree': return t(`common:degreeShort.${p.degree}`);
      case 'program_id': return o.programs.find((x) => x.id === p.program_id)?.name ?? '…';
      case 'nationality': return countryName(p.nationality ?? '', locale);
      case 'agency_id': return agencies.nameOf(p.agency_id) ?? '…';
      case 'reached': return t(`university:af.stepName.${p.reached}`);
      case 'reviewer': return p.reviewer === 'me' ? t('university:v8.chip.reviewerMe') : p.reviewer === 'none' ? t('university:v8.chip.reviewerNone') : team.data?.find((m) => m.user_id === p.reviewer)?.full_name ?? '…';
      case 'admin_check': return t(`university:v8.chip.admin_check.${p.admin_check}`);
      case 'flagged': return p.flagged ? t('university:applicants.flagged') : t('university:v8.chip.notFlagged');
      case 'requests': return t(`university:v4.aq.requests.${p.requests}`);
      case 'eligibility': return t(`university:v9.chip.eligibility.${p.eligibility}`);
      case 'submitted_within': return t('university:v25.chip.days', { count: p.submitted_within });
      case 'updated_within': return t('university:v25.chip.days', { count: p.updated_within });
      case 'submitted_month': return p.submitted_month ?? '';
    }
  };
  const keyLabel = (k: ChipKey) => (k === 'eligibility' ? t('university:v9.chip.key') : k === 'submitted_within' || k === 'updated_within' ? t(`university:v25.chip.${k}`) : k === 'submitted_month' ? t('university:v25.chip.submitted_within') : t(`university:v8.chip.key.${k}`));
  const chip = (k: string, label: string, val: string, remove: () => void) => (
    <span key={k} className="uv8-chip">
      <span className="uv8-chip__k">{label}</span>
      <span className="uv8-chip__v">{val}</span>
      <button type="button" className="uv8-chip__x" aria-label={t('university:v8.chip.remove', { what: `${label} ${val}` })} onClick={remove}>×</button>
    </span>
  );
  return (
    <div className="uv8-chips uv22-chips" role="group" aria-label={t('university:v8.chip.label')}>
      {customStatus && chip('status', t('university:applicants.status'), p.status.length === 1 ? t(`common:appStatus.${p.status[0]}`) : t('university:applicants.customStatus', { count: p.status.length }), () => set({ status: [] }))}
      {chips.map((k) => chip(k, keyLabel(k), value(k), () => set({ [k]: undefined })))}
      {(chips.length + (customStatus ? 1 : 0)) > 1 && <button type="button" className="hg-btn hg-btn--link hg-btn--sm" onClick={onClear}>{t('common:actions.clearFilters')}</button>}
    </div>
  );
}

/**
 * One count query per stage (page_size 1, same filter as the table) — the strip is a row of table totals.
 * `base` carries the non-status filters, so the numbers always describe the same intake / country / programme
 * the table is showing.
 */
function useStageCounts(base: Partial<ApplicantParams>) {
  const counts = STAGES.map((s) => useApplicationCount({ ...base, ...stageFilter(s.key) })); // eslint-disable-line react-hooks/rules-of-hooks
  const all = useApplicationCount({ ...base, status: [] });
  const closed = useApplicationCount({ ...base, status: CLOSED_STATUSES });
  return { byStage: Object.fromEntries(STAGES.map((s, i) => [s.key, counts[i].count])) as Record<StageKey, number | undefined>, all: all.count, closed: closed.count };
}

export default function Dashboard() {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { perms, scopeId, overview, isHangyul } = useUniversity();
  const [sp, setSp] = useSearchParams();
  const raw = useMemo(() => parseApplicantParams(sp), [sp]);
  // An old `?status=` link whose statuses are exactly one stage selects that stage.
  const p = useMemo(() => (raw.stage || !raw.status.length ? raw : { ...raw, stage: stageFor(raw.status, raw.admin_check) ?? undefined }), [raw]);
  const eff = useMemo(() => withStage(p), [p]);
  const [q, setQ] = useState(p.q ?? '');
  const [drawer, setDrawer] = useState(false);
  const [exporting, setExporting] = useState(false);
  const agencies = useAgencyDirectory();
  const programs = usePrograms();

  const set = (patch: Partial<ApplicantParams>) => setSp(writeApplicantParams({ ...p, page: 1, ...patch }), { replace: true });
  const pick = (k: StageKey | null) => set({ stage: k ?? undefined, status: [], admin_check: undefined, requests: undefined });

  useEffect(() => { setQ(p.q ?? ''); }, [p.q]);
  useEffect(() => {
    const h = setTimeout(() => { if ((q.trim() || undefined) !== p.q) set({ q: q.trim() || undefined }); }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const base = useMemo(() => ({ program_id: p.program_id, nationality: p.nationality, agency_id: p.agency_id, flagged: p.flagged, q: p.q, intake: p.intake, degree: p.degree,
    reviewer: p.reviewer, reached: p.reached, requests: p.requests, eligibility: p.eligibility, admin_check: p.stage ? undefined : p.admin_check,
    submitted_within: p.submitted_within, updated_within: p.updated_within, submitted_month: p.submitted_month }), [p]);
  // The headline describes the scope (intake · country · programme · agency · degree), never the headline filter itself.
  const headBase = useMemo(() => ({ program_id: p.program_id, nationality: p.nationality, agency_id: p.agency_id, intake: p.intake, degree: p.degree }), [p]);
  const counts = useStageCounts(base);
  const list = useApplications(eff);
  const listQuery = useApplicantQuery(eff);
  const secondary = activeChips(p).filter((k) => !['intake', 'nationality', 'program_id', 'flagged', 'requests', 'eligibility'].includes(k) && !(p.stage && k === 'admin_check')).length;
  const clearAll = () => setSp(writeApplicantParams({ stage: p.stage, q: p.q, sort: p.sort }), { replace: true });

  const stages: Stage<StageKey>[] = STAGES.map((s) => ({
    key: s.key,
    label: (
      <span className={cx('uv22-stage', s.needsUs && (counts.byStage[s.key] ?? 0) > 0 && 'uv22-stage--needs-us')}>
        {t(`university:v22.stage.${s.key}`)}
      </span>
    ),
    count: counts.byStage[s.key],
    hint: t(`university:v22.stageHint.${s.key}`),
  }));

  const columns = useMemo<ColumnDef<Application, unknown>[]>(() => {
    const head = (id: string, label: string) => <span data-col={id}>{label}</span>;
    const col = (id: string, key: string, rest: Partial<ColumnDef<Application, unknown>> & { exportValue: (r: Application) => unknown; hideOnMobile?: boolean; priority: number; minWidth: number }) => {
      const { exportValue, hideOnMobile, priority, minWidth, ...def } = rest;
      const label = t(key);
      return { id, header: () => head(id, label), enableSorting: false, meta: { label, exportValue, hideOnMobile, priority, minWidth }, ...def } as ColumnDef<Application, unknown>;
    };
    // Scanning order: who · what they applied for · where from · where they are · documents · what a decision needs ·
    // last change. Hangyul team, submitted date and deadline are secondary: they live in the row expander (priority 9
    // never fits beside the seven above) and in the CSV. Nothing scrolls sideways; narrower tables fold the highest
    // priority number first.
    return [
      {
        id: 'student', header: () => head('student', t('university:applicants.col.student')), enableSorting: false, enableHiding: false,
        meta: { primary: true, priority: 1, minWidth: 140, label: t('university:applicants.col.student'), exportValue: (r: Application) => r.student?.full_name ?? '' },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="un-who" data-col="student">
              <span className="un-who__name" title={r.student?.full_name}>{r.student?.full_name ?? '—'}</span>
              {r.flagged && <span className="un-who__flag" title={r.flag_reason ?? t('university:applicants.flagged')}><Flag size={13} aria-hidden /><span className="hg-sr-only">{t('university:applicants.flagged')}</span></span>}
            </span>
          );
        },
      },
      col('program', 'university:applicants.col.program', {
        priority: 2, minWidth: 184, exportValue: (r) => `${localName(r.program)} · ${r.intake.year}-${r.intake.term}`,
        cell: ({ row }) => (
          <span className="un-prog" data-col="program">
            <span className="un-prog__name" title={localName(row.original.program)}>{localName(row.original.program)}</span>
            <span className="un-prog__meta">{intakeText(`${row.original.intake.year}-${row.original.intake.term}`, t)} · {t(`common:degreeShort.${row.original.program.degree_level}`)}</span>
          </span>
        ),
      }),
      col('country', 'university:v8.aq.country', {
        priority: 4, minWidth: 120, exportValue: (r) => r.student?.nationality ?? '',
        cell: ({ row }) => <span data-col="country"><Country code={row.original.student?.nationality} /></span>,
      }),
      col('status', 'university:applicants.col.status', {
        priority: 2, minWidth: 116, exportValue: (r) => t(`common:appStatus.${r.status}`),
        cell: ({ row }) => <span data-col="status" title={t(`university:v4.status.${row.original.status}`, { defaultValue: '' })}><StatusSoft status={row.original.status} short /></span>,
      }),
      col('documents', 'university:applicants.col.documents', {
        priority: 5, minWidth: 112, exportValue: (r) => documentsText(r, t as never),
        cell: ({ row }) => <span data-col="documents"><DocumentsCell a={row.original} /></span>,
      }),
      col('need', 'university:v33.list.action', {
        priority: 2, minWidth: 148, exportValue: (r) => (awaitingDecision(r.status) ? r.eligibility?.status ?? '' : ''),
        cell: ({ row }) => <span data-col="need" className="un-need"><NeedText a={row.original} /></span>,
      }),
      col('updated', 'university:aq.updated', {
        priority: 6, minWidth: 104, hideOnMobile: true, exportValue: (r) => r.updated_at,
        cell: ({ row }) => <span data-col="updated" className="un-when" title={formatDate(row.original.updated_at, locale)}>{formatRelative(row.original.updated_at, locale)}</span>,
      }),
      col('submitted', 'university:applicants.col.submitted', {
        priority: 9, minWidth: 2000, hideOnMobile: true, exportValue: (r) => r.submitted_at ?? '',
        cell: ({ row }) => <span data-col="submitted" className="hg-num">{row.original.submitted_at ? formatDate(row.original.submitted_at, locale) : '—'}</span>,
      }),
      col('deadline', 'university:applicants.col.deadline', {
        priority: 9, minWidth: 2000, hideOnMobile: true, exportValue: (r) => r.intake.application_deadline ?? '',
        cell: ({ row }) => <span data-col="deadline" className="hg-num">{row.original.intake.application_deadline ? formatDate(row.original.intake.application_deadline, locale) : '—'}</span>,
      }),
      col('agency', 'university:applicants.col.agency', {
        priority: 9, minWidth: 2000, hideOnMobile: true, exportValue: (r) => agencies.nameOf(r.agency_org_id) ?? '',
        cell: ({ row }) => {
          const name = agencies.nameOf(row.original.agency_org_id);
          return <span data-col="agency">{name ?? <span className="hg-subtle">{row.original.agency_org_id ? '…' : t('university:agencies.direct')}</span>}</span>;
        },
      }),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, locale, agencies.directory]);

  /** Export what is on screen: the current filters (never more than the list shows). */
  const serverExport = async () => {
    setExporting(true);
    try {
      // V23 §273 U1: the list's own query (minus paging/sort), so the file is exactly the rows the table shows.
      const { page: _page, page_size: _size, sort: _sort, university_id: _uid, ...filters } = listQuery;
      const res = await api.university.exportApplications(scopeId, filters);
      downloadBlob(await res.blob(), `${overview?.slug ?? 'applications'}-applications-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('university:exports.done'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  // The nearest intake date and the closed count are one line of page meta, not widgets.
  const soonest = nextDeadline(programs.data ?? []);
  const name = overview ? (locale === 'ko' ? overview.name_ko : overview.name_en) : '';
  const rows = list.data?.items ?? [];
  const total = list.data?.total;
  const emptyTitle = p.stage && !secondary && !p.q ? t(`university:v22.empty.${p.stage}`) : secondary || p.q ? t('common:states.noResults') : t('university:applicants.empty');
  const subtitle = (
    <span className="un-pagemeta">
      <span>{name}</span>
      {counts.all !== undefined && <span>{t('university:v22.allN', { n: formatNumber(counts.all, locale) })}</span>}
      {soonest && (
        <Link to="/programs" className="uv22-meta__date">
          {t('university:v15.ov.nextDate', { kind: t(`university:ov.dates.kind.${soonest.kind}`), date: formatDate(soonest.date, locale, { month: 'short', day: 'numeric' }) })}
        </Link>
      )}
    </span>
  );
  const sortLabel: Record<string, string> = { decision: t('university:v26.sortBy.decision'), submitted: t('university:applicants.sortBy.submitted'), deadline: t('university:applicants.sortBy.deadline'), updated: t('university:applicants.sortBy.updated') };

  return (
    <div className="uv7 uv7-applicants uv22-work un-home">
      <PageHeader title={t('common:nav.applicants')} subtitle={subtitle}
        actions={perms.canExport ? (
          <Button size="sm" icon={<Download />} disabled={exporting} onClick={serverExport}>
            {p.stage || secondary ? t('university:v8.aq.exportFiltered') : t('university:exports.applicationsCsv')}
          </Button>
        ) : undefined} />

      <ExecutiveSummary base={headBase} set={set} byStage={counts.byStage} all={counts.all} />

      <Suspense fallback={<div className="un-sig" aria-hidden><Skeleton h={168} /><Skeleton h={168} /></div>}>
        <OverviewSignals base={headBase} set={set} />
      </Suspense>

      <section className="un-work" aria-labelledby="work-h">
        <div className="un-work__head">
          <h2 id="work-h" className="un-work__title">{t('university:v33.list.title')}</h2>
          {counts.closed !== undefined && counts.closed > 0 && (
            <Link to={`/applicants?${writeApplicantParams({ ...base, status: CLOSED_STATUSES }).toString()}`} className="un-work__closed uv22-meta__closed" data-closed-count={counts.closed}>
              {t('university:v22.closed', { n: formatNumber(counts.closed, locale) })}
            </Link>
          )}
        </div>
        <div className="uv22-strip">
          <StageStrip<StageKey> label={t('university:v22.stripLabel')} stages={stages} selected={p.stage ?? null} onSelect={pick}
            allLabel={t('university:filters.all')} allCount={counts.all} />
        </div>

        {/* One row at desktop widths: search, the scope filters, more filters, sort. Phones keep search + one Filters button. */}
        <div className="un-tools" role="search" aria-label={t('university:filters.label')}>
          <div className="hg-input-icon un-tools__search">
            <Search aria-hidden />
            <input type="search" className="hg-input hg-input--sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('university:applicants.searchPlaceholder')} aria-label={t('university:applicants.searchPlaceholder')} />
          </div>
          <div className="un-tools__filters uv22-tools" role="group" aria-label={t('university:filters.label')}>
            <FilterFields p={p} set={set} idp="apf" inline />
          </div>
          <Button size="sm" variant="ghost" icon={<Filter />} onClick={() => setDrawer(true)} className="un-tools__more">
            <span className="uc-only-compact">{t('common:actions.filter')}</span><span className="uc-only-wide">{t('university:v4.aq.moreFilters')}</span>
            {secondary > 0 && <Badge tone="brand" size="sm">{secondary}</Badge>}
          </Button>
          <div className="un-tools__sort">
            <FilterSelect id="ap-sort" size="sm" label={t('university:applicants.sort')} value={p.sort} active={false} onChange={(e) => set({ sort: e.target.value as ApplicantSort })}>
              {(['decision', 'submitted', 'deadline', 'updated'] as const).map((k) => <option key={k} value={k}>{sortLabel[k]}</option>)}
            </FilterSelect>
          </div>
        </div>

        <FilterChips p={p} set={set} onClear={clearAll} />

        <div className="uv22-table un-table" data-work-total={total ?? ''} data-work-stage={p.stage ?? 'all'}>
          {list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
            <DataTable<Application>
              columns={columns}
              data={rows}
              loading={list.isLoading}
              getRowId={(r) => r.id}
              onRowClick={(r) => nav(`/applications/${r.id}`)}
              caption={t('common:nav.applicants')}
              selectable={perms.canEdit || perms.canExport}
              bulkActions={(ids, clear) => <BulkActions ids={ids} rows={rows} clear={clear} total={total} filters={listFilters(eff, isHangyul)} />}
              renderCard={(r) => (
                <span className="un-acard">
                  <span className="un-acard__top">
                    <span className="un-acard__name">{r.student?.full_name ?? '—'}{r.flagged && <Flag size={13} className="un-acard__flag" aria-label={t('university:applicants.flagged')} />}</span>
                    <StatusSoft status={r.status} short />
                  </span>
                  <span className="un-acard__meta">{localName(r.program)} · {intakeText(`${r.intake.year}-${r.intake.term}`, t)}</span>
                  <span className="un-acard__meta un-acard__facts"><Country code={r.student?.nationality} /><span>{documentsText(r, t as never)}</span></span>
                  {/* A decided application needs nothing: on the card that is no line at all, not a lone dash. */}
                  {decisionNeed(r).kind !== 'decided' && <span className="un-acard__need"><NeedText a={r} /></span>}
                  <ChevronRight className="un-acard__chev hg-flip-rtl" aria-hidden />
                </span>
              )}
              server={{
                total: total ?? 0,
                pagination: { pageIndex: p.page - 1, pageSize: p.page_size },
                onPaginationChange: (u) => {
                  const next = typeof u === 'function' ? u({ pageIndex: p.page - 1, pageSize: p.page_size }) : u;
                  setSp(writeApplicantParams({ ...p, page: next.pageSize !== p.page_size ? 1 : next.pageIndex + 1, page_size: next.pageSize }), { replace: true });
                },
              }}
              empty={<EmptyState compact icon={<Users />} title={emptyTitle}
                text={secondary || p.q ? undefined : t('university:applicants.emptyText')}
                action={secondary || p.q ? <Button size="sm" onClick={clearAll}>{t('common:actions.clearFilters')}</Button> : undefined} />}
            />
          )}
        </div>
        <p className="un-pagenote">{t('university:applicants.privacyNote')}</p>
      </section>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t('common:actions.filter')} footer={<Button variant="primary" block onClick={() => setDrawer(false)}>{t('common:actions.done')}</Button>}>
        <div className="hg-stack"><FilterFields p={p} set={set} idp="apd" /></div>
      </Drawer>
    </div>
  );
}

/** Kept for the tests and the detail page: the text helpers are in lib/workflow.ts. */
export { awaitingDecision, documentsText } from '../lib/workflow';
export type { T as TranslateFn };
