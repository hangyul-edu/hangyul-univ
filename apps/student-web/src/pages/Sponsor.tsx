/**
 * V9 S3 — PRIMARY QUESTION (for a parent or sponsor): "What does our family need to pay, show and know?"
 * Public, read-only page opened from the link a student shared (/sponsor/:token). No account. Shown in the language
 * the sponsor picks (default: the language the student chose for them). Only the parts the student chose; never
 * messages, essays, counselor notes or document files. An unknown, revoked or expired link shows one plain message.
 */
import { useApi } from '@hangyul/auth';
import { CalendarDays, FileText, GraduationCap, Lock, Plane, Wallet } from '@hangyul/icons';
import { changeLocale, STORAGE_KEY, useLocale } from '@hangyul/i18n';
import { LocaleSelector, Logo, Skeleton, StatusText } from '@hangyul/ui';
import { formatDate, formatDateTime, formatMoney } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { useParams } from 'react-router';

import { FundsToShowBlock, MoneyTimeline, PaymentGuard } from '../components/MoneyPlan';
import { RefundCard } from '../components/RefundCard';
import type { SponsorPayload } from '../lib/sponsor';

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="v9-sp__block">
      <h2 className="v9-sp__h">{icon}<span>{title}</span></h2>
      {children}
    </section>
  );
}

export default function Sponsor() {
  const { token = '' } = useParams();
  const api = useApi();
  const { t, locale } = useLocale(['student', 'visaroute', 'common']);
  const q = useQuery({
    queryKey: ['sponsor', token, locale],
    queryFn: () => api.get<SponsorPayload>(`/public/sponsor/${encodeURIComponent(token)}`, { lang: locale }),
    retry: false,
    staleTime: 60_000,
  });
  // First visit: read in the language the student chose for the family, unless this browser already picked one.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !q.data?.locale) return;
    applied.current = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
    if (!saved && q.data.locale !== locale) void changeLocale(q.data.locale);
  }, [q.data, locale]);
  const d = q.data;
  const name = d?.student.first_name ?? '';
  return (
    <div className="v9-sp">
      <header className="qs-top">
        <Logo />
        <LocaleSelector compact />
      </header>
      <main className="v9-sp__main" id="main">
        {q.isLoading && <><Skeleton h={32} w={260} /><Skeleton h={160} r={12} /></>}
        {q.isError && (
          <section className="v9-sp__gone">
            <h1 className="v9-sp__title">{t('v9.sponsor.goneTitle')}</h1>
            <p>{t('v9.sponsor.goneText')}</p>
          </section>
        )}
        {d && (
          <>
            <div className="v9-sp__intro">
              <h1 className="v9-sp__title">{t('v9.sponsor.title', { name })}</h1>
              <p className="hg-muted">{t('v9.sponsor.sub', { name })}</p>
              <p className="v9-sp__meta"><Lock aria-hidden /> {t('v9.sponsor.readOnly', { date: formatDate(d.expires_at, locale, { dateStyle: 'medium' }) })}</p>
            </div>
            {d.money && (
              <Block icon={<Wallet aria-hidden />} title={t('v9.sponsor.money')}>
                {d.money.refund && <RefundCard r={d.money.refund} sponsor />}
                {d.money.program ? (
                  <>
                    <p className="hg-small hg-muted">{t('v9.sponsor.moneyFor', { university: d.money.program.university_name, program: d.money.program.program_name })}</p>
                    {d.money.program.first_year_gross_min != null && (
                      <p className="v9-sp__total">{t('v9.sponsor.firstYear', { range: `${formatMoney(d.money.program.first_year_gross_min, 'KRW', locale, { compact: true })} – ${formatMoney(d.money.program.first_year_gross_max, 'KRW', locale, { compact: true })}` })}</p>
                    )}
                    <MoneyTimeline lines={d.money.program.lines} />
                  </>
                ) : <p className="hg-small">{t('v9.sponsor.noProgram', { name })}</p>}
                <PaymentGuard source={d.money.guard} />
                <FundsToShowBlock data={d.money.funds_to_show} />
              </Block>
            )}
            {d.family_documents && (
              <Block icon={<FileText aria-hidden />} title={t('v9.sponsor.docs')}>
                {d.family_documents.items.length === 0 ? <p className="hg-small">{t('v9.sponsor.docsNone')}</p> : (
                  <ul className="v9-sp__list">
                    {d.family_documents.items.map((it) => (
                      <li key={it.key}>
                        <span className="hg-medium">{t(`visaroute:doc.${it.key}.name`, { defaultValue: t(`common:docCategory.${it.category ?? 'OTHER'}`) })}</span>
                        <span className="hg-small hg-muted">
                          {t(`visaroute:who.${it.who}`, { defaultValue: '' })}
                          {it.validity_days ? ` · ${t('v9.funds.certAge', { count: it.validity_days })}` : ''}
                          {it.applies === 'maybe' ? ` · ${t('v9.sponsor.maybe')}` : ''}
                        </span>
                        <StatusText tone={it.ready ? 'success' : 'warning'}>{it.ready ? t('v9.sponsor.ready') : t('v9.sponsor.needed')}</StatusText>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="hg-xs hg-subtle">{t('v9.sponsor.noFiles')}</p>
              </Block>
            )}
            {d.dates && (
              <Block icon={<CalendarDays aria-hidden />} title={t('v9.sponsor.dates')}>
                {d.dates.length === 0 ? <p className="hg-small">{t('v9.sponsor.datesNone')}</p> : (
                  <ul className="v9-sp__list">
                    {d.dates.map((x) => (
                      <li key={`${x.kind}-${x.date}-${x.university ?? ''}`}>
                        <span className="hg-medium hg-num">{formatDate(x.date, locale, { dateStyle: 'medium' })}</span>
                        <span className="hg-small">{t(`v9.sponsor.date.${x.kind}`, { university: x.university ?? '' })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>
            )}
            {d.progress && (
              <Block icon={<GraduationCap aria-hidden />} title={t('v9.sponsor.progress')}>
                {d.progress.applications.length === 0 ? <p className="hg-small">{t('v9.sponsor.progressNone', { name })}</p> : (
                  <ul className="v9-sp__list">
                    {d.progress.applications.map((a, i) => (
                      <li key={`${a.university}-${i}`}>
                        <span className="hg-medium">{a.university}</span>
                        <span className="hg-small hg-muted">{a.program}</span>
                        <span className="hg-small">{t(`stage.${a.status}`, { defaultValue: t(`common:appStatus.${a.status}`) })}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {d.progress.visa && <p className="hg-small">{t('v9.sponsor.visa', { type: d.progress.visa.visa_type, status: t(`visaroute:status.${d.progress.visa.status}`) })}</p>}
              </Block>
            )}
            {d.arrival && (
              <Block icon={<Plane aria-hidden />} title={t('v9.sponsor.arrival')}>
                <p className="hg-small">{d.arrival.arrived ? t('v9.sponsor.arrived', { name }) : d.arrival.arrival_at
                  ? t('v9.sponsor.landing', { when: formatDateTime(d.arrival.arrival_at, locale) }) : t('v9.sponsor.noFlight')}</p>
                {d.arrival.housing && <p className="hg-small">{t('v9.sponsor.housing', { status: t(`common:housingStatus.${d.arrival.housing}`, { defaultValue: d.arrival.housing }) })}</p>}
              </Block>
            )}
            <p className="v9-sp__foot">{t('v9.sponsor.foot', { name, date: formatDate(d.as_of, locale, { dateStyle: 'medium' }) })}</p>
          </>
        )}
      </main>
    </div>
  );
}
