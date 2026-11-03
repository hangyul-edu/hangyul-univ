import { localName } from '@hangyul/i18n';
import { useApi } from '@hangyul/auth';
import { GraduationCap } from '@hangyul/icons';
import type { Application } from '@hangyul/types';
import { ButtonLink, EmptyState, ListRow, QueryState, Section, SkeletonCard, StatusText, UniMark } from '@hangyul/ui';
import { applicationTone, formatDate, formatMoney } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { isPreSubmit } from '../lib/format';
import { Link } from 'react-router';

import { DaysLeft, PageIntro } from '../components/bits';
import { PortfolioSection, StrategyLine, useMyStrategy } from '../components/success/Strategy';
import { intakeLabel, useT } from '../lib/i18n';
import { range } from '../lib/budget';

const CLOSED = new Set(['REJECTED', 'WITHDRAWN', 'ENROLLED']);

function AppRow({ a }: { a: Application }) {
  const { t, locale } = useT();
  const preSubmit = isPreSubmit(a.status);
  const strategy = useMyStrategy().data?.items.find((s) => s.application_id === a.id);
  return (
    <li>
      <ListRow as={Link} to={`/applications/${a.id}`} chevron
        lead={<UniMark name={localName(a.university)} color={a.university.brand_color} photo={a.university.photo} />}
        title={localName(a.university)}
        meta={`${localName(a.program)} · ${intakeLabel(t, a.intake.term, a.intake.year)}`}
        end={
          <span className="sh-app-end">
            <StatusText tone={applicationTone[a.status]}>{t(`stage.${a.status}`, { defaultValue: t(`common:appStatus.${a.status}`) })}</StatusText>
            {preSubmit ? (
              <>
                <span className="hg-xs sa-when">{t('home.closes', { date: formatDate(a.intake.application_deadline, locale) })} · <DaysLeft date={a.intake.application_deadline} /></span>
                <StrategyLine s={strategy} />
              </>
            ) : (
              <>
                <span className="hg-xs hg-subtle sh-hide-sm sa-when">{a.submitted_at ? t('applications.submittedOn', { date: formatDate(a.submitted_at, locale) }) : t('applications.updated', { date: formatDate(a.updated_at, locale) })}</span>
                <StrategyLine s={strategy} />
              </>
            )}
          </span>
        }
      />
    </li>
  );
}

const OFFER_STATES = new Set(['OFFERED', 'OFFER_ACCEPTED', 'TUITION_PENDING']);

/** Several offers: support the decision with the facts that differ — what you pay now, first-year cost, deadline, housing. Never a recommendation. */
function OfferComparison({ offers }: { offers: Application[] }) {
  const { t, locale } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['offers'], queryFn: () => api.me.offers(), staleTime: 60_000 });
  const o4 = (id: string) => q.data?.items.find((x) => x.application_id === id);
  const m = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatMoney(v, 'KRW', locale));
  const rows: { key: string; label: string; cell: (o: Application) => React.ReactNode }[] = [
    { key: 'program', label: t('offers.row.program'), cell: (o) => <>{localName(o.program)}<span className="bd-note">{intakeLabel(t, o.intake.term, o.intake.year)} · {o.university.city}</span></> },
    { key: 'pay', label: t('v4.offers.payNow'), cell: (o) => { const x = o4(o.id); return x?.payment.pay != null ? <><strong>{m(x.payment.pay)}</strong>{x.payment.scholarship ? <span className="bd-note">{t('v4.offers.payCalc', { tuition: m(x.payment.tuition), scholarship: m(x.payment.scholarship) })}</span> : null}</> : m(x?.payment.tuition); } },
    { key: 'deadline', label: t('offers.row.deadline'), cell: (o) => o.tuition_due ? <>{formatDate(o.tuition_due, locale)} <DaysLeft date={o.tuition_due} /></> : <span className="hg-subtle">{t('offers.deadlineUnknown')}</span> },
    { key: 'scholarship', label: t('offers.row.scholarship'), cell: (o) => o.offer_scholarship_note ? <span data-user-content lang="en">{o.offer_scholarship_note}</span> : <span className="hg-subtle">{t('offers.none')}</span> },
    { key: 'year', label: t('v4.cost.firstYear'), cell: (o) => { const x = o4(o.id); if (!x) return '—'; const r = x.first_year_after_scholarship_krw ?? x.first_year_range_krw; return <>{range(r.low, r.high, 'KRW', undefined, locale)}{x.first_year_after_scholarship_krw ? <span className="bd-note">{t('v4.offers.afterScholarship')}</span> : null}</>; } },
    { key: 'dorm', label: t('offers.row.dorm'), cell: (o) => { const x = o4(o.id); return x ? (x.dormitory ? t('offers.dormYes') : t('offers.dormNo')) : '—'; } },
  ];
  return (
    <Section title={t('offers.title', { count: offers.length })} sub={t('offers.sub')}>
      <div className="st-compare sc-table">
        <table className="st-compare__table">
          <thead><tr><th scope="col" className="st-compare__corner"><span className="hg-sr-only">{t('offers.criteria')}</span></th>
            {offers.map((o) => <th key={o.id} scope="col"><Link to={`/applications/${o.id}`} className="hg-link hg-strong">{localName(o.university)}</Link></th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><th scope="row">{r.label}</th>{offers.map((o) => <td key={o.id}>{r.cell(o)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {/* Under ~900px the table is hidden (shared compare styles): one card per offer instead. */}
      <div className="sc-cards">
        {offers.map((o) => (
          <section key={o.id} className="sc-card" aria-label={localName(o.university)}>
            <header className="sc-card__head">
              <Link to={`/applications/${o.id}`} className="hg-link hg-strong">{localName(o.university)}</Link>
            </header>
            <dl className="sc-card__rows">
              {rows.map((r) => <div key={r.key}><dt>{r.label}</dt><dd>{r.cell(o)}</dd></div>)}
            </dl>
          </section>
        ))}
      </div>
      <p className="hg-small hg-subtle">{t('offers.note')}</p>
    </Section>
  );
}

export default function Applications() {
  const { t } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['applications', {}], queryFn: () => api.applications.list({ page_size: 50 }) });
  return (
    <div className="st-page">
      <PageIntro title={t('applications.title')} subtitle={t('applications.subtitle')}
        actions={<ButtonLink as={Link} to="/explore?tab=foryou">{t('applications.add')}</ButtonLink>} />
      <QueryState
        query={q}
        skeleton={<div className="st-cards">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={<GraduationCap />} title={t('applications.empty')} text={t('applications.emptyText')} action={<ButtonLink as={Link} to="/explore?tab=foryou" variant="primary">{t('applications.emptyCta')}</ButtonLink>} />}
      >
        {(d) => {
          const active = d.items.filter((a) => !CLOSED.has(a.status));
          const offers = d.items.filter((a) => OFFER_STATES.has(a.status));
          const closed = d.items.filter((a) => CLOSED.has(a.status));
          return (
            <>
              {offers.length >= 2 && <OfferComparison offers={offers} />}
              {active.length > 0 && <div className="hg-panel"><ul className="hg-list">{active.map((a) => <AppRow key={a.id} a={a} />)}</ul></div>}
              <PortfolioSection />
              {closed.length > 0 && (
                <Section title={t('applications.closed')}>
                  <div className="hg-panel"><ul className="hg-list">{closed.map((a) => <AppRow key={a.id} a={a} />)}</ul></div>
                </Section>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
