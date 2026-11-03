import { useApi } from '@hangyul/auth';
import { useLocale, localName } from '@hangyul/i18n';
import type { ApplicationStrategy, Portfolio, StrategyItem } from '@hangyul/types';
import { Section, StatusText, UniMark } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { GROUP_ORDER, GROUP_TONE, itemParams, itemTitle, itemWhy, QUOTED_WHY, splitForWorkspace, strategyLine } from '../../lib/success';
import './success.css';

export function useS() {
  return useLocale(['success', 'common']);
}

/** My strategy for every application (one request, shared by the list lines and home). */
export function useMyStrategy() {
  const api = useApi();
  return useQuery({ queryKey: ['strategy'], queryFn: () => api.success.myStrategy(), staleTime: 60_000 });
}

function ItemRow({ it }: { it: StrategyItem }) {
  const { t, locale } = useS();
  const why = itemWhy(t, locale, it);
  return (
    <li className="sx-item" data-severity={it.severity}>
      <span className="sx-item__mark" aria-hidden>{it.severity === 'info' ? 'i' : '!'}</span>
      <span className="sx-item__text">
        <span className="sx-item__title">{itemTitle(t, locale, it)}</span>
        {why && <span className="sx-item__why" data-user-content={QUOTED_WHY.has(it.code) ? true : undefined}>{why}</span>}
        <span className="sx-item__meta">
          <span className="hg-subtle">{t(`success:owner.${it.owner}`)}</span>
          {it.action?.link && <> · <Link to={it.action.link} className="hg-link">{t(`success:action.${it.action.code}`, { defaultValue: it.action.label })}</Link></>}
        </span>
      </span>
    </li>
  );
}

/**
 * On the application workspace, under the three lanes: "N things can still improve this application" or "Ready".
 * Documents and essays are NOT repeated (the lanes are the checklist); only what the checklist can't say is listed.
 */
export function StrategyBlock({ appId }: { appId: string }) {
  const { t } = useS();
  const api = useApi();
  const q = useQuery({ queryKey: ['strategy', appId], queryFn: () => api.success.strategy(appId), staleTime: 30_000 });
  const s = q.data;
  if (!s || s.scope === 'closed') return null;
  const { extra, info, inLanes } = splitForWorkspace(s);
  const count = s.counts.blocker + s.counts.improve;
  if (s.scope === 'review' && count === 0) return null;
  const fits = s.fit.map((c) => t(`success:fit.${c}`, { defaultValue: '' })).filter(Boolean);
  return (
    <section className="sx-block" aria-labelledby="sx-block-title">
      <h2 id="sx-block-title" className="sx-block__title">
        {count === 0 ? t('success:block.ready') : t('success:block.title', { count })}
      </h2>
      {count > 0 && inLanes > 0 && (
        <p className="sx-block__sub">{inLanes === count ? t('success:block.allInChecklist') : t('success:block.inChecklist', { count: inLanes })}</p>
      )}
      {extra.length > 0 && <ul className="sx-list">{extra.map((it) => <ItemRow key={`${it.code}-${JSON.stringify(it.params)}`} it={it} />)}</ul>}
      {fits.length > 0 && <p className="sx-block__fit">{t('success:block.fits', { list: fits.join(' · ') })}</p>}
      {info.length > 0 && (
        <details className="sx-more">
          <summary>{t('success:block.goodToKnow', { count: info.length })}</summary>
          <ul className="sx-list">{info.map((it) => <ItemRow key={`${it.code}-${JSON.stringify(it.params)}`} it={it} />)}</ul>
        </details>
      )}
      {s.history && <p className="sx-block__hist">{t('success:block.history', { n: s.history.n, offered: s.history.offered, cohort: s.history.cohort })}</p>}
    </section>
  );
}

/** One line on the Applications list: Ready / N things to improve / Blocked by X. */
export function StrategyLine({ s }: { s: ApplicationStrategy | undefined }) {
  const { t, locale } = useS();
  if (!s) return null;
  const line = strategyLine(s);
  if (!line) return null;
  if (line.kind === 'ready') return <span className="sx-line" data-kind="ready">{t('success:line.ready')}</span>;
  if (line.kind === 'blocked' && line.first) {
    return <span className="sx-line" data-kind="blocked">{t('success:line.blocked', { what: itemTitle(t, locale, line.first) })}{line.count > 1 ? ` ${t('success:line.more', { count: line.count - 1 })}` : ''}</span>;
  }
  return <span className="sx-line" data-kind="improve">{t('success:line.improve', { count: line.count })}</span>;
}

