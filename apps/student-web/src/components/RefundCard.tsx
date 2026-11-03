/**
 * V9 S8 — PRIMARY QUESTION: "What happens to my money now that it went wrong?"
 * Shown on home (and to a sponsor) when a refund case is open: why, the university's refund rule (or "your counselor
 * confirms"), the own-account rule, the payment-route guard and how many days have passed.
 */
import { ArrowRight, Undo2 } from '@hangyul/icons';
import { ButtonLink, StatusText } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { Link } from 'react-router';

import { useT } from '../lib/i18n';
import type { RefundSummary } from '../lib/money';

export function RefundCard({ r, sponsor = false }: { r: RefundSummary; sponsor?: boolean }) {
  const { t, locale } = useT();
  return (
    <section className="v9-refund" aria-labelledby="v9-refund-title">
      <p className="v9-refund__eyebrow"><Undo2 aria-hidden /> {t(`v9.refund.trigger.${r.trigger}`)}</p>
      <h2 id="v9-refund-title" className="v9-refund__title">{t('v9.refund.title', { university: r.university ?? '' })}</h2>
      <ul className="v9-refund__facts">
        {r.amount_paid_krw != null && <li>{t('v9.refund.paid', { amount: formatMoney(r.amount_paid_krw, 'KRW', locale) })}</li>}
        <li>{r.rule.known ? t('v9.refund.ruleKnown') : t('v9.refund.ruleUnknown')}</li>
        <li><strong>{t('v9.refund.ownAccount')}</strong></li>
        <li>{t('v9.refund.noAgents')}</li>
      </ul>
      <p className="v9-refund__days">
        <StatusText tone={r.closed ? 'success' : r.elapsed_days > 30 ? 'danger' : 'warning'}>{t(`v9.refund.status.${r.status}`, { defaultValue: r.status })}</StatusText>
        <span>{t('v9.refund.elapsed', { count: r.elapsed_days, date: formatDate(r.since, locale, { dateStyle: 'medium' }) })}</span>
      </p>
      {!sponsor && <ButtonLink as={Link} to="/messages" size="sm" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('v9.refund.cta')}</ButtonLink>}
    </section>
  );
}
