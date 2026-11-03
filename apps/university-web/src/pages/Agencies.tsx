// V8 Partner agencies: "Which agencies send applications we can decide on?" One ranked table, single-hue bars (no rainbow
// series), every number opens exactly its applicants with the page filters; readiness % replaced by complete-on-first-review.
import { Building2, Info } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { Callout, EmptyState, InfoTip, QueryState, SkeletonCard } from '@hangyul/ui';
import { PageHeader, YCard } from '@hangyul/ynex-ui';
import { formatNumber } from '@hangyul/utils';
import { Link } from 'react-router';

import { FilterBar, useUrlFilters } from '../components/FilterBar';
import { GlossaryButton } from '../components/v8/Glossary';
import { RateText } from '../components/ynex';
import { applicantsLink, type ApplicantParams } from '../lib/filters';
import { MIN_N } from '../lib/metrics';
import { useAgencyDirectory, useAnalytics } from '../lib/queries';

export default function Agencies() {
  const { t, locale } = useLocale(['university', 'common']);
  const [filters, setFilters] = useUrlFilters();
  const q = useAnalytics(filters);
  const dir = useAgencyDirectory();
  const idOf = (r: { agency: string; agency_id?: string | null }) => r.agency_id ?? dir.directory.find((d) => d.name === r.agency)?.id;
  const link = (p: Partial<ApplicantParams>) => applicantsLink({ intake: filters.intake, degree: filters.degree, program_id: filters.program_id, nationality: filters.nationality, ...p });
  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('common:nav.partnerAgencies')} sub={t('university:agencies.subtitle')} actions={<GlossaryButton />} />
      <FilterBar value={filters} onChange={setFilters} keys={['intake', 'nationality', 'degree', 'program_id']} />
      <Callout tone="info" icon={<Info aria-hidden />} title={t('university:agencies.qualityTitle')}>{t('university:agencies.qualityBody')}</Callout>
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />} isEmpty={(a) => a.by_agency.length === 0}
        empty={<EmptyState icon={<Building2 />} title={t('university:agencies.empty')} text={t('university:agencies.emptyText')} />}>
        {(a) => {
          const max = Math.max(1, ...a.by_agency.map((r) => r.applications));
          return (
            <YCard title={t('university:agencies.tableTitle')} flush footer={<p className="fs-12 text-muted mb-0">{t('university:v7.an.agencyFoot', { min: MIN_N })}</p>}>
              <div className="uv8-fit">
                <table className="table mb-0 uv7-table uv8-agtable">
                  <caption className="hg-sr-only">{t('university:agencies.tableTitle')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('university:agencies.agency')}</th>
                      <th scope="col">{t('university:agencies.applications')}</th>
                      <th scope="col" className="text-end uv8-opt">{t('university:agencies.offers')}</th>
                      <th scope="col" className="text-end"><span className="d-inline-flex align-items-center gap-1">{t('university:agencies.offerRate')}<InfoTip text={t('university:v8.gl.def.offer_rate')} /></span></th>
                      <th scope="col" className="text-end uv8-opt2"><span className="d-inline-flex align-items-center gap-1">{t('university:v6.facts.firstReview')}<InfoTip text={t('university:v8.gl.def.complete_on_first_review')} /></span></th>
                      <th scope="col" className="text-end uv8-opt">{t('university:agencies.enrolled')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.by_agency.map((r) => {
                      const id = idOf(r);
                      const n = (v: number, p: Partial<ApplicantParams>) => (id && v > 0 ? <Link to={link({ agency_id: id, ...p })}>{formatNumber(v, locale)}</Link> : formatNumber(v, locale));
                      return (
                        <tr key={r.agency_id ?? r.agency}>
                          <th scope="row" className="fw-semibold">{id ? <Link to={link({ agency_id: id })}>{r.agency}</Link> : r.agency}</th>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="progress progress-xs flex-fill" aria-hidden style={{ minInlineSize: 48 }}><div className="progress-bar bg-primary" style={{ width: `${(r.applications / max) * 100}%` }} /></div>
                              <span className="uv7-num fw-semibold">{n(r.applications, {})}</span>
                            </div>
                          </td>
                          <td className="text-end uv7-num uv8-opt">{n(r.offers, { reached: 'OFFERED' })}</td>
                          <td className="text-end"><RateText r={r.offer_rate} /></td>
                          <td className="text-end uv8-opt2"><RateText r={r.complete_on_first_review ?? null} /></td>
                          <td className="text-end uv7-num uv8-opt">{n(r.enrolled, { reached: 'ENROLLED' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </YCard>
          );
        }}
      </QueryState>
    </div>
  );
}
