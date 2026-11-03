import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  absoluteApiUrl, AppText, Button, Callout, CheckRow, ListGroup, ListItem, LoadingState, QueryState, Screen,
  SectionHeader, StatusBadge, UploadSheet, useFormat, v3, type PickedFile,
} from '@hangyul/mobile-ui';
import type { VaultDocument } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ExternalLink, History, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { qk } from '../../src/queries';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery({ queryKey: qk.document(id), queryFn: () => api.documents.get(id), enabled: !!id });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <Stack.Screen options={{ title: query.data?.title ?? '' }} />
      <QueryState query={query} loading={<LoadingState hero rows={3} />}>{(d) => <Detail d={d} />}</QueryState>
    </Screen>
  );
}

function Detail({ d }: { d: VaultDocument }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: (progress: string[]) => api.documents.update(d.id, { legalization_progress: progress }),
    onMutate: async (progress) => {
      await qc.cancelQueries({ queryKey: qk.document(d.id) });
      const prev = qc.getQueryData<VaultDocument>(qk.document(d.id));
      if (prev) qc.setQueryData(qk.document(d.id), { ...prev, legalization_progress: progress });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.document(d.id), ctx.prev);
      Alert.alert(t('common:states.error'), e.message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.document(d.id) });
      void qc.invalidateQueries({ queryKey: qk.documents });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });

  const open = useMutation({
    mutationFn: () => api.documents.downloadUrl(d.id, 'inline'),
    onSuccess: (r) => void Linking.openURL(absoluteApiUrl(r.url)),
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });

  const [picking, setPicking] = useState(false);
  const upload = useMutation({
    mutationFn: (file: PickedFile) => v3.uploadDocument(api, file, { category: d.category, document_id: d.id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.document(d.id) }); void qc.invalidateQueries({ queryKey: qk.documents }); void qc.invalidateQueries({ queryKey: qk.dashboard }); },
  });
  const steps = d.legalization?.steps ?? [];
  const done = new Set(d.legalization_progress);
  const toggle = (key: string, on: boolean) => {
    const next = on ? [...done, key] : [...done].filter((k) => k !== key);
    update.mutate(next);
  };

  return (
    <>
      <View style={{ gap: 6 }}>
        <AppText variant="title" accessibilityRole="header">{t(`common:docCategory.${d.category}`, { defaultValue: d.title })}</AppText>
        <StatusBadge kind="document" value={d.status} />
      </View>
      {d.status === 'NEEDS_CORRECTION' ? (
        <Callout tone="danger" title={t('student.documents.fixTitle')} body={d.rejection_reason ?? t('student.documents.fixFallback')} />
      ) : null}
      {d.translation_required ? <Callout tone="warning" body={t('student.documents.translationBody')} /> : null}
      <ListGroup>
        {d.issuing_country ? <ListItem title={t('v3.documents.issuedIn')} subtitle={countryName(d.issuing_country, f.locale)} /> : null}
        {d.issue_date ? <ListItem title={t('v3.documents.issuedOn')} subtitle={f.date(d.issue_date)} /> : null}
        {d.expires_on ? <ListItem title={t('v3.documents.validUntilLabel')} subtitle={f.date(d.expires_on)} /> : null}
        {d.latest_file ? <ListItem icon={ExternalLink} title={t('student.documents.openFile')} subtitle={t('student.documents.file', { name: d.latest_file.filename, version: d.current_version })} onPress={() => open.mutate()} /> : null}
      </ListGroup>
      {d.status !== 'VERIFIED' ? (
        <Button label={d.latest_file ? t('v3.documents.newVersion') : t('v3.documents.upload')} variant={d.status === 'NEEDS_CORRECTION' ? 'primary' : 'secondary'} icon={Upload} loading={upload.isPending} onPress={() => setPicking(true)} fullWidth />
      ) : null}
      {upload.isError ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{(upload.error as Error).message}</AppText> : null}

      {d.legalization_path !== 'NONE' && steps.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title={t('v3.documents.howTo', { path: t(`common:legalization.${d.legalization_path}`) })} />
          <AppText variant="caption">{t('v3.documents.howToBody')}</AppText>
          <ListGroup>
            {steps.map((st) => (
              <CheckRow key={st.key} label={st.title} detail={st.detail} checked={done.has(st.key)} onToggle={(on) => toggle(st.key, on)} disabled={update.isPending || st.key === 'verify'} />
            ))}
          </ListGroup>
          {d.legalization?.note ? <AppText variant="caption">{d.legalization.note}</AppText> : null}
          {d.legalization?.source_url ? (
            <Button label={d.legalization.verified_at ? t('v3.documents.sourceVerified', { date: f.date(d.legalization.verified_at) }) : t('common:freshness.officialSource')} variant="ghost" icon={ExternalLink} onPress={() => void Linking.openURL(d.legalization!.source_url!)} />
          ) : null}
        </View>
      ) : null}

      {d.reviews && d.reviews.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title={t('student.documents.reviews')} />
          <ListGroup>
            {d.reviews.map((r, i) => (
              <ListItem key={`${r.at}-${i}`} icon={History} title={t(`common:docStatus.${r.decision}`, { defaultValue: r.decision })} subtitle={r.reason} meta={`${r.reviewer} · ${f.dateTime(r.at)} · v${r.version}`} />
            ))}
          </ListGroup>
        </View>
      ) : null}
      <UploadSheet visible={picking} title={t('v3.documents.newVersion')} onClose={() => setPicking(false)} onPicked={(file) => upload.mutate(file)} />
    </>
  );
}
