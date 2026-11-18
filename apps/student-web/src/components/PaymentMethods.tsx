/**
 * **Payment methods** — what the student has saved, and nothing the student cannot use.
 *
 * A saved method is a convenience: it is charged only when its owner confirms a one-time payment, and the
 * screen says so. There is no subscription to manage here because there is none anywhere.
 *
 * The credential behind a method is not in this component's props, its state, or any API response that
 * feeds it. What is shown is what the provider reported: a network, four digits.
 */
import { useApi } from '@hangyul/auth';
import { CreditCard, Globe, Lock, Plus, Trash2, Wallet } from '@hangyul/icons';
import type { PaymentMethodKind, StudentPaymentMethod } from '@hangyul/types';
import { Button, Callout, designPreviewVariant, Modal, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { failureCode, failureKey, KIND_LABEL, openPaymentMethodRegistration } from '../lib/billing';
import { useT } from '../lib/i18n';
import { methodLabel } from './PaymentCheckout';

const KIND_ICON: Record<PaymentMethodKind, ReactNode> = {
  DOMESTIC_CARD: <CreditCard aria-hidden />,
  FOREIGN_CARD: <Globe aria-hidden />,
  TOSS_PAY: <Wallet aria-hidden />,
  NAVER_PAY: <Wallet aria-hidden />,
};

export function PaymentMethods() {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const preview = designPreviewVariant() !== null;
  const q = useQuery({ queryKey: ['payment-options', 'manage'], queryFn: () => api.me.paymentOptions(), staleTime: 30_000 });
  const [removing, setRemoving] = useState<StudentPaymentMethod | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyKind, setBusyKind] = useState<PaymentMethodKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['payment-options'] });
  const remove = useMutation({
    mutationFn: (id: string) => api.me.deletePaymentMethod(id),
    onSuccess: () => { setRemoving(null); toast.success(t('billing.manage.removed')); void refresh(); },
    onError: (e) => { setRemoving(null); setError(t(preview ? 'billing.previewOff' : 'billing.manage.removeFailed')); void e; },
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.me.setDefaultPaymentMethod(id),
    onSuccess: () => { void refresh(); },
    onError: (e) => setError(t(failureKey(failureCode(e)))),
  });

  const add = async (kind: PaymentMethodKind) => {
    if (busyKind) return;
    if (preview) { setError(t('billing.previewOff')); return; }
    setBusyKind(kind);
    setError(null);
    try {
      const reg = await api.me.startPaymentMethod(kind, null);
      await openPaymentMethodRegistration(reg); // the browser leaves for the provider's secure page
    } catch (e) {
      setError(t(failureKey(failureCode(e))));
      setBusyKind(null);
    }
  };

  const items = q.data?.saved ?? [];
  const kinds = (q.data?.methods ?? []).filter((m) => m.available).map((m) => m.kind);
  // Nothing to manage and nothing that could be added: the section would be an empty box, so it is not shown.
  if (q.isLoading || (items.length === 0 && kinds.length === 0)) return null;

  return (
    <section className="paym" id="payment-methods" aria-labelledby="paym-h">
      <header className="paym__head">
        <div>
          <h2 className="hg-title-sm" id="paym-h">{t('billing.manage.title')}</h2>
          <p className="hg-small hg-muted">{t('billing.manage.lede')}</p>
        </div>
        {kinds.length > 0 && items.length > 0 && !adding && (
          <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => setAdding(true)}>{t('billing.manage.add')}</Button>
        )}
      </header>

      {items.length > 0 && (
        <ul className="paym__list">
          {items.map((m) => (
            <li key={m.id} className="paym__row">
              <span className="pay__icon">{KIND_ICON[m.kind]}</span>
              <span className="paym__what">
                <span className="hg-strong hg-num">{methodLabel(m, t)}</span>
                <span className="hg-subtle hg-xs">
                  {t(KIND_LABEL[m.kind])} · {t('billing.manage.added', { date: formatDate(m.created_at, locale) })}
                </span>
                {!m.usable && <span className="paym__warn hg-xs">{t('billing.manage.notUsable')}</span>}
              </span>
              {m.is_default
                ? <span className="pay__tag">{t('billing.default')}</span>
                : <Button variant="ghost" size="sm" loading={makeDefault.isPending && makeDefault.variables === m.id}
                    onClick={() => makeDefault.mutate(m.id)}>{t('billing.manage.makeDefault')}</Button>}
              <Button variant="ghost" size="sm" icon={<Trash2 />} aria-label={t('billing.manage.removeNamed', { method: methodLabel(m, t) })}
                onClick={() => setRemoving(m)}>{t('billing.manage.remove')}</Button>
            </li>
          ))}
        </ul>
      )}

      {kinds.length > 0 && (adding || items.length === 0) && (
        <div className="pay__add">
          <p className="hg-small pay__addlede">{t(items.length ? 'billing.addChoose' : 'billing.manage.empty')}</p>
          <div className="pay__kinds">
            {kinds.map((k) => (
              <button key={k} type="button" className="pay__kind" disabled={busyKind !== null} onClick={() => add(k)}>
                <span className="pay__icon">{KIND_ICON[k]}</span>
                <span>{t(KIND_LABEL[k])}</span>
              </button>
            ))}
          </div>
          <p className="hg-subtle hg-xs pay__secure"><Lock aria-hidden />{t('billing.secure')}</p>
        </div>
      )}
      {error && <Callout tone="danger">{error}</Callout>}

      {removing && (
        <Modal open onClose={() => setRemoving(null)} title={t('billing.manage.removeTitle')}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)} disabled={remove.isPending}>{t('common:actions.cancel')}</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(removing.id)}>{t('billing.manage.remove')}</Button>
            </>
          )}>
          <p>{t('billing.manage.removeBody', { method: methodLabel(removing, t) })}</p>
        </Modal>
      )}
    </section>
  );
}
