/**
 * The Hangyul service plans — **the single source of truth for what a plan costs and what it promises**
 * (REPORT §117, §380).
 *
 * `scripts/plans/sync.mjs` writes `shared/plans.json` from this file, the server seed reads that file, the
 * public API serves what the seed wrote, and `npm run qa:plans-v29` asserts every surface agrees with it —
 * manifest, generated JSON, API, database, marketing, student web, student native, agency and checkout.
 *
 * **V29 (2026-10-30): the owner's new service/pricing document is the contract.** It replaced the V15
 * business-plan definition (frozen in `shared/plan-catalog/2026-10-19.v15.json`). What changed, and why the
 * shape of the data changed with it (REPORT §380):
 *
 *   - a plan no longer sells *minutes of consultation*. It sells one diagnostic consultation and a **support
 *     window** — 1 day (Basic), 3 days (All-in-One), or the **contracted service term** (Premium). A single
 *     meeting's length is the appointment's `duration_minutes`, not a plan property;
 *   - All-in-One's statement / study-plan editing is **2 rounds** (was 1);
 *   - Premium's editing is **not rationed within the contracted scope** — the contracted application
 *     documents, for the contracted applications, during the contracted term (`essay_review_scope`). It is not
 *     unlimited unrelated documents, new documents, translation, notarization or work after the term;
 *   - Premium adds pre-arrival support from D-30, 30 days of settlement support and a dedicated team.
 *
 * Nothing here is a product decision taken in code: if a number here is wrong, the owner's document is the
 * place it is wrong. Prices are one-time USD purchases.
 */

/* ---------------------------------------------------------------------------------- catalogue version */

/**
 * The version every purchase snapshots (V29 §7).
 *
 * An order records the catalogue version and a full copy of the plan it bought, so changing this file never
 * rewrites a historical purchase. Bump `version` whenever a price, a limit or a scope changes, and freeze the
 * previous `shared/plans.json` under `shared/plan-catalog/<version>.json`.
 */
export const SERVICE_CATALOG = {
  version: '2026-10-30.v29',
  effective_from: '2026-10-30',
  source: 'Owner-approved Hangyul Univ service/pricing document (V29)',
  previous: '2026-10-19.v15',
} as const;

