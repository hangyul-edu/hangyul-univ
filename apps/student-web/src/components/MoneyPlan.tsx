/**
 * V9 S2 — PRIMARY QUESTION: "How much will everything cost, who do we pay, and when?"
 * Building blocks shared by Budget, offers, the visa page and the sponsor view:
 *  · MoneyTimeline — every payment by moment (application → monthly), each with payee, refundability and basis
 *  · FundsToShow   — "Money you must show (not pay)" from the visa route, as translated keys + params
 *  · PaymentGuard  — pay the university directly, in the student's own name; never via money changers or agents
 *  · AnnouncedRules — government changes announced but NOT in force, with source
 */
import { ExternalLink, Info, ShieldCheck } from '@hangyul/icons';
import { StatusText } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import type { ReactNode } from 'react';

import { useT, type TFn } from '../lib/i18n';
import { fundsAmountFor, groupByWhen, planCoverage, type Announced, type FundsToShow, type MoneyLine, type ParsedFunds } from '../lib/money';

const BASIS_TONE = { OFFICIAL: 'success', ESTIMATE: 'info', SAMPLE: 'neutral', UNKNOWN: 'warning' } as const;

export function lineAmount(t: TFn, l: MoneyLine, locale: string): string {
  if (l.amount_min == null) return t('v9.money.unknown');
  if (l.amount_min === 0 && (l.amount_max ?? 0) === 0) return t('v9.money.free');
  const one = (v: number) => formatMoney(v, l.currency, locale, { compact: l.currency === 'KRW' && v >= 1_000_000 });
  const v = l.amount_max != null && l.amount_max !== l.amount_min ? `${one(l.amount_min)} – ${one(l.amount_max)}` : one(l.amount_min);
  return l.period === 'ONCE' ? v : `${v} ${t(`v9.money.per.${l.period}`)}`;
}

function BasisTag({ l }: { l: MoneyLine }) {
  const { t, locale } = useT();
  const label = l.basis === 'SAMPLE' ? t('common:freshness.unverified') : t(`v9.money.basis.${l.basis}`);
  return (
    <span className="v9-basis">
      <StatusText tone={BASIS_TONE[l.basis]} hollow={l.basis === 'UNKNOWN'}>{label}</StatusText>
      {l.source_url && (
        <a className="v9-basis__src" href={l.source_url} target="_blank" rel="noreferrer">
          {l.verified_at ? t('v9.money.checked', { date: formatDate(l.verified_at, locale, { dateStyle: 'medium' }) }) : t('v9.money.source')}<ExternalLink aria-hidden />
        </a>
      )}
    </span>
  );
}

export function MoneyLineRow({ l, showWhen = false }: { l: MoneyLine; showWhen?: boolean }) {
  const { t, locale } = useT();
  return (
    <li className="v9-line" data-key={l.key}>
      <div className="v9-line__main">
        <span className="v9-line__name">{t(`v9.money.line.${l.key}`)}</span>
        <span className="v9-line__to">{t(`v9.money.payee.${l.payee}`)}{showWhen ? ` · ${t(`v9.money.when.${l.when}`)}` : ''}</span>
        {l.note_code && <span className="v9-line__note">{t(`v9.money.note.${l.note_code}`, { defaultValue: '' })}</span>}
        {l.guard && <span className="v9-line__guard"><ShieldCheck aria-hidden /> {t('v9.money.guardShort')}</span>}
        {l.published_en && l.amount_min == null && (
          <details className="v9-asis"><summary>{t('v9.money.asPublished')}</summary><p lang="en" data-source-quote>{l.published_en}</p></details>
        )}
      </div>
      <div className="v9-line__end">
        <span className="v9-line__amount hg-num">{lineAmount(t, l, locale)}</span>
        <span className="v9-line__refund" data-refund={l.refundable}>{t(`v9.money.refund.${l.refundable}`)}</span>
        <BasisTag l={l} />
      </div>
    </li>
  );
}

/** Every payment, grouped by moment, in the order the family meets them. */
export function MoneyTimeline({ lines, hideKeys = [] }: { lines: MoneyLine[]; hideKeys?: string[] }) {
  const { t } = useT();
  const groups = groupByWhen(lines.filter((l) => !hideKeys.includes(l.key)));
  return (
    <ol className="v9-when">
      {groups.map((g) => (
        <li key={g.when} className="v9-when__group">
          <h3 className="v9-when__title">{t(`v9.money.when.${g.when}`)}</h3>
          <ul className="v9-lines">{g.lines.map((l) => <MoneyLineRow key={l.key} l={l} />)}</ul>
        </li>
      ))}
    </ol>
  );
}

function amountText(locale: string, a: { currency: string; amount: number }): string {
  return formatMoney(a.amount, a.currency, locale);
}

/** The rule's facts as plain sentences (translated keys + params). */
export function fundsFacts(t: TFn, locale: string, f: ParsedFunds, regionKind: 'CAPITAL' | 'OTHER' | null, university?: string | null): ReactNode[] {
  const out: ReactNode[] = [];
  const chosen = fundsAmountFor(f, regionKind);
  if (f.kind === 'FIXED' && chosen) {
    out.push(<strong key="amt">{t(`v9.funds.amount.${chosen.area === 'ANY' ? 'ANY' : chosen.area}`, { amount: amountText(locale, chosen), university: university ?? '' })}</strong>);
  } else if (f.kind === 'FIXED') {
    f.amounts.forEach((a) => out.push(<span key={`${a.area}-${a.amount}`}>{t(`v9.funds.amount.${a.area}`, { amount: amountText(locale, a), university: '' })}</span>));
  } else {
    out.push(<strong key="kind">{t(`v9.funds.kind.${f.kind}`)}</strong>);
  }
  if (f.period?.months) out.push(t(`v9.funds.period.${f.period.kind}`, { count: f.period.months }));
  if (f.period?.days) out.push(t('v9.funds.periodDays', { count: f.period.days }));
  if (f.longer_months_lower_tier) out.push(t('v9.funds.longer', { count: f.longer_months_lower_tier }));
  out.push(t(`v9.funds.whose.${f.whose}`));
  if (f.certificate_max_age_days) out.push(t('v9.funds.certAge', { count: f.certificate_max_age_days }));
  return out;
}

