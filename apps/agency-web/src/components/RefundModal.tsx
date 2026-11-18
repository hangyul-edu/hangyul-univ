/**
 * Refund one order (Operations). Two steps in one dialog: type the amount and the reason, then confirm.
 *
 * The amount field starts EMPTY and nothing fills it: no "full refund" shortcut, no pro-rata figure, no suggestion.
 * No refund schedule has been approved, so the amount is decided by the team under the agreed terms; the dialog says
 * so, shows what is still refundable as a limit, and sends exactly what was typed (`POST /agency/orders/{id}/refund`
 * → the card company's cancellation). Every purchase is a one-time payment, so there is nothing recurring to stop.
 */
import type { AgencyOrderRow } from '@hangyul/types';
import { Button, Callout, DescriptionList, Field, Input, Modal, Textarea } from '@hangyul/ui';
import { formatMoney } from '@hangyul/utils';
import { useId, useState } from 'react';

import { REASON_MAX, REASON_MIN, refundable, refundFailure, validateRefund } from '../lib/refund';
import { useT } from './bits';

export type RefundSubmit = (body: { amount_minor: number; reason: string }) => Promise<unknown>;

export function RefundModal({ order, onClose, submit, onDone }: {
  order: AgencyOrderRow; onClose: () => void; submit: RefundSubmit; onDone: (amountMinor: number) => void;
}) {
  const { t, locale } = useT();
  const id = useId();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ReturnType<typeof refundFailure> | null>(null);

  const money = (minor: number) => formatMoney(minor, order.currency, locale, { minor: true });
  const remaining = refundable(order);
  const check = validateRefund(order, amount, reason);
  const amountError = touched && check.amount ? t(`ops.refund.err.amount.${check.amount}`, { remaining: money(remaining) }) : undefined;
  const reasonError = touched && check.reason ? t(`ops.refund.err.reason.${check.reason}`, { min: REASON_MIN }) : undefined;

  const review = () => { setTouched(true); setFailure(null); if (check.ok) setStep('confirm'); };
  const send = async () => {
    if (!check.ok || check.amountMinor === null) return;
    setBusy(true); setFailure(null);
    try {
      await submit({ amount_minor: check.amountMinor, reason: reason.trim() });
      onDone(check.amountMinor);
    } catch (e) {
      setFailure(refundFailure(e));
      setStep('form');
    } finally { setBusy(false); }
  };

  const failureText = failure && (
    failure.code === 'AMOUNT_EXCEEDS_REMAINING' ? t('ops.refund.fail.AMOUNT_EXCEEDS_REMAINING', { remaining: money(failure.remainingMinor ?? remaining) })
      : failure.code === 'DESIGN_PREVIEW' ? t('ops.refund.fail.DESIGN_PREVIEW')
        : failure.message || t('ops.refund.fail.generic')
  );

  return (
    <Modal open onClose={busy ? () => undefined : onClose} width={520}
      title={step === 'confirm' ? t('ops.refund.confirmTitle') : t('ops.refund.title')}
      description={t('ops.refund.for', { student: order.student.full_name, service: order.product_name })}
      footer={step === 'form' ? (
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" onClick={review}>{t('ops.refund.review')}</Button>
        </>
      ) : (
        <>
          <Button onClick={() => setStep('form')} disabled={busy}>{t('ops.refund.back')}</Button>
          <Button variant="danger" loading={busy} onClick={send}>{t('ops.refund.confirm', { amount: money(check.amountMinor ?? 0) })}</Button>
        </>
      )}>
      <div className="hg-stack ops-refund">
        {failure && (
          <Callout tone="danger" title={t('ops.refund.fail.title')}>
            {failureText}
            {failure.code && failure.code !== 'DESIGN_PREVIEW' && <span className="ops-refund__code hg-num">{t('ops.refund.fail.code', { code: failure.code })}</span>}
          </Callout>
        )}
        <DescriptionList items={[
          { label: t('ops.pay.col.amount'), value: <span className="hg-num">{money(order.amount_minor)}</span> },
          { label: t('ops.pay.col.refunded'), value: <span className="hg-num">{money(order.refunded_amount_minor ?? 0)}</span> },
          { label: t('ops.refund.remaining'), value: <strong className="hg-num" data-testid="refund-remaining">{money(remaining)}</strong> },
        ]} />
        {step === 'form' ? (
          <>
            <p className="ops-refund__policy">{t('ops.refund.policy')}</p>
            <Field label={t('ops.refund.amount', { currency: order.currency })} htmlFor={`${id}-amount`} error={amountError}
              hint={t('ops.refund.amountHint', { remaining: money(remaining) })}>
              <Input id={`${id}-amount`} inputMode="decimal" autoComplete="off" value={amount} invalid={!!amountError}
                aria-describedby={`${id}-policy`} onChange={(e) => { setAmount(e.target.value); setFailure(null); }} />
            </Field>
            <Field label={t('ops.refund.reason')} htmlFor={`${id}-reason`} error={reasonError} hint={t('ops.refund.reasonHint')}>
              <Textarea id={`${id}-reason`} rows={3} maxLength={REASON_MAX} value={reason} invalid={!!reasonError} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <span id={`${id}-policy`} className="hg-sr-only">{t('ops.refund.policy')}</span>
          </>
        ) : (
          <>
            <Callout tone="warning" title={t('ops.refund.confirmLead', { amount: money(check.amountMinor ?? 0), student: order.student.full_name })}>
              {t('ops.refund.confirmText')}
            </Callout>
            <DescriptionList items={[
              { label: t('ops.refund.reason'), value: <span data-user-content>{reason.trim()}</span> },
              { label: t('ops.refund.afterwards'), value: <span className="hg-num">{money(remaining - (check.amountMinor ?? 0))}</span> },
            ]} />
          </>
        )}
      </div>
    </Modal>
  );
}
