import { useAuth } from '@hangyul/auth';
import { ArrowLeft, ExternalLink, Handshake } from '@hangyul/icons';
import { Badge, Card, DataTable, EmptyState, FreshnessBadge, PageHeader, QueryState, Skeleton, Tabs, type ColumnDef } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import type { Program, UniversityDetail as UD } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useT } from '../components/bits';
import { DeadlineCell } from './Applications';
import { RequirementsList } from './Catalog';

type Tab = 'programs' | 'deadlines' | 'documents' | 'scholarships' | 'housing';

export default function UniversityDetail() {
  const { slug = '' } = useParams();
  const { api } = useAuth();
  const { t, locale } = useT();
  const [tab, setTab] = useState<Tab>('programs');
  const [openProgram, setOpenProgram] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['university', slug], queryFn: () => api.catalog.university(slug) });

  const programCols: ColumnDef<Program>[] = [
    { id: 'name', accessorKey: 'name_en', header: t('catalog.program'), meta: { primary: true, label: t('catalog.program') } },
    { id: 'degree', accessorKey: 'degree_level', header: t('students.col.degree'), meta: { label: t('students.col.degree') }, cell: ({ getValue }) => t(`degreeShort.${getValue<string>()}`) },
    { id: 'lang', accessorKey: 'instruction_language', header: t('catalog.language'), meta: { label: t('catalog.language') }, cell: ({ getValue }) => t(`instruction.${getValue<string>()}`) },
    { id: 'topik', accessorFn: (r) => r.requirements?.min_topik_level ?? '—', header: 'TOPIK', meta: { numeric: true, label: 'TOPIK' } },
    { id: 'tuition', accessorKey: 'tuition_per_semester_krw', header: t('catalog.tuition'), meta: { numeric: true, label: t('catalog.tuition') }, cell: ({ getValue }) => formatMoney(getValue<number | null>(), 'KRW', locale, { compact: true }) },
  ];
  const deadlineCols: ColumnDef<UD['deadlines'][number]>[] = [
    { id: 'program', accessorKey: 'program', header: t('catalog.program'), meta: { primary: true, label: t('catalog.program') } },
    { id: 'intake', accessorFn: (r) => `${r.year}-${r.term}`, header: t('apps.col.intake'), meta: { label: t('apps.col.intake') }, cell: ({ row }) => t('intakeLabel', { term: t(`term.${row.original.term}`), year: row.original.year }) },
    { id: 'deadline', accessorKey: 'application_deadline', header: t('apps.deadline'), meta: { label: t('apps.deadline') }, cell: ({ getValue }) => <DeadlineCell date={getValue<string>()} /> },
    { id: 'docs', accessorKey: 'document_deadline', header: t('catalog.docsDeadline'), meta: { label: t('catalog.docsDeadline') }, cell: ({ getValue }) => formatDate(getValue<string | null>(), locale) },
    { id: 'fresh', accessorFn: (r) => r.verification_status ?? '', header: t('catalog.freshness'), meta: { label: t('catalog.freshness') }, cell: ({ row }) => <FreshnessBadge data={row.original} compact /> },
  ];

  return (
    <div className="hg-stack ag-page">
      <QueryState query={q} skeleton={<Skeleton h={320} r={16} />}>
        {(u) => {
          const prog = u.programs.find((p) => p.id === openProgram);
          return (
            <>
              <PageHeader
                crumbs={<Link to="/universities?view=universities"><ArrowLeft size={13} aria-hidden className="hg-flip-rtl" style={{ display: 'inline' }} /> {t('sidebar.catalog')}</Link>}
                title={u.name_en}
                subtitle={<span className="hg-row-wrap" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
                  <span>{u.name_ko}</span><span>·</span><span>{u.city}, {t(`region.${u.region}`, { defaultValue: u.region })}</span>
                  <Badge size="sm">{t(`institution.${u.institution_type}`)}</Badge>
                  <Badge size="sm" tone={u.certification_status === 'VISA_RESTRICTED' ? 'danger' : 'neutral'}>{t(`certification.${u.certification_status}`, { defaultValue: u.certification_status })}</Badge>
                  {u.partner.active && <Badge size="sm" tone="brand" icon={<Handshake aria-hidden />}>{t('catalog.partner')}</Badge>}
                  <FreshnessBadge data={u} />
                </span>}
                actions={<>
                  {u.international_admissions_url && <a className="hg-btn hg-btn--sm" href={u.international_admissions_url} target="_blank" rel="noreferrer noopener">{t('catalog.admissionsSite')} <ExternalLink size={13} aria-hidden /></a>}
                </>}
              />
              {u.partner.active && (u.partner.benefits.length > 0 || u.partner.guarantee_available) && (
                <Card pad warm>
                  <strong className="hg-small">{t('catalog.partnerBenefits')}</strong>
                  <ul className="ag-bullets hg-small">{u.partner.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
                  {u.partner.guarantee_available && u.partner.guarantee_terms && <p className="hg-xs hg-muted">{t('catalog.guaranteeTerms')}: {u.partner.guarantee_terms}</p>}
                </Card>
              )}
              <Tabs label={u.name_en} value={tab} onChange={setTab} tabs={[
                { value: 'programs', label: t('catalog.programs'), count: u.programs.length },
                { value: 'deadlines', label: t('catalog.deadlines'), count: u.deadlines.length },
                { value: 'documents', label: t('catalog.documents'), count: u.required_documents.length },
                { value: 'scholarships', label: t('catalog.scholarships'), count: u.scholarships.length },
                { value: 'housing', label: t('catalog.housing'), count: u.dormitories.length },
              ]} />
              {tab === 'programs' && (
                <div className="ag-grid-2-1">
                  <Card><DataTable dense columns={programCols} data={u.programs} getRowId={(r) => r.id} onRowClick={(r) => setOpenProgram(r.id)} caption={t('catalog.programs')} /></Card>
                  <Card pad>
                    {prog ? <><h3 className="hg-title-sm">{prog.name_en}</h3><p className="hg-subtle hg-xs" style={{ marginBottom: 10 }}>{t(`degreeShort.${prog.degree_level}`)} · {t(`instruction.${prog.instruction_language}`)}</p><RequirementsList p={prog} /></>
                      : <p className="hg-subtle hg-small">{t('catalog.pickProgram')}</p>}
                  </Card>
                </div>
              )}
              {tab === 'deadlines' && <Card><DataTable dense columns={deadlineCols} data={u.deadlines} getRowId={(r) => r.id} caption={t('catalog.deadlines')} empty={<EmptyState compact title={t('catalog.noIntakes')} />} /></Card>}
              {tab === 'documents' && (
                <Card pad>
                  {u.required_documents.length === 0 ? <p className="hg-subtle">{t('states.empty')}</p> : (
                    <ul className="hg-list">
                      {u.required_documents.map((d, i) => (
                        <li key={i} style={{ padding: '10px 0' }}>
                          <div className="hg-row hg-between"><strong className="hg-small">{d.label}</strong>
                            <span className="hg-row" style={{ gap: 4 }}>{d.required ? <Badge size="sm" outline>{t('form.required')}</Badge> : <Badge size="sm" outline tone="neutral">{t('form.optional')}</Badge>}
                              {d.legalization_required && <Badge size="sm" tone="warning">{t('apps.legalization')}</Badge>}{d.translation_required && <Badge size="sm" tone="info">{t('apps.translation')}</Badge>}</span>
                          </div>
                          <div className="hg-subtle hg-xs">
                            {d.applies_to_nationalities?.length ? t('catalog.appliesTo', { list: d.applies_to_nationalities.join(', ') }) : t('catalog.allNationalities')}
                            {d.max_age_days ? ` · ${t('catalog.maxAge', { days: d.max_age_days })}` : ''}
                          </div>
                          {d.notes && <div className="hg-small hg-muted">{d.notes}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
              {tab === 'scholarships' && (
                <div className="ag-grid-2">
                  {u.scholarships.length === 0 && <EmptyState compact title={t('states.empty')} />}
                  {u.scholarships.map((s) => (
                    <Card pad key={s.id}>
                      <div className="hg-row hg-between"><strong className="hg-small">{s.name}</strong><Badge size="sm" tone="teal">{t(`scholarshipKind.${s.kind}`)}</Badge></div>
                      {s.coverage && <p className="hg-small">{s.coverage}</p>}
                      {s.description && <p className="hg-xs hg-muted">{s.description}</p>}
                      <div className="hg-row hg-between hg-xs" style={{ marginTop: 6 }}><span className="hg-subtle">{s.application_deadline ? t('time.due', { date: formatDate(s.application_deadline, locale) }) : s.is_automatic ? t('catalog.automatic') : ''}</span><FreshnessBadge data={s} compact /></div>
                    </Card>
                  ))}
                </div>
              )}
              {tab === 'housing' && (
                <div className="ag-grid-2">
                  {u.dormitories.length === 0 && <EmptyState compact title={t('states.empty')} />}
                  {u.dormitories.map((d) => (
                    <Card pad key={d.id}>
                      <strong className="hg-small">{d.name}</strong>
                      <p className="hg-xs hg-muted">{d.room_types.join(', ')}{d.capacity ? ` · ${t('catalog.beds', { n: d.capacity })}` : ''}</p>
                      <p className="hg-small">{d.cost_per_semester_krw_min ? `${formatMoney(d.cost_per_semester_krw_min, 'KRW', locale)}${d.cost_per_semester_krw_max && d.cost_per_semester_krw_max !== d.cost_per_semester_krw_min ? ` – ${formatMoney(d.cost_per_semester_krw_max, 'KRW', locale)}` : ''} ${t('catalog.perSemesterShort')}` : '—'}</p>
                      {d.application_note && <p className="hg-xs hg-subtle">{d.application_note}</p>}
                      <FreshnessBadge data={d} compact />
                    </Card>
                  ))}
                </div>
              )}
              <p className="hg-subtle hg-xs">{t('catalog.verifyNote')}</p>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
