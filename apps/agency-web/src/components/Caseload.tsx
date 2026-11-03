/**
 * V22 caseload grammar (REPORT §249 G1–G3, brief §52–§53): ONE process strip, ONE toolbar, ONE work table.
 *
 * Today and Students render this same component. The strip's nine steps are groups of `PipelineStage` (lib/stages.ts);
 * selecting one sends the group's stages as the repeatable `stage=` filter of `GET /agency/students`, and the count on
 * the step is that very query's `total` — so the number on the strip is always the number of rows underneath.
 *
 *   · no toolbar filter  → counts from `GET /agency/stage-counts` (one grouped query, same tenant scope);
 *   · any toolbar filter → one `page_size=1` count query per step with the same filters (ten light requests).
 *
 * Today (`mode="today"`): no paging, top 10 rows, most urgent first — the ranked Today queue's position is merged into
 * the rows where it exists, the rest keep the server's deadline order. Students (`mode="students"`): full paging, the
 * built-in views are a toolbar filter, sortable columns. The table wrapper carries `data-work-total` / `data-work-stage`
 * for the `qa:v22` gate.
 */
import { useAuth } from '@hangyul/auth';
import { Bookmark, SlidersHorizontal, Trash2 } from '@hangyul/icons';
import { PIPELINE_STAGES, type AgencySavedView, type AgencyStudentRow, type AgencyViewKey, type PipelineStage } from '@hangyul/types';
import { Button, DataTable, EmptyState, ErrorState, FilterSelect, StageStrip, StageView, WorkToolbar, type ColumnDef } from '@hangyul/ui';
import { countryName, cx, flagEmoji, formatDate, formatNumber, formatRelative } from '@hangyul/utils';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { localName } from '@hangyul/i18n';
import { useDebounced, useHotkeys, usePerms, useUrlFilters } from '../lib/hooks';
import { shortRelative } from '../lib/logic';
import { CLOSED_KEY, groupOf, isStripKey, STAGE_GROUPS, stagesFor, stripCounts, type StripKey } from '../lib/stages';
import { rowHref } from '../lib/focus';
import { useTodayQueue } from '../lib/v8';
import { useT, useWaitingText, WAITING_PARTIES, WaitingOn } from './bits';
import { StageSoft } from './ynex';

export type CaseloadMode = 'today' | 'students';

/** Every URL key the caseload understands. Old links (`?view=`, `?missing=1`, `?stage=NEW_LEAD`) keep resolving. */
const KEYS = ['stage', 'q', 'counselor', 'nationality', 'waiting', 'intake', 'view', 'saved', 'agency', 'degree', 'sla', 'within', 'missing', 'closing', 'sla_risk', 'sort', 'page', 'size'] as const;
type Key = (typeof KEYS)[number];

const SORT_TO_COL: Record<string, { id: string; desc: boolean }> = {
  name: { id: 'full_name', desc: false }, stage: { id: 'pipeline_stage', desc: false }, deadline: { id: 'next_deadline', desc: false }, activity: { id: 'last_activity', desc: true },
};
const COL_TO_SORT: Record<string, string> = { full_name: 'name', pipeline_stage: 'stage', next_deadline: 'deadline', last_activity: 'activity' };

/** The ten built-in views (V8) — a toolbar filter now, not a tab row. */
const VIEWS: AgencyViewKey[] = ['urgent', 'attention', 'deadline7', 'student_silent', 'university', 'docs', 'visa_blocked', 'new_paid', 'unassigned', 'waiting_student'];
const VIEW_LABEL: Partial<Record<AgencyViewKey, string>> = {
  urgent: 'v8.view.urgent', deadline7: 'v8.view.deadline7', student_silent: 'v8.view.student_silent', university: 'v8.view.university',
  docs: 'v8.view.docs', visa_blocked: 'v8.view.visa_blocked', new_paid: 'v8.view.new_paid', unassigned: 'v8.view.unassigned',
};

export function useCountries() {
  const { api } = useAuth();
  return useQuery({ queryKey: ['meta', 'countries', 'priority'], queryFn: () => api.meta.countries(undefined, true), staleTime: 60 * 60_000 });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);
}

