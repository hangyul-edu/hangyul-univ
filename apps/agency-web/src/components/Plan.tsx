/**
 * The purchased plan, as the Agency Console shows it (V15, REPORT §119).
 *
 * The fourth of the counselor's four questions — *what service have we promised this student?* — had no
 * answer anywhere in the console before V15. The consequences at 200 cases were operational, not cosmetic:
 * a counselor could spend a review round that did not exist, or promise a dormitory application on a Basic
 * plan.
 *
 * It is answered in three places and, per brief Part 27, all three are **metadata on something that already
 * exists** rather than a new card, tab or nav item:
 *
 *   `PlanMark`   one token on the Today row and in the case strip;
 *   `PlanScope`  a compact panel inside the student workspace Overview — only the rationed allowances;
 *   `OutOfScope` what the counselor sees when an action exceeds the plan.
 */
import { useAuth } from '@hangyul/auth';
import type { AddOnCode, CountedEntitlement, EntitlementUse, PlanCode, StudentPlan } from '@hangyul/types';
import { ADD_ONS, ADD_ON_BY_CODE, addOnFor, addOnPriceAllowed } from '@hangyul/types';
import { Button, Popover, Select, useToast } from '@hangyul/ui';
import { cx, formatDate, formatMoney, formatNumber } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useT } from './bits';

/** Short label for a plan code, in the reader's language. */
export function usePlanLabel() {
  const { t } = useT();
  return (code: PlanCode | null | undefined) => (code ? t(`v15.plan.${code}`) : null);
}

/**
 * One compact token. Deliberately not a coloured badge: Today already uses tone for *tier*, and a second
 * colour system on the same row would make a Premium student look urgent.
 */
export function PlanMark({ code, className }: { code: PlanCode | null | undefined; className?: string }) {
  const { t } = useT();
  const label = usePlanLabel();
  if (!code) return null;
  return (
    <span className={cx('ag15-plan', className)} data-plan={code} title={t('v15.plan.title', { plan: label(code) })}>
      {label(code)}
    </span>
  );
}

const PLACES: CountedEntitlement[] = ['max_managed_applications', 'max_recommended_institutions'];

/** `1 / 2`, `1 / 1 사용`, or "상시" when the allowance is not rationed. */
export function AllowanceText({ u }: { u: EntitlementUse }) {
  const { t } = useT();
  // V29: a `null` limit is bounded by its scope — say which, so "unlimited" is never read as unlimited.
  if (u.limit === null) return <span className="ag15-scope__v">{t(`v29.plan.unrationed.${u.scope ?? 'TEAM'}`, { defaultValue: t('v15.scope.ongoing') })}{u.used > 0 ? ` · ${t('v29.plan.usedSoFar', { count: u.used })}` : ''}</span>;
  if (u.limit === 0) return <span className="ag15-scope__v ag15-scope__v--none">{t('v15.scope.notIncluded')}</span>;
  return (
    <span className={cx('ag15-scope__v', 'hg-num')} data-exhausted={u.remaining === 0 ? '' : undefined}>
      {t(PLACES.includes(u.key) ? 'v15.scope.usedPlaces' : 'v15.scope.used', { used: u.used, limit: u.limit })}
      {u.from_add_ons > 0 && <span className="ag15-scope__addon" title={t('v15.scope.addOnTitle', { count: u.from_add_ons })}>+{u.from_add_ons}</span>}
    </span>
  );
}

/** One unit price in USD cents from what a counselor typed ("45" or "45.50"); `null` when it is not a number. */
function cents(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return v.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * "추가 서비스 제안" — an offer from the V29 catalogue (brief §20).
 *
 * The counselor picks the service, the quantity and **one exact unit price inside the catalogue's range** (or writes a
 * quote and its scope). Nothing is prefilled from the range — a range is a bound, not a price. The student then sees
 * the exact amount, approves and pays; nothing is granted before that.
 */
