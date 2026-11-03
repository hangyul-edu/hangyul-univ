import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import type { ApiClient } from '@hangyul/api-client';
import { DEGREE_LEVELS, type MatchReason, type MatchTier, type Program } from '@hangyul/types';
import { Badge, Checkbox, DataTable, DescriptionList, Drawer, EmptyState, ErrorState, FreshnessBadge, Input, PageHeader, QueryState, FilterSelect, Select, StatusText, Tabs, UniMark, type ColumnDef } from '@hangyul/ui';
import { eligibilityGroup, formatDate, formatMoney, tierTone } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { FilterBar, SearchBox, useT } from '../components/bits';
import { useDebounced, useUrlFilters } from '../lib/hooks';
import { DeadlineCell } from './Applications';

export function RequirementsList({ p }: { p: Program }) {
  const { t, locale } = useT();
  const r = p.requirements;
  if (!r) return <p className="hg-subtle hg-small">{t('catalog.noReq')}</p>;
  return (
    <>
      <DescriptionList items={[
        { label: t('catalog.minEducation'), value: r.min_prior_education },
        { label: t('catalog.minGpa'), value: r.min_gpa_percent !== null ? `${r.min_gpa_percent}%` : null },
        { label: 'TOPIK', value: r.min_topik_level !== null ? t('catalog.level', { n: r.min_topik_level }) : null },
        { label: 'IELTS', value: r.min_ielts },
        { label: 'TOEFL iBT', value: r.min_toefl_ibt },
        { label: t('catalog.langAlt'), value: r.language_alternative ? t('misc.yes') : t('misc.no') },
        { label: t('catalog.interview'), value: r.requires_interview ? t('misc.yes') : t('misc.no') },
        { label: t('catalog.portfolio'), value: r.requires_portfolio ? t('misc.yes') : t('misc.no') },
        { label: t('catalog.tuition'), value: p.tuition_per_semester_krw ? t('catalog.perSemester', { amount: formatMoney(p.tuition_per_semester_krw, 'KRW', locale) }) : null },
        { label: t('catalog.appFee'), value: p.application_fee_krw ? formatMoney(p.application_fee_krw, 'KRW', locale) : null },
      ]} />
      {r.notes && <p className="hg-small hg-muted" style={{ marginTop: 8 }}>{r.notes}</p>}
      <div style={{ marginTop: 8 }}><FreshnessBadge data={r} /></div>
    </>
  );
}

