// PRIMARY QUESTION: "Is Hangyul a better channel than e-mail + agents?" — V9 U7: every number with numerator, denominator and
// cohort (n < 5 withheld), process quality first, then the after-admission chain, and visa outcome per agency for this
// university (MOJ plans to score universities on visa refusal). Contract terms, quotas and pools below. Phones: summary rows.
import { Handshake } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { Partnership as Contract } from '@hangyul/types';
import { EmptyState, FilterSelect, InfoTip, QueryState, Section, Skeleton, SkeletonCard, StatusText } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { countryName, daysUntil, formatDate, formatMoney, formatNumber, formatPercent } from '@hangyul/utils';
import { Link } from 'react-router';

import { NoAccess } from '../components/common';
import { Panel } from '../components/Panel';
import { Fact, useRateFact } from '../components/Preparation';
import { RateText } from '../components/ynex';
import { SummaryList } from '../components/v9/SummaryList';
import { useNarrow, usePartnershipValue, VALUE_GROUPS, type ValueMetric, type VisaRow } from '../lib/v9';
import { useState } from 'react';
import { intakeText } from '../lib/format';
import { incentiveProgress, MIN_N } from '../lib/metrics';
import { useMetrics, usePartnership, usePrograms } from '../lib/queries';
import { useUniversity } from '../lib/university';