/** A saved view is exactly a set of list filters (server validates the keys) — URL ⇄ filters. */
function fromFilters(f: Record<string, unknown>): Partial<Record<Key, string | null>> {
  const one = (x: unknown) => (Array.isArray(x) ? String(x[0] ?? '') : x ? String(x) : '');
  return {
    q: one(f.q) || null, view: one(f.view) || null, stage: Array.isArray(f.stage) ? f.stage.join(',') : one(f.stage) || null,
    nationality: one(f.nationality) || null, degree: one(f.degree) || null, intake: one(f.intake) || null,
    sla: f.sla_breached ? '1' : null, within: f.deadline_within_days ? String(f.deadline_within_days) : null, missing: f.missing_documents ? '1' : null,
    waiting: one(f.waiting_on) || null, closing: f.closing_within_days ? String(f.closing_within_days) : null, sla_risk: f.sla_risk ? '1' : null,
  };
}
export function toFilters(v: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (v.q) out.q = v.q;
  if (v.view) out.view = v.view;
  if (v.stage) out.stage = stagesFor(isStripKey(v.stage) ? v.stage : null) ?? v.stage.split(',');
  if (v.nationality) out.nationality = [v.nationality];
  if (v.degree) out.degree = [v.degree];
  if (v.intake) out.intake = v.intake;
  if (v.sla === '1') out.sla_breached = true;
  if (v.within) out.deadline_within_days = Number(v.within);
  if (v.missing === '1') out.missing_documents = true;
  if (v.waiting) out.waiting_on = v.waiting;
  if (v.closing) out.closing_within_days = Number(v.closing);
  if (v.sla_risk === '1') out.sla_risk = true;
  return out;
}

/** `?stage=` is a strip key, or (older links, saved views) one or more raw pipeline stages. */
function parseStage(v: string): { key: StripKey | null; stages: PipelineStage[] | undefined } {
  if (!v) return { key: null, stages: undefined };
  if (isStripKey(v)) return { key: v, stages: stagesFor(v) };
  const raw = v.split(',').filter((s): s is PipelineStage => (PIPELINE_STAGES as string[]).includes(s));
  if (!raw.length) return { key: null, stages: undefined };
  const g = groupOf(raw[0]);
  const whole = stagesFor(g) ?? [];
  const sameGroup = raw.every((s) => groupOf(s) === g) && whole.length === raw.length;
  return { key: sameGroup ? g : null, stages: raw };
}

