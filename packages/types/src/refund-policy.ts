/**
 * The canonical refund-policy model (V22, REPORT §245 L4, brief §25–§26).
 *
 * Driven by **service state**, not by prose: each stage names what the law lets Hangyul say today, and whether a
 * commercial rule (a deduction schedule after the 7-day period) exists. None does — `OWNER_POLICY_REQUIRED` is a
 * recorded fact, never rendered as a placeholder. The Terms (제9조) and the checkout summary both render from this
 * object; `shared/refund-policy.json` mirrors it for the server (`services/refund_policy.py`), and `qa:v22` fails
 * if the two drift.
 *
 * Statutory basis: 전자상거래 등에서의 소비자보호에 관한 법률 제17조·제18조 (법률 제21312호, 시행 2026-07-21) —
 * docs/legal/V22_LEGAL_RESEARCH.md §3, §9.
 */
export const REFUND_POLICY_VERSION = '2026-10-23';

export type RefundStageKey =
  | 'BEFORE_START' | 'CONSULTATION_DONE' | 'RECOMMENDATION_STARTED' | 'RECOMMENDATION_DONE'
  | 'APPLICATION_WORK_STARTED' | 'DOCUMENT_REVIEW_DELIVERED' | 'ESSAY_REVIEW_DELIVERED' | 'SETTLEMENT_STARTED';

export interface RefundStage {
  key: RefundStageKey;
  /** Has the service "commenced" for 제17조②5 at this stage? */
  commenced: boolean;
  /** What may be stated from statute alone. */
  statutory: 'FULL' | 'PARTIAL';
  /** Commercial deduction schedule — no owner-approved figure exists. */
  commercial: 'OWNER_POLICY_REQUIRED';
}

export const REFUND_POLICY = {
  version: REFUND_POLICY_VERSION,
  /** The event that starts the service (and therefore the 제17조②5 exception). */
  service_start: 'FIRST_CONSULTATION',
  withdrawal_days: 7,
  refund_business_days: 3,
  non_conformity_months: 3,
  non_conformity_days_after_knowing: 30,
  statutory_basis: ['전자상거래법 제17조①1', '제17조②5', '제17조③', '제17조⑥', '제18조②2', '제18조⑨'],
  stages: [
    { key: 'BEFORE_START', commenced: false, statutory: 'FULL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'CONSULTATION_DONE', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'RECOMMENDATION_STARTED', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'RECOMMENDATION_DONE', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'APPLICATION_WORK_STARTED', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'DOCUMENT_REVIEW_DELIVERED', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'ESSAY_REVIEW_DELIVERED', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
    { key: 'SETTLEMENT_STARTED', commenced: true, statutory: 'PARTIAL', commercial: 'OWNER_POLICY_REQUIRED' },
  ] as readonly RefundStage[],
  /** Set to true only when the owner approves a deduction schedule; the Terms then render the commercial column. */
  commercial_schedule_approved: false,
} as const;

export const refundPolicyReady = (): boolean => REFUND_POLICY.commercial_schedule_approved;
