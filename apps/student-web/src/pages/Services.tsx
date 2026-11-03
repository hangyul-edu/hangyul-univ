/**
 * Service plans — what I bought, what it covers, what is left (V15, REPORT §117 and §122).
 *
 * What this replaced, and why. V3's page was a 6×3 matrix of "who does this part" — strategy, documents,
 * writing, submission, visa, arrival — with each cell inferred by `whoDoes()` from the product's marketing
 * feature strings. It was a reasonable answer to a question the business no longer asks. The new plans are
 * defined by *quantities* (V29: 최대 2곳 지원 관리, 첨삭 최대 2회, 1일·3일·계약 기간 상담 지원). An inference over strings cannot tell a
 * student how many review rounds they have left, which is the only question this screen is now for.
 *
 * So the page has two states and they are not the same screen:
 *
 *   **bought** →  the plan, the allowances as `used / limit`, any extra the counselor has offered, the
 *                 other plans only as a quiet way to change, and a compact payment history;
 *   **not yet** → **the order first** — the chosen plan, its price, 1회 결제, and 결제하고 시작하기 — then
 *                 the three plans as the way to change that choice.
 *
 * V16 made the second state answer "do I pay now?" (REPORT §136). Before it, the primary action said
 * 올인원 선택, the word 결제 did not appear until a modal had already been opened, and the modal's first
 * element was a warning that the payment was not real. The modal is gone, the word is on the button, and
 * the payment is a real Toss test transaction.
 *
 * Nothing here holds a price of its own: the numbers come from `/me/services`, which serves what the seed
 * wrote from `shared/plans.json`, which is generated from `packages/types/src/plans.ts`. Nothing here
 * decides that a payment succeeded either — see `lib/toss.ts` and `/me/payments/toss/confirm`.
 */
