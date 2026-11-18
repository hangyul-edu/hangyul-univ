/**
 * One student's payments, inside their workspace (Operations design pass 2026-11): what was paid, its state, what has
 * gone back — and the refund action, the same dialog as the Payments page. Reads the shared `['agency','orders']`
 * query, so a refund made here or there refreshes both. Every purchase is a one-time payment.
 */
import { useAuth } from '@hangyul/auth';
import { ArrowUpRight, Undo2 } from '@hangyul/icons';
import type { AgencyOrderRow } from '@hangyul/types';
import { Button, Skeleton, StatusText, useToast } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { canRefund } from '../lib/refund';
import { useT } from './bits';
import { RefundModal } from './RefundModal';

const TONE: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  PAID: 'success', PARTIALLY_REFUNDED: 'warning', REFUNDED: 'neutral', FAILED: 'danger', CANCELLED: 'neutral',
  PENDING: 'warning', PAYMENT_METHOD_REQUIRED: 'warning', BILLING_AUTH_PENDING: 'warning', BILLING_KEY_READY: 'warning', CHARGING: 'info',
};

export function StudentPayments({ studentId }: { studentId: string }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['agency', 'orders'], queryFn: () => api.agency.orders(), staleTime: 60_000 });
  const [refunding, setRefunding] = useState<AgencyOrderRow | null>(null);
  const orders = (q.data ?? []).filter((o) => o.student.id === studentId);
  const money = (minor: number, cur: string) => formatMoney(minor, cur, locale, { minor: true });
  return (
    <div className="ops-spay">
      <h3 className="ops-spay__h">{t('ops.pay.list')} <span className="ops-spay__note">{t('ops.pay.oneTimeShort')}</span></h3>
      {q.isLoading ? <Skeleton h={44} /> : q.isError ? <p className="ops-wssec__empty">{t('ops.ws.paymentsError')}</p>
        : orders.length === 0 ? <p className="ops-wssec__empty">{t('ops.ws.noPayments')}</p> : (
          <ul className="ops-spay__list">
            {orders.map((o) => {
              const state = o.payment_state ?? o.status;
              const back = o.refunded_amount_minor ?? 0;
              return (
                <li key={o.id} className="ops-spay__row">
                  <span className="ops-spay__main">
                    <span className="ops-spay__top"><strong>{o.product_name}</strong><span className="hg-num">{money(o.amount_minor, o.currency)}</span></span>
                    <span className="ops-spay__meta">
                      <StatusText tone={TONE[state] ?? 'neutral'}>{t(`ops.pay.state.${state}`, { defaultValue: state })}</StatusText>
                      {o.paid_at && <span>{t('ops.pay.paidOn', { date: formatDate(o.paid_at, locale) })}</span>}
                      {back > 0 && <span>{t('ops.pay.refundedAmount', { amount: money(back, o.currency) })}</span>}
                      {o.receipt_url && <a className="hg-link ops-pay__receipt" href={o.receipt_url} target="_blank" rel="noreferrer noopener">{t('ops.pay.receipt')}<ArrowUpRight size={14} aria-hidden /></a>}
                    </span>
                  </span>
                  {canRefund(o) && <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => setRefunding(o)}>{t('ops.refund.open')}</Button>}
                </li>
              );
            })}
          </ul>
        )}
      {refunding && (
        <RefundModal key={refunding.id} order={refunding} onClose={() => setRefunding(null)}
          submit={(body) => api.agency.refundOrder(refunding.id, body)}
          onDone={(amountMinor) => {
            toast.success(t('ops.refund.done', { amount: money(amountMinor, refunding.currency), student: refunding.student.full_name }));
            setRefunding(null);
            qc.invalidateQueries({ queryKey: ['agency', 'orders'] });
            qc.invalidateQueries({ queryKey: ['agency', 'student', studentId] });
          }} />
      )}
    </div>
  );
}
