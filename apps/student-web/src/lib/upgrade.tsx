/**
 * **A refusal becomes an offer** (V17, brief §24).
 *
 * The server already refuses work that falls outside the purchased plan, and it refuses it with numbers:
 * `409 { error: 'entitlement_exceeded', entitlement_key, limit, used, add_on_available }` from
 * `app/services/entitlements.py`. Two student actions can produce it —
 *
 *   `essay_review_rounds`         sending an essay for 첨삭 (Basic 0 · All-in-One 2 · Premium within the contract)
 *   `max_managed_applications`    moving an application out of DRAFT (Basic 0 · All-in-One 2 · Premium 3)
 *
 * — and until now both landed in the generic error toast, which told a Basic student that something went
 * wrong when in fact nothing had: they had asked for a thing they had not bought. That is the one moment
 * the brief says to show the next plan, so this hook turns exactly that refusal into `UpgradeSheet`.
 *
 * **It is deliberately narrow.** It claims a failure only when all three of these hold:
 *
 *   1. the server said `entitlement_exceeded` — not a guess from a status code;
 *   2. a higher plan actually includes the thing (`planThatUnlocks`);
 *   3. that plan is not the one the student already holds.
 *
 * When a Premium student exhausts a Premium allowance there is nothing to sell them, so the hook declines
 * the error and the toast handles it as before — the counselor's add-on is the real next step there, and an
 * upgrade sheet offering a plan they own would be worse than the plain message it replaced.
 */
import { planThatUnlocks, type EntitlementRefusal, type PlanCode, type PlanEntitlements } from '@hangyul/types';
import { ApiError } from '@hangyul/api-client';
import { useCallback, useState } from 'react';

import { UpgradeSheet } from '../components/Upgrade';
import { useMyPlan } from './queries';

/**
 * Entitlement key → the copy key under `v17.upgrade.feature.*`.
 *
 * The two spellings are deliberately not the same thing. `essay_review_rounds` is an allowance with a
 * number; 자기소개서 첨삭 is what the student was trying to do. Printing the key would put
 * `max_managed_applications` in a sentence a student reads, and a key not in this map is a key with no
 * sentence — so the hook declines it and the plain message stands.
 */
const COPY: Partial<Record<keyof PlanEntitlements, string>> = {
  max_managed_applications: 'managed_application',
  essay_review_rounds: 'essay_review',
  mock_interviews: 'mock_interview',
  follow_up_consultations: 'consultation',
  max_recommended_institutions: 'recommendations',
  document_review_level: 'document_review',
  settlement_support_level: 'settlement',
};

/** The server's refusal, or `null` for every other failure. */
export function entitlementRefusal(err: unknown): EntitlementRefusal | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const d = (err.body as { detail?: Record<string, unknown> } | undefined)?.detail;
  if (!d || d.error !== 'entitlement_exceeded' || typeof d.entitlement_key !== 'string') return null;
  return {
    entitlement_key: d.entitlement_key as EntitlementRefusal['entitlement_key'],
    limit: (d.limit as number | null) ?? null,
    used: (d.used as number) ?? 0,
    add_on_available: !!d.add_on_available,
    reason: typeof d.reason === 'string' ? d.reason : undefined,
    add_on_code: typeof d.add_on_code === 'string' ? d.add_on_code : null,
  };
}

export interface UpgradePrompt {
  /**
   * Hand a mutation's error here from `onError`. Returns `true` if the sheet took it, in which case the
   * caller must **not** also show a toast — two explanations of one refusal is worse than either alone.
   */
  catchRefusal: (err: unknown) => boolean;
  /** Render this. `null` until a refusal arrives. */
  sheet: React.ReactNode;
}

export function useUpgradeOnRefusal(): UpgradePrompt {
  const plan = useMyPlan();
  const current: PlanCode | null = plan.data?.plan?.code ?? null;
  const [offer, setOffer] = useState<{ feature: string; to: PlanCode } | null>(null);

  const catchRefusal = useCallback((err: unknown) => {
    const r = entitlementRefusal(err);
    if (!r) return false;
    // V29: outside the contract's scope (a new document, an unmanaged application, after the term) a bigger plan does
    // not help — the team's add-on does. Only a reached limit or a service the plan does not include is an upgrade moment.
    if (r.reason && !['LIMIT_REACHED', 'NOT_INCLUDED'].includes(r.reason)) return false;
    const feature = COPY[r.entitlement_key];
    const next = planThatUnlocks(r.entitlement_key, current);
    // Nothing above them to sell, it is what they already hold, or there is no sentence for it: let the
    // plain message through rather than show a sheet with a database column in its heading.
    if (!feature || !next || next.code === current) return false;
    setOffer({ feature, to: next.code });
    return true;
  }, [current]);

  return {
    catchRefusal,
    sheet: offer
      ? <UpgradeSheet current={current} feature={offer.feature} to={offer.to} onClose={() => setOffer(null)} />
      : null,
  };
}