import { useApi } from '@hangyul/auth';
import { BadgeCheck, Check, CreditCard } from '@hangyul/icons';
import {
  ADD_ONS, ADD_ON_BY_CODE, COMPARE_GROUPS, COMPARE_ROWS, PLAN_BY_CODE, SERVICE_NOTES, addOnFor, compareCell, planPresentationByCode, planText, upgradeOffer,
  type AddOnCode, type AddOnDef, type EntitlementUse, type OrderRow, type PlanCode, type ServiceAddOn, type ServiceNowLine, type ServiceProduct, type StudentPlan,
} from '@hangyul/types';
import { Button, Callout, QueryState, SkeletonCard, useToast } from '@hangyul/ui';
import { formatDate, formatDateTime, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { PageIntro } from '../components/bits';
import { GateNotice } from '../components/Upgrade';
import { rememberAppReturn } from '../lib/apphandoff';
import { tr, useT } from '../lib/i18n';
import { readPlanParam } from '../lib/quick';
import { openTossCheckout } from '../lib/toss';
import { CardForm, type CardValue } from '../components/CardForm';

const MARKETING_URL = (import.meta.env.VITE_MARKETING_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3100' : '');
/** The purchase-terms version the summary renders; the API refuses a stale one (REPORT §245 L5). */
const PURCHASE_TERMS_VERSION = '2026-10-30';
import { SavedCards } from '../components/SavedCards';

/**
 * Everything that changes the moment an order is paid. `services` carries the plan itself and is what the route
 * paywall reads (`lib/queries.ts` → `useMyPlan`), so it is invalidated and awaited before the app navigates.
 */
const PAID_STATE_QUERY_KEYS = ['services', 'plan', 'dashboard', 'profile', 'tasks', 'applications', 'conversations', 'notifications'] as const;

const planName = (t: (k: string, o?: Record<string, unknown>) => string, p: Pick<ServiceProduct, 'code' | 'name_en'>) =>
  tr(t, `services.${p.code}.name`, p.name_en);

function Price({ p }: { p: ServiceProduct }) {
  const { t, locale } = useT();
  if (!p.price) return null;
  return (
    <div className="st-price">
      {/* `gap` keeps ₩'s crossbars off the digits; `symbolOnly` is V20 §2 — a headline price shows the
          symbol, not `US$`. The order block and the payment history below keep the full currency, because
          there the reader is checking what they were charged. */}
      <strong className="hg-num">{formatMoney(p.price.amount_minor, p.price.currency, locale, { minor: true, gap: true, symbolOnly: true })}</strong>
      <span className="hg-subtle hg-xs">{t('services.oneTime')}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ the plan a student already bought */

/** One allowance row: what it is, how much is left, and whether an add-on raised the limit. */
function Allowance({ u }: { u: EntitlementUse }) {
  const { t } = useT();
  const K = 'v15.services.allowance';
  const label = t(`${K}.key.${u.key}`);
  const places = u.key === 'max_managed_applications' || u.key === 'max_recommended_institutions';
  let right: string;
  // V29: `null` is bounded by its scope — Premium editing by the contracted documents, follow-up by the team.
  if (u.limit === null) right = t(`v29.services.unrationed.${u.scope ?? 'TEAM'}`, { defaultValue: t(`${K}.unlimited`) });
  else if (u.limit === 0) right = t(`${K}.none`);
  else if (u.remaining === 0) right = t(`${K}.exhausted`);
  else right = t(places ? `${K}.placesRemaining` : `${K}.remaining`, { count: u.remaining ?? 0 });
  return (
    <div className="sv15-allow" data-exhausted={u.limit !== null && u.limit > 0 && u.remaining === 0 ? '' : undefined}>
      <span className="sv15-allow__k">{label}</span>
      <span className="sv15-allow__v">
        {u.limit !== null && u.limit > 0 && <span className="hg-num sv15-allow__n">{t(`${K}.used`, { used: u.used, limit: u.limit })}</span>}
        <span className="sv15-allow__state">{right}</span>
        {u.from_add_ons > 0 && <span className="hg-subtle hg-xs">{t(`${K}.addedByAddOn`, { count: u.from_add_ons })}</span>}
      </span>
    </div>
  );
}

/**
 * What the contract includes, row by row — V29: the same `compareCell` the homepage comparison uses, applied to
 * **this student's snapshot** (the plan as sold), so the two can never describe a plan differently. A contract bought
 * under an earlier catalogue keeps its own terms; it is named as such rather than redrawn in today's rows.
 */
function Scope({ plan }: { plan: StudentPlan }) {
  const { t } = useT();
  const def = PLAN_BY_CODE[plan.code as PlanCode];
  if (!def || !('support_window_type' in (plan.entitlements as object))) {
    return <p className="hg-small hg-muted sv15-scope">{t('v29.services.legacyContract', { version: plan.catalog_version ?? '' })}</p>;
  }
  const mine = { ...def, entitlements: plan.entitlements };
  return (
    <div className="sv15-scope">
      <h3 className="hg-title-sm">{t('v15.services.scope.title')}</h3>
      {COMPARE_GROUPS.map((g) => (
        <dl key={g} className="sv15-scope__list">
          {COMPARE_ROWS.filter((r) => r.group === g).map((r) => {
            const c = compareCell(r, mine);
            return <div key={r.key} data-cell={c.kind}><dt>{t(`common:v29.pricing.compare.row.${r.key}`)}</dt><dd>{t(c.key, c.params)}</dd></div>;
          })}
        </dl>
      ))}
      {plan.entitlements.essay_review_scope === 'CONTRACTED_DOCUMENTS' && <p className="hg-subtle hg-xs">{t('common:v29.pricing.compare.scopeNote')}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------------ the service term (V29) */

/**
 * When the service runs: started on, the support window (1 or 3 days, or the contracted term) and — for Premium — the
 * arrival window (pre-arrival from D-30, settlement to D+30). Dates that the contract leaves to be agreed say so.
 */
function ServiceTerm({ plan }: { plan: StudentPlan }) {
  const { t, locale } = useT();
  const e = plan.engagement;
  if (!e) return null;
  const T = 'v29.services.term';
  const ent = plan.entitlements;
  const rows: { k: string; v: string }[] = [];
  rows.push({ k: t(`${T}.started`), v: e.service_started_at ? formatDate(e.service_started_at, locale) : t(`${T}.notStarted`) });
  if (ent.support_window_type === 'DAYS') {
    rows.push({ k: t(`${T}.support`), v: e.support_window_ends_at
      ? (e.support_days_left ? t(`${T}.supportLeft`, { count: e.support_days_left, date: formatDate(e.support_window_ends_at, locale) })
        : t(`${T}.supportEnded`, { date: formatDate(e.support_window_ends_at, locale) }))
      : t(`${T}.supportFromStart`, { count: ent.support_window_days ?? 0 }) });
  } else if (ent.support_window_type === 'CONTRACT_TERM') {
    rows.push({ k: t(`${T}.term`), v: e.service_ends_at ? t(`${T}.termUntil`, { date: formatDate(e.service_ends_at, locale) }) : t(`${T}.termToAgree`) });
  }
  if ((ent.pre_arrival_support_days ?? 0) > 0) {
    rows.push({ k: t(`${T}.arrival`), v: e.arrival_at
      ? t(`${T}.arrivalWindow`, { from: formatDate(e.pre_arrival_starts_at!, locale), arrive: formatDate(e.arrival_at, locale), until: formatDate(e.settlement_ends_at!, locale) })
      : t(`${T}.arrivalToConfirm`) });
  }
  return (
    <dl className="sv29-term" aria-label={t(`${T}.title`)}>
      {rows.map((r) => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}
      {e.term_ended && <div data-ended=""><dt>{t(`${T}.status`)}</dt><dd>{t(`${T}.ended`)}</dd></div>}
    </dl>
  );
}

/** The catalogue entry behind an add-on row; V15–V28 rows were coded by entitlement key (`ADDON_<KEY>`). */
const defOf = (a: ServiceAddOn): AddOnDef | null =>
  ADD_ON_BY_CODE[a.code as AddOnCode] ?? (a.entitlement_key ? addOnFor(a.entitlement_key) : null);

/**
 * Additional services the team proposed (V29 §19).
 *
 * The student sees the service, its unit and quantity, the agreed scope in the team's words, and the **exact** amount —
 * never a range — before deciding. Approving creates the order to pay; nothing is switched on until it is paid. Declining
 * is a one-click terminal answer that costs nothing, and the decline control is as prominent as the approve one.
 */
function AddOns({ items, onDecide, onPay, pending, cardMode }: {
  items: ServiceAddOn[]; pending: string | null; cardMode: boolean;
  onDecide: (id: string, approve: boolean) => void;
  onPay: (a: ServiceAddOn, card?: CardValue) => void;
}) {
  const { t, locale } = useT();
  const A = 'v29.services.addOn';
  const [paying, setPaying] = useState<string | null>(null);
  const shown = items.filter((a) => a.status !== 'CANCELLED');
  if (shown.length === 0) return null;
  const name = (a: ServiceAddOn) => { const d = defOf(a); return d ? t(`common:v29.addon.item.${d.slug}`) : a.code; };
  const unit = (a: ServiceAddOn) => { const d = defOf(a); return d ? t(`common:v29.addon.unit.${d.unit}`) : ''; };
  const money = (a: ServiceAddOn) => (a.amount_minor ? formatMoney(a.amount_minor, a.currency ?? 'USD', locale, { minor: true, gap: true }) : '—');
  return (
    <section className="hg-panel sv15-addons" id="addons" aria-labelledby="sv15-addons-h">
      <h3 className="hg-title-sm" id="sv15-addons-h">{t(`${A}.title`)}</h3>
      <ul className="sv15-addons__list">
        {shown.map((a) => (
          <li key={a.id} data-status={a.status}>
            <div className="sv15-addons__what">
              <span className="hg-strong">{name(a)}</span>
              <span className="hg-subtle hg-small">{t(`${A}.qty`, { unit: unit(a), count: a.quantity })} · <span className="hg-num">{money(a)}</span></span>
              {a.scope && <p className="hg-small hg-muted" data-user-content="">{a.scope}</p>}
              {a.status !== 'OFFERED' && a.status !== 'AWAITING_PAYMENT' && <span className="hg-subtle hg-xs">{t(`${A}.status.${a.status}`)}</span>}
            </div>
            {a.status === 'OFFERED' && (
              <div className="sv15-addons__act">
                <Button variant="primary" size="sm" loading={pending === a.id} onClick={() => onDecide(a.id, true)}>{t(`${A}.approve`, { amount: money(a) })}</Button>
                <Button variant="secondary" size="sm" disabled={pending === a.id} onClick={() => onDecide(a.id, false)}>{t(`${A}.decline`)}</Button>
              </div>
            )}
            {a.status === 'AWAITING_PAYMENT' && (
              <div className="sv15-addons__pay">
                <p className="hg-small">{t(`${A}.awaiting`)}</p>
                {cardMode && paying === a.id
                  ? <CardForm amount={money(a)} busy={pending === a.id} error={null} onSubmit={(card) => onPay(a, card)} />
                  : <Button variant="primary" size="sm" loading={pending === a.id}
                      onClick={() => (cardMode ? setPaying(a.id) : onPay(a))}>{t(`${A}.pay`, { amount: money(a) })}</Button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {shown.some((a) => a.status === 'OFFERED') && <p className="hg-subtle hg-xs">{t(`${A}.noPressure`)}</p>}
    </section>
  );
}

/**
 * What else can be added, and how it is priced — the catalogue, read-only. A student asks the team; the team proposes an
 * exact scope and amount, which then appears above. Nothing here can be bought with one click, by design: a range is not
 * a price.
 */
function AddOnCatalogue({ plan }: { plan: StudentPlan }) {
  const { t, locale } = useT();
  const premiumEditing = plan.entitlements.essay_review_scope === 'CONTRACTED_DOCUMENTS';
  const price = (a: AddOnDef) => a.pricing.kind === 'QUOTE' ? t('common:v29.addon.quote')
    : t('common:v29.addon.range', {
      min: formatMoney(a.pricing.min_minor, 'USD', locale, { minor: true, symbolOnly: true }),
      max: formatMoney(a.pricing.max_minor, 'USD', locale, { minor: true, symbolOnly: true }) });
  return (
    <details className="sv29-catalogue">
      <summary>{t('v29.services.catalogue.title')}</summary>
      <p className="hg-small hg-muted">{t('common:v29.pricing.addons.lede')}</p>
      <ul>
        {ADD_ONS.map((a) => (
          <li key={a.code}>
            <span>{t(`common:v29.addon.item.${a.slug}`)}</span>
            <span className="hg-subtle hg-small">{t(`common:v29.addon.unit.${a.unit}`)}</span>
            <span className="hg-num">{price(a)}</span>
            {a.code === 'EXTRA_ESSAY_ROUND' && premiumEditing && <span className="hg-subtle hg-xs">{t('v29.services.catalogue.premiumEditing')}</span>}
            {a.code === 'MOCK_INTERVIEW' && plan.entitlements.mock_interviews > 0 && <span className="hg-subtle hg-xs">{t('common:v29.addon.premiumMock')}</span>}
          </li>
        ))}
      </ul>
      <Link to="/messages?compose=addon" className="hg-link">{t('v29.services.catalogue.ask')}</Link>
    </details>
  );
}

/**
 * Moving up a plan (V29 §18). What changes is computed from the two plans' comparison cells; **the price is not**,
 * because the owner has not defined upgrade pricing — the server refuses an upgrade order (`UPGRADE_POLICY_REQUIRED`)
 * and this says so plainly, with the one useful next step: ask the team.
 */
function UpgradePanel({ from, to }: { from: PlanCode; to: PlanCode }) {
  const { t } = useT();
  const o = upgradeOffer(from, to);
  if (!o) return null;
  const U = 'v29.services.upgrade';
  return (
    <section className="hg-panel sv29-upgrade" aria-labelledby="sv29-upgrade-h">
      <h2 className="hg-title-sm" id="sv29-upgrade-h">{t(`${U}.title`, { from: t(`common:v29.pricing.${PLAN_BY_CODE[from].slug}.name`), to: t(`common:v29.pricing.${PLAN_BY_CODE[to].slug}.name`) })}</h2>
      <dl className="sv15-scope__list">
        {COMPARE_ROWS.filter((r) => o.gains.includes(r.key)).map((r) => {
          const a = compareCell(r, PLAN_BY_CODE[from]);
          const b = compareCell(r, PLAN_BY_CODE[to]);
          return <div key={r.key}><dt>{t(`common:v29.pricing.compare.row.${r.key}`)}</dt><dd>{t(a.key, a.params)} → <strong>{t(b.key, b.params)}</strong></dd></div>;
        })}
      </dl>
      <p className="hg-small">{t(`${U}.used`)}</p>
      <Callout tone="info">{t(`${U}.pricePending`)}</Callout>
      <Link to={`/messages?compose=upgrade:${to.toLowerCase()}`} className="hg-btn hg-btn--primary sv29-upgrade__ask">{t(`${U}.ask`)}</Link>
    </section>
  );
}

function CurrentPlan({ plan, now, cardMode }: { plan: StudentPlan; now: ServiceNowLine[]; cardMode: boolean }) {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const refresh = () => { PAID_STATE_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setPending(null); };
  const fail = (e: unknown) => { toast.error(t('v29.services.addOn.failed')); setPending(null); void e; };
  const m = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.me.decideAddOn(id, approve),
    onSuccess: refresh, onError: fail,
  });
  // V29: an add-on is paid through the same order state machine as a plan (card key-in on the foreign-card merchant).
  const pay = useMutation({
    mutationFn: async ({ a, card }: { a: ServiceAddOn; card?: CardValue }) => {
      if (!a.order_id) throw new Error('no_order');
      if (!card) throw new Error('card_required');
      return api.me.payOrderWithCard(a.order_id, { number: card.number, expiry_month: card.expiry_month, expiry_year: card.expiry_year, holder_name: card.holder_name || null });
    },
    onSuccess: refresh, onError: fail,
  });
  return (
    <section className="hg-panel sv15-current" aria-labelledby="sv15-current-h">
      <header className="sv15-current__head">
        <div>
          <p className="hg-subtle hg-xs">{t('v15.services.current')}</p>
          <h2 className="hg-title" id="sv15-current-h">{locale === 'ko' ? plan.name_ko : plan.name_en}</h2>
          {plan.purchased_at && <p className="hg-subtle hg-xs">{t('v15.services.purchasedOn', { date: formatDate(plan.purchased_at, locale) })}</p>}
        </div>
        <strong className="hg-num sv15-current__price">{formatMoney(plan.amount_minor, plan.currency, locale, { minor: true, gap: true, symbolOnly: true })}</strong>
      </header>
      {/* V29: the term before the work — when support started and how long it runs. */}
      <ServiceTerm plan={plan} />
      {/* V26: the work first; the full scope of the plan one tap away (progressive disclosure). */}
      <NowLines lines={now} />
      <details className="sv26-scope" open={now.length === 0}>
        <summary>{t('v26.now.scopeToggle')}</summary>
      <div className="sv15-current__cols">
        <div>
          <h3 className="hg-title-sm">{t('v15.services.allowance.title')}</h3>
          <div className="sv15-allows">
            {/* Only the allowances this plan actually rations. Printing "모의 면접 0 / 0" on a Basic case is
                noise the student cannot act on; what Basic does include is in the scope list beside it. */}
            {plan.usage.filter((u) => u.limit === null || u.limit > 0).map((u) => <Allowance key={u.key} u={u} />)}
          </div>
        </div>
        <Scope plan={plan} />
      </div>
      </details>
      <AddOns items={plan.add_ons} pending={pending} cardMode={cardMode}
        onDecide={(id, approve) => { setPending(id); m.mutate({ id, approve }); }}
        onPay={(a, card) => { setPending(a.id); pay.mutate({ a, card }); }} />
      <AddOnCatalogue plan={plan} />
    </section>
  );
}

/* ------------------------------------------------------------------- what the plan is doing right now (V26) */

/**
 * "지금 진행 중" — one row per included service: what it covers *for me* (which applications, which essays), where it
 * stands, who acts next, and when (REPORT §334 S3). Before V26 this page answered "how much is left" ("2 / 2 사용 ·
 * 모두 사용했습니다") but not "which two", "what is the team doing" or "what do I do now".
 */
function NowLines({ lines }: { lines: ServiceNowLine[] }) {
  const { t, locale } = useT();
  const N = 'v26.now';
  if (!lines.length) return null;
  const label = (l: ServiceNowLine) => (['max_managed_applications', 'essay_review_rounds', 'max_recommended_institutions'].includes(l.key)
    ? t(`v15.services.allowance.key.${l.key}`)
    // V29: the consultation line is the support window, not "consultation time" (the retired minutes semantics).
    : l.key === 'consultation' ? t('common:v29.pricing.compare.row.support') : t(`v15.services.scope.${l.key}`));
  // V29: institutions arrive as an id and both names; the UI language picks (V28 localName rule).
  const ko = locale.startsWith('ko');
  const itemLabel = (it: ServiceNowLine['items'][number]) => (ko && it.name_ko ? it.name_ko : it.label);
  const itemSub = (it: ServiceNowLine['items'][number]) => (ko && it.sub_ko ? it.sub_ko : it.sub);
  const nextUniversity = (l: ServiceNowLine) => (l.next?.names ? (ko && l.next.names.name_ko ? l.next.names.name_ko : l.next.names.name_en) : undefined);
  const status = (l: ServiceNowLine, s: string | null) => (!s ? null
    : l.key === 'max_managed_applications' ? t(`common:appStatus.${s}`)
      : l.key === 'essay_review_rounds' ? t(`common:essayStatus.${s}`)
        : l.key === 'visa_support' ? t(`common:visaStatus.${s}`, { defaultValue: s }) : null);
  return (
    <section className="sv26-now" aria-labelledby="sv26-now-h">
      <h2 className="hg-title-sm" id="sv26-now-h">{t(`${N}.title`)}</h2>
      <ul className="sv26-now__list">
        {lines.map((l) => (
          <li key={l.key} className="sv26-now__row" data-state={l.state}>
            <div className="sv26-now__what">
              <span className="sv26-now__name">{label(l)}</span>
              <span className="sv26-now__state">{t(`${N}.state.${l.state}`)} · {t(`${N}.owner.${l.owner}`)}</span>
              {l.usage && l.usage.limit !== null && l.usage.limit > 0 && (
                <span className="sv26-now__usage hg-num">{t('v15.services.allowance.used', { used: l.usage.used, limit: l.usage.limit })}</span>
              )}
            </div>
            <div className="sv26-now__items">
              {l.items.map((it) => (
                <Link key={it.link} to={it.link} className="sv26-now__item" data-counted={it.counted === false ? 'no' : undefined}>
                  <span className="sv26-now__label" data-user-content={it.user_content ? "" : undefined}>{l.key === 'consultation' ? t(`${N}.kind.${it.label}`, { defaultValue: t(`${N}.kind.CONSULTATION`) }) : itemLabel(it)}{it.sub && l.key !== 'essay_review_rounds' && l.key !== 'consultation' ? <span className="hg-subtle"> · {itemSub(it)}</span> : null}</span>
                  <span className="sv26-now__status hg-subtle">
                    {l.key === 'consultation' && l.when ? t(`${N}.consultationAt`, { when: formatDateTime(l.when, locale) }) : status(l, it.status)}
                    {it.counted === false ? ` · ${t(`${N}.notCounted`)}` : ''}
                  </span>
                </Link>
              ))}
              {l.counts && <p className="sv26-now__counts hg-small">{t(`${N}.docCounts`, { review: l.counts.review, fix: l.counts.fix, verified: l.counts.verified })}</p>}
              {!l.items.length && !l.counts && <p className="hg-small hg-subtle">{t(`${N}.empty.${l.key}`, { defaultValue: t(`${N}.empty.${l.state}`) })}</p>}
            </div>
            <div className="sv26-now__next">
              {l.next && <Link to={l.next.link} className="sv26-now__go">{t(`${N}.next.${l.next.code}`, { ...l.next.params, university: nextUniversity(l), category: l.next.params?.category ? t(`common:docCategory.${l.next.params.category}`) : '' })} <span aria-hidden>→</span></Link>}
              {l.when && l.key !== 'consultation' && <span className="hg-subtle hg-xs">{t(`${N}.by`, { date: formatDate(l.when, locale) })}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------------------- choosing a plan, and paying */

/**
 * **The order, on the page.** There is no checkout modal any more (brief Part 22, REPORT §136).
 *
 * The modal it replaced held a price the page already showed, a feature list the card already showed, and a
 * yellow "this is a demo" warning — a confirmation surface that repeated the page it was opened from and
 * then told the reader the transaction was not real. A surface has to earn its existence; this one did not.
 *
 * What is here instead answers, in order, the five questions a student actually has at this moment:
 * what did I choose, how much is it, is it one payment or a subscription, what is not included, and what
 * happens the second I pay. The amount is on the button because the button is the last thing read.
 */
/**
 * The order, and the card (V21).
 *
 * Until V21 this block ended at a button that opened the provider's window. The merchant
 * configuration the owner contracted takes the card **here** (REPORT §229.3, §236), so the form is
 * Hangyul's and the student never leaves: one section, one price, one action that both registers
 * the card and pays — which is what §35 asks for and what the API actually does in one call.
 */
export function OrderBlock({ p, busy, error, onPay, cardMode, benefits }: {
  p: ServiceProduct; busy: boolean; error: string | null;
  onPay: (card?: CardValue) => void; cardMode: boolean;
  /** V22: the plan's approved benefit lines, shown once more where the money is (REPORT §245 L5). */
  benefits?: string[];
}) {
  const { t, locale } = useT();
  const amount = p.price ? formatMoney(p.price.amount_minor, p.price.currency, locale, { minor: true, gap: true, symbolOnly: true }) : '—';
  return (
    <section className="sv16-order" aria-labelledby="sv16-order-h">
      <h2 className="hg-title-sm" id="sv16-order-h">{t('v16.pay.orderTitle')}</h2>
      <div className="sv16-order__line">
        <span className="sv16-order__name">{planName(t, p)}</span>
        <span className="sv16-order__amount">
          <strong className="hg-num">{amount}</strong>
          <span className="hg-subtle hg-xs">{t('services.oneTime')}</span>
        </span>
      </div>
      {/* V22 purchase summary (brief §27): plan · price · one-time · included · service-start condition · refund link.
          A short list and a link, not a legal paragraph; the version shown is recorded with the order. */}
      <dl className="sv22-summary">
        <div><dt>{t('v22.checkout.oneTime')}</dt><dd className="hg-num">{amount}</dd></div>
        {benefits && benefits.length > 0 && <div><dt>{t('v22.checkout.included')}</dt><dd><ul>{benefits.map((b) => <li key={b}>{b}</li>)}</ul></dd></div>}
        <div><dt>{t('v22.checkout.start')}</dt><dd>{t('v22.checkout.startCondition')} <a href={`${MARKETING_URL}/terms?lang=${locale}#refunds`} target="_blank" rel="noreferrer" className="hg-link">{t('v22.checkout.refundLink')}</a></dd></div>
      </dl>
      {/* V29 이용 안내 — stated in full where the money is (brief §12): USD, exchange and card fees, third-party costs,
          documents vary, visa decisions are the authority's, the agreement sets detail, Premium's editing scope. */}
      <ul className="sv29-notes hg-small">
        {SERVICE_NOTES.filter((k) => k !== 'premiumScope' || p.code === 'PREMIUM').map((k) => <li key={k}>{t(`common:v29.pricing.notes.${k}`)}</li>)}
      </ul>
      <p className="hg-subtle hg-xs sv22-summary__agree">{t('v22.checkout.agree')}</p>
      {cardMode ? (
        <CardForm amount={amount} busy={busy} error={error} onSubmit={(card) => onPay(card)} />
      ) : (
        <>
          {error && <Callout tone="danger">{error}</Callout>}
          {/* The amount rides on the button because the button is the last thing read before the
              decision. A price that lives only in a row above it is a price the eye has already left. */}
          <Button variant="primary" size="lg" icon={<CreditCard />} loading={busy} onClick={() => onPay()} className="sv16-order__pay">
            {t('v16.pay.cta')}<span className="sv16-order__sum hg-num" aria-hidden>{amount}</span>
          </Button>
          <p className="hg-subtle hg-xs sv16-order__after">{t('v17.pay.afterPay')}</p>
        </>
      )}
    </section>
  );
}

export function PlanCard({ p, owned, preselected, selected, hasPlan, onBuy }: {
  p: ServiceProduct; owned: boolean; preselected: boolean; selected: boolean; hasPlan: boolean; onBuy: () => void;
}) {
  const { t } = useT();
  const name = planName(t, p);
  /**
   * **The approved plan content, not a paraphrase of it** (V21 b, REPORT §243).
   *
   * This used to build two to four lines by interpolating entitlement numbers into student-namespace
   * labels — 상담 30분, 추천 대학 최대 3곳 — which is a *different text* from the one the homepage shows,
   * and a shorter one: three of Basic's five promises never reached the screen where it is paid for.
   * There is now one definition of what a plan promises a reader (`@hangyul/types` → `PLAN_PRESENTATION`)
   * and this renders it. The numbers are still the manifest's; they are inside the approved sentences.
   */
  const copy = (() => {
    const pres = planPresentationByCode(p.code);
    return pres ? planText(t, pres) : null;
  })();
  return (
    <section className="sv15-plan" data-recommended={p.recommended || undefined} data-preselected={preselected || undefined}
      data-selected={selected || undefined} aria-labelledby={`plan-${p.code}`}>
      <div className="sv15-plan__head">
        <h3 id={`plan-${p.code}`} className="hg-title-sm">{name}</h3>
        <Price p={p} />
      </div>
      {preselected && !owned && <p className="sv15-plan__chosen hg-xs">{t('v15.services.chosen')}</p>}
      {copy && <p className="sv15-plan__desc hg-small hg-muted">{copy.description}</p>}
      <ul className="st-ticks">{(copy?.benefits ?? []).map((l) => <li key={l}><Check aria-hidden />{l}</li>)}</ul>
      {owned
        ? <span className="sv3-owned"><BadgeCheck aria-hidden /> {t('v15.services.owned')}</span>
        : selected
          ? <p className="sv16-plan__selected hg-xs"><Check aria-hidden /> {t('v16.pay.selected')}</p>
          : <Button variant="secondary" onClick={onBuy}>
              {t(hasPlan ? 'v15.services.upgrade' : 'v15.services.choose', { name })}
            </Button>}
    </section>
  );
}

/* ------------------------------------------------------------------------------------ payment history */

/** Date · plan · amount · status, inside this screen (brief Part 24). Not a destination. */
function History({ rows }: { rows: OrderRow[] }) {
  const { t, locale } = useT();
  if (rows.length === 0) return null;
  return (
    <section className="sv16-history" aria-labelledby="sv16-history-h">
      <h2 className="hg-title-sm" id="sv16-history-h">{t('v16.pay.history')}</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.id} data-status={r.status}>
            <span className="sv16-history__when hg-num">{r.at ? formatDate(r.at, locale) : '—'}</span>
            <span className="sv16-history__what hg-truncate">{r.kind === 'ADD_ON'
              ? t('v29.services.history.addOn')
              : tr(t, `services.${r.product_code}.name`, r.product_name)}</span>
            <span className="sv16-history__amount hg-num">{formatMoney(r.amount_minor, r.currency, locale, { minor: true, gap: true })}</span>
            <span className="sv16-history__status">{t(`v16.pay.status.${r.status}`, { defaultValue: r.status })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ the screen */

export default function Services() {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const q = useQuery({ queryKey: ['services'], queryFn: () => api.me.services() });
  // The plan chosen on the public pricing section, carried here through registration (REPORT §118).
  const chosen = readPlanParam(sp);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A cancelled payment comes back here with `?payment=cancelled`. It is a notice, not an error wall, and
  // the plan the student chose is still chosen — that is the whole point of carrying it in the URL.
  const notice = sp.get('payment');
  // V17: the native app opens this page in the system browser and passes the deep link back to itself.
  // Toss decides where the browser lands after the window closes, so the link is stashed now and offered
  // on the confirmation page (see `lib/apphandoff.ts`). `from=app` is only for the sentence below.
  const fromApp = sp.get('from') === 'app';
  const appReturnHref = sp.get('return');
  useEffect(() => { rememberAppReturn(appReturnHref); }, [appReturnHref]);

  const products = q.data?.products ?? [];
  const owned = q.data?.owned ?? [];
  const plan = q.data?.plan ?? null;
  // What the student is about to buy: whatever they just clicked, else the plan they picked on the public
  // site, else the recommended one. There is always an answer, so the order block is never empty and the
  // page never opens on "choose something first".
  // Did the student actually ask to change plan, or is this just the default recommendation? Only the
  // first may open an order block for someone who already owns a plan — see the note at `OrderBlock`.
  const upgradeIntent = !!picked || !!sp.get('upgrade');
  const selectedCode = picked
    // V17: `?upgrade=all_in_one` arrives from the contextual upgrade sheet and names the plan that has the
    // capability the student was just refused. It wins over the homepage's `?plan=`, because it is the more
    // recent and far more specific intent.
    ?? products.find((x) => sp.get('upgrade') === x.code.toLowerCase())?.code
    ?? products.find((x) => !plan && chosen === x.code.toLowerCase())?.code
    ?? products.find((x) => x.recommended)?.code
    ?? products[0]?.code
    ?? null;
  const selected = products.find((x) => x.code === selectedCode) ?? null;

  /**
   * One payment path, and it is the same one on every surface.
   *
   * Create the order on the server (which prices it), then open the provider's own window. Nothing here
   * decides anything: if the window cannot be opened the order is cancelled so it cannot be left dangling,
   * and if the provider is the development demo provider the server has already completed the order and the
   * answer is simply to refresh the screen.
   */
  /**
   * Does the server take the card itself? V21: on the foreign-card configuration it does, so the
   * student sees Hangyul's form rather than a provider window (REPORT §236). Read from the server
   * rather than from a build flag, because which merchant configuration is live is a server fact.
   */
  const payCfg = useQuery({ queryKey: ['payments-config'], queryFn: () => api.me.paymentsConfig(), staleTime: 5 * 60_000 });
  const cardMode = payCfg.data?.foreign_card?.enabled === true;

  const purchaseTermsVersion = PURCHASE_TERMS_VERSION;
  const pay = async (card?: CardValue) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    let orderId: string | null = null;
    try {
      const r = await api.me.checkout(selected.code, purchaseTermsVersion);
      orderId = r.order_id;
      // V21 — the card path. `card_form` is the server saying "I take the card myself": the digits go
      // straight to Hangyul's API, which charges Toss and returns a paid order. No window opens, so
      // there is nothing to cancel and nothing to come back from.
      if (card && r.card_form) {
        await api.me.payOrderWithCard(orderId, {
          number: card.number, expiry_month: card.expiry_month,
          expiry_year: card.expiry_year, holder_name: card.holder_name || null,
        });
        PAID_STATE_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        setSp((prev) => { const n = new URLSearchParams(prev); n.set('payment', 'done'); return n; }, { replace: true });
        return;
      }
      if (r.checkout) {
        await openTossCheckout(r.checkout, r.customer);
        return; // the browser is leaving for the payment window
      }
      // No provider-hosted window (the development demo provider): the server already completed the order.
      PAID_STATE_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setSp((prev) => { const n = new URLSearchParams(prev); n.set('payment', 'done'); return n; }, { replace: true });
    } catch (e) {
      const err = e as Error & { body?: { detail?: { code?: string; message?: string } } };
      const code = err.body?.detail?.code;
      // V21 — a *declined card* must not cancel the order. The student's plan choice survives so they
      // can try another card on the same order (brief §40); only a failure to open the provider window
      // leaves a dangling order worth cancelling.
      if (orderId && !card) api.me.cancelOrder(orderId).catch(() => undefined);
      // V17: the provider is not contracted for this currency yet (REPORT §152). That is a *status*, not a
      // failure the student caused, and it must not be shown as one — and it must never be "resolved" by
      // quietly creating a won order for a dollar price.
      setError(
        code === 'CURRENCY_NOT_CONTRACTED' ? t('v17.pay.currencyPending')
          : code === 'FOREIGN_BILLING_NOT_READY' ? t('v21.pay.notConfigured')
            : code === 'TOO_MANY_CARD_ATTEMPTS' ? t('v21.pay.tooMany')
              : err.body?.detail?.message ? t('v21.pay.declined', { reason: err.body.detail.message })
                : err.message === 'payment_sdk_unavailable' ? t('v16.pay.sdkDown')
                  // V23: never the raw transport/JS message ("Failed to fetch") — a localized, recoverable line.
                  : t(card ? 'v21.pay.cardFailed' : 'v16.pay.couldNotStart'),
      );
      if (code !== 'CURRENCY_NOT_CONTRACTED') toast.error(t(card ? 'v21.pay.cardFailed' : 'v16.pay.couldNotStart'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-page">
      {/* Two states, two questions. "구매한 플랜에 포함된 범위와 남은 횟수를 확인하고…" is the right sentence
          for someone who has bought and the wrong one for someone deciding whether to. */}
      <PageIntro title={t('v15.services.title')} subtitle={t(plan ? 'v15.services.subtitle' : 'v16.pay.chooseSubtitle')} />
      {/* V17: why they are here. The paywall redirects with `?gate=<route>`; without the sentence a student
          who clicked 지원 현황 and landed on a pricing page has been bounced with no explanation. */}
      <GateNotice gate={sp.get('gate')} />
      {notice === 'cancelled' && <Callout tone="info">{t('v16.pay.cancelled')}</Callout>}
      {/* V17: the student arrived from the native app, in a browser they did not choose to open. Saying so
          is the whole difference between a handoff and the app having thrown them out. */}
      {fromApp && <Callout tone="info">{t('v17.pay.fromApp')}</Callout>}
      <QueryState query={q} skeleton={<SkeletonCard lines={8} />}>
        {(d) => (
          <>
            {d.plan && <CurrentPlan plan={d.plan} now={d.now ?? []} cardMode={cardMode} />}
            {cardMode && <SavedCards />}
            {/* Before a plan is bought the order comes first: the question on this screen is "do I pay now,
                and for what", and the answer should not be below three cards. Once a plan is owned the
                other two are a way to change rather than an offer, so the block is not shown *by default*.
                
                V19: "not by default" is not the same as "never", and the original `!d.plan` meant never.
                Every upgrade button on this page calls `setPicked`, and `?upgrade=<plan>` — the deep link
                the contextual upgrade sheet uses when a student is refused a capability — sets the same
                selection. With a plan owned there was no order block for either of them to reveal, so
                "프리미엄으로 변경" set some state, scrolled to a top the reader was already at, and did
                nothing else. For ever. No error, no console message, nothing: the entire upgrade path was
                unreachable for exactly the people who had already paid once. The V19 click-map found it
                (REPORT §208).
                
                The condition is a *deliberate* change, not merely a selection: `selectedCode` falls back to
                the recommended plan when nothing is chosen, so keying off `selected` alone would open every
                owner's page on an unasked-for order block. */}
            {/* V29: with a plan owned, moving up is a conversation — the upgrade price is an owner decision not yet taken,
                and the server refuses an upgrade order. The panel shows exactly what would change. */}
            {d.plan && upgradeIntent && selected && selected.code !== d.plan.code && (
              <UpgradePanel from={d.plan.code} to={selected.code as PlanCode} />
            )}
            {!d.plan && selected
              && (
                <OrderBlock
                  p={selected} busy={busy} error={error} onPay={pay} cardMode={cardMode}
                  benefits={(() => { const pres = planPresentationByCode(selected.code); return pres ? planText(t, pres).benefits : []; })()}
                />
              )}
            {d.plan && !upgradeIntent ? (
              <details className="sv26-otherplans">
                <summary>{t('v26.now.otherPlans')}</summary>
                <div className="sv15-plans" data-owned="">
                  {d.products.map((p) => (
                    <PlanCard key={p.code} p={p} owned={owned.includes(p.code)} preselected={false} selected={false} hasPlan
                      onBuy={() => { setPicked(p.code); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                  ))}
                </div>
              </details>
            ) : (
            <div className="sv15-plans" data-owned={d.plan ? '' : undefined}>
              {d.products.map((p) => (
                <PlanCard
                  key={p.code}
                  p={p}
                  owned={owned.includes(p.code)}
                  preselected={!d.plan && chosen === p.code.toLowerCase()}
                  selected={!d.plan && p.code === selectedCode}
                  hasPlan={!!d.plan}
                  onBuy={() => { setPicked(p.code); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
              ))}
            </div>
            )}
            <p className="hg-subtle hg-xs sv15-external">{t('v15.services.external')}</p>
            <History rows={d.history ?? []} />
          </>
        )}
      </QueryState>
    </div>
  );
}
