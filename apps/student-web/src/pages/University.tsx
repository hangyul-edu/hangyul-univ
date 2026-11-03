import { useApi } from '@hangyul/auth';
import { docLabel, localName } from '@hangyul/i18n';
import {
  ArrowRight, BadgeCheck, Building2, ExternalLink, FileCheck2, Globe, Handshake, MapPin, ShieldAlert, ShieldCheck,
} from '@hangyul/icons';
import type { Match, MatchReason, Program, ScholarshipKind, UniversityContent, UniversityDetail } from '@hangyul/types';
import {
  Badge, Button, ButtonLink, Callout, Card, CardBody, CardHeader, DescriptionList, EmptyState, FreshnessBadge, ListRow, QueryState, Section, Select, Skeleton, StatusText, Tabs,
  PhotoCredit, UniversityHero, UniversityOfficialLinks, UniversityPhilosophy, UniversityPhoto, UniversityVideo,
} from '@hangyul/ui';
import { countryName, formatDate, formatMoney, formatNumber, galleryFor } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { DaysLeft, Krw, PartnerBadge, TierLabel, sortReasons } from '../components/bits';
import { CompareToggle, SaveButton } from '../components/ProgramCard';
import { ScholarshipCard } from '../components/ScholarshipCard';
import { StartApplicationModal } from '../components/StartApplication';
import { intakeLabel, reasonText, tr, useT } from '../lib/i18n';
import { useMyApplications, useMyMatches } from '../lib/queries';
import { FirstYearAmount, useFirstYearText } from '../lib/cost';
import { gapOf } from '../components/ProgramRow';
import { basisLabelKey, range, useBudget } from '../lib/budget';
import { MoneyTimeline, PlanCoverage } from '../components/MoneyPlan';
import type { ProgramPlan } from '../lib/money';

const TABS = ['overview', 'admissions', 'costs', 'life', 'sources'] as const;
type Tab = (typeof TABS)[number];
/** Old deep links (?tab=programs, ?tab=documents, …) map onto the five sections. */
const LEGACY: Record<string, Tab> = { programs: 'overview', documents: 'admissions', deadlines: 'admissions', scholarships: 'costs', housing: 'life', campus: 'life', support: 'life', partner: 'sources' };

function Overview({ u }: { u: UniversityDetail }) {
  const { t, locale } = useT();
  return (
    <div className="st-uni-grid">
      <Card pad>
        <h2 className="hg-title-sm" style={{ marginBottom: 8 }}>{t('university.overview.about')}</h2>
        {u.summary ? (
          // Catalogue text exists in English only (translated catalogue fields need university-provided copy): quoted as published.
          <>
            {!locale.startsWith('en') && <p className="hg-caption hg-muted">{t('v9.catalogue.englishOnly')}</p>}
            <p className="hg-muted" lang="en" data-source-quote>{u.summary}</p>
          </>
        ) : <p className="hg-muted">{t('university.overview.noSummary')}</p>}
        <div style={{ marginTop: 16 }}>
          <DescriptionList items={[
            { label: t('university.overview.type'), value: t(`common:institution.${u.institution_type}`) },
            { label: t('university.overview.location'), value: u.city === u.region ? u.city : `${u.city}, ${t(`common:region.${u.region}`, { defaultValue: u.region })}` },
            { label: t('university.overview.founded'), value: u.founded_year ?? '—' },
            { label: t('university.overview.programs'), value: formatNumber(u.programs.length, locale) },
            { label: t('university.overview.living'), value: <><Krw value={u.est_living_cost_monthly_krw} />{u.est_living_cost_monthly_krw ? t('units.perMonth') : ''}</> },
            { label: t('university.overview.certification'), value: <CertBadge u={u} /> },
          ]} />
        </div>
      </Card>
      <div className="hg-stack">
        <Card pad>
          <h2 className="hg-title-sm" style={{ marginBottom: 8 }}>{t('university.overview.links')}</h2>
          <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
            {u.website_url && <a href={u.website_url} target="_blank" rel="noreferrer" className="st-extlink"><Globe aria-hidden />{t('university.overview.website')}<ExternalLink aria-hidden /></a>}
            {u.international_admissions_url && <a href={u.international_admissions_url} target="_blank" rel="noreferrer" className="st-extlink"><FileCheck2 aria-hidden />{t('university.overview.admissions')}<ExternalLink aria-hidden /></a>}
          </div>
          <div style={{ marginTop: 12 }}><FreshnessBadge data={u} /></div>
        </Card>
      </div>
    </div>
  );
}

