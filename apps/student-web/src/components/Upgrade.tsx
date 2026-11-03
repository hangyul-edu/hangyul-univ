/**
 * **The upgrade offer, and the gate notice** (V17, brief §24, §41).
 *
 * Both exist for the same reason: a student should meet the next plan at the moment it would help them, and
 * never before. V17 adds no upgrade banners, no permanent "compare plans" strip and no second pricing page.
 * There are exactly two surfaces, and both are consequences of something the student just tried to do.
 *
 *   `GateNotice`    they asked for a managed-service route without a plan. `/services` explains which one.
 *   `UpgradeSheet`  they asked for a capability their plan does not include. A compact sheet names the
 *                   capability, the plan that has it, and the difference in price. One CTA.
 *
 * What neither does is argue. There is no comparison table (the brief rules it out by name), no
 * strike-through, no scarcity, and no second "are you sure" — the student came here from a thing they
 * wanted, so the sheet's whole job is to say what it costs and get out of the way.
 */
import { CircleAlert, X } from '@hangyul/icons';
import { PLANS, upgradeOffer, type PlanCode } from '@hangyul/types';
import { ButtonLink, Callout } from '@hangyul/ui';
import { formatMoney, koParticle } from '@hangyul/utils';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { tr, useT } from '../lib/i18n';

const planName = (t: (k: string, o?: Record<string, unknown>) => string, code: PlanCode) => {
  const p = PLANS.find((x) => x.code === code)!;
  return tr(t, `services.${p.code}.name`, p.name_en);
};

/**
 * Why an unpaid student is looking at the plan screen.
 *
 * `?gate=applications` comes from the router's paywall (`lib/access.ts`). Without it a student who clicked
 * "지원 현황" and landed on a pricing page has been bounced with no explanation, which reads as a bug rather
 * than as a boundary — and a boundary a student does not understand is one they do not pay to cross.
 */
export function GateNotice({ gate }: { gate: string | null }) {
  const { t } = useT();
  if (!gate) return null;
  // Falls back to the general sentence for any route the copy does not name individually.
  const what = t(`v17.gate.what.${gate}`, { defaultValue: '' });
  return (
    <Callout tone="info" icon={<CircleAlert aria-hidden />}>
      {/* `particle` is unused by every locale except Korean, where 지원 관리**는** and 기숙사 지원**은** are
          different words and `은(는)` is the giveaway that a machine wrote the sentence. */}
      {what ? t('v17.gate.named', { what, particle: koParticle(what, '은는') }) : t('v17.gate.general')}
    </Callout>
  );
}

/**
 * The contextual upgrade sheet.
 *
 * It is a `<dialog>`-shaped surface rather than a route because the student is in the middle of something —
 * an essay, an application — and must come back to it. Dismissing it returns them exactly where they were.
 */
export function UpgradeSheet({ current, feature, to, onClose }: {
  /** The plan the student holds, or `null` if they somehow have none. */
  current: PlanCode | null;
  /** i18n suffix under `v17.upgrade.feature.*` — what they just tried to do. */
  feature: string;
  /** The plan that includes it. */
  to: PlanCode;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const offer = current ? upgradeOffer(current, to) : null;
  const target = PLANS.find((p) => p.code === to)!;
  // Escape closes, focus lands inside, and the page behind does not scroll. The same contract every other
  // overlay in this product keeps; it is repeated here rather than inherited because this one is tiny.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // V20 §2 — the sheet is selling the plan, so the figure is a headline and shows the symbol alone. The
  // checkout block it leads to, and the payment history it writes, both keep the currency code.
  // V29: an upgrade has no approved price (UPGRADE_POLICY is OWNER_DECISION_REQUIRED), so the sheet never prints one —
  // not the difference, not the list price. Without a current plan this is a first purchase at the list price.
  const amount = offer
    ? t('v29.services.upgrade.amountPending')
    : formatMoney(target.amount_minor, target.currency, locale, { minor: true, symbolOnly: true });

  return (
    <>
      <div className="hg-overlay" onClick={onClose} aria-hidden />
      <div ref={ref} className="sv17-up" role="dialog" aria-modal="true" aria-labelledby="sv17-up-h">
        <button type="button" className="sv17-up__x" onClick={onClose} aria-label={t('common:actions.close')}><X /></button>
        {/* The sentence the brief asks for: not an error, a fact about where this lives. */}
        <h2 className="hg-title-sm" id="sv17-up-h">
          {(() => {
            const f = t(`v17.upgrade.feature.${feature}`, { defaultValue: feature });
            return t('v17.upgrade.title', { feature: f, plan: planName(t, to), particle: koParticle(f, '은는') });
          })()}
        </h2>
        <p className="sv17-up__lede">{offer ? t('v29.services.upgrade.sheetLede') : t(`v17.upgrade.why.${to}`, { defaultValue: '' })}</p>
        <dl className="sv17-up__facts">
          {current && <div><dt>{t('v17.upgrade.currentPlan')}</dt><dd>{planName(t, current)}</dd></div>}
          <div><dt>{t('v17.upgrade.amount')}</dt><dd className="hg-num"><strong>{amount}</strong>{!offer && <> <span className="hg-subtle hg-xs">{t('services.oneTime')}</span></>}</dd></div>
        </dl>
        <ButtonLink as={Link} to={`/services?upgrade=${target.slug}`} variant="primary" size="lg" onClick={onClose}>
          {t('v17.upgrade.cta', { plan: planName(t, target.code), particleRo: koParticle(planName(t, target.code), '으로로') })}
        </ButtonLink>
        {/* No second CTA. "Not now" is the close button, which is already there. */}
      </div>
    </>
  );
}
