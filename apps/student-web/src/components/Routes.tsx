/**
 * V9 S1 — PRIMARY QUESTION: "Can I realistically study in Korea?"
 * Shown wherever language blocks the chosen degree (quick check result, Discovery "For you", the early home): the
 * realistic routes from the catalogue instead of "0 programs". Phone-first (360 px): one lead route with its facts,
 * the other two as one line each. Counts from published requirements — never an offer, never a probability.
 */
import { ArrowRight, Info } from '@hangyul/icons';
import { formatMoney, formatNumber } from '@hangyul/utils';
import { Link } from 'react-router';

import { useT } from '../lib/i18n';
import { leadRoute, routeLinks, type LanguageRoutes } from '../lib/routes';

export function RoutesCard({ routes, compact = false, ctaFor }: {
  routes: LanguageRoutes;
  /** Compact: the early home, where the next step above already leads. */
  compact?: boolean;
  /** Public /start: every route leads to sign-up instead of Discovery. */
  ctaFor?: (route: 'korean' | 'english') => string;
}) {
  const { t, locale } = useT();
  const k = routes.korean_first;
  const e = routes.english;
  const step = routes.smallest_step;
  const links = routeLinks(routes.degree);
  const to = (r: 'korean' | 'english') => ctaFor?.(r) ?? links[r];
  const money = (v: number | null | undefined) => (v == null ? '' : formatMoney(v, 'KRW', locale, { compact: true }));
  const lead = leadRoute(routes);
  const degree = t(`common:degreeShort.${routes.degree}`, { defaultValue: routes.degree });
  const cost = k && k.year_cost_min != null
    ? t('v9.routes.korean.cost', { range: k.year_cost_max && k.year_cost_max !== k.year_cost_min ? `${money(k.year_cost_min)} – ${money(k.year_cost_max)}` : money(k.year_cost_min) })
    : null;
  return (
    <section className="v9-routes" aria-labelledby="v9-routes-title" data-compact={compact || undefined}>
      <p className="v9-routes__eyebrow">{t('v9.routes.eyebrow')}</p>
      <h2 id="v9-routes-title" className="v9-routes__title">{t('v9.routes.title')}</h2>
      {!compact && <p className="v9-routes__sub">{t('v9.routes.sub', { degree })}</p>}
      <ol className="v9-routes__list">
        {k && k.count > 0 && (
          <li className="v9-route" data-lead={lead === 'korean' || undefined}>
            <h3 className="v9-route__name">{t('v9.routes.korean.title')}</h3>
            <p className="v9-route__big"><strong className="hg-num">{formatNumber(k.count, locale)}</strong> {t('v9.routes.korean.count', { count: k.count })}</p>
            {!compact && (
              <ul className="v9-route__facts">
                <li>{t('v9.routes.korean.noTest')}</li>
                {k.term_semesters ? <li>{t('v9.routes.korean.length', { count: k.term_semesters })}</li> : null}
                {cost && <li>{cost}</li>}
                <li>{t('v9.routes.korean.visa', { from: k.visa_from, to: k.visa_to })}</li>
                {k.opens_at && <li className="v9-route__next">{t('v9.routes.korean.opens', { count: k.opens_at.count, level: k.opens_at.level })}</li>}
              </ul>
            )}
            {compact && k.opens_at && <p className="v9-route__line">{t('v9.routes.korean.opens', { count: k.opens_at.count, level: k.opens_at.level })}</p>}
            <Link to={to('korean')} className="v9-route__cta">{t('v9.routes.korean.cta')} <ArrowRight aria-hidden className="hg-flip-rtl" /></Link>
          </li>
        )}
        {e && e.count > 0 && (
          <li className="v9-route" data-lead={lead === 'english' || undefined}>
            <h3 className="v9-route__name">{t('v9.routes.english.title')}</h3>
            <p className="v9-route__line">
              {t('v9.routes.english.count', { count: e.count, degree })}
              {' · '}
              {e.ielts_from != null && e.toefl_from != null
                ? t('v9.routes.english.level', { ielts: formatNumber(e.ielts_from, locale, { minimumFractionDigits: 1 }), toefl: e.toefl_from })
                : e.ielts_from != null ? t('v9.routes.english.ielts', { ielts: formatNumber(e.ielts_from, locale, { minimumFractionDigits: 1 }) })
                  : t('v9.routes.english.toefl', { toefl: e.toefl_from })}
            </p>
            {!compact && <Link to={to('english')} className="v9-route__cta">{t('v9.routes.english.cta')} <ArrowRight aria-hidden className="hg-flip-rtl" /></Link>}
          </li>
        )}
        {step && (
          <li className="v9-route">
            <h3 className="v9-route__name">{t('v9.routes.step.title')}</h3>
            <p className="v9-route__line">{t(`v9.routes.step.${step.kind}`, { count: step.count, level: step.kind === 'IELTS' ? formatNumber(step.level, locale, { minimumFractionDigits: 1 }) : step.level, degree })}</p>
          </li>
        )}
      </ol>
      <p className="v9-routes__note"><Info aria-hidden /> <span>{t('v9.routes.notOffer')}</span></p>
    </section>
  );
}
