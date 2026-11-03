import { useApi } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import {
  AppText, Button, Callout, KeyValue, Lanes, ListGroup, ListItem, LoadingState, lowerKeepAcronyms, NextAction, QueryState, Screen, SectionTitle,
  UploadSheet, isUnavailable, theme, useFormat, v3, type DocumentRequest, type LaneItem, type PickedFile,
} from '@hangyul/mobile-ui';
import type { ApplicationDetail, ApplicationStatus, ChecklistItem, DocumentCategory } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { qk } from '../../src/queries';

const SUBMITTED: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW'];
const PRE_SUBMIT: ApplicationStatus[] = ['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY'];

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery({ queryKey: qk.application(id), queryFn: () => api.applications.get(id), enabled: !!id });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <Stack.Screen options={{ title: localName(query.data?.university) }} />
      <QueryState query={query} loading={<LoadingState hero rows={4} />}>{(a) => <Workspace a={a} />}</QueryState>
    </Screen>
  );
}

/** An application is a project: where it is, what's missing, and who is doing what. */
function Workspace({ a }: { a: ApplicationDetail }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const [uploadFor, setUploadFor] = useState<{ category: DocumentCategory; request?: DocumentRequest; label: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.application(a.id) });
    void qc.invalidateQueries({ queryKey: qk.applications });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    void qc.invalidateQueries({ queryKey: qk.documents });
  };
  const transition = useMutation({
    mutationFn: (to: ApplicationStatus) => api.applications.transition(a.id, { to }),
    onSuccess: (data) => { qc.setQueryData(qk.application(a.id), data); refresh(); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const upload = useMutation({
    mutationFn: async ({ file, category, request }: { file: PickedFile; category: DocumentCategory; request?: DocumentRequest }) => {
      const doc = await v3.uploadDocument(api, file, { category });
      if (request) await v3.fulfillRequest(api, request.id, doc.id).catch((e) => { if (!isUnavailable(e)) throw e; });
      return doc;
    },
    onSuccess: () => { setUploadError(null); refresh(); },
    onError: (e: Error) => setUploadError(e.message),
  });
  const confirm = (to: ApplicationStatus) =>
    Alert.alert(t(`student.applications.confirm.${to}.title`), t(`student.applications.confirm.${to}.body`, { university: localName(a.university) }), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      { text: t(`student.applications.confirm.${to}.cta`), style: to === 'WITHDRAWN' ? 'destructive' : 'default', onPress: () => transition.mutate(to) },
    ]);

  const requests = (a.document_requests ?? []).filter((r) => r.status === 'OPEN');
  const preSubmit = PRE_SUBMIT.includes(a.status);
  const intake = t('common:intakeLabel', { term: t(`common:term.${a.intake.term}`), year: a.intake.year });
  const label = (c: ChecklistItem) => c.label || t(`common:docCategory.${c.category}`);
  const essayLabel = (e: EssayLite) => t(`common:essayType.${e.essay_type}`);

  // V4 "say it once": an essay and the document requirement of the same type are one item, and every item sits in
  // exactly one lane. The lanes are the application's only checklist (no separate "N items remain" / documents list).
  const essayTypes = new Set(a.essays.map((e) => e.essay_type as string));
  const required = a.checklist.filter((c) => c.required && !essayTypes.has(c.category));
  const fixes = required.filter((c) => !c.ready && (c.action_code === 'FIX' || c.action_code === 'LEGALIZE'));
  const uploads = required.filter((c) => !c.ready && c.action_code && ['UPLOAD', 'RENEW', 'TOO_OLD'].includes(c.action_code));
  const inReview = required.filter((c) => !c.ready && c.action_code === 'IN_REVIEW');
  const done = required.filter((c) => c.ready);
  const essaysMine = a.essays.filter((e) => ['DRAFT', 'CHANGES_REQUESTED', 'STUDENT_REVISION'].includes(e.status));
  const essaysTeam = a.essays.filter((e) => ['SUBMITTED', 'AGENCY_REVIEW', 'FINAL_REVIEW', 'AI_PRECHECK'].includes(e.status));
  const essaysDone = a.essays.filter((e) => e.status === 'APPROVED');

  const openUpload = (c: ChecklistItem) => setUploadFor({ category: c.category, label: label(c) });
  const openDoc = (c: ChecklistItem) => (c.document_id ? () => router.push(`/documents/${c.document_id}`) : undefined);

  // The one next step: a university request, then fixes, then uploads, then writing.
  type Next = { key: string; title: string; body: string; cta?: string; onCta?: () => void };
  const blocks = preSubmit ? t('v4.application.blocks') : t('v4.application.blocksUni', { university: localName(a.university) });
  const next: Next | null = requests[0]
    ? { key: `req:${requests[0].id}`, title: t('v4.application.nextRequest', { university: localName(a.university), item: requests[0].label }), body: `“${requests[0].note}” ${blocks}`,
        cta: t('v3.application.uploadRequested'), onCta: () => setUploadFor({ category: (requests[0].category ?? 'OTHER') as DocumentCategory, request: requests[0], label: requests[0].label }) }
    : fixes[0]
      ? { key: fixes[0].requirement_id, title: t(fixes[0].action_code === 'LEGALIZE' ? 'v4.application.nextLegalize' : 'v4.application.nextFix', { item: lowerKeepAcronyms(label(fixes[0])) }),
          body: `${fixes[0].action ?? t(`v3.docAction.${fixes[0].action_code}`)} ${blocks}`, cta: fixes[0].document_id ? t('v4.application.openDocument') : undefined, onCta: openDoc(fixes[0]) }
      : uploads[0]
        ? { key: uploads[0].requirement_id, title: t('v4.application.nextUpload', { item: lowerKeepAcronyms(label(uploads[0])) }), body: `${uploads[0].action ?? ''} ${blocks}`.trim(),
            cta: t('v3.documents.upload'), onCta: () => openUpload(uploads[0]) }
        : essaysMine[0]
          ? { key: `essay:${essaysMine[0].id}`, title: t('v4.application.nextWrite', { item: lowerKeepAcronyms(essayLabel(essaysMine[0])) }), body: `${t('v4.application.writeOnWeb')} ${blocks}` }
          : null;

  const reviewLine = (c: ChecklistItem) => (c.review_overdue ? t('v4.application.reviewLate') : null);
  const youItems: LaneItem[] = [
    ...requests.map((r): LaneItem => ({ label: r.label, detail: `“${r.note}”`, state: 'blocked',
      ...(next?.key === `req:${r.id}` ? {} : { actionLabel: t('v3.documents.upload'), onAction: () => setUploadFor({ category: (r.category ?? 'OTHER') as DocumentCategory, request: r, label: r.label }), disabled: upload.isPending }) })),
    ...fixes.map((c): LaneItem => ({ label: label(c), detail: next?.key === c.requirement_id ? null : c.action ?? t(`v3.docAction.${c.action_code}`), state: 'blocked', onPress: openDoc(c) })),
    ...uploads.map((c): LaneItem => ({ label: label(c), state: 'todo',
      ...(next?.key === c.requirement_id ? {} : { actionLabel: t('v3.documents.upload'), onAction: () => openUpload(c), disabled: upload.isPending }) })),
    ...essaysMine.map((e): LaneItem => ({ label: essayLabel(e), detail: e.due_date ? t('v3.application.due', { date: f.deadline(e.due_date) }) : null, state: 'todo' })),
  ];
  const doneLabels = [...done.map(label), ...essaysDone.map(essayLabel)];
  if (doneLabels.length) youItems.push({ label: t('v4.application.doneSummary', { count: doneLabels.length, items: doneLabels.join(', ') }), state: 'done' });
  const teamItems: LaneItem[] = [
    ...inReview.map((c): LaneItem => ({ label: t('v3.application.reviewing', { item: lowerKeepAcronyms(label(c)) }), state: 'active', warning: reviewLine(c), onPress: openDoc(c) })),
    ...essaysTeam.map((e): LaneItem => ({ label: t('v3.application.reviewing', { item: lowerKeepAcronyms(essayLabel(e)) }), state: 'active' })),
  ];
  if (!teamItems.length) teamItems.push({ label: t(preSubmit ? 'v3.application.teamWaiting' : 'v3.application.teamMonitoring'), state: preSubmit ? 'todo' : 'active' });
  const lanes: { title: string; items: LaneItem[] }[] = [
    { title: t('v3.application.you'), items: youItems.length ? youItems : [{ label: t('v4.application.nothingForYou'), state: 'done' }] },
    { title: t('v23.team.name'), items: teamItems },
    { title: t('v3.application.university'), items: [{ label: t(`v3.application.uni.${preSubmit ? 'waiting' : SUBMITTED.includes(a.status) ? 'reviewing' : 'decided'}`), state: preSubmit ? 'todo' : SUBMITTED.includes(a.status) ? 'active' : 'done' }] },
  ];
  const deadlineMeta = preSubmit ? t('v3.application.closes', { date: f.deadline(a.intake.application_deadline), left: f.due(a.intake.application_deadline) }) : null;

  return (
    <>
      <View style={{ gap: 4 }}>
        <AppText variant="title" accessibilityRole="header">{localName(a.program)}</AppText>
        <AppText variant="caption">{localName(a.university)} · {intake}</AppText>
        <AppText variant="body" style={{ marginTop: 6 }}>{t(`v3.appStatus.${a.status}`, { university: localName(a.university) })}</AppText>
      </View>

      {a.status === 'OFFERED' ? <OfferNext a={a} onAccept={() => confirm('OFFER_ACCEPTED')} loading={transition.isPending} /> : null}

      {next ? (
        <NextAction eyebrow={t('v4.application.next')} title={next.title} body={next.body} meta={deadlineMeta} actionLabel={next.cta} onAction={next.onCta} />
      ) : preSubmit && a.allowed_transitions.includes('SUBMITTED') ? (
        <NextAction eyebrow={t('v4.application.next')} title={t('v3.application.ready')} body={t('v3.application.readyBody')} meta={deadlineMeta}
          actionLabel={t('v3.application.submit')} onAction={() => confirm('SUBMITTED')} />
      ) : preSubmit ? (
        <Callout tone="info" title={t('v4.application.waitTitle')} body={[t('v4.application.waitBody'), deadlineMeta].filter(Boolean).join(' ')} />
      ) : SUBMITTED.includes(a.status) ? (
        <Callout tone="info" title={t('v3.application.reviewTitle', { university: localName(a.university) })} body={t('v3.application.reviewBody', { date: a.submitted_at ? f.date(a.submitted_at) : '—' })} />
      ) : null}
      {uploadError ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{uploadError}</AppText> : null}

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.application.who')} />
        <Lanes lanes={lanes} />
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.application.timeline')} />
        <ListGroup>
          {[...a.history].reverse().slice(0, 3).map((h, i) => (
            <ListItem key={`${h.to}-${i}`} title={t(`common:appStatus.${h.to}`)} subtitle={[f.dateTime(h.at), h.note].filter(Boolean).join(' · ')} />
          ))}
        </ListGroup>
      </View>

      {a.allowed_transitions.includes('WITHDRAWN') ? (
        <Pressable onPress={() => confirm('WITHDRAWN')} accessibilityRole="button" hitSlop={8} style={styles.withdraw}>
          <AppText variant="caption" weight="semibold" tone="danger">{t('v3.application.withdraw')}</AppText>
        </Pressable>
      ) : null}
      <UploadSheet visible={!!uploadFor} title={uploadFor ? t('v3.application.uploadFor', { item: uploadFor.label }) : ''} onClose={() => setUploadFor(null)}
        onPicked={(file) => uploadFor && upload.mutate({ file, category: uploadFor.category, request: uploadFor.request })} />
    </>
  );
}

type EssayLite = ApplicationDetail['essays'][number];

function OfferNext({ a, onAccept, loading }: { a: ApplicationDetail; onAccept: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const steps = ['review', 'accept', 'tuition', 'letter', 'visa'] as const;
  return (
    <View style={styles.offer}>
      <AppText variant="title">{t('v3.offer.label')}</AppText>
      <AppText variant="body">{t('v3.offer.body', { university: localName(a.university), program: localName(a.program) })}</AppText>
      {a.tuition_due ? <AppText variant="caption" weight="semibold" color={theme.color.text}>{t('v3.offer.deadline', { date: f.deadline(a.tuition_due), left: f.due(a.tuition_due) })}</AppText> : null}
      {a.offer_scholarship_note ? <KeyValue label={t('v3.offer.scholarship')} value={a.offer_scholarship_note} /> : null}
      {a.tuition_amount_krw ? <KeyValue label={t('v3.offer.tuition')} value={f.money(a.tuition_amount_krw)} /> : null}
      <AppText variant="subheading" style={{ marginTop: 8 }}>{t('v3.offer.next')}</AppText>
      {steps.map((s, i) => <AppText key={s} variant="body">{i + 1}. {t(`v3.offer.step.${s}`)}</AppText>)}
      <AppText variant="caption">{t('v3.offer.tuitionDirect')}</AppText>
      {a.allowed_transitions.includes('OFFER_ACCEPTED') ? <Button label={t('v3.offer.accept')} onPress={onAccept} loading={loading} fullWidth style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  offer: { backgroundColor: theme.color.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.color.border, padding: 18, gap: 6 },
  withdraw: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
