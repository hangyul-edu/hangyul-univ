import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  AppText, Button, EmptyState, ListGroup, ListItem, ProgressBar, QueryState, Screen, SectionTitle, StatusText, UploadSheet, theme, useFormat, v3,
  type PickedFile,
} from '@hangyul/mobile-ui';
import type { ChecklistItem, DocumentCategory, VaultDocument } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { FileText, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { qk, useDashboard } from '../../src/queries';

type State = 'fix' | 'legalize' | 'review' | 'ready';
const stateOf = (d: VaultDocument): State =>
  d.status === 'NEEDS_CORRECTION' || d.status === 'EXPIRED' ? 'fix'
    : d.status === 'VERIFIED' ? (d.legalization_status === 'REQUIRED' || d.legalization_status === 'IN_PROGRESS' ? 'legalize' : 'ready') : 'review';
const REVIEW_TARGET_MS = 48 * 3600 * 1000;
const TONE = { fix: 'danger', legalize: 'warning', review: 'info', ready: 'success' } as const;

/** What documents do I still need? Requirements first, files second. */
export default function DocumentsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: qk.documents, queryFn: () => api.documents.list({ page_size: 200 }) });
  const dash = useDashboard();
  const [target, setTarget] = useState<{ category: DocumentCategory; label: string } | null>(null);
  const upload = useMutation({
    mutationFn: ({ file, category }: { file: PickedFile; category: DocumentCategory }) => v3.uploadDocument(api, file, { category }),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: qk.documents });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      router.push(`/documents/${d.id}`);
    },
  });
  const toUpload: ChecklistItem[] = (dash.data?.missing_documents ?? []).filter((m) => m.action_code === 'UPLOAD');

  return (
    <Screen onRefresh={() => Promise.all([docs.refetch(), dash.refetch()])}>
      <Stack.Screen options={{ title: t('common:nav.documents') }} />
      <QueryState query={docs}>
        {(page) => {
          const rows = page.items.map((d) => ({ d, s: stateOf(d) }));
          const needs = rows.filter((r) => r.s === 'fix' || r.s === 'legalize');
          const review = rows.filter((r) => r.s === 'review');
          const ready = rows.filter((r) => r.s === 'ready');
          const total = rows.length + toUpload.length;
          if (!total) return <EmptyState icon={FileText} title={t('student.documents.empty')} body={t('student.documents.emptyBody')} />;
          return (
            <>
              <View style={{ gap: 8 }}>
                <AppText variant="title">{t('v3.documents.readyOf', { ready: ready.length, total })}</AppText>
                <ProgressBar value={(ready.length / total) * 100} tone="success" height={6} accessibilityLabel={t('v3.documents.readyOf', { ready: ready.length, total })} />
                <AppText variant="caption">{needs.length + toUpload.length ? t('v3.documents.needYou', { count: needs.length + toUpload.length }) : t('v3.documents.allSet')}</AppText>
              </View>
              {upload.isError ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{(upload.error as Error).message}</AppText> : null}
              {needs.length + toUpload.length ? (
                <View style={{ gap: 8 }}>
                  <SectionTitle title={t('v3.documents.needsYou')} />
                  <ListGroup>
                    {/* Blocking fixes first, then what is still missing. */}
                    {needs.map(({ d, s }) => (
                      <ListItem key={d.id} title={t(`common:docCategory.${d.category}`)} subtitle={s === 'fix' ? d.rejection_reason : t('v3.documents.legalize', { path: t(`common:legalization.${d.legalization_path}`) })}
                        trailing={<StatusText label={t(`v3.documents.state.${s}`)} tone={TONE[s]} />} onPress={() => router.push(`/documents/${d.id}`)} />
                    ))}
                    {toUpload.map((m) => (
                      <ListItem key={`u-${m.requirement_id}`} title={m.label || t(`common:docCategory.${m.category}`)} subtitle={m.university ? t('v3.documents.neededFor', { university: m.university }) : null}
                        trailing={<Button label={t('v3.documents.upload')} size="sm" variant="secondary" disabled={upload.isPending} onPress={() => setTarget({ category: m.category, label: m.label || t(`common:docCategory.${m.category}`) })} />} />
                    ))}
                  </ListGroup>
                </View>
              ) : null}
              {review.length ? (
                <View style={{ gap: 8 }}>
                  <SectionTitle title={t('v3.documents.checking')} />
                  <ListGroup>
                    {review.map(({ d }) => {
                      // V4: time is information — a review past its 48 h target is said, never hidden behind "being checked".
                      const late = Date.now() - new Date(d.updated_at).getTime() > REVIEW_TARGET_MS;
                      return (
                        <ListItem key={d.id} title={t(`common:docCategory.${d.category}`)}
                          subtitle={late ? `${t('v3.documents.submitted', { when: f.relative(d.updated_at) })} · ${t('v4.documents.lateLine')}` : t('v3.documents.submitted', { when: f.relative(d.updated_at) })}
                          trailing={<StatusText label={t(late ? 'v4.documents.late' : 'v3.documents.state.review')} tone={late ? 'warning' : 'info'} />} onPress={() => router.push(`/documents/${d.id}`)} />
                      );
                    })}
                  </ListGroup>
                </View>
              ) : null}
              {ready.length ? (
                <View style={{ gap: 8 }}>
                  <SectionTitle title={t('v3.documents.readyTitle')} />
                  <ListGroup>
                    {ready.map(({ d }) => <ListItem key={d.id} title={t(`common:docCategory.${d.category}`)} subtitle={d.expires_on ? t('v3.documents.validUntil', { date: f.date(d.expires_on) }) : null} trailing={<StatusText label={t('v3.documents.ready')} tone="success" />} onPress={() => router.push(`/documents/${d.id}`)} />)}
                  </ListGroup>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Lock size={14} color={theme.color.textTertiary} style={{ marginTop: 2 }} />
                <AppText variant="caption" style={{ flex: 1 }}>{t('v3.upload.privacy')}</AppText>
              </View>
            </>
          );
        }}
      </QueryState>
      <UploadSheet visible={!!target} title={target ? t('v3.application.uploadFor', { item: target.label }) : ''} onClose={() => setTarget(null)}
        onPicked={(file) => target && upload.mutate({ file, category: target.category })} />
    </Screen>
  );
}
