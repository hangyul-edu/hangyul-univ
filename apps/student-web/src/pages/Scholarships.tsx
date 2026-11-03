import { useApi } from '@hangyul/auth';
import { CheckCircle2, CircleHelp, XCircle } from '@hangyul/icons';
import type { Scholarship } from '@hangyul/types';
import { EmptyState, FreshnessBadge, QueryState, Section, SkeletonCard } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';

import { CheckText, SourceText } from '../components/ScholarshipCard';
import { DaysLeft, PageIntro } from '../components/bits';
import { useT } from '../lib/i18n';

const GROUPS = ['ELIGIBLE', 'POSSIBLE', 'NOT_ELIGIBLE'] as const;

/** What the scholarship is worth, in the most concrete terms the source gives. */
function valueText(t: ReturnType<typeof useT>['t'], locale: string, s: Scholarship): string | null {
  // V9 l10n: free-text coverage is English catalogue text — the row shows it as a source quote outside English.
  if (s.amount_krw) return formatMoney(s.amount_krw, 'KRW', locale);
  if (s.tuition_waiver_percent_min !== null || s.tuition_waiver_percent_max !== null) {
    const lo = s.tuition_waiver_percent_min ?? s.tuition_waiver_percent_max;
    const hi = s.tuition_waiver_percent_max;
    return hi && lo !== hi ? t('scholarships.waiverRange', { min: lo ?? 0, max: hi }) : t('scholarships.waiverOne', { pct: lo });
  }
  return s.coverage;
}

function Row({ s }: { s: Scholarship }) {
  const { t, locale } = useT();
  const value = valueText(t, locale, s);
  const open = (s.eligibility?.checks ?? []).filter((c) => c.ok !== true);
  return (
    <li className="ssc-row">
      <div className="ssc-main">
        <div className="ssc-name">{s.name}</div>
        <div className="ssc-meta">{[t(`common:scholarshipKind.${s.kind}`), s.provider, s.university_name && !s.provider.includes(s.university_name) ? s.university_name : null].filter(Boolean).join(' · ')}</div>
        {s.eligibility?.status === 'POSSIBLE' && open.length > 0 && (
          <ul className="ssc-checks" aria-label={t('scholarships.checks')}>
            {open.slice(0, 3).map((c, i) => (
              <li key={i}>{c.ok === false ? <XCircle aria-hidden /> : <CircleHelp aria-hidden />}<CheckText c={c} /></li>
            ))}
          </ul>
        )}
        {s.eligibility?.status === 'ELIGIBLE' && (s.eligibility.checks ?? []).length > 0 && (
          <details className="ssc-why">
            <summary>{t('scholarshipsV3.why')}</summary>
            <ul className="ssc-checks">
              {s.eligibility.checks.map((c, i) => <li key={i}><CheckCircle2 aria-hidden /><CheckText c={c} /></li>)}
            </ul>
          </details>
        )}
      </div>
      <div className="ssc-value">
        <div className="hg-medium">{value == null ? t('scholarshipsV3.valueUnknown') : value === s.coverage ? <SourceText text={value} /> : value}</div>
        <div className="hg-xs hg-subtle">{s.is_automatic ? t('scholarshipsV3.automatic') : t('scholarshipsV3.apply')}</div>
      </div>
      <div className="ssc-when">
        {s.application_deadline ? (
          <>
            <div className="hg-small">{formatDate(s.application_deadline, locale)}</div>
            <DaysLeft date={s.application_deadline} />
          </>
        ) : <div className="hg-xs hg-subtle">{t('scholarshipsV3.followsAdmission')}</div>}
        <FreshnessBadge data={s} compact />
      </div>
    </li>
  );
}

export default function Scholarships() {
  const { t } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['scholarships', 'me'], queryFn: () => api.me.scholarships() });
  return (
    <div className="st-page">
      <PageIntro title={t('scholarships.title')} subtitle={t('scholarshipsV3.subtitle')} />
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />} isEmpty={(d) => d.length === 0}
        empty={<EmptyState title={t('scholarships.empty')} />}>
        {(list) => {
          const by = (g: (typeof GROUPS)[number]) => list.filter((s) => (s.eligibility?.status ?? 'POSSIBLE') === g);
          return (
            <>
              <p className="sx-summary">{by('POSSIBLE').length > 0 ? t('scholarshipsV3.summary', { eligible: by('ELIGIBLE').length, possible: by('POSSIBLE').length }) : t('scholarshipsV3.summaryOnly', { eligible: by('ELIGIBLE').length })}</p>
              {GROUPS.map((g) => {
                const items = by(g);
                if (!items.length) return null;
                const body = <ul className="hg-panel ssc-list">{items.map((s) => <Row key={s.id} s={s} />)}</ul>;
                return g === 'NOT_ELIGIBLE' ? (
                  <details key={g} className="ssc-more">
                    <summary>{t('scholarshipsV3.notNow', { count: items.length })}</summary>
                    {body}
                  </details>
                ) : (
                  <Section key={g} title={t(`scholarshipsV3.group.${g}`)} sub={t(`scholarships.groupText.${g}`)}>{body}</Section>
                );
              })}
              <p className="hg-small hg-muted">{t('scholarshipsV3.note')}</p>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