function ContractView({ c }: { c: Contract }) {
  const { t, locale } = useLocale(['university', 'common']);
  const programs = usePrograms();
  const narrow = useNarrow();
  const money = (v: number | null | undefined) => formatMoney(v, 'KRW', locale);
  const left = daysUntil(c.end_date);
  const perf = c.performance;
  const enrolled = perf?.enrolled ?? 0;
  const inc = incentiveProgress(c.incentive_tiers.map((x) => ({ min_enrolled: x.min_enrolled, bonus_krw: x.bonus_krw ?? 0 })), enrolled);
  const seats = c.quotas.reduce((s, q) => s + q.seats, 0);
  const used = c.quotas.reduce((s, q) => s + q.used, 0);
  const poolLeft = c.pools.reduce((s, p) => s + p.remaining_krw, 0);
  const progNames = (c.target_programs ?? []).map((id) => programs.data?.find((p) => p.id === id)?.name_en).filter(Boolean);
  const committed = c.pools.reduce((s, p) => s + p.committed_krw, 0);
  const paid = c.pools.reduce((s, p) => s + p.paid_krw, 0);
  const poolTotal = c.pools.reduce((s, p) => s + p.total_krw, 0);
  const rate = useRateFact();
  const y = rate(perf?.yield, t('university:v6.partner.unitOffers'));
  const progLabel = (id: string | null) => (id ? programs.data?.find((p) => p.id === id)?.name_en ?? t('university:partnership.program') : t('university:partnership.allPrograms'));
  return (
    <section className="hg-stack" aria-labelledby={`c-${c.id}`} style={{ '--hg-gap': '28px' } as React.CSSProperties}>
      <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
        <div className="hg-row-wrap" style={{ gap: 12 }}>
          <h2 id={`c-${c.id}`} className="hg-title-md">{c.title}</h2>
          <StatusText tone={c.status === 'ACTIVE' ? 'success' : 'neutral'}>{t(`university:contractStatus.${c.status}`, { defaultValue: c.status })}</StatusText>
        </div>
      </div>

      <Section title={t('university:v6.partner.performance')} sub={perf ? t('university:v6.partner.performanceSub', { intake: c.intake_label ? intakeText(c.intake_label, t) : t('university:filters.allIntakes') }) : undefined} id={`perf-${c.id}`}>
        {!perf ? <Skeleton h={80} /> : (
          <div className="hg-stack">
            <dl className="uc-mfacts">
              <Fact label={t('university:af.stepName.SUBMITTED')} value={formatNumber(perf.submitted, locale)} context={t('university:v6.partner.applications')} />
              <Fact label={t('university:af.stepName.OFFERED')} value={formatNumber(perf.offered, locale)} context={t('university:v6.partner.offers')} />
              <Fact label={t('university:af.stepName.ENROLLED')} value={formatNumber(perf.enrolled, locale)} context={seats ? t('university:v6.partner.ofSeats', { seats: formatNumber(seats, locale) }) : t('university:v6.partner.students')} />
              <Fact label={t('university:kpi.yield')} value={y.value} context={y.context} withheld={y.withheld} />
            </dl>
            {inc.sorted.length > 0 && (
              <>
              <h3 className="uc-value__h" style={{ marginBlockEnd: 0 }}>{t('university:v6.partner.tiers')}</h3>
              <ul className="uc-list">
                {inc.sorted.map((tier) => (
                  <li key={tier.min_enrolled} className="hg-row hg-between" style={{ gap: 8 }}>
                    <span className="hg-small">{t('university:partnership.tier', { n: tier.min_enrolled })}</span>
                    <span className="hg-row" style={{ gap: 12 }}>
                      {c.financials_visible && tier.bonus_krw ? <span className="hg-num hg-small">{money(tier.bonus_krw)}</span> : null}
                      {enrolled >= tier.min_enrolled ? <StatusText tone="success">{t('university:partnership.reached')}</StatusText> : <span className="uc-sub">{t('university:partnership.toGo', { count: tier.min_enrolled - enrolled })}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              </>
            )}
          </div>
        )}
      </Section>

      <Section title={t('university:v4.partner.agreement')} id={`ag-${c.id}`}>
        <dl className="uc-kv uc-kv--wide">
          <dt>{t('university:partnership.term')}</dt>
          <dd>{formatDate(c.start_date, locale)} – {formatDate(c.end_date, locale)}{left !== null ? <span className="uc-sub"> · {left >= 0 ? t('common:time.daysLeft', { count: left }) : t('university:partnership.ended')}</span> : null}</dd>
          <dt>{t('university:partnership.targetIntake')}</dt><dd>{c.intake_label ? intakeText(c.intake_label, t) : '—'}</dd>
          <dt>{t('university:partnership.targetPrograms')}</dt><dd>{progNames.length ? progNames.join(', ') : t('university:partnership.allPrograms')}</dd>
          <dt>{t('university:partnership.targets')}</dt><dd>{c.target_countries.length ? c.target_countries.map((cc) => countryName(cc, locale)).join(', ') : '—'}</dd>
          <dt>{t('university:partnership.guarantee')}</dt><dd>{c.guarantee_enabled ? (c.guarantee_terms ?? t('university:partnership.guaranteeOn')) : t('university:partnership.guaranteeOff')}</dd>
          {c.financials_visible ? (
            <>
              <dt>{t('university:partnership.fee')}</dt><dd className="hg-num">{c.recruitment_fee_krw !== null ? `${money(c.recruitment_fee_krw)} ${t('university:partnership.perEnrolled')}` : '—'}</dd>
              {c.commission_percent !== null && <><dt>{t('university:partnership.commission')}</dt><dd className="hg-num">{c.commission_percent}%</dd></>}
              {c.guaranteed_minimum_krw !== null && <><dt>{t('university:partnership.minimum')}</dt><dd className="hg-num">{money(c.guaranteed_minimum_krw)}</dd></>}
            </>
          ) : <><dt>{t('university:partnership.financials')}</dt><dd className="hg-subtle">{t('university:partnership.financialsRestricted')}</dd></>}
        </dl>
      </Section>

      <Section title={t('university:v4.partner.quota')} sub={seats ? t('university:v4.partner.quotaSub', { used: formatNumber(used, locale), seats: formatNumber(seats, locale), left: formatNumber(Math.max(0, seats - used), locale) }) : undefined} id={`q-${c.id}`}>
        {c.quotas.length === 0 ? <p className="hg-subtle hg-small">{t('university:partnership.noQuotas')}</p> : narrow ? (
          <SummaryList label={t('university:v4.partner.quota')} items={c.quotas.map((q, i) => ({
            key: `${q.intake}-${q.program_id ?? 'all'}-${i}`, title: progLabel(q.program_id), meta: intakeText(q.intake, t),
            summary: `${formatNumber(q.used, locale)} / ${formatNumber(q.seats, locale)}`,
          }))} />
        ) : (
          <div className="uc-table-scroll" tabIndex={0}>
            <table className="hg-table hg-table--dense uc-simple-table">
              <thead><tr><th>{t('university:filters.program')}</th><th>{t('university:filters.intake')}</th><th className="hg-table__num">{t('university:v4.partner.seats')}</th><th className="hg-table__num">{t('university:v4.partner.used')}</th><th className="hg-table__num">{t('university:v4.partner.remaining')}</th></tr></thead>
              <tbody>
                {c.quotas.map((q, i) => (
                  <tr key={`${q.intake}-${q.program_id ?? 'all'}-${i}`}>
                    <td>{progLabel(q.program_id)}</td><td>{intakeText(q.intake, t)}</td>
                    <td className="hg-table__num">{formatNumber(q.seats, locale)}</td><td className="hg-table__num">{formatNumber(q.used, locale)}</td>
                    <td className="hg-table__num">{q.seats - q.used > 0 ? formatNumber(q.seats - q.used, locale) : <StatusText tone="warning">{t('university:partnership.full')}</StatusText>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={t('university:v4.partner.pools')} id={`p-${c.id}`}
        sub={c.pools.length ? t('university:v4.partner.poolsSub', { committed: money(committed), paid: money(paid), left: money(poolLeft), total: money(poolTotal) }) : undefined}
        action={<Link to="/scholarships" className="hg-link-arrow">{t('common:nav.scholarships')}</Link>}>
        {c.pools.length === 0 ? <p className="hg-subtle hg-small">{t('university:partnership.noPools')}</p> : narrow ? (
          <SummaryList label={t('university:v4.partner.pools')} items={c.pools.map((p) => ({
            key: p.id, title: p.name, meta: p.intake ? intakeText(p.intake, t) : undefined, summary: money(p.remaining_krw),
            fields: [
              { label: t('university:v4.partner.total'), value: money(p.total_krw) }, { label: t('university:scholarships.committed'), value: money(p.committed_krw) },
              { label: t('university:scholarships.paid'), value: money(p.paid_krw) }, { label: t('university:scholarships.remaining'), value: money(p.remaining_krw) },
            ],
          }))} />
        ) : (
          <div className="uc-table-scroll" tabIndex={0}>
            <table className="hg-table hg-table--dense uc-simple-table">
              <thead><tr><th>{t('university:v4.partner.pool')}</th><th className="hg-table__num">{t('university:v4.partner.total')}</th><th className="hg-table__num">{t('university:scholarships.committed')}</th><th className="hg-table__num">{t('university:scholarships.paid')}</th><th className="hg-table__num">{t('university:scholarships.remaining')}</th></tr></thead>
              <tbody>
                {c.pools.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}{p.intake ? <span className="uc-sub"> · {intakeText(p.intake, t)}</span> : null}</td>
                    <td className="hg-table__num">{money(p.total_krw)}</td><td className="hg-table__num">{money(p.committed_krw)}</td>
                    <td className="hg-table__num">{money(p.paid_krw)}</td><td className="hg-table__num hg-medium">{money(p.remaining_krw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

    </section>
  );
}

function ValueNumber({ m }: { m: ValueMetric }) {
  const { t, locale } = useLocale(['university', 'common']);
  if (m.insufficient || m.value === null) return <span className="text-muted">{t('university:af.lowN')}</span>;
  return <b>{m.kind === 'median' ? t('university:v6.facts.days', { n: formatNumber(m.value, locale) }) : formatPercent(m.value, locale, 0)}</b>;
}

/** Why the partnership is worth having, measured on this university's own records — never asserted (V9 U7). */
function ValuePanel() {
  const { t, locale } = useLocale(['university', 'common']);
  const metrics = useMetrics({});
  const [intake, setIntake] = useState<string>('');
  const q = usePartnershipValue(intake || undefined);
  const narrow = useNarrow();
  const d = q.data;
  const by = new Map((d?.metrics ?? []).map((m) => [m.key, m]));
  const ctx = (m: ValueMetric) => (m.kind === 'median'
    ? t('university:v9.pv.medianN', { n: formatNumber(m.denominator, locale) })
    : t('university:metric.ofN', { num: formatNumber(m.numerator ?? 0, locale), den: formatNumber(m.denominator, locale) }));
  const visa = d?.visa;
  const visaRows = (visa?.rows ?? []).filter((r) => r.agency_id);
  const vrate = (r: VisaRow) => <RateText r={r.refusal_rate} min={visa?.min_denominator} />;
  return (
    <Panel id="pt-value" title={t('university:v9.pv.title')} sub={d ? t('university:v9.pv.cohort', { cohort: d.population.label, n: formatNumber(d.population.size, locale) }) : undefined}
      action={<>
        <FilterSelect id="pv-intake" size="sm" label={t('university:filters.intake')} value={intake} onChange={(e) => setIntake(e.target.value)}>
          <option value="">{t('university:filters.allIntakesOption')}</option>
          {(metrics.data?.intakes ?? []).map((i) => <option key={i.key} value={i.key}>{intakeText(i.key, t)}</option>)}
        </FilterSelect>
      </>}
      foot={t('university:v9.pv.foot', { min: d?.min_denominator ?? MIN_N })}>
      {q.isLoading || !d ? <Skeleton h={160} /> : (
        <div className="hg-stack" style={{ '--hg-gap': '24px' } as React.CSSProperties}>
          <div className="uv9-value">
            {VALUE_GROUPS.map((g) => (
              <section key={g.key} aria-labelledby={`pv-${g.key}`}>
                <h3 id={`pv-${g.key}`}>{t(`university:v9.pv.group.${g.key}`)}</h3>
                {g.metrics.map((k) => by.get(k)).filter((m): m is ValueMetric => !!m).map((m) => (
                  <div key={m.key} className="uv9-vrow">
                    <span className="uv9-vrow__label">
                      <span className="d-inline-flex align-items-center gap-1">{t(`university:v9.pv.m.${m.key}`)}<InfoTip text={m.definition} /></span>
                      <small>{m.cohort}</small>
                    </span>
                    <span className="uv9-vrow__val"><ValueNumber m={m} /><span className="uv7-rate__n d-block">{ctx(m)}</span></span>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <section aria-labelledby="pv-visa">
            <h3 id="pv-visa" className="uc-value__h">{t('university:v9.pv.visaTitle')}<span className="uc-sub"> · {visa?.cohort}</span></h3>
            <p className="fs-12 text-muted">{visa?.definition && t('university:v30.def.visaOutcome', { defaultValue: visa.definition })}</p>
            {visaRows.length === 0 ? <p className="text-muted fs-13 mb-0">{t('university:v9.pv.visaNone')}</p> : narrow ? (
              <SummaryList label={t('university:v9.pv.visaTitle')} items={visaRows.map((r) => ({
                key: r.agency_id ?? 'direct', title: r.agency ?? t('university:agencies.direct'), meta: t('university:v9.pv.refusal'), summary: vrate(r),
                fields: [
                  { label: t('university:v9.pv.issued'), value: formatNumber(r.issued, locale) }, { label: t('university:v9.pv.refused'), value: formatNumber(r.refused, locale) },
                  { label: t('university:v9.pv.pending'), value: formatNumber(r.pending, locale) },
                ],
              }))} />
            ) : (
              <div className="uv8-fit">
                <table className="table mb-0 uv7-table">
                  <caption className="hg-sr-only">{t('university:v9.pv.visaTitle')}</caption>
                  <thead><tr>
                    <th scope="col">{t('university:agencies.agency')}</th>
                    <th scope="col" className="text-end">{t('university:v9.pv.issued')}</th><th scope="col" className="text-end">{t('university:v9.pv.refused')}</th>
                    <th scope="col" className="text-end">{t('university:v9.pv.pending')}</th><th scope="col" className="text-end">{t('university:v9.pv.refusal')}</th>
                  </tr></thead>
                  <tbody>
                    {visaRows.map((r) => (
                      <tr key={r.agency_id ?? 'direct'}>
                        <th scope="row" className="fw-semibold">{r.agency ?? t('university:agencies.direct')}</th>
                        <td className="text-end uv7-num">{formatNumber(r.issued, locale)}</td><td className="text-end uv7-num">{formatNumber(r.refused, locale)}</td>
                        <td className="text-end uv7-num">{formatNumber(r.pending, locale)}</td><td className="text-end">{vrate(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Panel>
  );
}

export default function Partnership() {
  const { t } = useLocale(['university', 'common']);
  const { perms } = useUniversity();
  const q = usePartnership();
  if (!perms.canViewPartnership) return <NoAccess />;
  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('common:nav.partnership')} sub={t('university:v6.partner.subtitle')} />
      <ValuePanel />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />} isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={<Handshake />} title={t('university:partnership.empty')} text={t('university:partnership.emptyText')} />}>
        {(contracts) => <div className="hg-stack" style={{ '--hg-gap': '28px' } as React.CSSProperties}>{contracts.map((c) => <ContractView key={c.id} c={c} />)}</div>}
      </QueryState>
    </div>
  );
}