function CertBadge({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  const s = u.certification_status || 'UNKNOWN';
  const tone = s === 'UNKNOWN' ? 'neutral' : s === 'VISA_RESTRICTED' ? 'danger' : 'success';
  return <Badge tone={tone} size="sm" icon={s === 'UNKNOWN' ? <ShieldAlert /> : <ShieldCheck />}>{t(`common:certification.${s}`, { defaultValue: s })}</Badge>;
}


function Admissions({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  return (
    <div className="hg-stack">
      <Callout tone="neutral">{t('university.admissions.intro')}</Callout>
      {u.programs.map((p) => {
        const r = p.requirements;
        return (
          <Card key={p.id}>
            <CardHeader title={localName(p)} subtitle={t(`common:degree.${p.degree_level}`)} actions={r ? <FreshnessBadge data={r} compact /> : undefined} />
            <CardBody>
              {!r ? <p className="hg-muted hg-small">{t('university.programs.noReq')}</p> : (
                <>
                  <DescriptionList items={[
                    { label: t('university.admissions.education'), value: r.min_prior_education ? t(`onboarding.education.levels.${r.min_prior_education}`, { defaultValue: r.min_prior_education }) : t('university.admissions.notPublished') },
                    { label: t('university.admissions.gpa'), value: r.min_gpa_percent ? `${r.min_gpa_percent}%` : t('university.admissions.notPublished') },
                    { label: t('university.admissions.topik'), value: r.min_topik_level ? t('university.admissions.level', { level: r.min_topik_level }) : t('university.admissions.notRequired') },
                    { label: t('university.admissions.english'), value: [r.min_ielts ? `IELTS ${r.min_ielts}` : null, r.min_toefl_ibt ? `TOEFL iBT ${r.min_toefl_ibt}` : null].filter(Boolean).join(' / ') || t('university.admissions.notRequired') },
                    { label: t('university.admissions.alternative'), value: r.language_alternative ? t('university.admissions.yes') : t('university.admissions.no') },
                    { label: t('university.admissions.interviewLabel'), value: r.requires_interview ? t('university.admissions.yes') : t('university.admissions.no') },
                    { label: t('university.admissions.portfolio'), value: r.requires_portfolio ? t('university.admissions.yes') : t('university.admissions.no') },
                  ]} />
                  {r.notes && <p className="hg-muted hg-small" style={{ marginTop: 12 }}>{r.notes}</p>}
                </>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function Documents({ u }: { u: UniversityDetail }) {
  const { t, locale } = useT();
  if (!u.required_documents.length) return <EmptyState title={t('university.documents.empty')} />;
  return (
    <Card>
      <CardHeader title={t('university.documents.title')} subtitle={t('university.documents.subtitle')} />
      <ul className="hg-list st-doc-req">
        {u.required_documents.map((d, i) => (
          <li key={`${d.category}-${i}`}>
            <div className="hg-grow">
              <div className="hg-strong">{docLabel(t, d)}</div>
              <div className="hg-row-wrap" style={{ '--hg-gap': '6px', marginTop: 6 } as React.CSSProperties}>
                <Badge size="sm" tone={d.required ? 'brand' : 'neutral'}>{d.required ? t('university.documents.required') : t('university.documents.optional')}</Badge>
                {d.legalization_required && <Badge size="sm" tone="warning">{t('university.documents.apostille')}</Badge>}
                {d.translation_required && <Badge size="sm" tone="info">{t('university.documents.translation')}</Badge>}
                {d.max_age_days ? <Badge size="sm" tone="neutral" outline>{t('university.documents.maxAge', { days: d.max_age_days })}</Badge> : null}
              </div>
              <div className="hg-subtle hg-xs" style={{ marginTop: 6 }}>
                {d.applies_to_nationalities?.length ? t('university.documents.appliesTo', { list: d.applies_to_nationalities.map((c) => countryName(c, locale)).join(', ') }) : t('university.documents.allNationalities')}
              </div>
              {d.notes && <div className="hg-muted hg-small" style={{ marginTop: 4 }}>{d.notes}</div>}
            </div>
            <FreshnessBadge data={d} compact />
          </li>
        ))}
      </ul>
      <CardBody><Callout tone="info">{t('university.documents.legalHelp')}</Callout></CardBody>
    </Card>
  );
}

function Scholarships({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  if (!u.scholarships.length) return <EmptyState title={t('university.scholarships.empty')} />;
  const kinds: ScholarshipKind[] = ['UNIVERSITY', 'GOVERNMENT', 'HANGYUL_PARTNER', 'OTHER'];
  return (
    <div className="hg-stack" style={{ '--hg-gap': '24px' } as React.CSSProperties}>
      {kinds.map((k) => {
        const list = u.scholarships.filter((s) => s.kind === k);
        if (!list.length) return null;
        return (
          <section key={k}>
            <h2 className="hg-title-sm" style={{ marginBottom: 10 }}>{t(`common:scholarshipKind.${k}`)}</h2>
            <div className="st-cards st-cards--2">{list.map((s) => <ScholarshipCard key={s.id} s={s} showChecks={false} />)}</div>
          </section>
        );
      })}
      <p className="hg-subtle hg-xs"><Link to="/scholarships">{t('university.scholarships.mine')}</Link></p>
    </div>
  );
}

function Costs({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  const living = u.est_living_cost_monthly_krw;
  return (
    <div className="hg-stack">
      <Card>
        <CardHeader title={t('university.costs.tuition')} subtitle={t('university.costs.tuitionSub')} />
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>{t('university.costs.program')}</th><th className="st-num">{t('explore.card.tuition')}</th><th className="st-num">{t('university.costs.fee')}</th><th className="st-num">{t('v4.cost.firstYear')}</th></tr></thead>
            <tbody>
              {u.programs.map((p) => (
                <tr key={p.id}>
                  <td><span className="hg-strong">{localName(p)}</span><div className="hg-subtle hg-xs">{t(`common:degreeShort.${p.degree_level}`)}</div></td>
                  <td className="st-num"><Krw value={p.tuition_per_semester_krw} /></td>
                  <td className="st-num"><Krw value={p.application_fee_krw} /></td>
                  <td className="st-num"><FirstYearAmount value={p.first_year_range_krw} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card pad>
        <div className="hg-row hg-between"><span className="hg-strong">{t('university.costs.living')}</span><strong><Krw value={living} />{living ? t('units.perMonth') : ''}</strong></div>
        <p className="hg-muted hg-small" style={{ marginTop: 8 }}>{t('university.costs.note')}</p>
        <div style={{ marginTop: 8 }}><FreshnessBadge data={u} /></div>
      </Card>
      <Callout tone="info" title={t('university.costs.payTitle')}>{t('university.costs.payText')}</Callout>
    </div>
  );
}

function Housing({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  if (!u.dormitories.length) return <EmptyState icon={<Building2 />} title={t('university.housing.empty')} text={t('university.housing.emptyText')} />;
  return (
    <div className="st-cards st-cards--2">
      {u.dormitories.map((d) => (
        <Card key={d.id} pad>
          <div className="hg-row hg-between"><h3 className="hg-title-sm">{d.name}</h3>{d.international_priority && <Badge size="sm" tone="success">{t('university.housing.priority')}</Badge>}</div>
          <DescriptionList items={[
            { label: t('university.housing.rooms'), value: d.room_types.join(', ') || '—' },
            { label: t('university.housing.cost'), value: d.cost_per_semester_krw_min ? <><Krw value={d.cost_per_semester_krw_min} /> – <Krw value={d.cost_per_semester_krw_max} /></> : '—' },
            { label: t('university.housing.capacity'), value: d.capacity ?? '—' },
            { label: t('university.housing.meals'), value: d.meal_plan === null ? '—' : d.meal_plan ? t('university.admissions.yes') : t('university.admissions.no') },
          ]} />
          {d.application_note && <p className="hg-muted hg-small" style={{ marginTop: 10 }}>{d.application_note}</p>}
          <div style={{ marginTop: 10 }}><FreshnessBadge data={d} /></div>
        </Card>
      ))}
    </div>
  );
}

function Campus({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  const campuses = u.campuses.length ? u.campuses : [{ id: 'main', name: t('university.campus.main'), city: u.city, address: null, is_main: true }];
  return (
    <div className="st-cards st-cards--2">
      {campuses.map((c) => {
        const q = encodeURIComponent(`${u.name_en} ${c.name} ${c.address ?? c.city}`);
        return (
          <Card key={c.id} pad>
            <div className="hg-row" style={{ gap: 8 }}><MapPin size={18} aria-hidden /><h3 className="hg-title-sm">{c.name}</h3>{c.is_main && <Badge size="sm">{t('university.campus.mainBadge')}</Badge>}</div>
            <p className="hg-muted" style={{ marginTop: 8 }}>{c.address ?? `${c.city}, ${t('university.campus.korea')}`}</p>
            {u.location.latitude !== null && c.is_main && <p className="hg-subtle hg-xs hg-num">{u.location.latitude?.toFixed(4)}, {u.location.longitude?.toFixed(4)}</p>}
            <div className="hg-row-wrap" style={{ marginTop: 12 }}>
              <a className="hg-btn hg-btn--sm" href={`https://map.naver.com/p/search/${q}`} target="_blank" rel="noreferrer">{t('university.campus.naver')}<ExternalLink aria-hidden /></a>
              <a className="hg-btn hg-btn--sm hg-btn--ghost" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer">{t('university.campus.google')}<ExternalLink aria-hidden /></a>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Support({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  if (!u.international_services.length) return <EmptyState title={t('university.support.empty')} />;
  return (
    <Card pad>
      <h2 className="hg-title-sm" style={{ marginBottom: 10 }}>{t('university.support.title')}</h2>
      <ul className="st-ticks">{u.international_services.map((s) => <li key={s}><BadgeCheck aria-hidden />{s}</li>)}</ul>
      <p className="hg-subtle hg-xs" style={{ marginTop: 12 }}>{t('university.support.note')}</p>
    </Card>
  );
}

function Deadlines({ u }: { u: UniversityDetail }) {
  const { t, locale } = useT();
  if (!u.deadlines.length) return <EmptyState title={t('university.deadlines.empty')} />;
  return (
    <Card>
      <div className="st-table-wrap">
        <table className="st-table">
          <thead><tr><th>{t('university.costs.program')}</th><th>{t('university.deadlines.intake')}</th><th>{t('university.deadlines.apply')}</th><th>{t('university.deadlines.docs')}</th><th>{t('university.deadlines.decision')}</th><th /></tr></thead>
          <tbody>
            {u.deadlines.map((d) => (
              <tr key={d.id}>
                <td><span className="hg-strong">{d.program}</span><div className="hg-subtle hg-xs">{t(`common:degreeShort.${d.degree_level}`)}</div></td>
                <td>{intakeLabel(t, d.term, d.year)}{d.round > 1 ? ` · ${t('university.deadlines.round', { n: d.round })}` : ''}</td>
                <td className="hg-num">{formatDate(d.application_deadline, locale)}</td>
                <td className="hg-num">{formatDate(d.document_deadline, locale)}</td>
                <td className="hg-num">{formatDate(d.decision_date, locale)}</td>
                <td><DaysLeft date={d.application_deadline} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardBody><FreshnessBadge data={u.deadlines[0]} /></CardBody>
    </Card>
  );
}

function Partner({ u }: { u: UniversityDetail }) {
  const { t } = useT();
  return (
    <div className="hg-stack">
      <Card pad warm>
        <div className="hg-row-wrap" style={{ marginBottom: 10 }}><Handshake size={20} aria-hidden /><h2 className="hg-title-sm">{t('university.partner.title')}</h2><PartnerBadge /></div>
        <p className="hg-muted hg-small">{t('university.partner.text')}</p>
        <ul className="st-ticks" style={{ marginTop: 12 }}>
          {u.partner.benefits.map((b) => <li key={b}><BadgeCheck aria-hidden />{tr(t, `university.partner.benefit.${b}`, b)}</li>)}
        </ul>
      </Card>
      {u.partner.guarantee_available && u.partner.guarantee_terms && (
        <Callout tone="success" title={t('university.partner.guaranteeTitle')}>
          <span style={{ display: 'block' }}>{u.partner.guarantee_terms}</span>
          <span style={{ display: 'block', marginTop: 6 }} className="hg-xs">{t('university.partner.guaranteeNote')}</span>
        </Callout>
      )}
    </div>
  );
}

function Sources({ u }: { u: UniversityDetail }) {
  const { t, locale } = useT();
  return (
    <div className="hg-stack">
      <Card pad>
        <h2 className="hg-title-sm">{t('university.outcomes.title')}</h2>
        {u.outcomes ? <p className="hg-muted" style={{ marginTop: 6 }}>{t('university.outcomes.available')}</p> : (
          <p className="hg-muted" style={{ marginTop: 6 }}>{t('university.outcomes.none')}</p>
        )}
      </Card>
      <Card pad>
        <h2 className="hg-title-sm" style={{ marginBottom: 10 }}>{t('university.sources.title')}</h2>
        <DescriptionList items={[
          { label: t('university.sources.profile'), value: <FreshnessBadge data={u} /> },
          { label: t('university.overview.certification'), value: <CertBadge u={u} /> },
          { label: t('university.sources.certVerified'), value: u.certification_verified_at ? formatDate(u.certification_verified_at, locale) : t('university.sources.notVerified') },
          { label: t('university.sources.certSource'), value: u.certification_source_url ? <a href={u.certification_source_url} target="_blank" rel="noreferrer">{t('common:freshness.officialSource')}</a> : '—' },
        ]} />
        <p className="hg-subtle hg-xs" style={{ marginTop: 12 }}>{t('university.sources.note')}</p>
      </Card>
    </div>
  );
}

type CheckRow = { key: string; result: 'meets' | 'below' | 'unknown' | 'info'; detail: string };
/** Groups the engine's reasons into the few checks a student cares about. */
function checksFrom(t: ReturnType<typeof useT>['t'], reasons: MatchReason[]): CheckRow[] {
  const groups: Record<string, string[]> = {
    academic: ['EDUCATION_MET', 'EDUCATION_EXPECTED', 'EDUCATION_BELOW', 'EDUCATION_UNKNOWN', 'GPA_MET', 'GPA_BELOW', 'GPA_SLIGHTLY_BELOW', 'GPA_UNKNOWN', 'DEGREE_MISMATCH'],
    language: ['TOPIK_MET', 'TOPIK_EXCEEDS', 'ENGLISH_MET', 'LANGUAGE_BELOW', 'LANGUAGE_GAP_SMALL', 'LANGUAGE_NOT_PUBLISHED'],
    budget: ['WITHIN_BUDGET', 'SLIGHTLY_OVER_BUDGET', 'OVER_BUDGET'],
    deadline: ['DEADLINE_FEASIBLE', 'DEADLINE_SOON', 'DEADLINE_VERY_SOON', 'NO_OPEN_INTAKE'],
    nationality: ['NATIONALITY_RESTRICTED'],
  };
  const out: CheckRow[] = [];
  for (const [key, codes] of Object.entries(groups)) {
    const rs = reasons.filter((r) => codes.includes(r.code));
    if (!rs.length) continue;
    const worst = rs.find((r) => r.kind === 'missing') ?? rs.find((r) => r.kind === 'warning') ?? rs[0];
    const result = worst.kind === 'missing' ? 'below' : worst.code.endsWith('UNKNOWN') ? 'unknown' : worst.kind === 'info' ? 'info' : worst.kind === 'warning' && key !== 'deadline' && key !== 'budget' ? 'unknown' : worst.kind === 'warning' ? 'below' : 'meets';
    out.push({ key, result, detail: reasonText(t, worst) });
  }
  return out;
}

const RESULT_TONE = { meets: 'success', below: 'warning', unknown: 'neutral', info: 'info' } as const;

/** The student's own application for this program, if any (so the page never offers "Start application" twice). */
function useExistingApplication(programId: string | undefined) {
  const apps = useMyApplications();
  return (apps.data?.items ?? []).find((a) => a.program.id === programId && a.status !== 'WITHDRAWN' && a.status !== 'REJECTED');
}

function DecisionPanel({ program, match, onApply }: { program: Program; match?: Match; onApply: () => void }) {
  const { t, locale } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const next = (program.intakes ?? []).filter((i) => i.is_open && i.application_deadline >= today).sort((a, b) => a.application_deadline.localeCompare(b.application_deadline))[0] ?? null;
  const reasons = match ? sortReasons(match.reasons) : [];
  const gap = match && match.tier !== 'STRONG' && match.tier !== 'COMPETITIVE' ? gapOf(t, reasons) : null;
  const checks = checksFrom(t, reasons);
  const metCount = checks.filter((c) => c.result === 'meets').length;
  const existing = useExistingApplication(program.id);
  const budget = useBudget([program.id]);
  const b = budget.data?.items[0];
  const line = (k: string) => b?.lines.find((l) => l.key === k);
  const schol = b?.scholarships.find((x) => x.status === 'ELIGIBLE' && x.amount_max);
  const r = (lo?: number | null, hi?: number | null) => range(lo, hi, 'KRW', undefined, locale);
  const req = program.requirements;
  const lang = [req?.min_topik_level ? t('explore.card.topik', { level: req.min_topik_level }) : null, req?.min_ielts ? t('explore.card.ielts', { score: req.min_ielts }) : null]
    .filter(Boolean).join(' / ') || t('discover.noLanguageMin');
  return (
    <section className="su-decision" aria-labelledby="decision-title">
      <div className="su-decision__verdict">
        {match ? <TierLabel tier={match.tier} /> : <span className="hg-subtle hg-small">{t('universityV2.noVerdict')}</span>}
        <h2 id="decision-title" className="su-decision__headline">
          {existing ? t('v4.program.applied', { status: t(`stage.${existing.status}`, { defaultValue: t(`common:appStatus.${existing.status}`) }) })
            : !match ? t('universityV2.completeProfile') : gap ? gap.gap
            : match.tier === 'STRONG' || match.tier === 'COMPETITIVE' ? t('programV3.meetsAll', { count: metCount }) : t(`universityV2.verdictLine.${match.tier}`)}
        </h2>
        {!existing && gap?.unlock && <p className="hg-muted">{gap.unlock}</p>}
      </div>
      <dl className="v4-keyfacts">
        <div><dt>{t('v4.cost.firstYear')}</dt><dd><FirstYearAmount value={program.first_year_range_krw} /></dd></div>
        <div><dt>{t('discover.deadline')}</dt><dd>{next ? <>{formatDate(next.application_deadline, locale)} <DaysLeft date={next.application_deadline} /></> : t('explore.card.noIntake')}</dd></div>
        <div><dt>{t('discover.language')}</dt><dd>{lang} · {t(`common:instruction.${program.instruction_language}`)}</dd></div>
      </dl>
      <div className="su-decision__cta">
        {existing ? (
          <ButtonLink as={Link} to={`/applications/${existing.id}`} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('v4.program.continue')}</ButtonLink>
        ) : (
          <Button variant="primary" size="lg" disabled={!next} onClick={onApply} iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('university.cta')}</Button>
        )}
        <CompareToggle programId={program.id} label={localName(program)} university={program.university?.name_en ?? ''} />
      </div>
      <div className="su-cols">
        <div className="su-col">
          <h3 className="su-col__title">{t('programV3.why')}</h3>
          {checks.length === 0 ? <p className="hg-small hg-muted">{t('universityV2.completeProfile')}</p> : (
            <dl className="su-checks">
              {checks.map((c) => (
                <div key={c.key} title={c.detail}>
                  <dt>{t(`programV3.check.${c.key}`)}</dt>
                  <dd><StatusText tone={RESULT_TONE[c.result]} hollow={c.result === 'unknown'}>{t(`programV3.result.${c.key}.${c.result}`, { defaultValue: t(`programV3.result.${c.result}`) })}</StatusText>
                    <span className="su-checks__detail">{c.detail}</span></dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="su-col">
          <h3 className="su-col__title">{t('v4.program.costTitle')}</h3>
          {budget.isLoading ? <Skeleton h={120} /> : b ? (
            <dl className="su-cost">
              <div><dt>{t('v4.cost.tuitionYear')}</dt><dd>{r(line('tuition')?.amount_min, line('tuition')?.amount_max)}</dd></div>
              {line('application_fee')?.amount_min != null && <div><dt>{t('budget.line.application_fee')}</dt><dd>{r(line('application_fee')?.amount_min, line('application_fee')?.amount_max)}</dd></div>}
              {line('dormitory') && <div><dt>{t('budget.line.dormitory')}</dt><dd>{r(line('dormitory')?.amount_min, line('dormitory')?.amount_max)}</dd></div>}
              <div><dt>{t('budget.line.living')}</dt><dd>{r(line('living')?.amount_min, line('living')?.amount_max)}</dd></div>
              <div className="su-cost__total"><dt>{t('v4.cost.firstYear')}</dt><dd>{r(b.first_year_gross_min, b.first_year_gross_max)}</dd></div>
              {schol && <div className="su-cost__schol"><dt>{t('v4.program.withScholarship')}</dt><dd>{r(b.first_year_min, b.first_year_max)}</dd></div>}
            </dl>
          ) : <p className="hg-small hg-muted">{t('budget.unknownAmount')}</p>}
          {b && (
            <p className="su-cost__note">
              {(b as typeof b & { plan?: ProgramPlan | null }).plan
                ? <span className="bd-cover"><PlanCoverage lines={(b as typeof b & { plan: ProgramPlan }).plan.lines} className="su-cover" /></span>
                : t('v4.cost.excludes')}{' '}{t('programV3.costNote', { basis: t(basisLabelKey(line('tuition')?.basis ?? 'UNKNOWN')).toLowerCase() })}{' '}
              <Link to={`/budget?programs=${program.id}`} className="hg-link">{t('programV3.fullBudget')}</Link>
            </p>
          )}
          {/* V9 S2: the same money plan as Budget — who is paid, when, refundable — one tap away on the program. */}
          {(b as (typeof b & { plan?: ProgramPlan | null }) | undefined)?.plan && (
            <details className="v9-asis">
              <summary>{t('v9.money.whenTitle')}</summary>
              <MoneyTimeline lines={(b as typeof b & { plan: ProgramPlan }).plan.lines} hideKeys={['hangyul_fee']} />
            </details>
          )}
        </div>
        <div className="su-col">
          <h3 className="su-col__title">{t('programV3.application')}</h3>
          <dl className="su-cost">
            <div><dt>{t('programV3.intake')}</dt><dd>{next ? intakeLabel(t, next.term, next.year) : t('explore.card.noIntake')}</dd></div>
            <div><dt>{t('budget.line.application_fee')}</dt><dd>{program.application_fee_krw !== null ? formatMoney(program.application_fee_krw, 'KRW', locale) : '—'}</dd></div>
            <div><dt>{t('explore.card.tuition')}</dt><dd>{program.tuition_per_semester_krw !== null ? formatMoney(program.tuition_per_semester_krw, 'KRW', locale, { compact: true }) : '—'}</dd></div>
          </dl>
          <FreshnessBadge data={program} compact />
        </div>
      </div>
    </section>
  );
}

function ProgramList({ u, selected, onSelect, matches }: { u: UniversityDetail; selected: string; onSelect: (id: string) => void; matches: Map<string, Match> }) {
  const { t, locale } = useT();
  const firstYear = useFirstYearText();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="hg-panel">
      <ul className="hg-list">
        {u.programs.map((p) => {
          const next = (p.intakes ?? []).filter((i) => i.is_open && i.application_deadline >= today).sort((a, b) => a.application_deadline.localeCompare(b.application_deadline))[0];
          const m = matches.get(p.id);
          return (
            <li key={p.id} data-selected={p.id === selected || undefined} className="su-prog">
              <ListRow as="button" type="button" onClick={() => onSelect(p.id)} aria-pressed={p.id === selected}
                title={localName(p)}
                meta={[t(`common:degreeShort.${p.degree_level}`), t(`common:instruction.${p.instruction_language}`), p.first_year_range_krw?.low ? t('v4.program.firstYearMeta', { range: firstYear(p.first_year_range_krw) }) : null, next ? t('home.closes', { date: formatDate(next.application_deadline, locale) }) : t('explore.card.noIntake')].filter(Boolean).join(' · ')}
                end={m ? <TierLabel tier={m.tier} /> : undefined}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StickyCta({ programId, onApply }: { programId: string; onApply: () => void }) {
  const { t } = useT();
  const existing = useExistingApplication(programId);
  return (
    <div className="st-sticky-cta">
      {existing ? <ButtonLink as={Link} to={`/applications/${existing.id}`} variant="primary" size="lg" block>{t('v4.program.continue')}</ButtonLink>
        : <Button variant="primary" size="lg" block onClick={onApply}>{t('university.cta')}</Button>}
    </div>
  );
}

/**
 * A university that is in the public directory but not in Hangyul's application catalogue (V12, brief Part 22).
 *
 * This is the ordinary case, not an error: the directory holds every institution on the national register and
 * Hangyul holds verified admission data for a handful of them. Before V12 the public "prepare to study here"
 * action pointed at this route for all of them, so 415 of 425 universities led to a 404.
 *
 * What it must not do is invent the missing data. So it shows what is verified — region, kind, who runs it, the
 * certifications, the university's own site — and offers the one thing that is genuinely available: asking a
 * counsellor to work on it. Nothing here implies a programme, a deadline, a fee or an eligibility verdict.
 */
function DirectoryOnlyUniversity({ slug }: { slug: string }) {
  const { t } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['directory', 'institution', slug], queryFn: () => api.directory.institution(slug), staleTime: 12 * 60 * 60_000 });
  return (
    <QueryState query={q} skeleton={<div className="st-page"><Skeleton w={320} h={32} /><Skeleton h={220} r={14} /></div>}>
      {(i) => (
        <div className="st-page su-page">
          <nav className="hg-crumbs" aria-label={t('university.crumbs')}>
            <Link to="/explore">{t('discover.title')}</Link><span aria-hidden>/</span><span>{localName(i)}</span>
          </nav>
          <PlaceHero slug={slug} name={localName(i)} altName={otherName(i)} region={i.region}>
            <p className="hg-uni-hero__where">{t(`common:region.${i.region}`, { defaultValue: i.region })} · {t(`university.kind.${i.institution_type}`, { defaultValue: i.institution_type })}</p>
          </PlaceHero>
          <PlaceGallery slug={slug} name={localName(i)} />
          <Card>
            <CardHeader title={t('university.interest.title')} subtitle={t('university.interest.lede')} />
            <CardBody>
              <DescriptionList
                items={[
                  { label: t('university.interest.region'), value: t(`common:region.${i.region}`, { defaultValue: i.region }) },
                  ...(i.ieqas?.certified ? [{ label: t('university.interest.certified'), value: t('university.interest.certifiedYes') }] : []),
                  ...(i.ieqas?.language_programme ? [{ label: t('university.interest.language'), value: t('university.interest.languageYes') }] : []),
                ]}
              />
              <div className="hg-row" style={{ gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <ButtonLink as={Link} to="/messages" variant="primary" iconEnd={<ArrowRight className="hg-flip-rtl" />}>
                  {t('university.interest.ask')}
                </ButtonLink>
                {i.website_url && (
                  <ButtonLink href={i.website_url} target="_blank" rel="noopener noreferrer" iconEnd={<ExternalLink />}>
                    {t('university.interest.site')}
                  </ButtonLink>
                )}
                <ButtonLink as={Link} to="/explore" variant="ghost">{t('university.interest.browse')}</ButtonLink>
              </div>
            </CardBody>
          </Card>
          <PublicIdentity content={i.enrichment ?? null} name={localName(i)} website={i.website_url} />
        </div>
      )}
    </QueryState>
  );
}

/**
 * **The same university, presented the same way** (V20, brief §30, §54).
 *
 * Before this the student app described an institution from the programme catalogue and the public
 * site described it from the content record, and the two could disagree — with the signed-in version
 * being the weaker of the two, which is exactly backwards. These are the *same components the public
 * page renders*, reading the *same content record*, served by the same public endpoint. What the
 * student app adds on top is its own: saving, match explanation, application status, cost and the next
 * action. What it no longer does is maintain a second, poorer description of the place.
 *
 * It renders nothing when the record has nothing verified, which for an institution with no official
 * channel and no reviewed philosophy is the normal case.
 */
function PublicIdentity({ content, name, website }: { content: UniversityContent | null; name: string; website?: string | null }) {
  if (!content) return null;
  return (
    <div className="hg-uni su-public">
      <UniversityPhilosophy content={content} name={name} />
      <UniversityVideo content={content} name={name} />
      <UniversityOfficialLinks content={content} website={website} />
    </div>
  );
}

/**
 * The public record for an institution that *is* in the catalogue, fetched alongside it.
 *
 * Two endpoints rather than one because they answer two questions — `catalog.university` is "what can I
 * apply to and what will it cost", `directory.institution` is "what is this place" — and because the
 * second is public, cacheable for twelve hours and identical to what the marketing site already has in
 * memory. A failure here removes a section; it never breaks the page a student came to use.
 */
function CataloguePublicIdentity({ slug, name }: { slug: string; name: string }) {
  const api = useApi();
  const q = useQuery({
    queryKey: ['directory', 'institution', slug],
    queryFn: () => api.directory.institution(slug),
    staleTime: 12 * 60 * 60_000,
    retry: false,
  });
  if (!q.data?.enrichment) return null;
  return <PublicIdentity content={q.data.enrichment} name={name} website={q.data.website_url} />;
}

/**
 * V25 (REPORT §310 P2, §313 S7): the student's university page opens on the **same** photographic hero and campus gallery as
 * the public page — one media system, one content record — instead of a crest beside a heading. What the student app adds
 * (save, match, apply) sits on and under it, never instead of it.
 */
function PlaceHero({ slug, name, altName, region, children }: { slug: string; name: string; altName?: string | null; region?: string | null; children?: React.ReactNode }) {
  const api = useApi();
  const q = useQuery({ queryKey: ['directory', 'institution', slug], queryFn: () => api.directory.institution(slug), staleTime: 12 * 60 * 60_000, retry: false });
  const inst = q.data;
  const content = inst?.enrichment ?? null;
  return (
    <div className="hg-uni su-place">
      <UniversityHero id={{ slug, name, altName, region: inst?.region ?? region ?? '', content }}>{children}</UniversityHero>
    </div>
  );
}

function PlaceGallery({ slug, name }: { slug: string; name: string }) {
  const api = useApi();
  const { t } = useT();
  const q = useQuery({ queryKey: ['directory', 'institution', slug], queryFn: () => api.directory.institution(slug), staleTime: 12 * 60 * 60_000, retry: false });
  const gallery = galleryFor(q.data?.enrichment ?? null).slice(0, 5);
  if (!gallery.length) return null;
  return (
    <section className="hg-uni su-gallery" aria-label={t('university.campusPhotos', { defaultValue: '' }) || undefined}>
      <ul className={`hg-uni-gal hg-uni-gal--n${gallery.length}${gallery.length === 1 ? ' hg-uni-gal--single' : ''}${gallery.length === 2 ? ' hg-uni-gal--pair' : ''}`} tabIndex={0}>
        {gallery.map((m, i) => (
          <li key={m.asset} className={i === 0 ? 'is-lead' : undefined}>
            <UniversityPhoto media={m} sizes="(min-width: 860px) 50vw, 88vw" alt={t(`marketing:${m.alt_key}`, { name, defaultValue: name })} />
            <PhotoCredit media={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** PRIMARY QUESTION (program page): "Can I apply here, what will it cost, by when?" */
/** V30: the university's name in the OTHER language, shown under the reader's own (부산대학교 / Pusan National University). */
function otherName(o: { name_en?: string | null; name_ko?: string | null }): string | null {
  const own = localName(o);
  return [o.name_en, o.name_ko].find((x) => x && x !== own) ?? null;
}

export default function University() {
  const { t } = useT();
  const api = useApi();
  const { slug = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const q = useQuery({ queryKey: ['university', slug], queryFn: () => api.catalog.university(slug), staleTime: 300_000, retry: false });
  const matches = useMyMatches();
  const byProgram = useMemo(() => new Map((matches.data?.items ?? []).map((m) => [m.program_id, m])), [matches.data]);
  const [applyFor, setApplyFor] = useState<string | null | undefined>(undefined);
  const raw = sp.get('tab') ?? 'overview';
  const tab = (TABS.includes(raw as Tab) ? raw : LEGACY[raw] ?? 'overview') as Tab;
  const setTab = (v: Tab) => { const n = new URLSearchParams(sp); n.set('tab', v); setSp(n, { replace: true }); };
  const selectProgram = (id: string) => { const n = new URLSearchParams(sp); n.set('program', id); setSp(n, { replace: true }); };

  // Not in the application catalogue → the directory view. A 404 here means "Hangyul holds no admission data
  // for this institution yet", which is a state the product has an answer for, not a failure to report.
  const notInCatalogue = q.isError && (q.error as { status?: number } | null)?.status === 404;
  if (notInCatalogue) return <DirectoryOnlyUniversity slug={slug} />;

  return (
    <QueryState query={q} skeleton={<div className="st-page"><Skeleton w={320} h={32} /><Skeleton h={220} r={14} /><Skeleton h={320} r={10} /></div>}>
      {(u) => {
        const ranked = [...u.programs].sort((a, b) => (byProgram.get(b.id)?.score ?? -1) - (byProgram.get(a.id)?.score ?? -1));
        const program = u.programs.find((p) => p.id === sp.get('program')) ?? ranked[0];
        return (
          <div className="st-page su-page">
            <nav className="hg-crumbs" aria-label={t('university.crumbs')}><Link to="/explore">{t('discover.title')}</Link><span aria-hidden>/</span><span>{u.name_en}</span></nav>
            <PlaceHero slug={slug} name={localName(u)} altName={otherName(u)} region={u.region}>
              <p className="hg-uni-hero__where">{u.city} · {t(`common:institution.${u.institution_type}`)}</p>
              <div className="su-place__save"><SaveButton universityId={u.id} name={localName(u)} size="md" /></div>
            </PlaceHero>
            {program && (
              <div className="su-top">
                <div className="su-top__picker">
                  <label className="hg-label" htmlFor="program-pick">{t('universityV2.program')}</label>
                  <Select id="program-pick" value={program.id} onChange={(e) => selectProgram(e.target.value)}>
                    {ranked.map((p) => <option key={p.id} value={p.id}>{localName(p)} · {t(`common:degreeShort.${p.degree_level}`)}</option>)}
                  </Select>
                </div>
                <DecisionPanel program={{ ...program, university: program.university ?? u }} match={byProgram.get(program.id)} onApply={() => setApplyFor(program.id)} />
              </div>
            )}
            <Tabs label={t('university.tabsLabel')} value={tab} onChange={setTab}
              tabs={TABS.map((x) => ({ value: x, label: t(`universityV2.tabs.${x}`) }))} />
            <div role="tabpanel" aria-label={t(`universityV2.tabs.${tab}`)} className="su-panel">
              {tab === 'overview' && (
                <>
                  <PlaceGallery slug={slug} name={localName(u)} />
                  <Section title={t('universityV2.programs', { count: u.programs.length })} sub={t('universityV2.programsSub')}>
                    <ProgramList u={u} selected={program?.id ?? ''} onSelect={(id) => { selectProgram(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} matches={byProgram} />
                  </Section>
                  <Overview u={u} />
                </>
              )}
              {tab === 'admissions' && <><Admissions u={u} /><Documents u={u} /><Deadlines u={u} /></>}
              {tab === 'costs' && <><Costs u={u} /><Scholarships u={u} /></>}
              {tab === 'life' && <><Housing u={u} /><Campus u={u} /><Support u={u} /><CataloguePublicIdentity slug={slug} name={u.name_en} /></>}
              {tab === 'sources' && <>{u.partner.active && <Partner u={u} />}<Sources u={u} /></>}
            </div>
            {program && <StickyCta programId={program.id} onApply={() => setApplyFor(program.id)} />}
            {applyFor !== undefined && (
              <StartApplicationModal open onClose={() => setApplyFor(undefined)} programs={u.programs} initialProgramId={applyFor} />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