function groupLabel(t: (k: string, o?: Record<string, unknown>) => string, g: string) {
  return t(`success:group.${g}`);
}

/** "Your plan": applications + saved programs as Strong / Possible / Not eligible yet, deadlines, budget, observations. */
export function PortfolioSection() {
  const { t, locale } = useS();
  const api = useApi();
  const q = useQuery({ queryKey: ['portfolio'], queryFn: () => api.success.myPortfolio(), staleTime: 60_000 });
  const p: Portfolio | undefined = q.data;
  if (!p || p.entries.length + p.offers === 0) return null;
  const apps = p.entries.filter((e) => e.source === 'application');
  const saved = p.entries.filter((e) => e.source === 'saved');
  const m = (v: number | null) => (v === null ? '—' : formatMoney(v, 'KRW', locale, { compact: true }));
  return (
    <Section id="portfolio" title={t('success:portfolio.title')} sub={t('success:portfolio.sub')}>
      {apps.length > 0 && (
        <p className="sx-groups">
          {GROUP_ORDER.map((g) => (
            <span key={g} data-group={g}><strong className="hg-num">{p.groups[g]}</strong> {groupLabel(t, g)}</span>
          ))}
        </p>
      )}
      {p.observations.length > 0 && (
        <ul className="sx-obs">
          {p.observations.map((o) => (
            <li key={o.code + JSON.stringify(o.params)} data-severity={o.severity}>
              {t(`success:obs.${o.code}`, { ...itemParams(t, locale, o.params), universities: Array.isArray(o.params.universities) ? (o.params.universities as string[]).join(', ') : undefined, defaultValue: o.text })}
            </li>
          ))}
        </ul>
      )}
      <div className="hg-panel">
        <ul className="hg-list">
          {[...apps, ...saved].map((e) => (
            <li key={`${e.source}-${e.program.id}`} className="sx-entry">
              <UniMark name={localName(e.university)} color={e.university.brand_color ?? undefined} photo={e.university.photo} size="sm" />
              <span className="sx-entry__main">
                {e.application_id ? <Link to={`/applications/${e.application_id}`} className="sx-entry__title">{localName(e.university)}</Link>
                  : <Link to={`/universities/${e.university.slug}`} className="sx-entry__title">{localName(e.university)}</Link>}
                <span className="sx-entry__meta">{localName(e.program)}{e.source === 'saved' ? ` · ${t('success:portfolio.saved')}` : ''}</span>
              </span>
              <span className="sx-entry__end">
                <StatusText tone={GROUP_TONE[e.group]}>{groupLabel(t, e.group)}</StatusText>
                <span className="hg-xs hg-subtle">
                  {e.group === 'sent' ? null : e.deadline ? t('success:portfolio.closes', { date: formatDate(e.deadline, locale, { month: 'short', day: 'numeric' }) }) : t('success:portfolio.noIntake')}
                  {e.first_year.low !== null && e.group !== 'sent' && <>{e.deadline ? ' · ' : ''}{t('success:portfolio.firstYear', { low: m(e.first_year.low), high: m(e.first_year.high) })}</>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {p.budget.low !== null && (
        <p className="hg-small hg-muted sx-budget">
          {t('success:portfolio.budgetSpread', { low: m(p.budget.low), high: m(p.budget.high) })}
          {p.budget.budget ? ` ${t('success:portfolio.yourBudget', { budget: m(p.budget.budget) })}` : ''}
          {p.budget.basis === 'SAMPLE' && <span className="sx-sample">{t('common:freshness.unverified')}</span>}
        </p>
      )}
      {p.review && (
        <p className="hg-small sx-review">
          {t('success:portfolio.reviewed', { name: t('student:messages.team'), date: formatDate(p.review.reviewed_at, locale, { month: 'short', day: 'numeric' }) })}
        </p>
      )}
      <p className="hg-xs hg-subtle">{t('success:portfolio.note')}</p>
    </Section>
  );
}
