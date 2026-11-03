import { useApi } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import {
  AppText, Avatar, Button, Callout, ListGroup, ListItem, LoadingState, PickerSheet, PromptSheet, QueryState, Screen, SectionTitle, StatusBadge,
  UploadSheet, useConversations, useFormat, type PickedFile,
} from '@hangyul/mobile-ui';
import { PIPELINE_STAGES, type DocumentCategory, type PipelineStage, type StudentWorkspace } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { GitBranch, MessageCircle, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { qk } from '../../src/queries';

const UPLOAD_CATEGORIES: DocumentCategory[] = ['PASSPORT', 'PHOTO', 'TRANSCRIPT', 'GRADUATION_CERTIFICATE', 'BANK_STATEMENT', 'TOPIK', 'IELTS', 'FAMILY_RELATION_CERTIFICATE', 'APOSTILLE', 'CERTIFIED_TRANSLATION', 'OTHER'];

export default function StudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const q = useQuery({ queryKey: qk.student(id), queryFn: () => api.agency.student(id), enabled: !!id });
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: q.data?.student.full_name ?? '' }} />
      <QueryState query={q} loading={<LoadingState hero rows={4} />}>{(w) => <Workspace w={w} />}</QueryState>
    </Screen>
  );
}

/** What is stopping this student from moving forward — then the actions to unblock them. */
function Workspace({ w }: { w: StudentWorkspace }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const convs = useConversations(w.student.id);
  const [stagePicker, setStagePicker] = useState(false);
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null);
  const [catPicker, setCatPicker] = useState(false);
  const [category, setCategory] = useState<DocumentCategory | null>(null);
  const [firstMessage, setFirstMessage] = useState(false);
  const p = w.profile;
  const invalidate = () => { void qc.invalidateQueries({ queryKey: qk.student(w.student.id) }); void qc.invalidateQueries({ queryKey: ['agency'] }); };

  const setStage = useMutation({
    mutationFn: (v: { stage: PipelineStage; note?: string }) => api.agency.setStage(w.student.id, v.stage, v.note),
    onSuccess: () => { setPendingStage(null); invalidate(); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const upload = useMutation({
    mutationFn: (v: { file: PickedFile; category: DocumentCategory }) => api.documents.upload(v.file, { category: v.category, student_user_id: w.student.id }),
    onSuccess: () => { invalidate(); Alert.alert(t('v3.agency.uploaded')); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const start = useMutation({
    mutationFn: (body: string) => api.messages.start({ subject: t('v3.agency.conversationSubject'), body, student_id: w.student.id }),
    onSuccess: (c) => { setFirstMessage(false); void qc.invalidateQueries({ queryKey: ['conversations'] }); router.push(`/messages/${c.id}`); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const message = () => { const c = convs.data?.[0]; if (c) router.push(`/messages/${c.id}`); else setFirstMessage(true); };

  const toFix = w.documents.filter((d) => d.status === 'NEEDS_CORRECTION' || d.status === 'EXPIRED');
  const toReview = w.documents.filter((d) => d.status === 'UPLOADED' || d.status === 'NEEDS_REVIEW');
  const soon = w.applications.filter((a) => { const d = f.daysUntil(a.intake.application_deadline); return d !== null && d >= 0 && d <= 21 && ['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY'].includes(a.status); });
  const slaDue = w.assignment?.first_response_due_at && !w.assignment.first_response_at ? w.assignment.first_response_due_at : null;
  const blockers = [
    slaDue ? { key: 'sla', title: t('v3.agency.block.sla'), detail: f.due(slaDue) } : null,
    ...toFix.map((d) => ({ key: `fix-${d.id}`, title: t('v3.agency.block.fix', { doc: t(`common:docCategory.${d.category}`) }), detail: d.rejection_reason, go: () => router.push(`/reviews/${d.id}`) })),
    ...toReview.map((d) => ({ key: `rev-${d.id}`, title: t('v3.agency.block.review', { doc: t(`common:docCategory.${d.category}`) }), detail: f.relative(d.updated_at), go: () => router.push(`/reviews/${d.id}`) })),
    ...w.applications.filter((a) => a.status === 'ADDITIONAL_DOCUMENTS' || (a.open_document_requests ?? 0) > 0).map((a) => ({ key: `req-${a.id}`, title: t('v3.agency.block.requested', { uni: localName(a.university) }), detail: localName(a.program) })),
    ...soon.map((a) => ({ key: `due-${a.id}`, title: t('v3.agency.block.deadline', { uni: localName(a.university) }), detail: `${f.deadline(a.intake.application_deadline)} · ${f.due(a.intake.application_deadline)}` })),
  ].filter(Boolean) as { key: string; title: string; detail?: string | null; go?: () => void }[];

  return (
    <>
      <View style={styles.head}>
        <Avatar name={w.student.full_name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={2}>{w.student.full_name}</AppText>
          <AppText variant="caption" numberOfLines={1}>
            {[p.nationality ? countryName(p.nationality, f.locale) : null, p.target_degree ? t(`common:degreeShort.${p.target_degree}`) : null,
              p.target_intake_term && p.target_intake_year ? t('common:intakeLabel', { term: t(`common:term.${p.target_intake_term}`), year: p.target_intake_year }) : null].filter(Boolean).join(' · ')}
          </AppText>
          <StatusBadge kind="pipeline" value={p.pipeline_stage} style={{ marginTop: 4 }} />
        </View>
      </View>
      <View style={styles.actions}>
        <Button label={t('v3.agency.message')} icon={MessageCircle} size="sm" onPress={message} style={{ flex: 1 }} />
        <Button label={t('v3.agency.upload')} icon={Upload} size="sm" variant="secondary" onPress={() => setCatPicker(true)} loading={upload.isPending} style={{ flex: 1 }} />
        <Button label={t('v3.agency.stage')} icon={GitBranch} size="sm" variant="secondary" onPress={() => setStagePicker(true)} style={{ flex: 1 }} />
      </View>
      {w.assignment ? <AppText variant="caption">{t('v3.agency.assigned', { counselor: w.assignment.counselor?.full_name ?? '—', since: f.date(w.assignment.since) })}{w.services.length ? ` · ${w.services.map((s) => s.name).join(', ')}` : ''}</AppText> : null}

      <View style={{ gap: 8 }}>
        <SectionTitle title={blockers.length ? t('v3.agency.blockers', { count: blockers.length }) : t('v3.agency.noBlockers')} />
        {blockers.length ? (
          <ListGroup>{blockers.map((b) => <ListItem key={b.key} title={b.title} subtitle={b.detail ?? null} onPress={b.go} />)}</ListGroup>
        ) : <Callout tone="success" body={t('v3.agency.noBlockersBody')} />}
      </View>

      {w.applications.length ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={t('v3.agency.applications', { count: w.applications.length })} />
          <ListGroup>
            {w.applications.map((a) => (
              <ListItem key={a.id} title={localName(a.university)} subtitle={localName(a.program)} meta={t('v3.home.closes', { date: f.deadlineShort(a.intake.application_deadline), left: f.due(a.intake.application_deadline) })}
                footer={<StatusBadge kind="application" value={a.status} />} />
            ))}
          </ListGroup>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.agency.documents', { verified: w.documents.filter((d) => d.status === 'VERIFIED').length, total: w.documents.length })} />
        <ListGroup>
          {w.documents.map((d) => <ListItem key={d.id} title={t(`common:docCategory.${d.category}`)} subtitle={d.status === 'NEEDS_CORRECTION' ? d.rejection_reason : null} footer={<StatusBadge kind="document" value={d.status} />} onPress={() => router.push(`/reviews/${d.id}`)} />)}
        </ListGroup>
      </View>

      <PickerSheet visible={stagePicker} title={t('v3.agency.stage')} selected={p.pipeline_stage} cancelLabel={t('common:actions.cancel')} onCancel={() => setStagePicker(false)}
        options={PIPELINE_STAGES.map((s) => ({ value: s, label: t(`common:pipeline.${s}`) }))} onSelect={(s) => { setStagePicker(false); if (s !== p.pipeline_stage) setPendingStage(s); }} />
      <PromptSheet visible={!!pendingStage} title={t('v3.agency.stageTo', { stage: pendingStage ? t(`common:pipeline.${pendingStage}`) : '' })} label={t('v3.agency.stageNote')}
        confirmLabel={t('common:actions.save')} cancelLabel={t('common:actions.cancel')} loading={setStage.isPending} onCancel={() => setPendingStage(null)}
        onSubmit={(note) => pendingStage && setStage.mutate({ stage: pendingStage, note: note || undefined })} />
      <PickerSheet visible={catPicker} title={t('v3.agency.uploadWhat')} cancelLabel={t('common:actions.cancel')} onCancel={() => setCatPicker(false)}
        options={UPLOAD_CATEGORIES.map((c) => ({ value: c, label: t(`common:docCategory.${c}`) }))} onSelect={(c) => { setCatPicker(false); setCategory(c); }} />
      <UploadSheet visible={!!category} title={category ? t('v3.agency.uploadFor', { doc: t(`common:docCategory.${category}`), name: w.student.full_name }) : ''}
        onClose={() => setCategory(null)} onPicked={(file) => category && upload.mutate({ file, category })} />
      <PromptSheet visible={firstMessage} title={t('v3.agency.firstMessage', { name: w.student.full_name })} label={t('v3.agency.messageLabel')}
        confirmLabel={t('common:actions.send')} cancelLabel={t('common:actions.cancel')} minLength={1} loading={start.isPending}
        onCancel={() => setFirstMessage(false)} onSubmit={(body) => start.mutate(body)} />
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
});