export function AddOnOffer({ studentId, initial, onDone }: { studentId: string; initial?: AddOnCode | null; onDone?: () => void }) {
  const { t, locale } = useT();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState<AddOnCode>(initial ?? 'EXTRA_MANAGED_APPLICATION');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  const [scope, setScope] = useState('');
  const def = ADD_ON_BY_CODE[code];
  const unit = cents(price);
  const ok = unit !== null && addOnPriceAllowed(def, unit) && (!def.requires_scope || scope.trim().length > 0);
  const range = def.pricing.kind === 'RANGE'
    ? t('v29.plan.offer.range', { min: formatMoney(def.pricing.min_minor, 'USD', locale, { minor: true }), max: formatMoney(def.pricing.max_minor, 'USD', locale, { minor: true }) })
    : t('v29.plan.offer.quote');
  const m = useMutation({
    mutationFn: () => api.agency.offerAddOn(studentId, { code, quantity: qty, unit_amount_minor: unit!, scope: scope.trim() || null }),
    onSuccess: () => { toast.success(t('v15.outOfScope.offered')); qc.invalidateQueries({ queryKey: ['agency'] }); onDone?.(); },
    onError: (e) => toast.error((e as { body?: { detail?: { message?: string } } }).body?.detail?.message ?? (e as Error).message),
  });
  return (
    <form className="ag29-offer" onSubmit={(e) => { e.preventDefault(); if (ok) m.mutate(); }}>
      <label className="form-label" htmlFor="ag29-offer-code">{t('v29.plan.offer.service')}</label>
      <Select id="ag29-offer-code" compact value={code}
        onChange={(e) => { setCode(e.target.value as AddOnCode); setPrice(''); }}>
        {ADD_ONS.map((a) => <option key={a.code} value={a.code}>{t(`common:v29.addon.item.${a.slug}`)}</option>)}
      </Select>
      <div className="ag29-offer__row">
        <div>
          <label className="form-label" htmlFor="ag29-offer-qty">{t('v29.plan.offer.quantity', { unit: t(`common:v29.addon.unit.${def.unit}`) })}</label>
          <input id="ag29-offer-qty" type="number" min={1} max={def.max_quantity} className="form-control form-control-sm" value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(def.max_quantity, Number(e.target.value) || 1)))} />
        </div>
        <div>
          <label className="form-label" htmlFor="ag29-offer-price">{t('v29.plan.offer.unitPrice')}</label>
          <input id="ag29-offer-price" inputMode="decimal" className="form-control form-control-sm" value={price} placeholder="USD"
            aria-describedby="ag29-offer-range" aria-invalid={price !== '' && !(unit !== null && addOnPriceAllowed(def, unit))}
            onChange={(e) => setPrice(e.target.value)} />
          <span id="ag29-offer-range" className="fs-12 text-muted">{range}</span>
        </div>
      </div>
      <label className="form-label" htmlFor="ag29-offer-scope">{t(def.requires_scope ? 'v29.plan.offer.scopeRequired' : 'v29.plan.offer.scope')}</label>
      <textarea id="ag29-offer-scope" className="form-control form-control-sm" rows={2} maxLength={2000} value={scope}
        required={def.requires_scope} onChange={(e) => setScope(e.target.value)} />
      {def.referral && <p className="fs-12 text-muted mb-1">{t('common:v29.addon.pickupNote')}</p>}
      <div className="ag29-offer__foot">
        <span className="hg-num">{unit !== null ? t('v29.plan.offer.total', { amount: formatMoney(unit * qty, 'USD', locale, { minor: true }) }) : ''}</span>
        <Button size="sm" variant="primary" type="submit" disabled={!ok} loading={m.isPending}>{t('v29.plan.offer.send')}</Button>
      </div>
      <p className="fs-12 text-muted mb-0">{t('v29.plan.offer.howItWorks')}</p>
    </form>
  );
}

/** The work a plan level obliges the team to do — one line, so nobody has to memorise the plan rules (brief §20). */
function Duties({ plan }: { plan: StudentPlan }) {
  const { t } = useT();
  const e = plan.entitlements;
  if (!('visa_support_level' in (e as object))) return null;
  return (
    <p className="ag29-duties fs-12 mb-0">
      {[`visa.${e.visa_support_level}`, `dorm.${e.dormitory_support_level}`, `settle.${e.settlement_support_level}`, `docs.${e.document_review_level}`]
        .map((k) => t(`v29.plan.duty.${k}`)).join(' · ')}
      {e.dedicated_support ? ` · ${t('v29.plan.duty.dedicated')}` : ''}
    </p>
  );
}