/** Plan codes. These are the `ServiceProduct.code` values and the `?plan=` handoff values (lower-cased). */
export const PLAN_CODES = ['BASIC', 'ALL_IN_ONE', 'PREMIUM'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/* ------------------------------------------------------------------------------------- graded scope */

/** How long consultation support lasts: a number of days, or the whole contracted service term. */
export type SupportWindow = 'DAYS' | 'CONTRACT_TERM';
/** What follow-up after the diagnostic consultation means: one more consultation, the responsible team, or priority. */
export type FollowUpLevel = 'CONSULTATION' | 'TEAM' | 'PRIORITY';
/** 서류: 체크리스트 / 검토·보완 가이드 / 집중 검토·보완. Three promises, not one switched on and off. */
export type ReviewLevel = 'CHECKLIST' | 'REVIEW_GUIDANCE' | 'INTENSIVE';
/** Which statement / study-plan editing the plan covers: none, a counted number of rounds, or the contracted documents. */
export type EssayScope = 'NONE' | 'ROUNDS' | 'CONTRACTED_DOCUMENTS';
export type VisaLevel = 'GUIDANCE' | 'DOCUMENT_PREP' | 'INTENSIVE';
export type DormLevel = 'INFORMATION' | 'SCHEDULE' | 'APPLICATION';
export type SettlementLevel = 'NONE' | 'INFORMATION' | 'FULL';

/**
 * What a plan promises, machine-readable.
 *
 * A counted allowance is a number. `null` means **not rationed within the plan's contracted scope** — it never
 * means globally unlimited. Every `null` below is paired with a scope field that bounds it:
 * `follow_up_consultations: null` with `follow_up_level`, `essay_review_rounds: null` with
 * `essay_review_scope: 'CONTRACTED_DOCUMENTS'`, and both with the engagement's service term.
 */
export interface PlanEntitlements {
  /** The personalised diagnostic consultation (진단 상담), counted. */
  consultation_sessions: number;
  support_window_type: SupportWindow;
  /** Days of consultation support for `DAYS`; `null` for `CONTRACT_TERM` (bounded by the engagement's term). */
  support_window_days: number | null;
  follow_up_level: FollowUpLevel;
  /** Counted follow-up consultations; `null` = team / priority follow-up within the support window. */
  follow_up_consultations: number | null;
  /** How many universities / language institutes Hangyul researches and recommends. Not applications. */
  max_recommended_institutions: number;
  /** How many applications Hangyul *manages* — not how many the student may create. */
  max_managed_applications: number;
  document_review_level: ReviewLevel;
  /** 자기소개서·학업계획서 첨삭 rounds; `null` = not rationed **within `essay_review_scope`**. */
  essay_review_rounds: number | null;
  essay_review_scope: EssayScope;
  /** Mock interviews included. Every plan may buy more as an add-on. */
  mock_interviews: number;
  visa_support_level: VisaLevel;
  dormitory_support_level: DormLevel;
  settlement_support_level: SettlementLevel;
  /** 입국 후 기본 생활 정보. */
  basic_living_information: boolean;
  /** Pre-arrival support starts this many days before the arrival date (0 = none). */
  pre_arrival_support_days: number;
  /** Initial settlement support lasts this many days after arrival (0 = none). */
  settlement_days: number;
  priority_response: boolean;
  /** A dedicated responsible staff member / team inside Hangyul. Outwardly still "Hangyul Univ team" (V22). */
  dedicated_support: boolean;
}

/** The entitlement keys that are counted allowances, i.e. the ones that can run out. */
export const COUNTED_ENTITLEMENTS = [
  'max_managed_applications', 'essay_review_rounds', 'mock_interviews', 'follow_up_consultations',
  'max_recommended_institutions', 'consultation_sessions',
] as const;
export type CountedEntitlement = (typeof COUNTED_ENTITLEMENTS)[number];

/** Statement / study-plan documents a plan's editing covers. Anything else is a new document (add-on). */
export const CONTRACTED_ESSAY_TYPES = ['PERSONAL_STATEMENT', 'STUDY_PLAN'] as const;

export interface PlanDef {
  code: PlanCode;
  /** `?plan=` value and the order slug. */
  slug: string;
  sort_order: number;
  /** Korean name, the canonical semantic source. English and the rest come from i18n. */
  name_ko: string;
  name_en: string;
  /**
   * **USD is the product currency (V17).** Only Hangyul's own service fee is in dollars; a university's
   * tuition, dormitory and application fees stay KRW, charged by the university.
   */
  currency: 'USD';
  /** Minor units — cents. $179 is `17_900`. `formatMoney(..., { minor: true })` renders it. */
  amount_minor: number;
  /** The strategically important plan. Exactly one is true. Hierarchy and copy, never a ribbon. */
  recommended: boolean;
  entitlements: PlanEntitlements;
  /** The card lines, as i18n key suffixes under `v29.pricing.<slug>.f1…f5`. */
  highlights: readonly ['f1', 'f2', 'f3', 'f4', 'f5'];
}

const H = ['f1', 'f2', 'f3', 'f4', 'f5'] as const;

export const PLANS: readonly PlanDef[] = [
  {
    code: 'BASIC', slug: 'basic', sort_order: 0, name_ko: '베이직', name_en: 'Basic',
    currency: 'USD', amount_minor: 17_900, recommended: false, highlights: H,
    entitlements: {
      consultation_sessions: 1,
      support_window_type: 'DAYS',
      support_window_days: 1,
      follow_up_level: 'CONSULTATION',
      follow_up_consultations: 1,
      max_recommended_institutions: 3,
      max_managed_applications: 0,
      document_review_level: 'CHECKLIST',
      essay_review_rounds: 0,
      essay_review_scope: 'NONE',
      mock_interviews: 0,
      visa_support_level: 'GUIDANCE',
      dormitory_support_level: 'INFORMATION',
      settlement_support_level: 'NONE',
      basic_living_information: false,
      pre_arrival_support_days: 0,
      settlement_days: 0,
      priority_response: false,
      dedicated_support: false,
    },
  },
  {
    code: 'ALL_IN_ONE', slug: 'all_in_one', sort_order: 1, name_ko: '올인원', name_en: 'All-in-One',
    currency: 'USD', amount_minor: 34_900, recommended: true, highlights: H,
    entitlements: {
      consultation_sessions: 1,
      support_window_type: 'DAYS',
      support_window_days: 3,
      follow_up_level: 'TEAM',
      follow_up_consultations: null,
      max_recommended_institutions: 5,
      max_managed_applications: 2,
      document_review_level: 'REVIEW_GUIDANCE',
      essay_review_rounds: 2,
      essay_review_scope: 'ROUNDS',
      mock_interviews: 0,
      visa_support_level: 'DOCUMENT_PREP',
      dormitory_support_level: 'SCHEDULE',
      settlement_support_level: 'INFORMATION',
      basic_living_information: true,
      pre_arrival_support_days: 0,
      settlement_days: 0,
      priority_response: false,
      dedicated_support: false,
    },
  },
  {
    code: 'PREMIUM', slug: 'premium', sort_order: 2, name_ko: '프리미엄', name_en: 'Premium',
    currency: 'USD', amount_minor: 59_900, recommended: false, highlights: H,
    entitlements: {
      consultation_sessions: 1,
      support_window_type: 'CONTRACT_TERM',
      support_window_days: null,
      follow_up_level: 'PRIORITY',
      follow_up_consultations: null,
      max_recommended_institutions: 7,
      max_managed_applications: 3,
      document_review_level: 'INTENSIVE',
      essay_review_rounds: null,
      essay_review_scope: 'CONTRACTED_DOCUMENTS',
      mock_interviews: 1,
      visa_support_level: 'INTENSIVE',
      dormitory_support_level: 'APPLICATION',
      settlement_support_level: 'FULL',
      basic_living_information: true,
      pre_arrival_support_days: 30,
      settlement_days: 30,
      priority_response: true,
      dedicated_support: true,
    },
  },
];

export const PLAN_BY_CODE: Record<PlanCode, PlanDef> = Object.fromEntries(PLANS.map((p) => [p.code, p])) as Record<PlanCode, PlanDef>;

/* ------------------------------------------------------------------------------------- upgrade policy */

/**
 * **Upgrade pricing is an owner decision that has not been taken** (V29 §18).
 *
 * V17 modelled a price-difference rule ($179 → $349 costs $170) as `PENDING_APPROVAL`. The V29 contract does
 * not define upgrade pricing at all, so the product must not charge either the difference or the full price on
 * its own authority. `status: 'OWNER_DECISION_REQUIRED'` makes the server refuse an upgrade order
 * (`UPGRADE_POLICY_REQUIRED`) and the UI offer a conversation with the team instead; `release:check` lists it.
 *
 * What an upgrade *means* is defined, because it follows from how usage works: the new plan's limits replace
 * the old ones and usage already delivered stays used (it is read from the work records, not a counter).
 */
export const UPGRADE_POLICY = {
  kind: 'UNDEFINED' as const,
  status: 'OWNER_DECISION_REQUIRED' as const,
  usage_rule: 'CARRY_OVER' as const,
  note: 'Upgrade pricing is not defined by the V29 service contract — owner decision required (REPORT §389).',
} as const;

export interface UpgradeOffer {
  from: PlanCode;
  to: PlanCode;
  /** What the student gains, as comparison-row keys whose cell differs between the two plans. */
  gains: string[];
  /** Always `null` until the owner approves an upgrade price rule. */
  amount_minor: number | null;
  priced: boolean;
}

/**
 * What moving from one plan to another changes, or `null` when that is not an upgrade.
 *
 * Returns `null` for the same plan and for every downgrade: moving *down* is a refund question, and the refund
 * schedule is `OWNER_POLICY_REQUIRED`. The amount is `null` while `UPGRADE_POLICY` is undecided — a caller must
 * not invent one.
 */
export function upgradeOffer(from: PlanCode, to: PlanCode): UpgradeOffer | null {
  const a = PLANS.find((p) => p.code === from);
  const b = PLANS.find((p) => p.code === to);
  if (!a || !b || a.code === b.code || b.sort_order <= a.sort_order) return null;
  const gains = COMPARE_ROWS.filter((r) => JSON.stringify(compareCell(r, a)) !== JSON.stringify(compareCell(r, b))).map((r) => r.key);
  return { from: a.code, to: b.code, gains, amount_minor: null, priced: false };
}

/**
 * The cheapest plan that includes a given entitlement at a higher level than the current one.
 *
 * `null` means no plan offers more — the honest answer is then an add-on or "this is as far as any plan goes".
 * A non-rationed (`null`) allowance counts as more than any number.
 */
export function planThatUnlocks(key: keyof PlanEntitlements, current: PlanCode | null): PlanDef | null {
  const from = current ? PLANS.find((p) => p.code === current) : null;
  const have = from ? from.entitlements[key] : undefined;
  const better = (v: PlanEntitlements[typeof key]) => {
    if (typeof v === 'boolean') return v && have !== true;
    if (v === null) return have !== null;
    if (typeof v === 'number') return have === undefined ? v > 0 : typeof have === 'number' && v > have;
    return typeof have === 'string' ? v !== have : true;
  };
  return PLANS.find((p) => (!from || p.sort_order > from.sort_order) && better(p.entitlements[key])) ?? null;
}

const BY_SLUG = new Map(PLANS.map((p) => [p.slug, p]));

/** `?plan=all_in_one` → the plan, or `null`. Accepts the code spelling too, so `?plan=ALL_IN_ONE` works. */
export function planFromParam(v: string | null | undefined): PlanDef | null {
  if (!v) return null;
  const k = v.trim().toLowerCase();
  return BY_SLUG.get(k) ?? BY_SLUG.get(k.replace(/-/g, '_')) ?? null;
}

/* ------------------------------------------------------------------------------------- the comparison */

/**
 * The rows of the owner's V29 comparison table, in its order. Marketing, the student plan table, the native
 * services screen and the agency panel all render from `compareCell`, so no surface holds plan logic.
 */
export interface CompareRow {
  key: string;
  /** Which area of the comparison the row belongs to (the three questions a buyer asks). */
  group: 'consult' | 'apply' | 'settle';
}

export const COMPARE_ROWS: readonly CompareRow[] = [
  { key: 'support', group: 'consult' },
  { key: 'followUp', group: 'consult' },
  { key: 'recommended', group: 'consult' },
  { key: 'managed', group: 'apply' },
  { key: 'documents', group: 'apply' },
  { key: 'essay', group: 'apply' },
  { key: 'interview', group: 'apply' },
  { key: 'visa', group: 'settle' },
  { key: 'dormitory', group: 'settle' },
  { key: 'arrival', group: 'settle' },
  { key: 'dedicated', group: 'settle' },
];

export const COMPARE_GROUPS = ['consult', 'apply', 'settle'] as const;

/**
 * One comparison cell as data: `kind` (draw an em dash, a tick, or a value), an i18n key under
 * `common:v29.pricing.compare.value.*`, and its interpolation values.
 */
export interface Cell { kind: 'none' | 'yes' | 'value'; key: string; params?: Record<string, number> }

const V = 'common:v29.pricing.compare.value';

export function compareCell(row: CompareRow, plan: PlanDef): Cell {
  const e = plan.entitlements;
  const none: Cell = { kind: 'none', key: `${V}.none` };
  const val = (leaf: string, params?: Record<string, number>): Cell => ({ kind: 'value', key: `${V}.${leaf}`, ...(params ? { params } : {}) });
  switch (row.key) {
    case 'support':
      return e.support_window_type === 'CONTRACT_TERM' ? val('supportTerm') : val('supportDays', { count: e.support_window_days ?? 0 });
    case 'followUp':
      return e.follow_up_level === 'CONSULTATION' ? val('followUpOnce', { count: e.follow_up_consultations ?? 1 })
        : val(`followUp.${e.follow_up_level}`);
    case 'recommended':
      return val('places', { count: e.max_recommended_institutions });
    case 'managed':
      return e.max_managed_applications > 0 ? val('places', { count: e.max_managed_applications }) : none;
    case 'documents':
      return val(`documents.${e.document_review_level}`);
    case 'essay':
      if (e.essay_review_scope === 'NONE') return none;
      return e.essay_review_rounds === null ? val('essayContract') : val('rounds', { count: e.essay_review_rounds });
    case 'interview':
      return e.mock_interviews > 0 ? val('mockIncluded', { count: e.mock_interviews }) : val('addOn');
    case 'visa':
      return val(`visa.${e.visa_support_level}`);
    case 'dormitory':
      return val(`dormitory.${e.dormitory_support_level}`);
    case 'arrival':
      if (e.settlement_support_level === 'FULL') return val('settlement', { count: e.settlement_days, before: e.pre_arrival_support_days });
      return e.basic_living_information ? val('livingInfo') : none;
    case 'dedicated':
      return e.dedicated_support && e.priority_response ? { kind: 'yes', key: `${V}.yes` } : none;
    default:
      return none;
  }
}

/** The external costs a Hangyul service fee never includes (V29 이용 안내). */
export const EXTERNAL_COSTS = ['application', 'tuition', 'visa', 'legalization', 'delivery', 'housing'] as const;

/**
 * The service notes (이용 안내) the V29 document requires the product to state. Short disclosure under the
 * pricing section, full text before checkout. Keys under `common:v29.pricing.notes.<key>`.
 */
export const SERVICE_NOTES = [
  'usd', 'exchange', 'external', 'documentsVary', 'visaDecision', 'agreement', 'premiumScope', 'newDocuments',
] as const;

/* ---------------------------------------------------------------------------------- additional services */

export type AddOnCode =
  | 'EXTRA_MANAGED_APPLICATION' | 'EXTRA_ESSAY_ROUND' | 'MOCK_INTERVIEW'
  | 'DORMITORY_APPLICATION' | 'AIRPORT_PICKUP' | 'SETTLEMENT_SUPPORT';

export type AddOnUnit = 'UNIVERSITY' | 'EDIT_ROUND' | 'SESSION' | 'APPLICATION' | 'ARRANGEMENT' | 'AGREED_SCOPE';

/**
 * How an add-on is priced. **A range is never a charge** (V29 §5): the operator prices each offer inside
 * `[min_minor, max_minor]` and the student sees that exact amount before approving. `QUOTE` has no default at all —
 * the operator writes a price and a scope.
 */
export type AddOnPricing =
  | { kind: 'RANGE'; currency: 'USD'; min_minor: number; max_minor: number }
  | { kind: 'QUOTE'; currency: 'USD' };

/** What a paid add-on does: raise one counted allowance, or open a real service case for the team. */
export type AddOnEffect =
  | { kind: 'ENTITLEMENT'; key: CountedEntitlement }
  | { kind: 'SERVICE_CASE'; case_type: string };

export interface AddOnDef {
  code: AddOnCode;
  slug: string;
  sort_order: number;
  unit: AddOnUnit;
  pricing: AddOnPricing;
  effect: AddOnEffect;
  /** Most units one offer may carry. */
  max_quantity: number;
  /** The offer must state the agreed scope in words (quote-based services). */
  requires_scope: boolean;
  /** Arranged through a third-party provider; Hangyul does not operate it. */
  referral: boolean;
}

export const ADD_ONS: readonly AddOnDef[] = [
  { code: 'EXTRA_MANAGED_APPLICATION', slug: 'extra_application', sort_order: 0, unit: 'UNIVERSITY',
    pricing: { kind: 'RANGE', currency: 'USD', min_minor: 3_000, max_minor: 5_000 },
    effect: { kind: 'ENTITLEMENT', key: 'max_managed_applications' }, max_quantity: 5, requires_scope: false, referral: false },
  { code: 'EXTRA_ESSAY_ROUND', slug: 'extra_edit', sort_order: 1, unit: 'EDIT_ROUND',
    pricing: { kind: 'RANGE', currency: 'USD', min_minor: 2_000, max_minor: 3_500 },
    effect: { kind: 'ENTITLEMENT', key: 'essay_review_rounds' }, max_quantity: 5, requires_scope: false, referral: false },
  { code: 'MOCK_INTERVIEW', slug: 'mock_interview', sort_order: 2, unit: 'SESSION',
    pricing: { kind: 'RANGE', currency: 'USD', min_minor: 5_000, max_minor: 7_000 },
    effect: { kind: 'ENTITLEMENT', key: 'mock_interviews' }, max_quantity: 3, requires_scope: false, referral: false },
  { code: 'DORMITORY_APPLICATION', slug: 'dormitory', sort_order: 3, unit: 'APPLICATION',
    pricing: { kind: 'RANGE', currency: 'USD', min_minor: 5_000, max_minor: 8_000 },
    effect: { kind: 'SERVICE_CASE', case_type: 'DORMITORY' }, max_quantity: 2, requires_scope: false, referral: false },
  { code: 'AIRPORT_PICKUP', slug: 'airport_pickup', sort_order: 4, unit: 'ARRANGEMENT',
    pricing: { kind: 'QUOTE', currency: 'USD' },
    effect: { kind: 'SERVICE_CASE', case_type: 'AIRPORT_PICKUP' }, max_quantity: 1, requires_scope: true, referral: true },
  { code: 'SETTLEMENT_SUPPORT', slug: 'settlement', sort_order: 5, unit: 'AGREED_SCOPE',
    pricing: { kind: 'QUOTE', currency: 'USD' },
    effect: { kind: 'SERVICE_CASE', case_type: 'ARRIVAL_SUPPORT' }, max_quantity: 1, requires_scope: true, referral: false },
];

export const ADD_ON_BY_CODE: Record<AddOnCode, AddOnDef> = Object.fromEntries(ADD_ONS.map((a) => [a.code, a])) as Record<AddOnCode, AddOnDef>;

/** The add-on that raises a counted allowance, if any — how a refusal becomes an offer. */
export function addOnFor(key: string): AddOnDef | null {
  return ADD_ONS.find((a) => a.effect.kind === 'ENTITLEMENT' && a.effect.key === key) ?? null;
}

/**
 * Whether an amount is a legitimate price for one unit of this add-on: inside the range, or any positive amount
 * for a quote. The server applies the same rule (`app/services/addons.py`).
 */
export function addOnPriceAllowed(def: AddOnDef, unit_minor: number): boolean {
  if (!Number.isInteger(unit_minor) || unit_minor <= 0) return false;
  return def.pricing.kind === 'QUOTE' || (unit_minor >= def.pricing.min_minor && unit_minor <= def.pricing.max_minor);
}

/* --------------------------------------------------------------- the plan as a reader sees it (V21 b) */

/**
 * **One plan presentation, and both products render it.**
 *
 * The manifest above has always been the single source of truth for what a plan *costs* and what it
 * *entitles* a student to. What it did not define was the **approved sales copy** — the one-line description
 * and the five benefit lines — and so two surfaces grew their own:
 *
 *   the homepage        read `marketing:v15.pricing.<slug>.{position,f1…f5}` — the approved content;
 *   `/services`         built a list of **two to four** lines by interpolating entitlement numbers into
 *                       student-namespace labels (`상담 30분`, `추천 대학 최대 3곳`).
 *
 * Nothing was out of date; the two were simply different texts, and the student's was shorter. A buyer who
 * read the homepage and then signed in was shown *less* of what they were about to pay for — 입학 조건·학비·
 * 일정 비교, 기본 입학 서류 체크 and 국적별 비자 준비 절차 안내 never appeared on the paying screen at all.
 *
 * So the key space is declared here, once, as part of the plan definition. `planText` resolves it with
 * whatever `t` the calling app has. There is deliberately **no** `marketingBenefits` / `studentBenefits`
 * pair: the only way to show a different list on one surface is to delete a key from this file, which is a
 * change to the plan rather than a change to a component.
 *
 * The strings live in the `common` namespace (V29), which every web app and the native apps load — the agency
 * console and the student app read the same text the homepage does. V29 also moved them from `v15.pricing` to `v29.pricing`: the
 * contract changed, and keeping the old keys would have let 34 locales go on printing the V15 promise
 * ("1회 첨삭", "상담 30분") until each was re-translated. The keys are namespace-qualified — the student app loads `marketing` (see
 * `apps/student-web/src/main.tsx`) precisely so the paying screen can read the approved copy rather than
 * paraphrase it.
 */
export const PLAN_COPY = { ns: 'common', prefix: 'v29.pricing' } as const;

export interface PlanPresentation {
  code: PlanCode;
  slug: string;
  recommended: boolean;
  currency: PlanDef['currency'];
  /** Minor units — cents. The price is the manifest's; nothing downstream holds a number. */
  amount_minor: number;
  /** Namespace-qualified i18n keys, resolvable by any app that has the `marketing` bundle loaded. */
  name_key: string;
  description_key: string;
  benefit_keys: readonly string[];
}

const copyKey = (slug: string, leaf: string) => `${PLAN_COPY.ns}:${PLAN_COPY.prefix}.${slug}.${leaf}`;

export function planPresentation(plan: PlanDef): PlanPresentation {
  return {
    code: plan.code,
    slug: plan.slug,
    recommended: plan.recommended,
    currency: plan.currency,
    amount_minor: plan.amount_minor,
    name_key: copyKey(plan.slug, 'name'),
    // `position` is the key the approved description has always lived under; renaming it would have made
    // this change a 57-file translation edit for no reader's benefit.
    description_key: copyKey(plan.slug, 'position'),
    benefit_keys: plan.highlights.map((h) => copyKey(plan.slug, h)),
  };
}

/** The three plans, in the owner's order, as every surface presents them. */
export const PLAN_PRESENTATION: readonly PlanPresentation[] = PLANS.map(planPresentation);

export function planPresentationByCode(code: string): PlanPresentation | null {
  return PLAN_PRESENTATION.find((p) => p.code === code) ?? null;
}

export interface PlanText { name: string; description: string; benefits: string[] }

/** The plan's approved copy in the reader's language. One function, so no surface can resolve a subset. */
export function planText(t: (key: string) => string, p: PlanPresentation): PlanText {
  return { name: t(p.name_key), description: t(p.description_key), benefits: p.benefit_keys.map((k) => t(k)) };
}
