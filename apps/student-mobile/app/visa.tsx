import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  AppText, Callout, ErrorState, JourneySteps, ListGroup, LoadingState, NextAction, Screen, SectionTitle, StatusBadge, StepRow, useFormat,
} from '@hangyul/mobile-ui';
import type { VisaChecklistItem, VisaStatus } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { qk } from '../src/queries';

const PHASES = ['admission', 'letter', 'documents', 'apply', 'decision'] as const;
function phaseIndex(s: VisaStatus): number {
  if (['NOT_STARTED', 'ELIGIBILITY_CHECK', 'WAITING_FOR_ADMISSION'].includes(s)) return 0;
  if (s === 'DOCUMENT_PREPARATION') return 2;
  if (s === 'READY_TO_APPLY') return 3;
  return 4;
}

/** V4: the requirement's name is the headline; the sourced rule text is its explanation (API `name`/`rule` when present). */
function visaName(i: VisaChecklistItem, t?: (k: string, o?: Record<string, unknown>) => string): string {
  const base = i.name || i.title.split(/ \(| per | — /)[0] || i.title;
  // V5: researched-route items carry a stable key → translated name (visaroute namespace).
  return t && i.route_status && i.name_key ? t(`visaroute:doc.${i.name_key}.name`, { defaultValue: base }) : base;
}
function visaRule(i: VisaChecklistItem): string | null {
  if (i.route_status) return null;
  if (i.rule !== undefined) return i.rule ?? null;
  return visaName(i) !== i.title ? i.title : null;
}

/** The visa as steps: where you are, what needs you now, then the open steps (completed ones fold into one line). */
export default function VisaScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const cases = useQuery({ queryKey: qk.visa, queryFn: () => api.visa.list() });
  const visa = cases.data?.items[0] ?? null;
  const eligibility = useQuery({ queryKey: [...qk.visa, 'eligibility'], queryFn: () => api.visa.eligibility(), enabled: cases.isSuccess && !visa });
  const update = useMutation({
    mutationFn: (steps: string[]) => api.visa.update(visa!.id, { completed_steps: steps }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: qk.visa }); void qc.invalidateQueries({ queryKey: qk.dashboard }); },
  });
  const type = visa?.visa_type ?? eligibility.data?.visa_type;
  const status: VisaStatus = visa?.status ?? eligibility.data?.status ?? 'WAITING_FOR_ADMISSION';
  const items: VisaChecklistItem[] = visa?.checklist ?? eligibility.data?.checklist ?? [];
  const nowItem = visa ? items.find((i) => !i.done && !i.blocked) : null;
  const [showDone, setShowDone] = useState(false);
  const doneCount = items.filter((i) => i.done).length;

  return (
    <Screen onRefresh={() => Promise.all([cases.refetch(), eligibility.refetch()])}>
      {cases.isPending ? <LoadingState hero /> : cases.isError ? <ErrorState error={cases.error} onRetry={() => void cases.refetch()} /> : (
        <>
          <View style={{ gap: 4 }}>
            <AppText variant="title" accessibilityRole="header">{type && type !== 'OTHER' ? t('v3.visa.title', { type }) : t('v3.visa.titleGeneric')}</AppText>
            <StatusBadge kind="visa" value={status} />
            {visa?.university ? <AppText variant="caption">{visa.university}</AppText> : null}
            {visa?.route?.post ? (
              <AppText variant="caption">{t(`visaroute:post.${visa.route.post.kind}`, { city: t(`visaroute:city.${visa.route.post.key}`, { defaultValue: visa.route.post.city }) })}
                {visa.route.method ? ` · ${t(`visaroute:method.${visa.route.method}`)}` : ''}</AppText>
            ) : null}
          </View>
          <JourneySteps stages={PHASES.map((p) => t(`v3.visa.phase.${p}`))} current={phaseIndex(status)} />
          {visa && visa.blockers.length ? <Callout tone="danger" title={t('v3.visa.blockers')} body={visa.blockers.join(' · ')} /> : null}
          {nowItem ? (
            <NextAction eyebrow={t('v3.visa.now')} title={visaName(nowItem, t)} body={[visaRule(nowItem), nowItem.detail].filter(Boolean).join(' · ') || null} actionLabel={nowItem.source_url ? t('v3.visa.seeRequirement') : undefined}
              onAction={nowItem.source_url ? () => void Linking.openURL(nowItem.source_url!) : undefined} />
          ) : !visa ? (
            <Callout tone="info" title={t('v3.visa.beforeTitle')} body={t('v3.visa.beforeBody')} />
          ) : null}
          {items.length ? (
            <View style={{ gap: 8 }}>
              <SectionTitle title={visa ? t('v3.visa.checklist', { done: items.filter((i) => i.done).length, total: items.length }) : t('v3.visa.preview')} />
              <ListGroup>
                {items.map((i, n) => (i.done && !showDone ? null : <Step key={i.key} i={i} n={n + 1} items={items} editable={!!visa} busy={update.isPending}
                  onToggle={(on) => update.mutate(on ? [...items.filter((x) => x.done).map((x) => x.key), i.key] : items.filter((x) => x.done && x.key !== i.key).map((x) => x.key))} />))}
              </ListGroup>
              {doneCount ? (
                <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <AppText variant="caption" weight="semibold">{showDone ? t('v4.visa.hideDone') : t('v4.visa.showDone', { count: doneCount })}</AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Step({ i, n, items, editable, busy, onToggle }: { i: VisaChecklistItem; n: number; items: VisaChecklistItem[]; editable: boolean; busy: boolean; onToggle: (on: boolean) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const deps = i.depends_on.map((k) => { const x = items.find((y) => y.key === k); return x ? visaName(x) : k; });
  const detail = [
    visaRule(i),
    i.detail,
    i.blocked && !i.done && deps.length ? t('v3.visa.after', { list: deps.join(', ') }) : null,
    i.country_specific ? t('v3.visa.forNationality') : null,
    i.route_status && !i.done ? t(`visaroute:docStatus.${i.route_status}`) : null,
  ].filter(Boolean).join(' · ');
  const meta = i.verification_status === 'DEMO' ? (i.source_url ? t('common:freshness.source') : null)
    : i.source_url ? (i.verified_at ? t('v3.visa.sourceChecked', { date: f.date(i.verified_at) }) : t('common:freshness.officialSource')) : null;
  return (
    <StepRow n={n} title={`${visaName(i, t)}${i.required ? '' : ` · ${t('common:form.optional')}`}`} detail={detail || null} meta={meta} done={i.done} blocked={i.blocked}
      onToggle={editable && i.toggle !== false ? onToggle : undefined} disabled={busy} onPressMeta={i.source_url ? () => void Linking.openURL(i.source_url!) : undefined} />
  );
}
