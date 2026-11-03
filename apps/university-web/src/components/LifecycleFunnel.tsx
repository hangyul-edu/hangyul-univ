import { EyeOff } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { formatNumber, formatPercent } from '@hangyul/utils';
import { Link } from 'react-router';

import { applicantsLink } from '../lib/filters';
import { funnelSteps, stageLink } from '../lib/metrics';

/**
 * Full student lifecycle funnel with stage-to-stage conversion. Stages link to the underlying list when one exists.
 * PREPARING is aggregate-only (identities stay private until submission) and says so.
 */
export function LifecycleFunnel({ funnel, compact, extraParams }: {
  funnel: { stage: string; count: number; note?: string }[];
  compact?: boolean;
  extraParams?: { program_id?: string; nationality?: string; agency_id?: string };
}) {
  const { t, locale } = useLocale(['university', 'common']);
  const steps = funnelSteps(funnel);
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <ol className="uc-funnel" aria-label={t('university:funnel.title')} data-compact={compact || undefined}>
      {steps.map((s, i) => {
        const link = stageLink(s.stage);
        const href = link?.kind === 'applicants' ? applicantsLink({ status: link.status, ...extraParams })
          : link?.kind === 'cohorts' ? (link.tab === 'overview' ? '/cohorts' : `/${link.tab}`) : null;
        const label = t(`university:stage.${s.stage}`, { defaultValue: s.stage });
        const aggregate = s.stage === 'PREPARING';
        const note = aggregate ? t('university:funnel.preparingNote') : s.stage === 'INTERESTED' ? t('university:funnel.interestedNote') : null;
        return (
          <li key={s.stage} className="uc-funnel__row" data-stage={s.stage}>
            <div className="uc-funnel__label">
              <span className="uc-funnel__idx" aria-hidden>{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                {href ? <Link to={href} className="uc-funnel__name">{label}</Link> : <span className="uc-funnel__name">{label}</span>}
                {note && !compact && (
                  <span className="uc-funnel__note">
                    {aggregate && <EyeOff aria-hidden size={12} />} {note}
                  </span>
                )}
              </span>
            </div>
            <div className="uc-funnel__track" aria-hidden>
              <div className="uc-funnel__fill" data-aggregate={aggregate || undefined} style={{ inlineSize: `${Math.max(s.count ? 1.5 : 0, (s.count / max) * 100)}%` }} />
            </div>
            <div className="uc-funnel__count hg-num">{formatNumber(s.count, locale)}</div>
            <div className="uc-funnel__conv">
              {s.conversion !== null ? (
                <span title={t('university:funnel.conversionFrom', { stage: t(`university:stage.${steps[i - 1].stage}`) })}>
                  <span className="hg-sr-only">{t('university:funnel.conversion')}: </span>{formatPercent(s.conversion, locale)}
                </span>
              ) : s.conversionNote === 'mixedPopulation' ? (
                <span className="hg-subtle" title={t('university:funnel.mixedPopulation')}>{t('university:funnel.inclEarlier')}</span>
              ) : i > 0 ? <span className="hg-subtle" aria-label={t('university:funnel.noConversion')}>—</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
