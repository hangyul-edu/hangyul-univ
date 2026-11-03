import { useTranslation } from '@hangyul/i18n';
import {
  AppText, Button, Callout, ErrorState, KeyValue, ListGroup, ListItem, LoadingState, ProgressBar, Screen,
  SectionTitle, StatusText, theme,
} from '@hangyul/mobile-ui';
import { PLANS, planPresentationByCode, planText, upgradeOffer, type PlanCode } from '@hangyul/types';
import { formatDate, formatMoney } from '@hangyul/utils';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { openCheckout, useServices } from '../src/plan';

/**
 * **플랜** — what was bought, what is left, and how to buy (V17, brief §35–37).
 *
 * Two shapes, as on the web: a plan that exists shows its allowances; no plan shows the three plans and a
 * price. The difference from the web is the last step. Pressing 결제하기 here does not open a payment
 * window — it opens the **web** checkout in the system browser and comes back by deep link, because one
 * payment state machine is the rule that must not bend (see `src/plan.ts` for why, in full).
 *
 * `useFocusEffect` is the other half of that handoff: the student leaves this screen for a browser and
 * returns to it with a plan the app has never heard of, so the plan is refetched on every focus rather
 * than on mount. Without it the app comes back to the screen that sold them the plan.
 */
export default function ServicesScreen() {
  const { t, i18n } = useTranslation();
  const services = useServices();
  const [picked, setPicked] = useState<PlanCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(useCallback(() => { void services.refetch(); }, [services.refetch]));

  const plan = services.data?.plan ?? null;
  const owned = plan?.code ?? null;
  // What they are about to buy: what they tapped, else the next plan up, else the recommended one. There is
  // always an answer, so the button is never "choose something first".
  const target: PlanCode | null = picked
    ?? (owned ? (PLANS.find((p) => p.sort_order > (PLANS.find((x) => x.code === owned)?.sort_order ?? -1))?.code ?? null)
      : (PLANS.find((p) => p.recommended)?.code ?? PLANS[0]?.code ?? null));
  const targetDef = target ? PLANS.find((p) => p.code === target) ?? null : null;
  const offer = owned && target ? upgradeOffer(owned, target) : null;
  // V29: an upgrade has no approved price (owner decision) — the app never prints one. A first purchase is the list price.
  const amount = targetDef ? formatMoney(targetDef.amount_minor, targetDef.currency, i18n.language, { minor: true }) : '—';
  const copy = targetDef ? (() => { const pres = planPresentationByCode(targetDef.code); return pres ? planText(t, pres) : null; })() : null;
  const eng = plan?.engagement ?? null;
  const ent = plan?.entitlements;

  const pay = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const opened = await openCheckout(target, i18n.language);
      if (!opened) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (services.isPending) return <Screen><LoadingState hero /></Screen>;
  if (services.isError) return <Screen><ErrorState error={services.error} onRetry={() => void services.refetch()} /></Screen>;

  return (
    <Screen onRefresh={() => services.refetch()}>
      {plan ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText variant="title" accessibilityRole="header">{i18n.language === 'ko' ? plan.name_ko : plan.name_en}</AppText>
            <StatusText label={t('mobile:more.active')} tone="success" />
          </View>
          <KeyValue label={t('mobile:plan.paid')} value={formatMoney(plan.amount_minor, plan.currency, i18n.language, { minor: true })} />
          {eng && ent ? (
            <KeyValue label={t('mobile:v29.plan.term')} value={ent.support_window_type === 'CONTRACT_TERM'
              ? (eng.service_ends_at ? t('mobile:v29.plan.termUntil', { date: formatDate(eng.service_ends_at, i18n.language) }) : t('mobile:v29.plan.termToAgree'))
              : eng.support_window_ends_at ? t('mobile:v29.plan.supportUntil', { date: formatDate(eng.support_window_ends_at, i18n.language) })
                : t('mobile:v29.plan.supportDays', { count: ent.support_window_days ?? 0 })} />
          ) : null}
          {eng?.arrival_at && eng.pre_arrival_starts_at && eng.settlement_ends_at ? (
            <KeyValue label={t('mobile:v29.plan.arrival')} value={t('mobile:v29.plan.arrivalWindow', {
              from: formatDate(eng.pre_arrival_starts_at, i18n.language), until: formatDate(eng.settlement_ends_at, i18n.language) })} />
          ) : null}
          {/* Only the allowances this plan actually rations. "모의 면접 0 / 0" on a Basic case is noise. */}
          {plan.usage.filter((u) => u.limit === null || u.limit > 0).length ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <SectionTitle title={t('mobile:plan.included')} />
              {plan.usage.filter((u) => u.limit === null || u.limit > 0).map((u) => (
                <View key={u.key} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="caption">{t(`mobile:plan.allowance.${u.key}`, { defaultValue: u.key })}</AppText>
                    <AppText variant="caption" color={theme.color.textTertiary}>
                      {u.limit === null ? t(`mobile:v29.plan.unrationed.${u.scope ?? 'TEAM'}`, { defaultValue: t('mobile:plan.ongoing') }) : `${u.used} / ${u.limit}`}
                    </AppText>
                  </View>
                  {u.limit !== null ? (
                    <ProgressBar value={Math.min(100, Math.round((u.used / Math.max(1, u.limit)) * 100))} height={4}
                      tone={u.used >= u.limit ? 'warning' : 'success'}
                      accessibilityLabel={t(`mobile:plan.allowance.${u.key}`, { defaultValue: u.key })} />
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <AppText variant="title" accessibilityRole="header">{t('mobile:plan.chooseTitle')}</AppText>
          <AppText variant="caption">{t('mobile:plan.chooseLede')}</AppText>
        </View>
      )}

      {/* The plans, as a choice rather than a comparison table. The web has the full 비교표; a phone that
          reproduces a seven-row matrix reproduces it badly. */}
      {targetDef ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={t(plan ? 'mobile:plan.upgradeTitle' : 'mobile:plan.plansTitle')} />
          <ListGroup>
            {PLANS.filter((p) => !owned || p.sort_order > (PLANS.find((x) => x.code === owned)?.sort_order ?? -1)).map((p) => (
              <ListItem
                key={p.code}
                title={i18n.language === 'ko' ? p.name_ko : p.name_en}
                subtitle={formatMoney(p.amount_minor, p.currency, i18n.language, { minor: true })}
                meta={t('mobile:plan.oneTime')}
                trailing={p.code === target ? <StatusText label={t('mobile:plan.selected')} tone="success" /> : undefined}
                onPress={() => setPicked(p.code)}
                chevron={false}
              />
            ))}
          </ListGroup>

          {copy ? (
            <View style={{ gap: 4 }}>
              <AppText variant="caption">{copy.description}</AppText>
              {copy.benefits.map((b) => <AppText key={b} variant="caption" color={theme.color.textSecondary}>• {b}</AppText>)}
            </View>
          ) : null}
          {failed ? <Callout tone="danger" body={t('mobile:plan.browserFailed')} /> : null}
          {offer ? (
            <>
              <Callout tone="info" body={t('mobile:v29.plan.upgradePending')} />
              <Button label={t('mobile:v29.plan.askTeam')} onPress={() => router.push('/messages')} fullWidth />
            </>
          ) : (
            <Button label={`${t('mobile:plan.pay')} · ${amount}`} icon={CreditCard} loading={busy} onPress={() => void pay()} fullWidth />
          )}
          {/* Two sentences, and both are things a student would otherwise find out by surprise: the payment
              happens in a browser and comes back here, and the card it takes is an overseas card. */}
          <AppText variant="caption">{t('mobile:plan.handoff')}</AppText>
          <AppText variant="caption">{t('mobile:plan.card')}</AppText>
        </View>
      ) : (
        <Callout tone="info" body={t('mobile:plan.highestAlready')} />
      )}

      {/* What the app cannot do, said once rather than discovered per screen. */}
      <AppText variant="caption" color={theme.color.textTertiary}>{t('mobile:plan.webNote')}</AppText>
    </Screen>
  );
}
