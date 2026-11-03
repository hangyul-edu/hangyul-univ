import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  absoluteApiUrl, AppText, Button, Callout, CheckRow, ChipGroup, KeyValue, ListGroup, ListItem, LoadingState, QueryState, Screen, SectionTitle, Sheet,
  StatusBadge, TextField, useFormat,
} from '@hangyul/mobile-ui';
import type { Page, VaultDocument } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, ExternalLink, History } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { qk } from '../../src/queries';

const CHECKS = ['legible', 'name', 'issuer', 'date'] as const;

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const q = useQuery({ queryKey: qk.document(id), queryFn: () => api.documents.get(id), enabled: !!id });
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: q.data ? q.data.owner_name ?? '' : '' }} />
      <QueryState query={q} loading={<LoadingState hero rows={3} />}>{(d) => <Review d={d} />}</QueryState>
    </Screen>
  );
}

/** Look → check → decide → next. Correction reasons come from the team's templates. */
function Review({ d }: { d: VaultDocument }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState('');
  const checks: string[] = [...CHECKS, ...(d.legalization_path !== 'NONE' ? ['legal'] : [])];
  const [ticked, setTicked] = useState<string[]>([]);
  const allTicked = checks.every((c) => ticked.includes(c));
  // V23 §274 N4: one role per agency tenant — any member reviews; the server enforces who may (403 otherwise).
  const canReview = ['UPLOADED', 'NEEDS_REVIEW', 'PROCESSING'].includes(d.status);
  const templates = useQuery({ queryKey: ['templates', 'DOCUMENT_CORRECTION'], queryFn: () => api.templates.list('DOCUMENT_CORRECTION'), enabled: canReview, staleTime: 10 * 60_000 });
  const preview = useMutation({
    mutationFn: () => api.documents.downloadUrl(d.id, 'inline'),
    onSuccess: (r) => void Linking.openURL(absoluteApiUrl(r.url)),
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const goNext = () => {
    const queue = qc.getQueryData<Page<VaultDocument>>(qk.reviewQueue)?.items.filter((x) => x.id !== d.id) ?? [];
    if (queue[0]) router.replace(`/reviews/${queue[0].id}`); else router.back();
  };
  const review = useMutation({
    mutationFn: (v: { decision: 'VERIFIED' | 'NEEDS_CORRECTION'; reason?: string }) => api.documents.review(d.id, v.decision, v.reason),
    onSuccess: (doc) => {
      setCorrecting(false);
      qc.setQueryData(qk.document(d.id), doc);
      void qc.invalidateQueries({ queryKey: qk.reviewQueue });
      void qc.invalidateQueries({ queryKey: ['agency'] });
      goNext();
    },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const { i18n } = useTranslation();
  const localTemplates = (templates.data?.items ?? []).filter((x) => x.locale?.slice(0, 2) === i18n.language.slice(0, 2));
  const shownTemplates = localTemplates.length ? localTemplates : (templates.data?.items ?? []).filter((x) => !x.locale || x.locale.startsWith('en'));
  const fill = (body: string) => body.replace(/\{\{\s*student_name\s*\}\}/g, d.owner_name ?? '').replace(/\{\{\s*document\s*\}\}/g, t(`common:docCategory.${d.category}`));

  return (
    <>
      <View style={{ gap: 4 }}>
        <AppText variant="title" accessibilityRole="header">{t(`common:docCategory.${d.category}`, { defaultValue: d.title })}</AppText>
        <AppText variant="caption">{[d.owner_name, d.owner_nationality ? countryName(d.owner_nationality, f.locale) : null, t('v3.reviews.uploaded', { when: f.relative(d.updated_at) })].filter(Boolean).join(' · ')}</AppText>
        <StatusBadge kind="document" value={d.status} style={{ marginTop: 4 }} />
      </View>
      {d.latest_file ? (
        <Button label={t('v3.reviews.open', { name: d.latest_file.filename })} icon={ExternalLink} variant="secondary" loading={preview.isPending} onPress={() => preview.mutate()} fullWidth />
      ) : <Callout tone="warning" body={t('agency.reviews.noFile')} />}
      <ListGroup>
        <View style={{ padding: 16, gap: 2 }}>
          {d.issuing_country ? <KeyValue label={t('v3.reviews.issuedIn')} value={countryName(d.issuing_country, f.locale)} /> : null}
          {d.issue_date ? <KeyValue label={t('v3.reviews.issuedOn')} value={f.date(d.issue_date)} /> : null}
          {d.expires_on ? <KeyValue label={t('v3.reviews.expires')} value={f.date(d.expires_on)} /> : null}
          <KeyValue label={t('v3.reviews.legalization')} value={d.legalization_path === 'NONE' ? t('v3.reviews.notNeeded') : t(`common:legalization.${d.legalization_path}`)} />
          {d.translation_required ? <KeyValue label={t('v3.reviews.translation')} value={t('v3.reviews.required')} tone="warning" /> : null}
        </View>
      </ListGroup>
      {d.rejection_reason ? <Callout tone="danger" title={t('agency.reviews.lastReason')} body={d.rejection_reason} /> : null}
      {canReview ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={t('v3.reviews.beforeVerify')} />
          {/* V4: Verify unlocks when every check is ticked — the checklist is the review, not decoration. */}
          <ListGroup>
            {checks.map((c) => (
              <CheckRow key={c} label={c === 'legal' ? t('v3.reviews.check.legal', { path: t(`common:legalization.${d.legalization_path}`) }) : t(`v3.reviews.check.${c}`)}
                checked={ticked.includes(c)} onToggle={() => setTicked((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))} />
            ))}
          </ListGroup>
          {!allTicked ? <AppText variant="caption">{t('v4.reviews.tickAll', { done: ticked.length, total: checks.length })}</AppText> : null}
          <Button label={t('agency.reviews.verify')} icon={BadgeCheck} onPress={() => review.mutate({ decision: 'VERIFIED' })} disabled={!allTicked} loading={review.isPending && review.variables?.decision === 'VERIFIED'} fullWidth style={{ marginTop: 8 }} />
          <Button label={t('v3.reviews.requestCorrection')} variant="secondary" onPress={() => setCorrecting(true)} fullWidth />
        </View>
      ) : <Callout tone="info" body={t('agency.reviews.notReviewable')} />}
      {d.reviews?.length ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={t('agency.reviews.history')} />
          <ListGroup>{d.reviews.map((r, i) => <ListItem key={`${r.at}-${i}`} icon={History} title={t(`common:docStatus.${r.decision}`, { defaultValue: r.decision })} subtitle={r.reason} meta={`${r.reviewer} · ${f.dateTime(r.at)} · v${r.version}`} />)}</ListGroup>
        </View>
      ) : null}
      <Sheet visible={correcting} title={t('v3.reviews.correctionTitle')} onClose={() => setCorrecting(false)} closeLabel={t('common:actions.cancel')}
        footer={<Button label={t('agency.reviews.sendToStudent')} onPress={() => review.mutate({ decision: 'NEEDS_CORRECTION', reason: reason.trim() })} disabled={reason.trim().length < 3} loading={review.isPending} fullWidth />}>
        {shownTemplates.length ? (
          <View style={{ gap: 6 }}>
            <AppText variant="label">{t('v3.reviews.templates')}</AppText>
            <ChipGroup options={shownTemplates.map((x) => ({ value: x.id, label: x.title }))} selected={[]} onToggle={(id) => { const x = shownTemplates.find((y) => y.id === id); if (x) setReason(fill(x.body)); }} />
          </View>
        ) : null}
        <TextField label={t('v3.reviews.reason')} value={reason} onChangeText={setReason} multiline placeholder={t('agency.reviews.reasonPlaceholder')} />
        <AppText variant="caption">{d.owner_name ? t('v3.reviews.studentSees', { name: d.owner_name }) : t('v3.reviews.studentSeesGeneric')}</AppText>
      </Sheet>
    </>
  );
}