export function Caseload({ mode, bulkActions, saveView }: {
  mode: CaseloadMode;
  bulkActions?: (ids: string[], clear: () => void) => ReactNode;
  /** Students: opens the "save this view" modal with the current filters. */
  saveView?: (filters: Record<string, unknown>, sort: string) => void;
}) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const nav = useNavigate();
  const perms = usePerms();
  const waitText = useWaitingText();
  const countries = useCountries();
  const f = useUrlFilters(KEYS);
  const v = f.values;
  const today = mode === 'today';

  const [search, setSearch] = useState(v.q);
  const dq = useDebounced(search, 300);
  useEffect(() => { if (dq !== v.q) f.set({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (v.q !== search && v.q !== dq) setSearch(v.q); }, [v.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const { key: stageKey, stages } = parseStage(v.stage);
  const agencyId = perms.isHangyul ? v.agency || undefined : undefined;
  const view = (VIEWS as string[]).includes(v.view) || ['waiting_counselor', 'waiting_agency', 'waiting_hangyul', 'waiting_us', 'requested', 'waiting_external', 'deadline', 'incomplete', 'visa', 'arrived', 'mine'].includes(v.view) ? v.view : '';
  /** Everything but the strip selection — the counts on the strip are computed with exactly these. */
  const base = {
    q: v.q || undefined, nationality: v.nationality || undefined, waiting_on: v.waiting || undefined, intake: v.intake || undefined,
    view: view && view !== 'mine' ? view : undefined, // V23 §272 A2: `?counselor=` (Insights' workload rows) is a real filter now, not a silently ignored key.
    counselor_id: v.counselor || (view === 'mine' ? perms.userId : undefined), agency_id: agencyId,
    degree: v.degree || undefined, sla_breached: v.sla === '1' || undefined, deadline_within_days: v.within ? Number(v.within) : undefined,
    missing_documents: v.missing === '1' || undefined, closing_within_days: v.closing ? Number(v.closing) : undefined, sla_risk: v.sla_risk === '1' || undefined,
  };
  const filtered = Object.values(base).some((x) => x !== undefined);

  const pageIndex = today ? 0 : Math.max(0, Number(v.page || 1) - 1);
  const pageSize = today ? 100 : Number(v.size || 50);
  const sort = today ? 'deadline' : v.sort || 'deadline';
  const query = { ...base, stage: stages, sort, page: pageIndex + 1, page_size: pageSize };
  const rowsQ = useQuery({ queryKey: ['agency', 'students', query], queryFn: () => api.agency.students(query), placeholderData: keepPreviousData });

  // ---- strip counts: the same predicate as the rows, one number per step.
  const plain = useQuery({ queryKey: ['agency', 'stage-counts'], queryFn: () => api.agency.stageCounts(), enabled: !filtered, staleTime: 30_000 });
  const stripKeys: StripKey[] = [...STAGE_GROUPS.map((g) => g.key), CLOSED_KEY];
  const perStep = useQueries({
    queries: stripKeys.map((k) => ({
      queryKey: ['agency', 'students', 'count', k, base],
      queryFn: () => api.agency.students({ ...base, stage: stagesFor(k), page_size: 1 }),
      enabled: filtered, staleTime: 30_000,
    })),
  });
  const allQ = useQuery({ queryKey: ['agency', 'students', 'count', 'all', base], queryFn: () => api.agency.students({ ...base, page_size: 1 }), enabled: filtered, staleTime: 30_000 });
  const counts: Record<StripKey, number> = filtered
    ? (Object.fromEntries(stripKeys.map((k, i) => [k, perStep[i].data?.total ?? 0])) as Record<StripKey, number>)
    : stripCounts(plain.data);
  const allCount = filtered ? allQ.data?.total ?? 0 : stripKeys.reduce((a, k) => a + counts[k], 0);

  // ---- Today: urgency order from the ranked queue, merged where it exists.
  const queue = useTodayQueue(today ? 'team' : undefined, null, 100, null);
  const items = rowsQ.data?.items ?? [];
  const ordered = useMemo(() => {
    if (!today || stageKey) return items;
    const pos = new Map((queue.data?.items ?? []).map((it) => [it.student.id, it.position]));
    const ranked = items.filter((r) => pos.has(r.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    return [...ranked, ...items.filter((r) => !pos.has(r.id))];
  }, [items, queue.data, today, stageKey]);
  const [all, setAll] = useState(false);
  const shown = today && !all ? ordered.slice(0, 10) : ordered;
  const total = rowsQ.data?.total ?? 0;

  // ---- toolbar helpers
  const waitingCounts = useQuery({ queryKey: ['agency', 'today'], queryFn: () => api.agency.today(), staleTime: 60_000 });
  const upcoming = useQuery({ queryKey: ['agency', 'deadlines', 14], queryFn: () => api.agency.deadlines(14), enabled: today, staleTime: 60_000 });
  const upcomingN = (upcoming.data ?? []).filter((x) => !x.overdue).length;
  const viewCounts = useQuery({ queryKey: ['agency', 'students', 'views', agencyId ?? null],
    queryFn: () => (agencyId ? api.get<Record<string, number>>('/agency/students/views', { agency_id: agencyId }) : api.agency.studentViews()) });
  const saved = useQuery({ queryKey: ['agency', 'saved-views'], queryFn: () => api.agency.savedViews(), enabled: !today });
  const agencies = useQuery({ queryKey: ['agency', 'agencies'], queryFn: () => api.agency.agencies(), enabled: perms.isHangyul, staleTime: 5 * 60_000 });
  const activeSaved = (saved.data ?? []).find((x) => x.id === v.saved);
  const intakes = useMemo(() => { const y = new Date().getFullYear(); return [y, y + 1, y + 2].flatMap((yr) => ['SPRING', 'FALL'].map((term) => `${yr}-${term}`)); }, []);
  const clearAll: Partial<Record<Key, null>> = Object.fromEntries(KEYS.filter((k) => k !== 'agency').map((k) => [k, null]));
  const applySaved = (sv: AgencySavedView) => f.set({ ...clearAll, ...fromFilters(sv.filters), sort: sv.sort, saved: sv.id });
  const activeFilters = [v.counselor, v.nationality, v.waiting, v.intake, view, v.degree, v.sla, v.within, v.missing, v.closing, v.sla_risk].filter(Boolean).length;

  useHotkeys({
    '/': () => document.querySelector<HTMLInputElement>('.ag22-work .hg-worktools input')?.focus(),
    j: () => { if (!document.activeElement?.closest('tbody')) document.querySelector<HTMLElement>('.ag22-work tbody tr[tabindex]')?.focus(); },
  });

  const columns = useMemo<ColumnDef<AgencyStudentRow>[]>(() => [
    { id: 'full_name', accessorKey: 'full_name', header: t('v22.work.col.student'), enableHiding: false, enableSorting: !today, size: 190,
      meta: { primary: true, priority: 1, minWidth: 170, label: t('v22.work.col.student'), exportValue: (r) => r.full_name },
      cell: ({ row }) => (
        <span className="ag22-cell-name">
          <span className="fw-semibold text-truncate">{row.original.full_name}</span>
          {row.original.sla_breached && <span className="badge bg-danger-transparent" title={t('students.noReply')}>{t('students.noReplyShort')}</span>}
          {/* V24 (REPORT §295): the country is context for the name, not a column to decide by. */}
          <span className="ag24-cell-country text-muted text-truncate"><span aria-hidden>{flagEmoji(row.original.nationality)} </span>{countryName(row.original.nationality, locale)}</span>
        </span>
      ) },
    { id: 'country', accessorFn: (r) => countryName(r.nationality, locale), header: t('v22.work.col.country'), enableSorting: false, size: 110, meta: { label: t('v22.work.col.country'), priority: 3, minWidth: 100, hideOnMobile: true, defaultHidden: true },
      cell: ({ row }) => <span className="hg-nowrap text-truncate" title={countryName(row.original.nationality, locale)}><span aria-hidden>{flagEmoji(row.original.nationality)} </span>{countryName(row.original.nationality, locale)}</span> },
    { id: 'pipeline_stage', accessorKey: 'pipeline_stage', header: t('v22.work.col.stage'), enableSorting: !today, size: 120, meta: { label: t('v22.work.col.stage'), priority: 1, minWidth: 116, exportValue: (r) => t(`pipeline.${r.pipeline_stage}`) },
      cell: ({ getValue }) => <StageSoft stage={getValue<PipelineStage>()} /> },
    { id: 'next_action', accessorFn: (r) => waitText.next(r.next_action) ?? '', header: t('v22.work.col.next'), enableSorting: false,
      meta: { label: t('v22.work.col.next'), priority: 1, minWidth: 180, exportValue: (r) => waitText.next(r.next_action) ?? '' },
      cell: ({ row }) => {
        const na = row.original.next_action;
        const text = waitText.next(na);
        if (!text) return <span className="hg-subtle">—</span>;
        // V26 (REPORT §341): the next action is the link to the exact record it names, not a sentence to go and find.
        return (
          <Link to={rowHref(row.original, view)} className={cx('ag7-clamp ag26-next', na?.task?.overdue && 'ag-overdue')} onClick={(e) => e.stopPropagation()}
            title={[text, waitText.owner(row.original.waiting_owner)].filter(Boolean).join(' · ')}>{text}</Link>
        );
      } },
    { id: 'waiting_on', accessorFn: (r) => r.waiting_on ?? '', header: t('v22.work.col.waiting'), enableSorting: false, size: 120,
      meta: { label: t('v22.work.col.waiting'), priority: 2, minWidth: 110, exportValue: (r) => (r.waiting_on ? waitText.party(r.waiting_on) : '') },
      cell: ({ row }) => <WaitingOn on={row.original.waiting_on} reason={row.original.waiting_reason} bare /> },
    { id: 'next_deadline', accessorFn: (r) => r.next_deadline?.date ?? '', header: t('v22.work.col.due'), enableSorting: !today, size: 92, meta: { label: t('v22.work.col.due'), priority: 1, minWidth: 88 },
      cell: ({ row }) => {
        const d = row.original.next_deadline;
        if (!d) return <span className="hg-subtle">—</span>;
        const n = daysUntil(d.date);
        return <span className={cx('hg-num hg-nowrap', n < 0 && 'text-danger', n >= 0 && n <= 7 && 'ag-soon')} title={`${localName({ name_en: d.university, name_ko: d.university_ko })} · ${t('students.dShort', { count: n })}`}>{formatDate(d.date, locale, { month: 'short', day: 'numeric' })}</span>;
      } },
    { id: 'university', accessorFn: (r) => r.top_university?.name ?? '', header: t('v22.work.col.university'), enableSorting: false, size: 130, meta: { label: t('v22.work.col.university'), priority: 3, minWidth: 120, hideOnMobile: true },
      cell: ({ row }) => row.original.top_university ? <span className="ag7-clamp" title={row.original.top_university.name}>{row.original.top_university.name}</span> : <span className="hg-subtle">—</span> },
    { id: 'last_activity', accessorFn: (r) => r.last_activity_at ?? '', header: t('v22.work.col.activity'), enableSorting: !today, size: 80, meta: { label: t('v22.work.col.activity'), priority: 4, minWidth: 80, hideOnMobile: true },
      cell: ({ getValue }) => <span className="hg-subtle hg-small hg-nowrap" title={getValue<string>() ? formatRelative(getValue<string>(), locale) : undefined}>{shortRelative(getValue<string>(), locale)}</span> },
  ], [t, locale, waitText, today, view]);

  const sorting = !today && v.sort && SORT_TO_COL[v.sort] ? [SORT_TO_COL[v.sort]] : [];
  const stripStages = STAGE_GROUPS.map((g) => ({ key: g.key as StripKey, label: t(`v22.stage.${g.key}`), count: counts[g.key] }));

  // V25 (REPORT §314 A1): the morning answer — who needs us today, as work, before the process strip. Each item is a
  // server view (`/agency/students/views`), the same predicate the table filters by, so the number is the row count.
  // Zero items are not shown; selecting one filters the table in place, selecting it again clears it.
  // V26 (REPORT §341, RC-26): the item labelled "대학 요청" is the `requested` view — an open university document request or
  // an application returned for documents — which is work for us today. V25 bound that label to `university`, the
  // "waiting on the university" view (applications under review), so the figure counted the wrong thing and the row
  // opened an application nobody could act on. "대학 응답 대기" stays available in the Filter select.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterN = [v.nationality, v.waiting, v.intake, v.view, v.degree].filter(Boolean).length;
  const urgentN = today && viewCounts.data && !perms.isHangyul ? (viewCounts.data.urgent ?? 0) : 0;

  return (
    <div className="ag22-work" data-mode={mode}>
      {/* V28 (UX_AUDIT AG-4): one control band. The urgent count leads the stage strip; the other work types live in the
          view select below, with their counts, instead of a second row of chips. */}
      <div className="ag22-strip">
        {/* V31 (REPORT §421): 전체 and 종료 are VIEWS beside the journey, 긴급 (above) is an ATTENTION filter — three
            dimensions that used to be drawn as one row of look-alike chips. */}
        <StageStrip<StripKey> stages={stripStages} selected={stageKey === CLOSED_KEY ? ('__none__' as StripKey) : stageKey} label={t('v22.stage.strip')} allLabel={t('v22.stage.all')} allCount={allCount}
          onSelect={(k) => { setAll(false); f.set({ stage: k, page: null, ...(k == null && view === 'urgent' ? { view: null } : {}) }); }}
          allSelected={stageKey == null && view !== 'urgent'}
          before={urgentN > 0 ? (
            <StageView tone="alert" label={t('v25.today.urgent')} count={urgentN} selected={view === 'urgent'}
              onSelect={() => f.set({ view: view === 'urgent' ? null : 'urgent', page: null })} />
          ) : undefined}
          after={<StageView label={t('v31.stage.closed')} count={counts.closed} selected={stageKey === CLOSED_KEY} title={t('v22.work.closedHint')}
            onSelect={() => { setAll(false); f.set({ stage: stageKey === CLOSED_KEY ? null : CLOSED_KEY, page: null }); }} />} />
      </div>
      {/* V25 (REPORT §314 A6): on a phone the filters wait behind one control, so the first student is above the fold. */}
      <div className={cx('ag25-tools', filtersOpen && 'is-open')}>
      <WorkToolbar search={search} onSearch={setSearch} placeholder={t('v22.work.searchPh')}
        searchAside={<button type="button" className="ag25-filtertoggle hg-btn hg-btn--sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
        <SlidersHorizontal size={14} aria-hidden />{t('common:actions.filter')}{activeFilterN ? ` · ${formatNumber(activeFilterN, locale)}` : ''}
      </button>}
        meta={today
          ? (upcomingN ? <Link to="/tasks?view=deadlines">{t('v22.work.upcoming', { count: upcomingN })}</Link> : <span>{t('v22.work.noUpcoming')}</span>)
          : (saveView ? <span className="hg-row" style={{ gap: 4 }}>
            {activeSaved?.can_edit && <DeleteSavedView id={activeSaved.id} name={activeSaved.name} onDeleted={() => f.set({ saved: null })} />}
            <Button size="sm" variant="ghost" icon={<Bookmark />} onClick={() => saveView(toFilters(v as Record<string, string>), sort)}>{t('v22.work.saveView')}</Button>
          </span> : null)}>
        {(
          <FilterSelect size="sm" label={t('v22.work.view')} value={activeSaved ? `saved:${activeSaved.id}` : view} onChange={(e) => {
            const val = e.target.value;
            if (val.startsWith('saved:')) { const sv = (saved.data ?? []).find((x) => x.id === val.slice(6)); if (sv) applySaved(sv); }
            else f.set({ view: val || null, saved: null });
          }}>
            <option value="">{t('v22.work.allViews')}</option>
            {VIEWS.filter((k) => !perms.isHangyul || k !== 'urgent').map((k) => (
              <option key={k} value={k}>{t(VIEW_LABEL[k] ?? `students.view.${k}`)}{viewCounts.data ? ` (${formatNumber(viewCounts.data[k] ?? 0, locale)})` : ''}</option>
            ))}
            {view && !(VIEWS as string[]).includes(view) && <option value={view}>{t(`students.view.${view}`, { defaultValue: t(`v9.waiting.on.${view.replace('waiting_', '')}`, { defaultValue: view }) })}</option>}
            {(['TEAM', 'PERSONAL'] as const).map((scope) => {
              const list = (saved.data ?? []).filter((x) => x.scope === scope);
              return list.length ? <optgroup key={scope} label={t(scope === 'TEAM' ? 'v22.work.teamViews' : 'v22.work.myViews')}>{list.map((x) => <option key={x.id} value={`saved:${x.id}`}>{x.name}</option>)}</optgroup> : null;
            })}
          </FilterSelect>
        )}
        <FilterSelect size="sm" label={t('v22.work.col.country')} value={v.nationality} onChange={(e) => f.set({ nationality: e.target.value })}>
          <option value="">{t('v22.work.allCountries')}</option>
          {v.nationality && !countries.data?.some((c) => c.code === v.nationality) && <option value={v.nationality}>{countryName(v.nationality, locale)}</option>}
          {(countries.data ?? []).map((c) => <option key={c.code} value={c.code}>{countryName(c.code, locale)}</option>)}
        </FilterSelect>
        <FilterSelect size="sm" label={t('v22.work.col.waiting')} value={v.waiting} onChange={(e) => f.set({ waiting: e.target.value })}>
          <option value="">{t('v22.work.anyWaiting')}</option>
          {WAITING_PARTIES.map((w) => {
            const n = waitingCounts.data?.waiting_on?.[w];
            return <option key={w} value={w}>{t(`v9.waiting.on.${w}`)}{n ? ` (${formatNumber(n, locale)})` : ''}</option>;
          })}
        </FilterSelect>
        <FilterSelect size="sm" label={t('students.col.intakeShort')} value={v.intake} onChange={(e) => f.set({ intake: e.target.value })}>
          <option value="">{t('v22.work.allIntakes')}</option>
          {intakes.map((i) => <option key={i} value={i}>{t('intakeLabel', { term: t(`term.${i.split('-')[1]}`), year: i.split('-')[0] })}</option>)}
        </FilterSelect>
        {perms.isHangyul && (
          <FilterSelect size="sm" label={t('hq.ag.agency')} value={v.agency} onChange={(e) => f.set({ agency: e.target.value })}>
            <option value="">{t('hq.allAgencies')}</option>
            {(agencies.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        )}
        {v.counselor && <Button size="sm" variant="ghost" onClick={() => f.set({ counselor: null, page: null })}>{t('v23.work.memberFilter')} ×</Button>}
        {(activeFilters > 0 || v.q) && <Button size="sm" variant="ghost" onClick={() => { setSearch(''); f.set(clearAll); }}>{t('actions.clearFilters')}{activeFilters ? ` · ${activeFilters}` : ''}</Button>}
      </WorkToolbar>
      </div>
      <div className="ag22-table" data-work-total={total} data-work-stage={stageKey ?? 'all'}>
        {rowsQ.isError ? <ErrorState error={rowsQ.error} onRetry={() => rowsQ.refetch()} /> : (
          <DataTable<AgencyStudentRow>
            dense
            selectable={!today && !!bulkActions}
            columns={columns}
            data={shown}
            loading={rowsQ.isLoading}
            getRowId={(r) => r.id}
            // V26: a row opens the record its work is about (the request, the thread, the document …), chosen by the TODAY
            // view in use and then by the row's own waiting reason (lib/focus.ts).
            onRowClick={(r) => nav(rowHref(r, view))}
            bulkActions={bulkActions}
            exportName={today ? undefined : 'students'}
            caption={today ? t('v22.nav.today') : t('v22.nav.students')}
            renderCard={(r) => (
              <div className="ag-scard">
                <div className="ag-scard__top">
                  <span className="min-w-0">
                    <span className="d-block fw-semibold text-truncate">{r.full_name}</span>
                    <span className="d-block fs-11 text-muted text-truncate"><span aria-hidden>{flagEmoji(r.nationality)} </span>{countryName(r.nationality, locale)}</span>
                  </span>
                  <StageSoft stage={r.pipeline_stage} />
                </div>
                {r.waiting_on && <WaitingOn on={r.waiting_on} reason={r.waiting_reason} />}
                {r.next_action && <div className={r.next_action.task?.overdue ? 'ag-overdue hg-small' : 'hg-small'}>{waitText.next(r.next_action)}</div>}
                <div className="hg-subtle hg-xs">{[r.top_university ? localName({ name_en: r.top_university.name, name_ko: r.top_university.name_ko }) : null, r.next_deadline ? t('students.deadlineShort', { date: formatDate(r.next_deadline.date, locale, { month: 'short', day: 'numeric' }) }) : null].filter(Boolean).join(' · ')}</div>
              </div>
            )}
            server={today
              ? { total: shown.length, pagination: { pageIndex: 0, pageSize: 100 }, onPaginationChange: () => undefined }
              : {
                total, pagination: { pageIndex, pageSize },
                onPaginationChange: (u) => { const n = typeof u === 'function' ? u({ pageIndex, pageSize }) : u; f.set({ page: n.pageIndex ? String(n.pageIndex + 1) : null, size: n.pageSize !== 50 ? String(n.pageSize) : null }, false); },
                sorting,
                onSortingChange: (u) => { const n = typeof u === 'function' ? u(sorting) : u; f.set({ sort: n[0] ? COL_TO_SORT[n[0].id] ?? null : null }); },
              }}
            empty={<EmptyState compact title={stageKey ? t('v22.work.empty') : t('v22.work.emptyFiltered')}
              action={activeFilters || v.q || stageKey ? <Button size="sm" onClick={() => { setSearch(''); f.set(clearAll); }}>{t('actions.clearFilters')}</Button> : undefined} />}
          />
        )}
        {today && total > 0 && (
          <div className="ag22-foot">
            <span className="hg-subtle hg-small">{t('v22.work.top')} · {all || ordered.length <= 10 ? t('v22.work.total', { count: total }) : t('v22.work.showing', { shown: shown.length, total: formatNumber(total, locale) })}</span>
            {ordered.length > 10 && <Button size="sm" variant="ghost" onClick={() => setAll((x) => !x)} aria-expanded={all}>{all ? t('v22.work.showTop') : t('v22.work.showAll', { count: ordered.length })}</Button>}
            {/* V23 §272 A6: Today loads the first 100 by deadline. When there are more, the rest are one click away in
                Students with the same filters, rather than hidden behind a footer total. */}
            {total > ordered.length && <Link className="hg-link hg-small" to={`/students${location.search}`}>{t('v23.work.openAll', { count: total })}</Link>}
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteSavedView({ id, name, onDeleted }: { id: string; name: string; onDeleted: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 />} aria-label={t('savedViews.delete', { name })} title={t('v22.work.deleteView')} loading={busy}
      onClick={async () => { setBusy(true); try { await api.agency.deleteSavedView(id); onDeleted(); } finally { setBusy(false); } }} />
  );
}
