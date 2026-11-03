import { useApi } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import {
  absoluteApiUrl, AppText, Avatar, Button, Callout, KeyValue, ListGroup, ListItem, LoadingState, PickerSheet, PromptSheet, QueryState,
  Screen, SectionTitle, Sheet, StatusBadge, StatusText, TextField, theme, useFormat,
} from '@hangyul/mobile-ui';
import type { ApplicationDetail, ApplicationStatus, ChecklistItem, Program } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Flag, FlagOff, MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { qk, useCanDecide } from '../../src/queries';

const NEGATIVE: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN'];
type Check = { key: string; label: string; need: string; have: string | null; state: 'meets' | 'below' | 'missing' | 'planned' | 'unscheduled' };

export default function ApplicantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const api = useApi();
  const q = useQuery({ queryKey: qk.applicant(id), queryFn: () => api.applications.get(id), enabled: !!id });
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: t('v3.uni.applicant') }} />
      <QueryState query={q} loading={<LoadingState hero rows={4} />}>{(a) => <Applicant a={a} />}</QueryState>
    </Screen>
  );
}

/** Published minimums vs. what the applicant reported. A reviewer aid, never an automatic decision. */
function useChecks(a: ApplicationDetail): Check[] | null {
  const { t } = useTranslation();
  const api = useApi();
  const programs = useQuery({ queryKey: ['university', 'programs'], queryFn: () => api.university.programs(), staleTime: 300_000 });
  const r = programs.data?.find((p: Program) => p.id === a.program.id)?.requirements;
  if (!r) return programs.isPending ? null : [];
  const sp = a.student_profile;
  const gpa = Math.max(-1, ...(sp?.education ?? []).map((e) => e.gpa_percent ?? -1));
  const lang = (test: string) => (sp?.languages ?? []).filter((l) => l.test === test).sort((x, y) => Number(x.is_planned) - Number(y.is_planned) || y.score - x.score)[0];
  const out: Check[] = [];
  if (r.min_gpa_percent !== null) out.push({ key: 'gpa', label: t('v3.uni.check.gpa'), need: `${r.min_gpa_percent}%`, have: gpa >= 0 ? `${Math.round(gpa)}%` : null, state: gpa < 0 ? 'missing' : gpa >= r.min_gpa_percent ? 'meets' : 'below' });
  const langChecks: Check[] = [];
  for (const [test, min] of [['TOPIK', r.min_topik_level], ['IELTS', r.min_ielts], ['TOEFL_IBT', r.min_toefl_ibt]] as const) {
    if (min === null) continue;
    const l = lang(test);
    langChecks.push({ key: test, label: test === 'TOPIK' ? t('v3.uni.check.topik') : test === 'IELTS' ? 'IELTS' : 'TOEFL iBT', need: test === 'TOPIK' ? t('v3.uni.check.level', { level: min }) : String(min),
      have: l ? (test === 'TOPIK' ? t('v3.uni.check.level', { level: l.score }) : String(l.score)) : null, state: !l ? 'missing' : l.is_planned ? 'planned' : l.score >= min ? 'meets' : 'below' });
  }
  // With language alternatives, one met test is enough.
  const met = langChecks.find((c) => c.state === 'meets');
  out.push(...(r.language_alternative && met ? [met] : langChecks));
  if (r.requires_interview) out.push({ key: 'interview', label: t('v3.uni.check.interview'), need: '', have: null, state: a.interview_at ? 'meets' : 'unscheduled' });
  return out;
}

