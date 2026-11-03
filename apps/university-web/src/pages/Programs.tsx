// PRIMARY QUESTION: "What do students see for this program, and what happens if we change a requirement?" (V9 U6: impact in the diff).
import { useAuth } from '@hangyul/auth';
import { BookOpen, CalendarDays, Clock, ExternalLink, Eye, Pencil, Receipt, Search, Users, Wallet } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { Intake, Program, RequirementProposal } from '@hangyul/types';
import { Button, Drawer, EmptyState, FilterSelect, QueryState, Select, SkeletonCard, useToast } from '@hangyul/ui';
import { Col, DateTimeline, PageHeader, Row, SoftBadge, YCard } from '@hangyul/ynex-ui';
import { cx, daysUntil, formatDate, formatDateTime, formatMoney, formatNumber } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Provenance } from '../components/common';
import { applicantsLink } from '../lib/filters';
import { intakeKey, intakeText } from '../lib/format';
import { usePrograms, useProposals, useRuleHistory } from '../lib/queries';
import { upcomingDates } from '../lib/workflow';
import { useUniversity } from '../lib/university';
import { requirementLines } from '../lib/rules';
import { RulesForm } from './AdmissionRules';
import { ImpactNote } from '../components/v9/ImpactNote';
import type { Impact } from '../lib/v9';

function nextDeadline(p: Program): Intake | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return [...(p.intakes ?? [])].filter((i) => i.is_open && i.application_deadline >= today).sort((a, b) => a.application_deadline.localeCompare(b.application_deadline))[0];
}

function ruleValue(t: ReturnType<typeof useLocale>['t'], key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return t('university:rules.none');
  if (typeof v === 'boolean') return v ? t('university:common.yes') : t('university:common.no');
  if (key === 'min_gpa_percent') return `${v}%`;
  if (key === 'min_topik_level') return t('university:rules.topikLevel', { level: v });
  if (key === 'min_prior_education') return t(`university:eduLevel.${v}`, { defaultValue: String(v) });
  return String(v);
}

function PendingChange({ c }: { c: RequirementProposal }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { perms } = useUniversity();
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: (d: 'publish' | 'discard') => api.university.decideProposal(c.id, d),
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: ['university', 'proposals'] });
      qc.invalidateQueries({ queryKey: ['university', 'programs'] });
      toast.success(d === 'publish' ? t('university:rules.published') : t('university:rules.discarded'));
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="uc-proposal">
      <div className="hg-row hg-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <SoftBadge tone="warning">{t('university:rules.pending')}</SoftBadge>
        <span className="uc-sub">{t('university:rules.proposedBy', { name: c.proposed_by ?? '—', date: formatDateTime(c.proposed_at, locale) })}</span>
      </div>
      <table className="table mb-0 uv7-table uc-diff">
        <caption className="hg-sr-only">{t('university:rules.changes')}</caption>
        <thead><tr><th>{t('university:rules.rule')}</th><th>{t('university:rules.now')}</th><th>{t('university:rules.proposedValue')}</th></tr></thead>
        <tbody>
          {Object.entries(c.changes).map(([k, v]) => (
            <tr key={k}><th scope="row">{t(k === 'min_prior_education' ? 'university:v9.rules.priorEducation' : `university:rules.field.${k}`, { defaultValue: k })}</th><td>{ruleValue(t, k, c.previous[k])}</td><td className="hg-medium">{ruleValue(t, k, v)}</td></tr>
          ))}
        </tbody>
      </table>
      <ImpactNote impact={(c as RequirementProposal & { impact?: Impact }).impact} />
      {c.note && <p className="hg-small">“{c.note}”</p>}
      {perms.canPublishRules && (
        <div className="hg-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" loading={m.isPending && m.variables === 'discard'} onClick={() => m.mutate('discard')}>{t('university:rules.discard')}</Button>
          <Button size="sm" variant="primary" loading={m.isPending && m.variables === 'publish'} onClick={() => m.mutate('publish')}>{t('university:rules.publish')}</Button>
        </div>
      )}
    </div>
  );
}