function ProgramDetail({ id, match, studentName, studentId }: { id: string; match?: StudentMatch; studentName?: string; studentId?: string }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['program', id], queryFn: () => api.catalog.program(id) });
  return (
    <QueryState query={q}>
      {(p) => (
        <div className="hg-stack">
          <div>
            <div className="hg-row-wrap" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
              <Badge size="sm" tone="brand">{t(`degreeShort.${p.degree_level}`)}</Badge>
              <Badge size="sm" tone="neutral">{t(`instruction.${p.instruction_language}`)}</Badge>
              <FreshnessBadge data={p} />
            </div>
            <h3 className="hg-title-sm" style={{ marginTop: 8 }}>{p.name_en}</h3>
            {p.university && <Link to={`/universities/${p.university.slug}`} className="hg-small">{localName(p.university)}</Link>}
            {p.description && <p className="hg-small hg-muted" style={{ marginTop: 6 }}>{p.description}</p>}
          </div>
          {match && (
            <section className="ag-subsection">
              <h3 className="ag-h3">{t('catalog3.forStudent', { name: studentName })}</h3>
              <FitLabel m={match} />
              <ul className="ag-reasons">
                {match.reasons.map((r, i) => <li key={i} data-kind={r.kind}>{r.text}</li>)}
              </ul>
              {studentId && <Link to={`/students/${studentId}`} className="hg-link-arrow">{t('catalog3.openWorkspace')}</Link>}
            </section>
          )}
          <section className="ag-subsection"><h3 className="ag-h3">{t('catalog.requirements')}</h3><RequirementsList p={p} /></section>
          <section className="ag-subsection">
            <h3 className="ag-h3">{t('catalog.intakes')}</h3>
            {(p.intakes ?? []).length === 0 ? <p className="hg-subtle hg-small">{t('catalog.noIntakes')}</p> : (
              <ul className="hg-list">
                {p.intakes!.map((i) => (
                  <li key={i.id} style={{ padding: '8px 0' }}>
                    <div className="hg-row hg-between hg-small"><strong>{t('intakeLabel', { term: t(`term.${i.term}`), year: i.year })}{i.round > 1 ? ` · R${i.round}` : ''}</strong>{i.is_open ? <Badge size="sm" tone="success">{t('catalog.open')}</Badge> : <Badge size="sm">{t('catalog.closed')}</Badge>}</div>
                    <div className="hg-subtle hg-xs">{t('catalog.window', { from: formatDate(i.application_opens, locale), to: formatDate(i.application_deadline, locale) })}{i.document_deadline ? ` · ${t('catalog.docsBy', { date: formatDate(i.document_deadline, locale) })}` : ''}</div>
                    <div className="hg-subtle hg-xs">{t('catalog.decision')}: {formatDate(i.decision_date, locale)} · {t('apps.semester')}: {formatDate(i.semester_start, locale)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {(p.required_documents ?? []).length > 0 && (
            <section className="ag-subsection">
              <h3 className="ag-h3">{t('catalog.documents')}</h3>
              <ul className="hg-list">
                {p.required_documents!.map((d, i) => (
                  <li key={i} className="hg-row hg-between" style={{ padding: '6px 0' }}>
                    <span className="hg-small">{d.label}</span>
                    <span className="hg-row" style={{ gap: 4 }}>{d.required && <Badge size="sm" outline>{t('form.required')}</Badge>}{d.legalization_required && <Badge size="sm" tone="warning">{t('apps.legalization')}</Badge>}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="hg-subtle hg-xs">{t('catalog.verifyNote')}</p>
        </div>
      )}
    </QueryState>
  );
}

type StudentMatch = { program_id: string; tier: MatchTier; eligible: boolean; score: number; reasons: MatchReason[] };
const TIER_RANK: Record<string, number> = { STRONG: 0, COMPETITIVE: 1, REACH: 2, NOT_ELIGIBLE: 3 };
/** Same verdicts the student sees (docs/STATE_MAP.md): Strong / Possible (meets requirements, needs attention) / Not eligible yet. */
const verdictTone = (tier: MatchTier) => tierTone[tier];

/** V8 (STATE_MAP "Eligibility vocabulary"): unknown grades/education are never shown as a verdict — same rule as the student app. */
function FitLabel({ m }: { m: StudentMatch }) {
  const { t } = useT();
  if (eligibilityGroup(m) === 'check') return <StatusText tone="info" hollow>{t('catalog3.verdict.CHECK')}</StatusText>;
  return <StatusText tone={verdictTone(m.tier)}>{t(`catalog3.verdict.${m.tier}`)}</StatusText>;
}

function Programs() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const f = useUrlFilters(['q', 'degree', 'teach', 'topik', 'tuition', 'before', 'open', 'partner', 'sort', 'student', 'meets'] as const);
  const [search, setSearch] = useState(f.values.q);
  const dq = useDebounced(search, 300);
  useEffect(() => { if (dq !== f.values.q) f.set({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [f.values.q, f.values.degree, f.values.teach, f.values.topik, f.values.tuition, f.values.before, f.values.open, f.values.partner, f.values.sort, f.values.meets]);

  const students = useQuery({ queryKey: ['agency', 'students', { page_size: 200, picker: true }], queryFn: () => api.agency.students({ page_size: 200, sort: 'name' }), staleTime: 5 * 60_000 });
  const student = (students.data?.items ?? []).find((s) => s.id === f.values.student);
  const matches = useQuery({ queryKey: ['agency', 'student-matches', f.values.student], queryFn: () => api.agency.studentMatches(f.values.student), enabled: !!f.values.student });
  const byProgram = useMemo(() => new Map((matches.data?.items ?? []).map((m) => [m.program_id, m])), [matches.data]);
  const onlyMeets = !!student && f.values.meets === '1';

  const query = {
    q: f.values.q || undefined, degree: f.values.degree || undefined, language: f.values.teach || undefined,
    max_topik: f.values.topik || undefined, max_tuition: f.values.tuition || undefined, deadline_before: f.values.before || undefined,
    open_only: f.values.open === '1', partner_only: f.values.partner === '1',
    // "fit" is a local ordering by the student's verdict; the server keeps its relevance order underneath.
    sort: !f.values.sort || f.values.sort === 'fit' ? 'relevance' : f.values.sort,
    // With a student selected, fetch the whole result set (the catalogue is small) so verdict filters and "best fit"
    // ordering apply across all programs, not just one page.
    page: student ? 1 : pagination.pageIndex + 1, page_size: student ? 200 : pagination.pageSize,
  };
  const q = useQuery({ queryKey: ['programs', query], queryFn: () => api.catalog.programs(query), placeholderData: keepPreviousData });
  let rows = q.data?.items ?? [];
  if (onlyMeets) rows = rows.filter((p) => { const m = byProgram.get(p.id); return m && ['eligible', 'reach'].includes(eligibilityGroup(m)); });
  if (student && f.values.sort === 'fit') rows = [...rows].sort((a, b) => (TIER_RANK[byProgram.get(a.id)?.tier ?? 'NOT_ELIGIBLE'] - TIER_RANK[byProgram.get(b.id)?.tier ?? 'NOT_ELIGIBLE']));

  const columns = useMemo<ColumnDef<Program>[]>(() => {
    const cols: ColumnDef<Program>[] = [
      { id: 'name', accessorKey: 'name_en', header: t('catalog.program'), size: 280, meta: { primary: true, label: t('catalog.program') },
        cell: ({ row }) => <span className="ag-cell-2"><span className="hg-medium hg-truncate">{row.original.name_en}</span><span className="hg-subtle hg-xs hg-truncate">{row.original.university?.name_en}{row.original.university ? ` · ${row.original.university.city}` : ''}</span></span> },
      { id: 'degree', accessorKey: 'degree_level', header: t('students.col.degree'), size: 96, meta: { label: t('students.col.degree') }, cell: ({ getValue }) => t(`degreeShort.${getValue<string>()}`) },
      { id: 'lang', accessorFn: (r) => r.requirements?.min_topik_level ?? '', header: t('catalog3.languageReq'), size: 130, meta: { label: t('catalog3.languageReq') },
        cell: ({ row }) => { const r = row.original.requirements; const parts = [r?.min_topik_level ? `TOPIK ${r.min_topik_level}+` : null, r?.min_ielts ? `IELTS ${r.min_ielts}+` : null].filter(Boolean); return parts.length ? parts.join(' / ') : <span className="hg-subtle">{t('catalog3.noMinimum')}</span>; } },
      { id: 'tuition', accessorKey: 'tuition_per_semester_krw', header: t('catalog3.tuitionSemester'), size: 110, meta: { numeric: true, label: t('catalog3.tuitionSemester') }, cell: ({ getValue }) => formatMoney(getValue<number | null>(), 'KRW', locale, { compact: true }) },
      { id: 'deadline', accessorFn: (r) => r.next_intake?.application_deadline ?? '', header: t('catalog.nextDeadline'), size: 130, meta: { label: t('catalog.nextDeadline') },
        cell: ({ row }) => (row.original.next_intake ? <DeadlineCell date={row.original.next_intake.application_deadline} /> : <span className="hg-subtle">{t('catalog3.noOpenIntake')}</span>) },
      { id: 'partner', accessorFn: (r) => (r.university?.is_partner ? 1 : 0), header: t('catalog3.partner'), size: 90, meta: { label: t('catalog3.partner'), hideOnMobile: true },
        cell: ({ row }) => (row.original.university?.is_partner ? <StatusText tone="brand">{t('catalog.partner')}</StatusText> : <span className="hg-subtle">—</span>) },
    ];
    if (student) {
      cols.splice(1, 0, { id: 'fit', accessorFn: (r) => byProgram.get(r.id)?.tier ?? '', header: t('catalog3.fitFor', { name: student.full_name.split(' ').slice(-1)[0] }), size: 150, enableSorting: false, meta: { label: t('catalog3.fit') },
        cell: ({ row }) => { const m = byProgram.get(row.original.id); return m ? <FitLabel m={m} /> : <span className="hg-subtle">—</span>; } });
    }
    return cols;
  }, [t, locale, student, byProgram]);

  const active = [f.values.degree, f.values.teach, f.values.topik, f.values.tuition, f.values.before, f.values.open, f.values.partner].filter(Boolean).length;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '16px' } as React.CSSProperties}>
      <div className="ag-forstudent">
        <label className="hg-label" htmlFor="for-student">{t('catalog3.forStudentLabel')}</label>
        <div className="ag-forstudent__row">
          <Select id="for-student" value={f.values.student} onChange={(e) => f.set({ student: e.target.value || null, meets: null, sort: e.target.value ? 'fit' : null })} style={{ maxWidth: 360 }}>
            <option value="">{t('catalog3.noStudent')}</option>
            {(students.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.target_degree ? ` · ${t(`degreeShort.${s.target_degree}`)}` : ''}</option>)}
          </Select>
          {student && (
            <>
              <Checkbox label={t('catalog3.onlyMeets')} checked={f.values.meets === '1'} onChange={(e) => f.set({ meets: e.target.checked ? '1' : null })} />
              <Link to={`/students/${student.id}`} className="hg-link-arrow">{t('catalog3.openWorkspace')}</Link>
            </>
          )}
        </div>
        <p className="hg-hint">{student ? t('catalog3.forStudentHint', { name: student.full_name }) : t('catalog3.noStudentHint')}</p>
      </div>
      <div className="hg-panel">
        <div className="ag-card-toolbar">
          <FilterBar active={active} onClear={() => { setSearch(''); f.set({ q: null, degree: null, teach: null, topik: null, tuition: null, before: null, open: null, partner: null }); }}
            search={<SearchBox value={search} onChange={setSearch} placeholder={t('catalog.searchPh')} label={t('actions.search')} />}>
            <FilterSelect size="sm" label={t('students.col.degree')} value={f.values.degree} onChange={(e) => f.set({ degree: e.target.value })}>
              <option value="">{t('students.f.allDegrees')}</option>
              {DEGREE_LEVELS.map((d) => <option key={d} value={d}>{t(`degreeShort.${d}`)}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('catalog3.topikMax')} value={f.values.topik} onChange={(e) => f.set({ topik: e.target.value })}>
              <option value="">{t('catalog3.anyTopik')}</option>
              <option value="0">{t('catalog3.noTopik')}</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{t('catalog3.topikUpTo', { n })}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('catalog3.tuitionMax')} value={f.values.tuition} onChange={(e) => f.set({ tuition: e.target.value })}>
              <option value="">{t('catalog3.anyTuition')}</option>
              {[3_000_000, 4_500_000, 6_000_000, 8_000_000].map((v) => <option key={v} value={v}>{t('catalog3.tuitionUpTo', { amount: formatMoney(v, 'KRW', locale, { compact: true }) })}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('catalog.language')} value={f.values.teach} onChange={(e) => f.set({ teach: e.target.value })}>
              <option value="">{t('catalog.anyLanguage')}</option>
              {['KOREAN', 'ENGLISH', 'BILINGUAL'].map((l) => <option key={l} value={l}>{t(`instruction.${l}`)}</option>)}
            </FilterSelect>
            <label className="ag-inline-field"><span className="hg-small hg-subtle">{t('catalog3.closesBefore')}</span>
              <Input compact type="date" value={f.values.before} onChange={(e) => f.set({ before: e.target.value })} aria-label={t('catalog3.closesBefore')} style={{ width: 150 }} />
            </label>
            <Checkbox label={t('catalog.openOnly')} checked={f.values.open === '1'} onChange={(e) => f.set({ open: e.target.checked ? '1' : null })} />
            <Checkbox label={t('catalog.partnersOnly')} checked={f.values.partner === '1'} onChange={(e) => f.set({ partner: e.target.checked ? '1' : null })} />
            <FilterSelect size="sm" label={t('apps.sort')} value={f.values.sort || 'relevance'} onChange={(e) => f.set({ sort: e.target.value === 'relevance' ? null : e.target.value })}>
              {student && <option value="fit">{t('catalog3.sortFit')}</option>}
              {['relevance', 'deadline', 'tuition', 'name'].map((s) => <option key={s} value={s}>{t(`catalog.sort.${s}`)}</option>)}
            </FilterSelect>
          </FilterBar>
        </div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable columns={columns} data={rows} loading={q.isLoading} getRowId={(r) => r.id} onRowClick={(r) => setOpen(r.id)} caption={t('catalog.programs')}
            server={student ? undefined : { total: q.data?.total ?? 0, pagination, onPaginationChange: setPagination }}
            empty={<EmptyState compact title={onlyMeets ? t('catalog3.noneMet') : t('catalog3.noResults')} text={onlyMeets ? t('catalog3.noneMetText') : t('catalog3.noResultsText')} />} />
        )}
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={t('catalog.programDetail')} width={560}>
        {open && <ProgramDetail id={open} match={byProgram.get(open)} studentName={student?.full_name} studentId={student?.id} />}
      </Drawer>
    </div>
  );
}

type Uni = Awaited<ReturnType<ApiClient['catalog']['universities']>>['items'][number];

function Universities() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [partner, setPartner] = useState(false);
  const dq = useDebounced(search, 300);
  const q = useQuery({ queryKey: ['universities', { q: dq, partner }], queryFn: () => api.catalog.universities({ q: dq || undefined, partner_only: partner, page_size: 100 }), placeholderData: keepPreviousData });
  const columns = useMemo<ColumnDef<Uni>[]>(() => [
    { id: 'name', accessorKey: 'name_en', header: t('catalog.universities'), size: 280, meta: { primary: true, label: t('catalog.universities') },
      cell: ({ row }) => <span className="hg-row" style={{ gap: 10 }}><UniMark name={row.original.name_en} color={row.original.brand_color} size="sm" /><span className="ag-cell-2"><span className="hg-medium hg-truncate">{row.original.name_en}</span><span className="hg-subtle hg-xs">{row.original.name_ko}</span></span></span> },
    { id: 'city', accessorKey: 'city', header: t('catalog3.city'), size: 120, meta: { label: t('catalog3.city') } },
    { id: 'type', accessorKey: 'institution_type', header: t('catalog3.type'), size: 110, meta: { label: t('catalog3.type'), hideOnMobile: true }, cell: ({ getValue }) => t(`institution.${getValue<string>()}`) },
    { id: 'programs', accessorFn: (r) => r.program_count ?? 0, header: t('catalog.programs'), size: 90, meta: { numeric: true, label: t('catalog.programs') } },
    { id: 'living', accessorKey: 'est_living_cost_monthly_krw', header: t('catalog3.living'), size: 130, meta: { numeric: true, label: t('catalog3.living'), hideOnMobile: true }, cell: ({ getValue }) => formatMoney(getValue<number | null>(), 'KRW', locale, { compact: true }) },
    { id: 'partner', accessorFn: (r) => (r.is_partner ? 1 : 0), header: t('catalog3.partner'), size: 90, meta: { label: t('catalog3.partner') },
      cell: ({ row }) => (row.original.is_partner ? <StatusText tone="brand">{t('catalog.partner')}</StatusText> : <span className="hg-subtle">—</span>) },
    { id: 'fresh', accessorFn: (r) => r.verification_status ?? '', header: t('catalog.freshness'), size: 120, meta: { label: t('catalog.freshness'), hideOnMobile: true }, cell: ({ row }) => <FreshnessBadge data={row.original} compact /> },
  ], [t, locale]);
  return (
    <div className="hg-panel">
      <div className="ag-card-toolbar">
        <FilterBar active={partner ? 1 : 0} onClear={() => { setSearch(''); setPartner(false); }}
          search={<SearchBox value={search} onChange={setSearch} placeholder={t('catalog.uniSearchPh')} label={t('actions.search')} />}>
          <Checkbox label={t('catalog.partnersOnly')} checked={partner} onChange={(e) => setPartner(e.target.checked)} />
        </FilterBar>
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <DataTable columns={columns} data={q.data?.items ?? []} loading={q.isLoading} getRowId={(r) => r.id} onRowClick={(r) => nav(`/universities/${r.slug}`)} caption={t('catalog.universities')}
          empty={<EmptyState compact title={t('catalog3.noResults')} text={t('catalog3.noResultsText')} />} />
      )}
    </div>
  );
}

export default function Catalog() {
  const { t } = useT();
  const f = useUrlFilters(['view'] as const);
  const view = (f.values.view || 'programs') as 'programs' | 'universities';
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('sidebar.catalog')} subtitle={t('catalog3.sub')} />
      <Tabs label={t('sidebar.catalog')} value={view} onChange={(v) => f.set({ view: v === 'programs' ? null : v })}
        tabs={[{ value: 'programs', label: t('catalog.programs') }, { value: 'universities', label: t('catalog.universities') }]} />
      {view === 'programs' ? <Programs /> : <Universities />}
      <p className="hg-subtle hg-xs">{t('catalog.readOnly')}</p>
    </div>
  );
}