function Applicant({ a }: { a: ApplicationDetail }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const canDecide = useCanDecide();
  const checks = useChecks(a);
  const [pending, setPending] = useState<ApplicationStatus | null>(null);
  const [more, setMore] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const refresh = (data?: ApplicationDetail) => {
    if (data) qc.setQueryData(qk.applicant(a.id), data);
    else void qc.invalidateQueries({ queryKey: qk.applicant(a.id) });
    void qc.invalidateQueries({ queryKey: ['applications'] });
    void qc.invalidateQueries({ queryKey: ['university'] });
  };
  const transition = useMutation({
    mutationFn: (v: { to: ApplicationStatus; note?: string }) => api.applications.transition(a.id, v),
    onSuccess: (data) => { setPending(null); refresh(data); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const flag = useMutation({
    mutationFn: (v: { flagged: boolean; flag_reason: string | null }) => api.applications.update(a.id, v),
    onSuccess: () => { setFlagging(false); refresh(); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const preview = useMutation({
    mutationFn: (docId: string) => api.documents.downloadUrl(docId, 'inline'),
    onSuccess: (r) => void Linking.openURL(absoluteApiUrl(r.url)),
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });

  const name = a.student?.full_name ?? t('university.applicants.anonymous');
  const intake = t('common:intakeLabel', { term: t(`common:term.${a.intake.term}`), year: a.intake.year });
  const required = a.checklist.filter((c) => c.required);
  const ready = required.filter((c) => c.ready).length;
  const openRequests = (a.document_requests ?? []).filter((r) => r.status === 'OPEN');
  const positive = a.allowed_transitions.filter((s) => !NEGATIVE.includes(s));
  const primary = positive[0];
  const others = a.allowed_transitions.filter((s) => s !== primary);

  return (
    <>
      <View style={styles.head}>
        <Avatar name={name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={2}>{name}</AppText>
          <AppText variant="caption">{localName(a.program)} · {intake}</AppText>
          <AppText variant="caption">
            {[a.student?.nationality ? countryName(a.student.nationality, f.locale) : null, a.agency ? t('university.applicants.viaAgency', { agency: a.agency.name }) : null].filter(Boolean).join(' · ')}
          </AppText>
          <View style={styles.statusRow}>
            <StatusBadge kind="application" value={a.status} />
            {a.flagged ? <StatusText label={t('university.flagged.flagged')} tone="danger" /> : null}
          </View>
        </View>
      </View>
      {a.flagged && a.flag_reason ? <Callout tone="danger" icon={Flag} title={t('university.flagged.reason')} body={a.flag_reason} /> : null}

      {canDecide ? (
        a.allowed_transitions.length ? (
          <View style={styles.decide}>
            <AppText variant="label" color={theme.color.textSecondary}>{t('v3.uni.decisionNow')}</AppText>
            <AppText variant="body">{openRequests.length ? t('v3.uni.decisionContext', { ready, total: required.length, count: openRequests.length }) : t('v3.uni.decisionDocs', { ready, total: required.length })}</AppText>
            {/* V4: stacked, full width — decision labels are long ("Ask for more documents") and must never be clipped. */}
            <View style={{ gap: 8 }}>
              {primary ? <Button label={t(`v3.uni.move.${primary}`, { defaultValue: t('university.applicants.moveTo', { status: t(`common:appStatus.${primary}`) }) })} onPress={() => setPending(primary)} loading={transition.isPending && transition.variables?.to === primary} fullWidth /> : null}
              {others.length ? <Button label={t('v3.uni.otherDecisions')} icon={MoreHorizontal} variant="secondary" onPress={() => setMore(true)} fullWidth /> : null}
            </View>
          </View>
        ) : null
      ) : null /* V23 §274 N5: one role per university tenant — there is no read-only member to explain to. */}

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.uni.checksTitle')} />
        {checks === null ? <LoadingState rows={2} /> : checks.length ? (
          <ListGroup>
            {checks.map((c) => (
              <ListItem key={c.key} title={c.label} subtitle={c.key === 'interview' ? (a.interview_at ? f.dateTime(a.interview_at) : t('v3.uni.check.interviewRequired')) : t('v3.uni.check.minimum', { need: c.need, have: c.have ?? t('v3.uni.check.notProvided') })}
                trailing={<StatusText label={t(`v3.uni.check.state.${c.state}`)} tone={c.state === 'meets' ? 'success' : c.state === 'below' ? 'danger' : 'warning'} hollow={c.state === 'missing' || c.state === 'unscheduled'} />} />
            ))}
          </ListGroup>
        ) : <AppText variant="caption">{t('v3.uni.noMinimums')}</AppText>}
        <AppText variant="caption" color={theme.color.textTertiary}>{t('v3.uni.checksNote')}</AppText>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.uni.docsTitle', { ready, total: required.length })} action={canDecide ? t('v3.uni.request') : undefined} onAction={canDecide ? () => setRequesting(true) : undefined} />
        {openRequests.length ? (
          <ListGroup>
            {openRequests.map((r) => (
              <ListItem key={r.id} title={r.label} subtitle={r.note || null} meta={[t('v3.uni.requestedOn', { date: f.dateShort(r.requested_at) }), r.due_date ? t('v3.uni.dueOn', { date: f.deadlineShort(r.due_date) }) : null].filter(Boolean).join(' · ')}
                trailing={<StatusText label={t('v3.uni.waitingStudent')} tone="warning" />} />
            ))}
          </ListGroup>
        ) : null}
        <ListGroup>{a.checklist.map((c) => <DocRow key={c.requirement_id} c={c} onPreview={(id) => preview.mutate(id)} />)}</ListGroup>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('university.applicants.history')} />
        <ListGroup>
          {[...a.history].reverse().slice(0, 5).map((h, i) => (
            <ListItem key={`${h.at}-${i}`} title={t(`common:appStatus.${h.to}`)} subtitle={h.note} meta={[f.dateShort(h.at), h.actor ? t(`v4.uni.actor.${h.actor}`, { defaultValue: h.actor }) : null].filter(Boolean).join(' · ')} />
          ))}
        </ListGroup>
      </View>

      <View style={{ gap: 4 }}>
        {a.submitted_at ? <KeyValue label={t('university.applicants.submittedLabel')} value={f.date(a.submitted_at)} /> : null}
        {a.interview_at ? <KeyValue label={t('university.applicants.interview')} value={f.dateTime(a.interview_at)} /> : null}
        {a.external_reference ? <KeyValue label={t('university.applicants.reference')} value={a.external_reference} /> : null}
      </View>

      {canDecide ? (
        a.flagged ? (
          <Button label={t('university.flagged.remove')} icon={FlagOff} variant="ghost" loading={flag.isPending}
            onPress={() => Alert.alert(t('university.flagged.removeTitle'), undefined, [
              { text: t('common:actions.cancel'), style: 'cancel' },
              { text: t('university.flagged.remove'), onPress: () => flag.mutate({ flagged: false, flag_reason: null }) },
            ])} />
        ) : <Button label={t('university.flagged.add')} icon={Flag} variant="ghost" onPress={() => setFlagging(true)} />
      ) : null}

      <PickerSheet visible={more} title={t('v3.uni.otherDecisions')} cancelLabel={t('common:actions.cancel')} onCancel={() => setMore(false)}
        options={others.map((s) => ({ value: s, label: t(`v3.uni.move.${s}`, { defaultValue: t('university.applicants.moveTo', { status: t(`common:appStatus.${s}`) }) }) }))}
        onSelect={(s) => { setMore(false); setPending(s); }} />
      <PromptSheet visible={!!pending} title={pending ? t('university.applicants.confirmTitle', { status: t(`common:appStatus.${pending}`) }) : ''}
        message={t('university.applicants.confirmBody', { name })} label={pending && NEGATIVE.includes(pending) ? t('v3.uni.reason') : t('university.applicants.note')}
        placeholder={pending && NEGATIVE.includes(pending) ? undefined : t('common:form.optional')} minLength={pending && NEGATIVE.includes(pending) ? 3 : 0}
        requiredMessage={t('common:validation.reasonRequired')} confirmLabel={t('common:actions.confirm')} cancelLabel={t('common:actions.cancel')}
        destructive={!!pending && NEGATIVE.includes(pending)} loading={transition.isPending}
        onCancel={() => setPending(null)} onSubmit={(note) => pending && transition.mutate({ to: pending, note: note || undefined })} />
      <PromptSheet visible={flagging} title={t('university.flagged.add')} message={t('university.flagged.addBody')} label={t('university.flagged.reason')}
        confirmLabel={t('university.flagged.add')} cancelLabel={t('common:actions.cancel')} minLength={3} requiredMessage={t('common:validation.reasonRequired')}
        loading={flag.isPending} onCancel={() => setFlagging(false)} onSubmit={(reason) => flag.mutate({ flagged: true, flag_reason: reason })} />
      <RequestSheet visible={requesting} a={a} name={name} onClose={() => setRequesting(false)} onDone={() => { setRequesting(false); refresh(); }} />
    </>
  );
}

/** Ask the student (and their counselor) for one more document, in words they can act on. */
function RequestSheet({ visible, a, name, onClose, onDone }: { visible: boolean; a: ApplicationDetail; name: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const api = useApi();
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: () => api.applications.requestDocument(a.id, { label: label.trim(), note: note.trim() }),
    onSuccess: () => { setLabel(''); setNote(''); onDone(); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  return (
    <Sheet visible={visible} title={t('v3.uni.requestTitle', { name })} onClose={onClose} closeLabel={t('common:actions.cancel')}
      footer={<Button label={t('v3.uni.requestSend')} onPress={() => send.mutate()} disabled={label.trim().length < 2 || note.trim().length < 3} loading={send.isPending} fullWidth />}>
      <TextField label={t('v3.uni.requestLabel')} placeholder={t('v3.uni.requestLabelHint')} value={label} onChangeText={setLabel} />
      <TextField label={t('v3.uni.requestNote')} placeholder={t('v3.uni.requestNoteHint')} value={note} onChangeText={setNote} multiline />
      <AppText variant="caption">{t('v3.uni.requestWho')}</AppText>
    </Sheet>
  );
}

function DocRow({ c, onPreview }: { c: ChecklistItem; onPreview: (id: string) => void }) {
  const { t } = useTranslation();
  const shared = c.shared_with_university !== false;
  const openable = !!c.document_id && shared;
  return (
    <ListItem title={t(`common:docCategory.${c.category}`, { defaultValue: c.label })}
      subtitle={!shared ? t('university.applicants.notShared') : c.required ? null : t('common:form.optional')}
      footer={<StatusBadge kind="document" value={c.status} />}
      onPress={openable ? () => onPreview(c.document_id!) : undefined}
      accessibilityHint={openable ? t('university.applicants.previewHint') : undefined} />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  decide: { gap: 8, padding: 16, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface },
});
