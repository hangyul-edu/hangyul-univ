// PRIMARY QUESTION: what did each student pay for, what state is that payment in, and what has gone back?
//
// Operations design pass (2026-11). One table — student · service · amount · state · paid · refunded · receipt — with
// the reconciliation facts (method, attempts, failure code, provider reference) one click away in a drawer, and the
// refund action on every order that still has something refundable. Every purchase is a one-time payment; there is
// no recurring-charge vocabulary on this screen because there is nothing recurring to describe.
import { useAuth } from '@hangyul/auth';
import { ArrowUpRight, FlaskConical, Undo2 } from '@hangyul/icons';
import type { AgencyOrderRow } from '@hangyul/types';
import { Button, Callout, DataTable, DescriptionList, Drawer, EmptyState, FilterSelect, Metrics, PageHeader, QueryState, Section, StatusText, useToast, type ColumnDef } from '@hangyul/ui';
import { formatDate, formatDateTime, formatMoney } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Person, useT } from '../components/bits';
import { RefundModal } from '../components/RefundModal';
import { useUrlFilters } from '../lib/hooks';
import { sumByCurrency } from '../lib/logic';
import { canRefund, refundable } from '../lib/refund';

type Order = AgencyOrderRow;
type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

/** One state per order: the payment state when the API sends it, the order status otherwise. */
const stateOf = (o: Order): string => o.payment_state ?? o.status;
const STATE_TONE: Record<string, Tone> = {
  PAID: 'success', PARTIALLY_REFUNDED: 'warning', REFUNDED: 'neutral', FAILED: 'danger', CANCELLED: 'neutral',
  PENDING: 'warning', PAYMENT_METHOD_REQUIRED: 'warning', BILLING_AUTH_PENDING: 'warning', BILLING_KEY_READY: 'warning', CHARGING: 'info',
};

