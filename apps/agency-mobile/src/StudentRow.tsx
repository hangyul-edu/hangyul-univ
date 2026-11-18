import { useTranslation } from '@hangyul/i18n';
import { ListItem, StatusBadge, StatusText, taskTitle, theme, type Tone } from '@hangyul/mobile-ui';
import type { AgencyStudentRow } from '@hangyul/types';
import { flagEmoji } from '@hangyul/utils';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

/** Parties on our side of the table: when the case waits on one of them, the next move is ours. */
const OURS = ['us', 'counselor', 'agency', 'hangyul'];

/**
 * What a queue row says about urgency, most pressing first — always as words with a semantic tone, never colour alone:
 * late first response / overdue work = danger, the next move is ours = warning, waiting on someone else = neutral.
 */
export function attention(s: AgencyStudentRow, t: (k: string, o?: Record<string, unknown>) => string): { label: string; tone: Tone } | null {
  if (s.sla_breached) return { label: t('agency.students.slaBreached'), tone: 'danger' };
  if (s.overdue_tasks > 0) return { label: t('agency.students.overdue', { count: s.overdue_tasks }), tone: 'danger' };
  if (s.waiting_on) return { label: t(`v3.agency.waitingOn.${s.waiting_on}`), tone: OURS.includes(s.waiting_on) ? 'warning' : 'neutral' };
  return null;
}

/** Sort key for the Today queue: late first response, then overdue work, then documents to review, then the rest. */
export function attentionRank(s: AgencyStudentRow): number {
  return s.sla_breached ? 0 : s.overdue_tasks > 0 ? 1 : s.documents_to_review > 0 ? 2 : 3;
}

/** One student in a queue: who · next action · due / documents · stage and what the case is waiting on. */
export function StudentRow({ s, due }: { s: AgencyStudentRow; due: (d: string) => string }) {
  const { t } = useTranslation();
  const intake = (v: string | null) => { const m = v?.match(/^(\d{4})-(\w+)$/); return m ? t('common:intakeLabel', { term: t(`common:term.${m[2]}`), year: m[1] }) : v; };
  const next = s.next_task ? taskTitle(t, s.next_task) : null;
  const title = `${s.nationality ? `${flagEmoji(s.nationality)} ` : ''}${s.full_name}`;
  const subtitle = next ? t('v3.agency.nextAction', { what: next }) : intake(s.target_intake);
  const meta = [
    s.next_deadline ? t('v3.agency.deadline', { uni: s.next_deadline.university, when: due(s.next_deadline.date) }) : null,
    s.documents_to_fix ? t('v3.agency.toFix', { count: s.documents_to_fix }) : null,
  ].filter(Boolean).join(' · ');
  const att = attention(s, t);
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      meta={meta || null}
      footer={(
        <View style={styles.status}>
          <StatusBadge kind="pipeline" value={s.pipeline_stage} />
          {att ? <StatusText label={att.label} tone={att.tone} hollow={att.tone === 'neutral'} /> : null}
        </View>
      )}
      accessibilityLabel={[s.full_name, subtitle, meta, t(`common:pipeline.${s.pipeline_stage}`), att?.label].filter(Boolean).join(', ')}
      onPress={() => router.push(`/students/${s.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: theme.space[3], rowGap: theme.space[1] },
});