export function FundsToShowBlock({ data, compact = false }: { data: FundsToShow; compact?: boolean }) {
  const { t, locale } = useT();
  if (data.status !== 'RESOLVED' || !data.funds) {
    return (
      <section className="v9-funds" aria-labelledby="v9-funds-title">
        <h2 id="v9-funds-title" className="v9-funds__title">{t('v9.funds.title')}</h2>
        <p className="hg-small">{t(`v9.funds.status.${data.status}`)}</p>
        <p className="v9-funds__genuine">{t('v9.funds.genuine')}</p>
      </section>
    );
  }
  const f = data.funds;
  const facts = fundsFacts(t, locale, f, data.region_kind, data.university);
  return (
    <section className="v9-funds" aria-labelledby="v9-funds-title">
      <h2 id="v9-funds-title" className="v9-funds__title">{t('v9.funds.title')}</h2>
      <p className="v9-funds__sub">{t('v9.funds.sub', { type: data.route_visa_type ?? data.visa_type ?? '' })}</p>
      <ul className="v9-funds__facts">{facts.map((x, i) => <li key={i}>{x}</li>)}</ul>
      {data.waived_here && <p className="hg-small">{t('v9.funds.waived')}</p>}
      {(data.scheduled ?? []).map((sc) => (
        <p key={sc.effective_from} className="hg-small">
          <StatusText tone="neutral" hollow>{t('v9.announced.badge')}</StatusText>{' '}
          {t('v9.visa.caveat.SCHEDULED_CHANGE', { date: formatDate(sc.effective_from, locale, { dateStyle: 'medium' }) })}
          {sc.source_url && <> <a className="hg-link" href={sc.source_url} target="_blank" rel="noreferrer">{t('v9.money.source')}</a></>}
        </p>
      ))}
      <p className="v9-funds__genuine"><ShieldCheck aria-hidden /> <span>{t('v9.funds.genuine')} <a className="hg-link" href={data.genuine.source_url} target="_blank" rel="noreferrer">{t('v9.money.source')}</a></span></p>
      {!compact && <AnnouncedRules items={data.announced} />}
      <details className="v9-asis">
        <summary>{t('v9.money.asPublished')}</summary>
        <div lang="en" data-source-quote>{f.published_en.map((p) => <p key={p}>{p}</p>)}</div>
        {f.source_url && <a className="hg-link hg-small" href={f.source_url} target="_blank" rel="noreferrer">{t('v9.funds.embassy')}</a>}
      </details>
    </section>
  );
}

export function PaymentGuard({ source }: { source?: { source_url: string } }) {
  const { t } = useT();
  return (
    <aside className="v9-guard" aria-label={t('v9.guard.title')}>
      <ShieldCheck aria-hidden />
      <div>
        <p className="v9-guard__title">{t('v9.guard.title')}</p>
        <p className="hg-small">{t('v9.guard.text')}{source && <> <a className="hg-link" href={source.source_url} target="_blank" rel="noreferrer">{t('v9.money.source')}</a></>}</p>
      </div>
    </aside>
  );
}

export function AnnouncedRules({ items }: { items: Announced[] }) {
  const { t, locale } = useT();
  if (!items.length) return null;
  return (
    <details className="v9-announced">
      <summary><Info aria-hidden /> {t('v9.announced.title', { count: items.length })}</summary>
      <ul>
        {items.map((a) => (
          <li key={a.code}>
            <StatusText tone="neutral" hollow>{t('v9.announced.badge')}</StatusText>{' '}
            {t(`v9.announced.rule.${a.code}`)}{' '}
            <span className="hg-subtle">{t('v9.announced.meta', { date: formatDate(a.announced_on, locale, { dateStyle: 'medium' }), target: t(`v9.announced.target.${a.target}`) })}</span>{' '}
            <a className="hg-link" href={a.source_url} target="_blank" rel="noreferrer">{t('v9.money.source')}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}


/** V9: the one sentence under a first-year range — included vs paid separately, from the same money plan lines. */
export function PlanCoverage({ lines, className = 'bd-hint' }: { lines: MoneyLine[]; className?: string }) {
  const { t, locale } = useT();
  const c = planCoverage(lines);
  const name = (l: MoneyLine) => t(`v9.money.line.${l.key}`);
  const withAmount = (l: MoneyLine) => `${name(l)} ${lineAmount(t, l, locale)}`;
  return (
    <>
      {c.included.length > 0 && <span className={className} data-coverage="included">{t('v9.money.coverage.included', { list: c.included.map(name).join(', ') })}</span>}
      {c.separate.length > 0 && <span className={className} data-coverage="separate">{t('v9.money.coverage.separate', { list: c.separate.map(withAmount).join(' · ') })}</span>}
      {c.noFigure.length > 0 && <span className={className} data-coverage="none">{t('v9.money.coverage.noFigure', { list: c.noFigure.map(name).join(', ') })}</span>}
    </>
  );
}