export default function Payments() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const fs = useUrlFilters(['status'] as const);
  const state = fs.values.status;
  const q = useQuery({ queryKey: ['agency', 'orders'], queryFn: () => api.agency.orders() });
  const all = q.data ?? [];
  const rows = useMemo(() => all.filter((o) => !state || stateOf(o) === state), [all, state]);
  const states = useMemo(() => [...new Set(all.map(stateOf))], [all]);
  const [detail, setDetail] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const detailOrder = all.find((o) => o.id === detail) ?? null;
  const refundOrder = all.find((o) => o.id === refunding) ?? null;

  const money = (amount: number, cur: string) => formatMoney(amount, cur, locale, { minor: true });
  const totals = (list: Order[], pick: (o: Order) => number) => {
    const sums = sumByCurrency(list, pick, (o) => o.currency);
    const parts = Object.entries(sums).filter(([, v]) => v !== 0).map(([cur, v]) => money(v, cur));
    return parts.length ? parts.join(' + ') : '—';
  };
  const charged = rows.filter((o) => o.paid_at);
  const refunded = rows.filter((o) => (o.refunded_amount_minor ?? 0) > 0);
  const demoCount = rows.filter((o) => o.is_demo_payment).length;
  const stateLabel = (o: Order) => t(`ops.pay.state.${stateOf(o)}`, { defaultValue: t(`payments.status.${o.status}`, { defaultValue: stateOf(o) }) });
  const stateCell = (o: Order) => <StatusText tone={STATE_TONE[stateOf(o)] ?? 'neutral'}>{stateLabel(o)}</StatusText>;
  const refundedCell = (o: Order) => ((o.refunded_amount_minor ?? 0) > 0
    ? <span className="ops-pay__refunded"><span className="hg-num">{money(o.refunded_amount_minor ?? 0, o.currency)}</span>{o.refunded_at && <span className="ops-pay__sub">{formatDate(o.refunded_at, locale)}</span>}</span>
    : <span className="hg-subtle">—</span>);
  const receipt = (o: Order) => (o.receipt_url
    ? <a className="hg-link ops-pay__receipt" href={o.receipt_url} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>{t('ops.pay.receipt')}<ArrowUpRight size={14} aria-hidden /></a>
    : <span className="hg-subtle">—</span>);
  const refundBtn = (o: Order) => (canRefund(o)
    ? <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={(e) => { e.stopPropagation(); setRefunding(o.id); }} aria-label={t('ops.refund.openFor', { student: o.student.full_name })}>{t('ops.refund.open')}</Button>
    : null);

  const cols: ColumnDef<Order>[] = [
    { id: 'student', accessorFn: (r) => r.student.full_name, header: t('misc.student'), size: 220, meta: { primary: true, priority: 1, minWidth: 190, label: t('misc.student') },
      cell: ({ row }) => <Person name={row.original.student.full_name} size={24} to={`/students/${row.original.student.id}`} /> },
    { id: 'service', accessorKey: 'product_name', header: t('ops.pay.col.service'), meta: { label: t('ops.pay.col.service'), priority: 1, minWidth: 130 } },
    { id: 'amount', accessorFn: (r) => r.amount_minor, header: t('ops.pay.col.amount'), size: 110, meta: { numeric: true, priority: 1, minWidth: 96, label: t('ops.pay.col.amount'), exportValue: (r) => money(r.amount_minor, r.currency) },
      cell: ({ row }) => <span className="hg-num">{money(row.original.amount_minor, row.original.currency)}</span> },
    { id: 'state', accessorFn: stateOf, header: t('ops.pay.col.state'), size: 170, meta: { label: t('ops.pay.col.state'), priority: 1, minWidth: 150, exportValue: stateLabel },
      cell: ({ row }) => stateCell(row.original) },
    { id: 'paid', accessorFn: (r) => r.paid_at ?? '', header: t('ops.pay.col.paid'), size: 130, meta: { label: t('ops.pay.col.paid'), priority: 2, minWidth: 116, exportValue: (r) => formatDateTime(r.paid_at, locale) },
      cell: ({ row }) => (row.original.paid_at ? <span className="hg-nowrap" title={formatDateTime(row.original.paid_at, locale)}>{formatDate(row.original.paid_at, locale)}</span> : <span className="hg-subtle">—</span>) },
    { id: 'refunded', accessorFn: (r) => r.refunded_amount_minor ?? 0, header: t('ops.pay.col.refunded'), size: 130, meta: { numeric: true, label: t('ops.pay.col.refunded'), priority: 2, minWidth: 110, exportValue: (r) => money(r.refunded_amount_minor ?? 0, r.currency) },
      cell: ({ row }) => refundedCell(row.original) },
    { id: 'receipt', accessorFn: (r) => r.receipt_url ?? '', header: t('ops.pay.col.receipt'), enableSorting: false, size: 110, meta: { label: t('ops.pay.col.receipt'), priority: 3, minWidth: 100, hideOnMobile: true },
      cell: ({ row }) => receipt(row.original) },
    { id: 'actions', accessorFn: () => '', header: () => <span className="hg-sr-only">{t('ops.pay.col.actions')}</span>, enableSorting: false, enableHiding: false, size: 120,
      meta: { label: t('ops.pay.col.actions'), priority: 1, minWidth: 110, hideOnMobile: true, exportValue: () => '' },
      cell: ({ row }) => <span className="ops-pay__act">{refundBtn(row.original)}</span> },
  ];

  return (
    <div className="hg-stack ag-page ops-pay">
      <PageHeader title={t('nav.payments')} subtitle={t('ops.pay.sub')} />
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t('payments.empty')} />}>
        {() => (
          <>
            {demoCount > 0 && <Callout tone="warning" icon={<FlaskConical aria-hidden />} title={t('payments.demoTitle')}>{t('payments.demoText', { count: demoCount })}</Callout>}
            <Metrics items={[
              { label: t('ops.pay.sum.charged'), value: totals(charged, (o) => o.amount_minor), foot: t('ops.pay.sum.payments', { count: charged.length }) },
              { label: t('ops.pay.sum.refunded'), value: totals(refunded, (o) => o.refunded_amount_minor ?? 0), foot: t('ops.pay.sum.refunds', { count: refunded.length }) },
              { label: t('ops.pay.sum.net'), value: totals(charged, (o) => o.amount_minor - (o.refunded_amount_minor ?? 0)), foot: t('payments.note') },
            ]} />
            <Section title={t('ops.pay.list')} sub={t('ops.pay.oneTime')}
              action={(
                <FilterSelect size="sm" label={t('ops.pay.col.state')} value={state} onChange={(e) => fs.set({ status: e.target.value || null })}>
                  <option value="">{t('ops.pay.allStates')}</option>
                  {states.map((s) => <option key={s} value={s}>{t(`ops.pay.state.${s}`, { defaultValue: s })}</option>)}
                </FilterSelect>
              )}>
              <div className="hg-panel ops-pay__table">
                <DataTable columns={cols} data={rows} getRowId={(r) => r.id} exportName="payments" caption={t('nav.payments')} onRowClick={(r) => setDetail(r.id)}
                  empty={<EmptyState compact title={t('ops.pay.emptyFiltered')} action={<Button size="sm" onClick={() => fs.set({ status: null })}>{t('actions.clearFilters')}</Button>} />}
                  renderCard={(r) => (
                    <div className="ops-paycard">
                      <div className="ops-paycard__top">
                        <Person name={r.student.full_name} size={28} to={`/students/${r.student.id}`} sub={r.product_name} />
                        <span className="ops-paycard__amount hg-num">{money(r.amount_minor, r.currency)}</span>
                      </div>
                      <div className="ops-paycard__meta">
                        {stateCell(r)}
                        {r.paid_at && <span>{t('ops.pay.paidOn', { date: formatDate(r.paid_at, locale) })}</span>}
                        {(r.refunded_amount_minor ?? 0) > 0 && <span>{t('ops.pay.refundedAmount', { amount: money(r.refunded_amount_minor ?? 0, r.currency) })}</span>}
                      </div>
                      {(canRefund(r) || r.receipt_url) && <div className="ops-paycard__act">{refundBtn(r)}{r.receipt_url && receipt(r)}</div>}
                    </div>
                  )} />
              </div>
            </Section>
          </>
        )}
      </QueryState>

      <Drawer open={!!detailOrder} onClose={() => setDetail(null)} title={t('ops.pay.detail.title')} width={480}
        footer={detailOrder && canRefund(detailOrder) ? <Button block icon={<Undo2 />} onClick={() => { setRefunding(detailOrder.id); setDetail(null); }}>{t('ops.refund.open')}</Button> : undefined}>
        {detailOrder && (
          <div className="hg-stack ops-pay__detail">
            <div className="ops-pay__detailhead">
              <div>
                <Link className="ops-pay__detailname" to={`/students/${detailOrder.student.id}`}>{detailOrder.student.full_name}</Link>
                <div className="hg-subtle">{detailOrder.product_name} · {t('ops.pay.oneTimeShort')}</div>
              </div>
              <span className="ops-pay__detailamount hg-num">{money(detailOrder.amount_minor, detailOrder.currency)}</span>
            </div>
            <Section title={t('ops.pay.detail.payment')} headingLevel={3} ruled>
              <DescriptionList items={[
                { label: t('ops.pay.col.state'), value: stateCell(detailOrder) },
                { label: t('ops.pay.detail.ordered'), value: formatDateTime(detailOrder.created_at, locale) },
                { label: t('ops.pay.col.paid'), value: detailOrder.paid_at ? formatDateTime(detailOrder.paid_at, locale) : '—' },
                { label: t('ops.pay.detail.method'), value: detailOrder.method ? t(`ops.pay.method.${detailOrder.method}`, { defaultValue: detailOrder.method }) : '—' },
                ...(detailOrder.attempts !== undefined ? [{ label: t('ops.pay.detail.attempts'), value: <span className="hg-num">{detailOrder.attempts}</span> }] : []),
                ...(detailOrder.failure_code ? [{ label: t('ops.pay.detail.failure'), value: <span className="hg-num ops-pay__danger">{detailOrder.failure_code}</span> }] : []),
                { label: t('ops.pay.col.receipt'), value: receipt(detailOrder) },
              ]} />
            </Section>
            <Section title={t('ops.pay.detail.refund')} headingLevel={3} ruled>
              <DescriptionList items={[
                { label: t('ops.pay.col.refunded'), value: <span className="hg-num">{money(detailOrder.refunded_amount_minor ?? 0, detailOrder.currency)}</span> },
                { label: t('ops.refund.remaining'), value: <span className="hg-num">{money(detailOrder.status === 'PAID' ? refundable(detailOrder) : 0, detailOrder.currency)}</span> },
                ...(detailOrder.refunded_at ? [{ label: t('ops.pay.detail.refundedAt'), value: formatDateTime(detailOrder.refunded_at, locale) }] : []),
                ...(detailOrder.refund_reason ? [{ label: t('ops.refund.reason'), value: <span data-user-content>{detailOrder.refund_reason}</span> }] : []),
              ]} />
            </Section>
            <Section title={t('ops.pay.detail.reconcile')} sub={t('ops.pay.detail.reconcileSub')} headingLevel={3} ruled>
              <DescriptionList items={[
                { label: t('ops.pay.detail.providerRef'), value: detailOrder.provider_ref ? <span className="hg-num ops-pay__ref">{detailOrder.provider_ref}</span> : '—' },
                ...(detailOrder.provider_mid ? [{ label: t('ops.pay.detail.providerMid'), value: <span className="hg-num ops-pay__ref">{detailOrder.provider_mid}</span> }] : []),
                { label: t('ops.pay.detail.orderId'), value: <span className="hg-num ops-pay__ref">{detailOrder.id}</span> },
                ...(detailOrder.is_demo_payment ? [{ label: t('ops.pay.detail.kind'), value: t('payments.demo') }] : []),
              ]} />
            </Section>
          </div>
        )}
      </Drawer>

      {refundOrder && (
        <RefundModal key={refundOrder.id} order={refundOrder} onClose={() => setRefunding(null)}
          submit={(body) => api.agency.refundOrder(refundOrder.id, body)}
          onDone={(amountMinor) => {
            setRefunding(null);
            toast.success(t('ops.refund.done', { amount: money(amountMinor, refundOrder.currency), student: refundOrder.student.full_name }));
            qc.invalidateQueries({ queryKey: ['agency', 'orders'] });
            qc.invalidateQueries({ queryKey: ['agency', 'student', refundOrder.student.id] });
          }} />
      )}
    </div>
  );
}