function StudentPreview({ p, onClose }: { p: Program; onClose: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['university', 'student-preview', p.id], queryFn: () => api.university.studentPreview(p.id), staleTime: 60_000 });
  const money = (v: number | null | undefined) => formatMoney(v ?? null, 'KRW', locale);
  const d = q.data;
  const next = d ? nextDeadline(d) : undefined;
  const range = d?.first_year_range_krw;
  return (
    <Drawer open onClose={onClose} title={t('university:v4.preview.title')} width={520}>
      {q.isLoading || !d ? <SkeletonCard lines={6} /> : (
        <div className="hg-stack uc-preview-student">
          <p className="uc-note">{t('university:v4.preview.intro')}</p>
          <header>
            <h3 className="hg-title-sm">{d.name_en}</h3>
            <p className="uc-sub">{[t(`common:degree.${d.degree_level}`), t(`common:instruction.${d.instruction_language}`)].join(' · ')}</p>
          </header>
          <dl className="uc-kv">
            <dt>{t('university:v4.preview.cost')}</dt>
            <dd>{range && range.low !== null && range.high !== null ? t('university:v4.preview.costRange', { low: money(range.low), high: money(range.high) }) : t('university:v4.preview.costUnknown')}
              {range?.tuition_year ? <span className="uc-sub" style={{ display: 'block' }}>{t('university:v4.preview.costBasis', { tuition: money(range.tuition_year) })}</span> : null}</dd>
            <dt>{t('university:programs.nextDeadline')}</dt>
            <dd>{next ? `${formatDate(next.application_deadline, locale)} · ${intakeText(intakeKey(next), t)}` : t('university:programs.noOpenIntake')}</dd>
          </dl>
          <section>
            <h4 className="uc-h3">{t('university:v4.preview.requirements')}</h4>
            <ul className="uc-bullets">{requirementLines(d.requirements, t).map((l) => <li key={l}>{l}</li>)}</ul>
            {d.requirements?.notes && <p className="uc-sub">{d.requirements.notes}</p>}
          </section>
          <section>
            <h4 className="uc-h3">{t('university:v4.preview.documents')}</h4>
            <ul className="uc-bullets">
              {(d.required_documents ?? []).map((x) => ({ ...x, translation_required: !!(x as { translation_required?: boolean }).translation_required })).map((x) => (
                <li key={x.label}>{x.label}{!x.required ? ` (${t('university:detail.optionalDoc').toLowerCase()})` : ''}
                  {x.legalization_required || x.translation_required ? <span className="uc-sub"> · {[x.legalization_required ? t('university:detail.legalization') : null, x.translation_required ? t('university:detail.translation') : null].filter(Boolean).join(' · ')}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Drawer>
  );
}

/** The first intake the current rules apply to: the earliest intake whose application window closes after they took effect. */
export function effectiveIntake(intakes: Intake[], effectiveFrom: string | null | undefined): Intake | undefined {
  const sorted = [...intakes].sort((a, b) => a.application_deadline.localeCompare(b.application_deadline));
  if (!effectiveFrom) return sorted.find((i) => i.is_open) ?? sorted[sorted.length - 1];
  return sorted.find((i) => i.application_deadline >= effectiveFrom.slice(0, 10));
}

/** V8: who changed this program's admission rules, when, and what — proposals (with reviewer) and direct publications. */
function RuleHistoryCard({ p }: { p: Program }) {
  const { t, locale } = useLocale(['university', 'common']);
  const q = useRuleHistory(p.id);
  const [all, setAll] = useState(false);
  const entries = q.data?.entries ?? [];
  const shown = all ? entries : entries.slice(0, 4);
  return (
    <YCard id="rule-history" title={t('university:v8.pr.history')} count={entries.length || undefined}
      footer={entries.length > 4 ? <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setAll(!all)}>{all ? t('common:actions.showLess') : t('university:v8.pr.historyAll', { count: entries.length })}</button> : undefined}>
      {q.isLoading ? <SkeletonCard lines={3} /> : entries.length === 0 ? <p className="text-muted fs-13 mb-0">{t('university:v8.pr.historyEmpty')}</p> : (
        <ol className="list-unstyled mb-0 uv8-rhist">
          {shown.map((e, i) => (
            <li key={i}>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <SoftBadge tone={e.status === 'PUBLISHED' ? 'success' : e.status === 'PENDING' ? 'warning' : 'light'}>{t(`university:v8.pr.status.${e.status}`, { defaultValue: e.status })}</SoftBadge>
                <span className="fs-12 text-muted">{e.at ? formatDateTime(e.at, locale) : '—'}</span>
              </div>
              <p className="fs-13 mb-1">
                {e.kind === 'proposal'
                  ? t('university:v8.pr.proposalLine', { by: e.proposed_by ?? '—', reviewer: e.reviewed_by ?? t('university:v8.pr.notReviewed') })
                  : t('university:v8.pr.directLine', { by: e.proposed_by ?? '—' })}
              </p>
              {Object.keys(e.changes).length > 0 && (
                <ul className="uv8-rhist__changes">
                  {Object.entries(e.changes).map(([k, v]) => (
                    <li key={k}><span className="text-muted">{t(k === 'min_prior_education' ? 'university:v9.rules.priorEducation' : `university:rules.field.${k}`, { defaultValue: k })}:</span> {e.previous && k in e.previous ? <>{ruleValue(t, k, e.previous[k])} → </> : null}<b>{ruleValue(t, k, v)}</b></li>
                  ))}
                </ul>
              )}
              {e.note && <p className="fs-12 text-muted mb-0">“{e.note}”</p>}
            </li>
          ))}
        </ol>
      )}
    </YCard>
  );
}

function ProgramDetail({ p, pending }: { p: Program; pending: RequirementProposal[] }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { perms } = useUniversity();
  const [sp, setSp] = useSearchParams();
  const editing = sp.get('edit') === '1';
  const setEditing = (v: boolean) => { const n = new URLSearchParams(sp); if (v) n.set('edit', '1'); else n.delete('edit'); setSp(n, { replace: true }); };
  const intakes = [...(p.intakes ?? [])].sort((a, b) => b.application_deadline.localeCompare(a.application_deadline));
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState(false);
  const visible = showAll ? intakes : intakes.filter((i) => i.is_open).concat(intakes.filter((i) => !i.is_open).slice(0, 1));
  const next = nextDeadline(p);
  const r = p.requirements;
  const { overview } = useUniversity();
  const pub = publicProgramUrl(overview?.slug, p.id);
  const history = useRuleHistory(p.id);
  const RULE_KEYS = ['min_prior_education', 'min_gpa_percent', 'min_topik_level', 'min_ielts', 'min_toefl_ibt', 'language_alternative', 'requires_interview'] as const;
  return (
    <>
      <div className="card custom-card uv7-proghead">
        <div className="card-body">
          <div className="d-sm-flex align-items-start gap-3">
            <span className="avatar avatar-lg avatar-rounded bg-primary-transparent uv7-proghead__icon" aria-hidden><BookOpen /></span>
            <div className="flex-fill min-w-0">
              <h2 className="fs-18 fw-semibold mb-1">{p.name_en}</h2>
              <p className="fs-13 text-muted mb-2">
                {[p.name_ko, t(`common:degree.${p.degree_level}`), t(`common:instruction.${p.instruction_language}`), t(`common:field.${p.field}`, { defaultValue: p.field })].filter(Boolean).join(' · ')}
              </p>
              <div className="d-flex flex-wrap align-items-center gap-2">
                {next ? <SoftBadge tone="success">{t('university:programs.open')}</SoftBadge> : <SoftBadge tone="light">{t('university:programs.noOpenIntake')}</SoftBadge>}
                {pending.length > 0 && <SoftBadge tone="warning">{t('university:rules.pendingShort')}</SoftBadge>}
                <Provenance data={p} compact />
              </div>
            </div>
            <div className="uv7-proghead__actions">
              <Link to={applicantsLink({ program_id: p.id })} className="btn btn-sm btn-light uv7-btn"><Users aria-hidden />{t('university:v7.pr.applicants', { count: p.applications ?? 0, n: formatNumber(p.applications ?? 0, locale) })}</Link>
              <button type="button" className="btn btn-sm btn-primary-light uv7-btn" onClick={() => setPreview(true)}><Eye aria-hidden />{t('university:v4.preview.cta')}</button>
            </div>
          </div>
          <dl className="uv7-progfacts">
            <div><dt><Wallet aria-hidden />{t('university:v4.programs.tuitionSemester')}</dt><dd>{p.tuition_per_semester_krw ? formatMoney(p.tuition_per_semester_krw, 'KRW', locale) : '—'}
              {p.tuition_per_semester_krw ? <span className="d-block fs-11 text-muted fw-normal">{t('university:v4.programs.tuitionYear', { amount: formatMoney(p.tuition_per_semester_krw * 2, 'KRW', locale) })}</span> : null}</dd></div>
            <div><dt><Receipt aria-hidden />{t('university:programs.fee')}</dt><dd>{formatMoney(p.application_fee_krw, 'KRW', locale)}</dd></div>
            <div><dt><Clock aria-hidden />{t('university:programs.duration')}</dt><dd>{p.duration_semesters ? t('university:programs.semesters', { count: p.duration_semesters }) : '—'}</dd></div>
            <div><dt><CalendarDays aria-hidden />{t('university:programs.nextDeadline')}</dt><dd>{next ? formatDate(next.application_deadline, locale) : '—'}
              <span className="d-block fs-11 text-muted fw-normal">{next ? `${intakeText(intakeKey(next), t)} · ${t('common:time.daysLeft', { count: Math.max(0, daysUntil(next.application_deadline) ?? 0) })}` : t('university:programs.noOpenIntake')}</span></dd></div>
          </dl>
        </div>
      </div>
      {preview && <StudentPreview p={p} onClose={() => setPreview(false)} />}

      <YCard id="rules" className="uv7-rules" title={t('university:rules.title')}
        tools={perms.canEditRules && !editing ? <button type="button" className="btn btn-sm btn-primary uv7-btn" onClick={() => setEditing(true)}><Pencil aria-hidden />{perms.canPublishRules ? t('university:rules.edit') : t('university:rules.propose')}</button> : undefined}>
        <p className="fs-12 text-muted mb-1">{r?.verified_at ? t('university:rules.lastUpdated', { date: formatDateTime(r.verified_at, locale) }) : t('university:rules.sub')}</p>
        {(() => {
          const eff = effectiveIntake(p.intakes ?? [], history.data?.effective_from);
          return r ? <p className="fs-13 mb-3 uv8-effective">{eff ? t('university:v8.pr.effective', { intake: intakeText(intakeKey(eff), t), date: formatDate(eff.application_deadline, locale) }) : t('university:v8.pr.effectiveNone')}</p> : null;
        })()}
        {pending.map((c) => <PendingChange key={c.id} c={c} />)}
        {editing && perms.canEditRules ? <RulesForm key={p.id} program={p} onDone={() => setEditing(false)} /> : !r ? (
          <div className="uv7-empty"><span className="avatar avatar-md avatar-rounded bg-light text-muted" aria-hidden><Pencil /></span><span>{t('university:v7.pr.noRules')}</span></div>
        ) : (
          <Row>
            <Col lg={7}>
              <dl className="uv7-settings">
                {RULE_KEYS.map((k) => (
                  <div key={k}><dt>{t(k === 'min_prior_education' ? 'university:v9.rules.priorEducation' : `university:rules.field.${k}`)}</dt><dd>{ruleValue(t, k, r?.[k as keyof typeof r])}</dd></div>
                ))}
                <div><dt>{t('university:rules.field.notes')}</dt><dd className="fw-normal">{r?.notes || '—'}</dd></div>
              </dl>
            </Col>
            <Col lg={5}>
              <div className="uv7-studentsee">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="fw-semibold fs-13">{t('university:v4.rules.studentsSee')}</span>
                  {pub && <a href={pub} target="_blank" rel="noopener noreferrer" className="fs-12 uv7-cardlink">{t('university:v7.pr.publicPage')}<ExternalLink aria-hidden /><span className="hg-sr-only"> {t('university:v7.pr.newTab')}</span></a>}
                </div>
                <ul className="uv7-bullets">{requirementLines(r, t).map((l) => <li key={l}>{l}</li>)}</ul>
                <button type="button" className="btn btn-sm btn-light uv7-btn w-100 mt-2" onClick={() => setPreview(true)}><Eye aria-hidden />{t('university:v4.preview.cta')}</button>
              </div>
            </Col>
          </Row>
        )}
      </YCard>

      <RuleHistoryCard p={p} />

      <YCard id="intakes" title={t('university:programs.intakesTitle')} count={intakes.length || undefined} flush
        footer={intakes.length > visible.length || showAll ? <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setShowAll(!showAll)}>{showAll ? t('common:actions.showLess') : t('university:programs.allIntakes', { count: intakes.length })}</button> : undefined}>
        <p className="fs-12 text-muted px-3 pt-3 mb-2">{t('university:programs.intakesSub')}</p>
        {intakes.length === 0 ? <p className="text-muted fs-13 px-3 pb-3 mb-0">{t('university:programs.noIntakes')}</p> : (
          <div className="uv8-fit">
            <table className="table mb-0 uv7-table uc-intakes">
              <caption className="hg-sr-only">{t('university:programs.intakesOf', { program: p.name_en })}</caption>
              <thead><tr>
                <th scope="col">{t('university:filters.intake')}</th><th scope="col" className="uv8-opt">{t('university:programs.opens')}</th><th scope="col">{t('university:applicants.col.deadline')}</th>
                <th scope="col" className="uv8-opt">{t('university:programs.docDeadline')}</th><th scope="col" className="uv8-opt2">{t('university:programs.starts')}</th><th scope="col" className="text-end uv8-opt2">{t('university:programs.seats')}</th><th scope="col">{t('university:programs.state')}</th>
              </tr></thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <td className="fw-semibold">{intakeText(intakeKey(i), t)}{i.round > 1 ? ` · ${t('university:programs.round', { n: i.round })}` : ''}</td>
                    <td className="uv8-opt">{formatDate(i.application_opens, locale)}</td>
                    <td>{formatDate(i.application_deadline, locale)}</td>
                    <td className="uv8-opt">{formatDate(i.document_deadline, locale)}</td>
                    <td className="uv8-opt2">{formatDate(i.semester_start, locale)}</td>
                    <td className="text-end uv7-num uv8-opt2">{i.seats_international !== null ? formatNumber(i.seats_international, locale) : '—'}</td>
                    <td>{i.is_open ? <SoftBadge tone="success">{t('university:programs.open')}</SoftBadge> : <SoftBadge tone="light">{t('university:programs.closed')}</SoftBadge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </YCard>
    </>
  );
}

/** Public program page on the Hangyul site (marketing app). Only when its address is known — never a guessed URL. */
function publicProgramUrl(slug: string | undefined, programId: string): string | null {
  const base = (import.meta.env.VITE_MARKETING_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3100' : undefined);
  if (!base || !slug) return null;
  return `${base.replace(/\/$/, '')}/universities/${encodeURIComponent(slug)}?program=${encodeURIComponent(programId)}`;
}


/**
 * V15 — the next intake dates across every programme (REPORT §120).
 *
 * It was a card on the Overview. It belongs here: these dates are **defined and edited on this page**, so a
 * director who reads "application deadline, 20 Oct" is one row away from the programme that owns it rather
 * than one navigation away. The Overview keeps the single nearest date in its header, as a sentence.
 *
 * Grouped, so a deadline shared by ten programmes is one row and not ten — the same rule `upcomingDates`
 * has always applied, and the reason this is a short list instead of a wall.
 */
function UpcomingDates() {
  const { t, locale } = useLocale(['university', 'common']);
  const q = usePrograms();
  const items = upcomingDates(q.data ?? []);
  return (
    <YCard title={t('university:ov.dates.title')} className="uv15-dates">
      {q.isLoading ? <SkeletonCard lines={3} /> : (
        <DateTimeline
          empty={<p className="text-muted mb-0">{t('university:ov.dates.empty')}</p>}
          items={items.map((d) => {
            const left = Math.max(0, Math.ceil((new Date(d.date).getTime() - Date.now()) / 86_400_000));
            const what = d.programs === 1 && d.names[0] ? d.names[0] : t('university:ov.dates.programs', { count: d.programs });
            return {
              key: d.key,
              day: formatDate(d.date, locale, { day: '2-digit' }),
              weekday: formatDate(d.date, locale, { month: 'short' }),
              title: <>{t(`university:ov.dates.kind.${d.kind}`)} · {intakeText(d.intake, t)}</>,
              meta: what,
              badge: { text: t('common:time.daysLeft', { count: left }), tone: left <= 7 ? 'danger' : left <= 21 ? 'warning' : 'primary' },
              // One programme selects it in the list beside this card; several have no single owner to open.
              to: d.ids.length === 1 ? `/programs?program=${d.ids[0]}` : undefined,
              urgent: left <= 7,
            };
          })}
        />
      )}
    </YCard>
  );
}

export default function Programs() {
  const { t, locale } = useLocale(['university', 'common']);
  const q = usePrograms();
  const proposals = useProposals('PENDING');
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState('');
  const [degree, setDegree] = useState('');
  // V8: programs the university no longer offers (incl. development fixtures) sort last and are never opened by default.
  const filtered = useMemo(() => (q.data ?? []).filter((p) => (!degree || p.degree_level === degree) && (!search || `${p.name_en} ${p.name_ko ?? ''}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false)), [q.data, search, degree]);
  const degrees = [...new Set((q.data ?? []).map((p) => p.degree_level))];
  const pendingBy = (id: string) => (proposals.data ?? []).filter((c) => c.program.id === id);
  const select = (id: string) => { const n = new URLSearchParams(sp); n.set('program', id); n.delete('edit'); setSp(n, { replace: true }); };
  return (
    <div className="uv7 uv7-programs">
      <PageHeader title={t('university:nav.programsRules')} sub={t('university:programs.subtitleV3')} />
      <UpcomingDates />
      {(proposals.data?.length ?? 0) > 0 && (
        <div className="alert alert-warning uv7-alert" role="status">{t('university:rules.pendingCount', { count: proposals.data?.length ?? 0 })}</div>
      )}
      <QueryState query={q} skeleton={<SkeletonCard lines={5} />} isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={<BookOpen />} title={t('university:programs.empty')} text={t('university:programs.emptyText')} />}>
        {(all) => {
          const selected = all.find((p) => p.id === sp.get('program')) ?? filtered.find((p) => p.is_active !== false) ?? all.find((p) => p.is_active !== false) ?? filtered[0] ?? all[0];
          return (
            <div className="uv7-master">
              <YCard className="uv7-master__list" title={t('university:v7.pr.listTitle')} count={formatNumber(filtered.length, locale)} flush>
                <nav aria-label={t('university:rules.programList')}>
                  <div className="uv7-master__filters">
                    <div className="hg-input-icon"><Search aria-hidden /><input type="search" className="hg-input hg-input--sm" placeholder={t('university:programs.search')} aria-label={t('common:actions.search')} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <FilterSelect size="sm" label={t('university:filters.degree')} value={degree} onChange={(e) => setDegree(e.target.value)}>
                      <option value="">{t('university:filters.allDegrees')}</option>
                      {degrees.map((d) => <option key={d} value={d}>{t(`common:degreeShort.${d}`)}</option>)}
                    </FilterSelect>
                    <label className="hg-label uc-only-compact mb-0" htmlFor="prog-pick">{t('university:filters.program')}</label>
                    <Select id="prog-pick" className="uc-only-compact" style={{ width: '100%' }} value={selected.id} onChange={(e) => select(e.target.value)}>
                      {filtered.map((p) => <option key={p.id} value={p.id}>{p.name_en}{p.is_active === false ? ` (${t('university:v8.pr.inactive')})` : ''}</option>)}
                    </Select>
                  </div>
                  <ul className="list-unstyled mb-0 uc-only-wide uv7-master__items">
                    {filtered.map((p) => {
                      const next = nextDeadline(p);
                      const on = p.id === selected.id;
                      return (
                        <li key={p.id}>
                          <button type="button" className={cx('uv7-master__item', on && 'is-active')} aria-current={on ? 'true' : undefined} onClick={() => select(p.id)}>
                            <span className="fw-semibold text-truncate d-block">{p.name_en}</span>
                            <span className="d-flex flex-wrap align-items-center gap-1 fs-11 text-muted">
                              <span>{t(`common:degreeShort.${p.degree_level}`)}</span>·
                              <span>{next ? t('university:programs.closes', { date: formatDate(next.application_deadline, locale, { month: 'short', day: 'numeric' }) }) : t('university:programs.noOpenIntake')}</span>
                              {(p.applications ?? 0) > 0 && <>·<span>{t('university:v7.pr.applicants', { count: p.applications ?? 0, n: formatNumber(p.applications ?? 0, locale) })}</span></>}
                              {pendingBy(p.id).length > 0 && <SoftBadge tone="warning">{t('university:rules.pendingShort')}</SoftBadge>}
                              {p.is_active === false && <SoftBadge tone="light">{t('university:v8.pr.inactive')}</SoftBadge>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </YCard>
              <section className="uv7-master__detail" aria-live="polite" aria-label={selected?.name_en}>
                {selected ? <ProgramDetail key={selected.id} p={selected} pending={pendingBy(selected.id)} /> : <EmptyState compact title={t('common:states.noResults')} />}
              </section>
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