/** Start, support window / contract term, and Premium's arrival window — with the dates the contract leaves open. */
function Term({ plan, studentId }: { plan: StudentPlan; studentId?: string }) {
  const { t, locale } = useT();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const e = plan.engagement;
  const [ends, setEnds] = useState('');
  const [arrive, setArrive] = useState('');
  const m = useMutation({
    mutationFn: () => api.agency.setServiceTerm(studentId!, {
      service_ends_at: ends ? `${ends}T23:59:00+09:00` : null, arrival_at: arrive ? `${arrive}T12:00:00+09:00` : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency'] }); toast.success(t('v29.plan.term.saved')); },
    onError: (err) => toast.error((err as Error).message),
  });
  if (!e) return null;
  const d = (v: string | null) => (v ? formatDate(v, locale) : null);
  const ent = plan.entitlements;
  const premium = ent.support_window_type === 'CONTRACT_TERM';
  const arrival = (ent.pre_arrival_support_days ?? 0) > 0;
  return (
    <>
      <div>
        <dt>{t('v29.plan.term.title')}</dt>
        <dd className="ag15-scope__v">
          {d(e.service_started_at) ? t('v29.plan.term.since', { date: d(e.service_started_at) }) : t('v29.plan.term.notStarted')}
          {' · '}
          {premium
            ? (e.service_ends_at ? t('v29.plan.term.until', { date: d(e.service_ends_at) }) : t('v29.plan.term.toAgree'))
            : e.support_window_ends_at ? t('v29.plan.term.support', { date: d(e.support_window_ends_at) }) : t('v29.plan.term.supportDays', { count: ent.support_window_days ?? 0 })}
          {e.term_ended && <> · <strong>{t('v29.plan.term.ended')}</strong></>}
        </dd>
      </div>
      {arrival && (
        <div>
          <dt>{t('v29.plan.term.arrival')}</dt>
          <dd className="ag15-scope__v">{e.arrival_at
            ? t('v29.plan.term.arrivalWindow', { from: d(e.pre_arrival_starts_at), arrive: d(e.arrival_at), until: d(e.settlement_ends_at) })
            : t('v29.plan.term.arrivalUnknown')}</dd>
        </div>
      )}
      {studentId && (premium || arrival) && (!e.service_ends_at || !e.arrival_at) && (
        <div className="ag29-term-set">
          <dt className="visually-hidden">{t('v29.plan.term.set')}</dt>
          <dd>
            <form className="ag29-term-form" onSubmit={(ev) => { ev.preventDefault(); m.mutate(); }}>
              {premium && !e.service_ends_at && <label className="fs-12">{t('v29.plan.term.endsLabel')}
                <input type="date" className="form-control form-control-sm" value={ends} onChange={(ev) => setEnds(ev.target.value)} /></label>}
              {arrival && !e.arrival_at && <label className="fs-12">{t('v29.plan.term.arrivalLabel')}
                <input type="date" className="form-control form-control-sm" value={arrive} onChange={(ev) => setArrive(ev.target.value)} /></label>}
              <Button size="sm" variant="secondary" type="submit" disabled={!ends && !arrive} loading={m.isPending}>{t('v29.plan.term.set')}</Button>
            </form>
          </dd>
        </div>
      )}
    </>
  );
}

const ADD_ON_LIVE = ['OFFERED', 'AWAITING_PAYMENT', 'ACTIVE', 'COMPLETED', 'APPROVED'];

/**
 * The scope panel for the student workspace (V29): PLAN · SERVICE TERM · USED / INCLUDED · ACTIVE ADD-ONS, plus the
 * one action a counselor needs when a student asks for something outside the contract — "추가 서비스 제안".
 */
export function PlanScope({ plan, compact, studentId }: { plan: StudentPlan | null | undefined; compact?: boolean; studentId?: string }) {
  const { t, locale } = useT();
  const [offering, setOffering] = useState<AddOnCode | null | false>(false);
  if (!plan) return <p className="hg-subtle hg-small ag15-scope__empty">{t('v15.scope.noPlan')}</p>;
  const shown = plan.usage.filter((u) => u.limit === null || u.limit > 0);
  const addOns = plan.add_ons.filter((a) => ADD_ON_LIVE.includes(a.status));
  const spent = plan.usage.filter((u) => u.limit !== null && u.limit > 0 && u.remaining === 0);
  const name = (code: string, key: string | null) => {
    const d = ADD_ON_BY_CODE[code as AddOnCode] ?? (key ? addOnFor(key) : null);
    return d ? t(`common:v29.addon.item.${d.slug}`) : code;
  };
  return (
    <div className={cx('ag15-scope', compact && 'ag15-scope--compact')}>
      <div className="ag15-scope__head">
        <PlanMark code={plan.code} />
        <span className="hg-num ag15-scope__price">{formatMoney(plan.amount_minor, plan.currency, locale, { minor: true, gap: true })}</span>
        {plan.engagement && !plan.engagement.is_current_catalog && <span className="fs-12 text-muted">{t('v29.plan.legacy', { version: plan.catalog_version })}</span>}
      </div>
      <dl className="ag15-scope__list">
        <Term plan={plan} studentId={compact ? undefined : studentId} />
        {shown.map((u) => (
          <div key={u.key}>
            <dt>{t(`v15.scope.key.${u.key}`)}</dt>
            <dd><AllowanceText u={u} /></dd>
          </div>
        ))}
        <div>
          <dt>{t('v15.scope.key.addOns')}</dt>
          <dd>
            {addOns.length === 0 ? <span className="ag15-scope__v">{t('v15.scope.addOnNone')}</span> : (
              <ul className="ag29-addons">
                {addOns.map((a) => (
                  <li key={a.id}>{name(a.code, a.entitlement_key)} ×{a.quantity} · <span className="hg-num">{a.amount_minor ? formatMoney(a.amount_minor, a.currency ?? 'USD', locale, { minor: true }) : '—'}</span> · {t(`v29.plan.addOnStatus.${a.status}`)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      {!compact && <Duties plan={plan} />}
      {!compact && studentId && spent.map((u) => (
        <OutOfScopeNote key={u.key} entitlementKey={u.key} limit={u.limit} used={u.used}
          canOffer={!!addOnFor(u.key)} onOffer={() => setOffering(addOnFor(u.key)!.code)} />
      ))}
      {!compact && studentId && (offering === false
        ? <Button size="sm" variant="secondary" className="ag29-offer__open" onClick={() => setOffering(null)}>{t('v29.plan.offer.open')}</Button>
        : <AddOnOffer studentId={studentId} initial={offering} onDone={() => setOffering(false)} />)}
    </div>
  );
}

/**
 * What a counselor sees when an action is outside the plan.
 *
 * The brief is explicit: never a silent block, never an internal error. So this says what is exhausted, by
 * how much, and offers the one legitimate next step — an add-on the *student* then approves. The offer
 * carries its price before anyone agrees to it, and declining leaves the case exactly as it was.
 */
export function OutOfScopeNote({ entitlementKey, limit, used, canOffer, onOffer, pending }: {
  entitlementKey: CountedEntitlement; limit: number | null; used: number;
  canOffer: boolean; onOffer?: () => void; pending?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="ag15-oos" role="status">
      <p className="ag15-oos__what">{t('v15.outOfScope.title')}</p>
      <p className="ag15-oos__detail">
        {t('v15.outOfScope.detail', { what: t(`v15.scope.key.${entitlementKey}`), used, limit: limit ?? 0 })}
      </p>
      {canOffer && onOffer && (
        <Button size="sm" variant="secondary" loading={pending} onClick={onOffer}>{t('v15.outOfScope.offer')}</Button>
      )}
      {!canOffer && <p className="hg-subtle hg-xs">{t('v15.outOfScope.escalate')}</p>}
    </div>
  );
}

/** The scope panel behind a popover, for places with no room for the panel itself (the Today row). */
export function PlanPopover({ plan, code }: { plan: StudentPlan | null | undefined; code: PlanCode | null | undefined }) {
  const { t } = useT();
  const label = usePlanLabel();
  if (!code) return null;
  return (
    <Popover width={300} align="start" trigger={(p) => (
      <button type="button" className="ag15-plan ag15-plan--button" data-plan={code} {...p}
        aria-label={t('v15.plan.title', { plan: label(code) })}>{label(code)}</button>
    )}>
      <div style={{ padding: 12 }}><PlanScope plan={plan} compact /></div>
    </Popover>
  );
}

/**
 * **Service delivery** — the fourth of the manager's four Insights visuals (brief Part 15).
 *
 * How much of what was sold has actually been delivered, and where the caseload is pressing against what
 * was promised. Three numbers and a row per plan; no chart, because at three plans a chart would be
 * decoration over a table that fits on four lines.
 *
 * Not revenue. What the caseload is *worth* is a different question and does not belong on an operations
 * screen — that is the failure mode the benchmark records for this whole product category.
 */
export function PlanDelivery() {
  const { t, locale } = useT();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['agency', 'plan-utilization'], queryFn: () => api.agency.planUtilization(), staleTime: 120_000 });
  const label = usePlanLabel();
  const d = q.data;
  if (!d) return null;
  const n = (v: number) => formatNumber(v, locale);
  return (
    <section className="ag15-delivery" aria-labelledby="ag15-delivery-h">
      <h3 className="card-title" id="ag15-delivery-h">{t('v15.delivery.title')}</h3>
      <p className="fs-12 text-muted mb-2">{t('v15.delivery.sub', { caseload: n(d.caseload), withPlan: n(d.with_plan) })}</p>
      <div className="ag15-delivery__top">
        <span><strong className="hg-num">{n(d.at_limit)}</strong> {t('v15.delivery.atLimit')}</span>
        <span data-alert={d.over > 0 || undefined}><strong className="hg-num">{n(d.over)}</strong> {t('v15.delivery.over')}</span>
        <span><strong className="hg-num">{n(d.open_offers)}</strong> {t('v15.delivery.offers')}</span>
        {d.unused_follow_ups > 0 && <span><strong className="hg-num">{n(d.unused_follow_ups)}</strong> {t('v15.delivery.unusedFollowUps')}</span>}
      </div>
      <table className="table mb-0 ag15-delivery__table">
        <thead>
          <tr>
            <th scope="col">{t('v15.scope.strip')}</th>
            <th scope="col" className="text-end">{t('v15.delivery.cases')}</th>
            <th scope="col" className="text-end">{t('v15.delivery.atLimit')}</th>
            <th scope="col" className="text-end">{t('v15.delivery.over')}</th>
            <th scope="col" className="text-end">{t('v15.delivery.withAddOn')}</th>
          </tr>
        </thead>
        <tbody>
          {d.by_plan.map((r) => (
            <tr key={r.code}>
              <th scope="row"><PlanMark code={r.code} /> <span className="visually-hidden">{label(r.code)}</span></th>
              <td className="text-end hg-num">{n(r.students)}</td>
              <td className="text-end hg-num">{n(r.at_limit)}</td>
              <td className="text-end hg-num" data-alert={r.over > 0 || undefined}>{n(r.over)}</td>
              <td className="text-end hg-num">{n(r.add_ons)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The definition is a *translated* string, not the server's English one. The metrics around this
          panel still print their English definitions on a Korean page (a pre-existing V5/V9 defect recorded
          in REPORT §128); this panel does not add to it. */}
      <p className="fs-12 text-muted mt-2 mb-0">{t('v15.delivery.definition')}</p>
    </section>
  );
}

/**
 * The student's remaining 첨삭 allowance, for the one screen where a reviewer decides whether to ask for
 * another revision (brief Part 12).
 *
 * Renders nothing when the allowance is not rationed or the student has no plan — an empty cell is better
 * than a cell that says "not applicable", and this sits in a metadata row where every other entry is a fact.
 */
export function EssayAllowance({ studentId }: { studentId: string | undefined }) {
  const { t } = useT();
  const { api } = useAuth();
  const q = useQuery({
    queryKey: ['agency', 'plan', studentId],
    queryFn: () => api.agency.studentPlan(studentId!),
    enabled: !!studentId,
    staleTime: 60_000,
  });
  const u = q.data?.usage.find((x) => x.key === 'essay_review_rounds');
  if (!u) return null;
  if (u.limit === null) return <div><dt>{t('v15.scope.key.essay_review_rounds')}</dt><dd><AllowanceText u={u} /></dd></div>;
  return (
    <div>
      <dt>{t('v15.scope.key.essay_review_rounds')}</dt>
      <dd>
        {u.limit === 0
          ? <span className="ag15-scope__v--none">{t('v15.scope.notIncluded')}</span>
          : <span className="hg-num" data-exhausted={u.remaining === 0 ? '' : undefined}>
              {t('v15.scope.used', { used: u.used, limit: u.limit })}
              {u.from_add_ons > 0 && <span className="ag15-scope__addon">+{u.from_add_ons}</span>}
            </span>}
      </dd>
    </div>
  );
}
