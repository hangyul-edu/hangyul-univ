// PRIMARY QUESTION: "Where is every applicant in our process, and which ones need us?" (V22, REPORT §250 V1–V3).
//
// The home screen IS the work: one clickable stage strip (lib/workflow.ts) over one dense applicant table. The strip's
// numbers are the table's totals — the same `GET /applications` filter counts the stage and fills the table, so the two
// cannot disagree. The V15 Overview (ranked decision queue, funnel card, market bars, post-admission rates) is gone from
// here: "needs us" is a tangerine mark on the stages where the university must act, the funnel and markets live on
// Insights, and the nearest intake date is one line of toolbar meta. `/applicants` renders this same screen.
import { useAuth } from '@hangyul/auth';
import { ChevronRight, Download, Filter, Flag, Users } from '@hangyul/icons';
import { useLocale, localName } from '@hangyul/i18n';
import type { Application, ApplicationStatus } from '@hangyul/types';
import { DEGREE_LEVELS } from '@hangyul/types';
import {
  Badge, Button, Checkbox, DataTable, Drawer, EmptyState, ErrorState, Field, FilterSelect, Select, StageStrip, StatusText, useToast, WorkToolbar, type ColumnDef, type Stage,
} from '@hangyul/ui';
import { countryName, cx, downloadBlob, flagEmoji, formatDate, formatNumber, formatRelative } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useFilterOptions } from '../components/FilterBar';
import { BulkActions } from '../components/v8/BulkActions';
import { NeedText } from '../components/v8/NeedText';
import { StatusSoft, YAvatar } from '../components/ynex';
import { activeChips, parseApplicantParams, REACHED_STEPS, writeApplicantParams, type ApplicantParams, type ApplicantSort, type ChipKey } from '../lib/filters';
import { intakeText } from '../lib/format';
import { VISIBLE_STATUSES } from '../lib/permissions';
import { useAgencyDirectory, useApplicantQuery, useApplicationCount, useApplications, usePrograms, useTeam } from '../lib/queries';
import { useUniversity } from '../lib/university';
import { listFilters } from '../lib/v9';
import { AWAITING_DECISION, awaitingDecision, CLOSED_STATUSES, documentsText, nextDeadline, STAGES, stageFilter, stageFor, withStage, type StageKey } from '../lib/workflow';

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
      <FilterPick inline={inline} id={`${idp}-nat`} label={t('university:filters.nationality')} value={p.nationality ?? ''} onChange={(v) => set({ nationality: v || undefined })}>
          <option value="">{t('university:filters.allNationalities')}</option>
          {[...new Set([...(p.nationality ? [p.nationality] : []), ...o.nationalities])].map((c) => <option key={c} value={c}>{countryName(c, locale)}</option>)}
      </FilterPick>
      <FilterPick inline={inline} id={`${idp}-program`} label={t('university:filters.program')} value={p.program_id ?? ''} onChange={(v) => set({ program_id: v || undefined })}>
          <option value="">{t('university:filters.allPrograms')}</option>
          {o.programs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
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
          <Field label={t('university:v4.aq.requests.label', { defaultValue: t('university:v8.chip.key.requests') })} htmlFor={`${idp}-req`}>
            <Select id={`${idp}-req`} compact value={p.requests ?? ''} onChange={(e) => set({ requests: (e.target.value || undefined) as ApplicantParams['requests'] })}>
              <option value="">{t('university:filters.all')}</option>
              <option value="open">{t('university:v4.aq.requests.open')}</option>
              <option value="returned">{t('university:v4.aq.requests.returned')}</option>
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

/**
 * V25 (REPORT §315 U1): the first screen answers "how many need us, what changed, where do I click" before the strip. Four
 * quiet figures, not cards. Each is the total of the same `GET /applications` filter it opens, so a figure is always the row
 * count behind it; a figure of 0 stays visible (a quiet week is information) but is not a link.
 */
function Headline({ base, set }: { base: Partial<ApplicantParams>; set: (patch: Partial<ApplicantParams>) => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const decide = useApplicationCount({ ...base, status: AWAITING_DECISION });
  const requests = useApplicationCount({ ...base, status: [], requests: 'open' });
  const fresh = useApplicationCount({ ...base, status: [], submitted_within: 7 });
  const moved = useApplicationCount({ ...base, status: [], updated_within: 7 });
  const items: { k: string; n?: number; label: string; patch: Partial<ApplicantParams>; lead?: boolean }[] = [
    { k: 'decide', n: decide.count, label: t('university:v25.head.decide'), patch: { stage: undefined, status: AWAITING_DECISION }, lead: true },
    { k: 'requests', n: requests.count, label: t('university:v25.head.requests'), patch: { stage: undefined, status: [], requests: 'open' } },
    { k: 'fresh', n: fresh.count, label: t('university:v25.head.fresh'), patch: { stage: undefined, status: [], submitted_within: 7 } },
    { k: 'moved', n: moved.count, label: t('university:v25.head.moved'), patch: { stage: undefined, status: [], updated_within: 7 } },
  ];
  return (
    <section className="uv25-head" aria-label={t('university:v25.head.label')}>
      {items.map((it) => {
        const inner = (<><span className="uv25-head__n hg-num">{it.n === undefined ? '–' : formatNumber(it.n, locale)}</span><span className="uv25-head__l">{it.label}</span></>);
        return it.n ? (
          <button key={it.k} type="button" className={cx('uv25-head__item', it.lead && 'is-lead')} data-head={it.k} data-count={it.n} onClick={() => set(it.patch)}>{inner}</button>
        ) : <span key={it.k} className={cx('uv25-head__item is-zero', it.lead && 'is-lead')} data-head={it.k} data-count={it.n ?? ''}>{inner}</span>;
      })}
    </section>
  );
}

/**
 * V28 (UX_AUDIT UN-1): below "what needs us", one line of pipeline health and outcomes — every step with its count and the
 * share of the step before it (denominator shown; a share under the minimum sample is "표본 부족", never a number). The line
 * opens Analytics, where each bar drills to its rows. No cards, no chart on the home.
 */
function PipelineLine({ base }: { base: Partial<ApplicantParams> }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['university', 'funnel-line', base], queryFn: () => api.university.admissionsFunnel(base as Record<string, string | undefined>), staleTime: 60_000 });
  const steps = (q.data?.steps ?? []).filter((s) => ['SUBMITTED', 'OFFERED', 'ACCEPTED', 'VISA_ISSUED', 'ENROLLED'].includes(s.key));
  if (!steps.length) return null;
  return (
    <Link to="/analytics" className="uv28-pipe" aria-label={t('university:v28.pipe.label')}>
      <span className="uv28-pipe__h">{t('university:v28.pipe.title')}</span>
      <ol className="uv28-pipe__steps">
        {steps.map((s, i) => (
          <li key={s.key}>
            <span className="uv28-pipe__n hg-num">{formatNumber(s.count, locale)}</span>
            <span className="uv28-pipe__l">{t(`university:v28.pipe.step.${s.key}`)}</span>
            {i > 0 && s.conversion && (
              <span className="uv28-pipe__r">{s.conversion.insufficient_data
                ? t('university:v28.pipe.small', { n: s.conversion.denominator })
                : t('university:v28.pipe.rate', { pct: Math.round((s.conversion.value ?? 0) * 100), den: s.conversion.denominator })}</span>
            )}
          </li>
        ))}
      </ol>
    </Link>
  );
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
  const secondary = activeChips(p).filter((k) => !['intake', 'nationality', 'program_id', 'flagged'].includes(k) && !(p.stage && k === 'admin_check')).length;
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
    // Column priority (1024–1279): Applicant · Programme · Country · Status · Documents · Need · Updated; agency and
    // submitted date fold into the row details first. Nothing scrolls sideways.
    return [
      {
        id: 'student', header: () => head('student', t('university:applicants.col.student')), enableSorting: false, enableHiding: false,
        meta: { primary: true, priority: 1, minWidth: 150, label: t('university:applicants.col.student'), exportValue: (r: Application) => r.student?.full_name ?? '' },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="uv7-who" data-col="student">
              <YAvatar name={r.student?.full_name ?? '?'} />
              <span className="min-w-0 d-flex align-items-center gap-1">
                <span className="fw-semibold text-truncate uv7-who__name" title={r.student?.full_name}>{r.student?.full_name ?? '—'}</span>
                {r.flagged && <Flag size={13} className="uc-flag" aria-label={t('university:applicants.flagged')} />}
              </span>
            </span>
          );
        },
      },
      col('program', 'university:applicants.col.program', {
        priority: 2, minWidth: 130, exportValue: (r) => `${localName(r.program)} · ${r.intake.year}-${r.intake.term}`,
        cell: ({ row }) => (
          <span className="d-block min-w-0" data-col="program">
            <span className="d-block text-truncate uv7-prog" title={localName(row.original.program)}>{localName(row.original.program)}</span>
            <span className="d-block fs-11 text-muted">{intakeText(`${row.original.intake.year}-${row.original.intake.term}`, t)}</span>
          </span>
        ),
      }),
      col('country', 'university:v8.aq.country', {
        priority: 3, minWidth: 90, exportValue: (r) => r.student?.nationality ?? '',
        cell: ({ row }) => {
          const nat = row.original.student?.nationality;
          return <span data-col="country" className="uc-cell-trunc" title={nat ? countryName(nat, locale) : undefined}>{nat ? <><span aria-hidden>{flagEmoji(nat)} </span>{countryName(nat, locale)}</> : '—'}</span>;
        },
      }),
      col('status', 'university:applicants.col.status', {
        priority: 2, minWidth: 100, exportValue: (r) => t(`common:appStatus.${r.status}`),
        cell: ({ row }) => <span data-col="status" title={t(`university:v4.status.${row.original.status}`, { defaultValue: '' })}><StatusSoft status={row.original.status} short /></span>,
      }),
      col('documents', 'university:applicants.col.documents', {
        priority: 3, minWidth: 90, exportValue: (r) => documentsText(r, t as never),
        cell: ({ row }) => <span data-col="documents"><DocumentsCell a={row.original} /></span>,
      }),
      col('need', 'university:v8.aq.need', {
        priority: 2, minWidth: 120, exportValue: (r) => (awaitingDecision(r.status) ? r.eligibility?.status ?? '' : ''),
        cell: ({ row }) => <span data-col="need" className="uc-cell-trunc"><NeedText a={row.original} /></span>,
      }),
      col('updated', 'university:aq.updated', {
        priority: 4, minWidth: 70, hideOnMobile: true, exportValue: (r) => r.updated_at,
        cell: ({ row }) => <span data-col="updated" className="uc-sub uc-nowrap" title={formatDate(row.original.updated_at, locale)}>{formatRelative(row.original.updated_at, locale)}</span>,
      }),
      col('agency', 'university:applicants.col.agency', {
        priority: 6, minWidth: 130, hideOnMobile: true, exportValue: (r) => agencies.nameOf(r.agency_org_id) ?? '',
        cell: ({ row }) => {
          const name = agencies.nameOf(row.original.agency_org_id);
          return <span className="uc-cell-trunc" data-col="agency" title={name ?? undefined}>{name ?? <span className="hg-subtle">{row.original.agency_org_id ? '…' : t('university:agencies.direct')}</span>}</span>;
        },
      }),
      col('submitted', 'university:applicants.col.submitted', {
        priority: 5, minWidth: 96, hideOnMobile: true, exportValue: (r) => r.submitted_at ?? '',
        cell: ({ row }) => <span data-col="submitted" className="hg-small hg-num uc-nowrap" title={row.original.submitted_at ? formatDate(row.original.submitted_at, locale) : undefined}>{row.original.submitted_at ? formatDate(row.original.submitted_at, locale, { month: 'short', day: 'numeric' }) : '—'}</span>,
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

  // The nearest intake date as one line of meta — the only trace of the former dates widget (brief Part 27).
  const soonest = nextDeadline(programs.data ?? []);
  const meta = (
    <>
      {soonest && (
        <Link to="/programs" className="uv22-meta__date">
          {t('university:v15.ov.nextDate', { kind: t(`university:ov.dates.kind.${soonest.kind}`), date: formatDate(soonest.date, locale, { month: 'short', day: 'numeric' }) })}
        </Link>
      )}
      {counts.closed !== undefined && counts.closed > 0 && (
        <Link to={`/applicants?${writeApplicantParams({ ...base, status: CLOSED_STATUSES }).toString()}`} className="uv22-meta__closed" data-closed-count={counts.closed}>
          {t('university:v22.closed', { n: formatNumber(counts.closed, locale) })}
        </Link>
      )}
    </>
  );

  const name = overview ? (locale === 'ko' ? overview.name_ko : overview.name_en) : '';
  const rows = list.data?.items ?? [];
  const total = list.data?.total;
  const emptyTitle = p.stage && !secondary && !p.q ? t(`university:v22.empty.${p.stage}`) : secondary || p.q ? t('common:states.noResults') : t('university:applicants.empty');

  return (
    <div className="uv7 uv7-applicants uv22-work">
      <header className="uv22-head">
        <h1 className="uv22-head__title">{t('common:nav.applicants')}</h1>
        <p className="uv22-head__sub">{name}{counts.all !== undefined ? ` · ${t('university:v22.allN', { n: formatNumber(counts.all, locale) })}` : ''}</p>
        <div className="uv22-head__actions">
          {perms.canExport && (
            <button type="button" className="hg-btn hg-btn--ghost hg-btn--sm" disabled={exporting} onClick={serverExport}>
              <Download aria-hidden size={14} />{p.stage || secondary ? t('university:v8.aq.exportFiltered') : t('university:exports.applicationsCsv')}
            </button>
          )}
        </div>
      </header>

      <Headline base={headBase} set={set} />
      <PipelineLine base={headBase} />

      <div className="uv22-strip">
        <StageStrip<StageKey> label={t('university:v22.stripLabel')} stages={stages} selected={p.stage ?? null} onSelect={pick}
          allLabel={t('university:filters.all')} allCount={counts.all} />
      </div>

      <WorkToolbar search={q} onSearch={setQ} placeholder={t('university:applicants.searchPlaceholder')} meta={meta}>
        <div className="uv22-tools" role="group" aria-label={t('university:filters.label')}>
          <FilterFields p={p} set={set} idp="apf" inline />
        </div>
        <Button size="sm" variant="ghost" icon={<Filter />} onClick={() => setDrawer(true)}>
          <span className="uc-only-compact">{t('common:actions.filter')}</span><span className="uc-only-wide">{t('university:v4.aq.moreFilters')}</span>
          {secondary > 0 && <Badge tone="neutral" size="sm">{secondary}</Badge>}
        </Button>
        <FilterSelect id="ap-sort" size="sm" label={t('university:applicants.sort')} value={p.sort} active={false} onChange={(e) => set({ sort: e.target.value as ApplicantSort })}>
            <option value="decision">{t('university:v26.sortBy.decision')}</option>
            <option value="submitted">{t('university:applicants.sortBy.submitted')}</option>
            <option value="deadline">{t('university:applicants.sortBy.deadline')}</option>
            <option value="updated">{t('university:applicants.sortBy.updated')}</option>
        </FilterSelect>
      </WorkToolbar>

      <FilterChips p={p} set={set} onClear={clearAll} />

      <div className="uv22-table" data-work-total={total ?? ''} data-work-stage={p.stage ?? 'all'}>
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
              <span className="hg-lrow uv7-acard" style={{ padding: 0 }}>
                <YAvatar name={r.student?.full_name ?? '?'} />
                <span className="hg-lrow__main">
                  <span className="hg-row hg-between" style={{ gap: 8 }}>
                    <span className="uc-applicant__name hg-truncate">{r.student?.full_name ?? '—'}{r.flagged && <Flag size={13} className="uc-flag" aria-label={t('university:applicants.flagged')} style={{ display: 'inline', marginInlineStart: 6 }} />}</span>
                    <StatusSoft status={r.status} short />
                  </span>
                  <span className="hg-lrow__meta hg-truncate">{localName(r.program)} · {intakeText(`${r.intake.year}-${r.intake.term}`, t)}</span>
                  <span className="hg-lrow__meta">{r.student?.nationality ? countryName(r.student.nationality, locale) : '—'} · {documentsText(r, t as never)}</span>
                  <span className="hg-lrow__meta"><NeedText a={r} /></span>
                </span>
                <ChevronRight className="hg-lrow__chev hg-flip-rtl" aria-hidden />
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
      <p className="fs-12 text-muted uv7-pagenote">{t('university:applicants.privacyNote')}</p>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t('common:actions.filter')} footer={<Button variant="primary" block onClick={() => setDrawer(false)}>{t('common:actions.done')}</Button>}>
        <div className="hg-stack"><FilterFields p={p} set={set} idp="apd" /></div>
      </Drawer>
    </div>
  );
}

/** Kept for the tests and the detail page: the text helpers are in lib/workflow.ts. */
export { awaitingDecision, documentsText } from '../lib/workflow';
export type { T as TranslateFn };
