/**
 * The cards on file (V21, brief §41, §42).
 *
 * It shows what Hangyul actually knows — a brand and four digits — and it is honest about the one
 * thing that matters: whether the card can be used again. On the merchant configuration in use it
 * cannot (REPORT §229.2), so the row says "다시 결제하려면 카드를 다시 입력해야 해요" instead of
 * offering an "이 카드로 결제" button that would fail. A saved-card list that lies about being usable
 * is worse than no list.
 *
 * The credential is not in this component's props, its state, or the API response that feeds it.
 */
import { Button, Callout, Modal } from '@hangyul/ui';
import { CreditCard, Trash2 } from '@hangyul/icons';
import { useApi } from '@hangyul/auth';
import type { StudentPaymentMethod } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useT } from '../lib/i18n';

export function SavedCards() {
  const { t } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.me.paymentMethods(), staleTime: 60_000 });
  const [confirming, setConfirming] = useState<StudentPaymentMethod | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.me.deletePaymentMethod(id),
    onSuccess: () => { setConfirming(null); qc.invalidateQueries({ queryKey: ['payment-methods'] }); },
  });

  const items = q.data?.items ?? [];
  if (!items.length) return null;

  return (
    <section className="sv21-cards hg-panel" aria-labelledby="sv21-cards-h">
      <h3 className="hg-title-sm" id="sv21-cards-h">{t('v21.pay.savedTitle')}</h3>
      <ul className="sv21-cards__list">
        {items.map((m) => (
          <li key={m.id} className="sv21-cards__row">
            <span className="sv21-cards__what">
              <CreditCard aria-hidden />
              <strong className="hg-num">{m.masked_number ?? m.brand}</strong>
              {m.brand && m.masked_number && <span className="hg-subtle hg-xs">{m.brand}</span>}
            </span>
            <span className="sv21-cards__note hg-subtle hg-xs">
              {m.reusable ? t('v21.pay.savedReusable') : t('v21.pay.savedNotReusable')}
            </span>
            <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setConfirming(m)}>
              {t('v21.pay.savedDelete')}
            </Button>
          </li>
        ))}
      </ul>
      {remove.isError && <Callout tone="danger">{t('v21.pay.savedDeleteFailed')}</Callout>}
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(null)}
          title={t('v21.pay.savedDeleteTitle')}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setConfirming(null)} disabled={remove.isPending}>
                {t('common:actions.cancel')}
              </Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(confirming.id)}>
                {t('v21.pay.savedDelete')}
              </Button>
            </>
          )}
        >
          <p>{t('v21.pay.savedDeleteBody', { card: confirming.masked_number ?? '' })}</p>
        </Modal>
      )}
    </section>
  );
}
