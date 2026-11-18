import { useAuth } from '@hangyul/auth';
import { useTranslation, localName } from '@hangyul/i18n';
import {
  AppText, Avatar, Button, DateRow, ErrorState, IconButton, JourneySteps, ListGroup, ListItem, LoadingState, NextAction, Screen,
  SectionTitle, StatusBadge, theme, useFormat, taskTitle, kstDayMonth } from '@hangyul/mobile-ui';
import type { Dashboard } from '@hangyul/types';
import { router } from 'expo-router';
import { Bell, FileWarning, MessageCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { JOURNEY, journeyStage, nextActionTitle, statusSentenceKey, v5NextCopy } from '../../src/journey';
import { mapWebLink } from '../../src/links';
import { useDashboard } from '../../src/queries';
import { CampusBanner, CampusThumb } from '../../src/campus';

const go = (link: string | null | undefined) => {
  const to = mapWebLink(link);
  if (to) router.push(to);
};

/**
 * Home answers, in this order: where am I, what do I do now (one primary button), what is coming next, then my
 * applications, documents and the team. When the API says nothing is the student's (`WAIT`) the hero turns calm —
 * a green tick, no primary button — and each application row says in a sentence where it stands, so the screen
 * reassures instead of going empty. Student page pass (2026-11); not visually verified on a device.
 */
/** The application deadline only matters until the application is sent (same rule as the web home). */
const PRE_SUBMIT = new Set(['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY']);

export default function HomeScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const dash = useDashboard();
  const d = dash.data;
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  return (
    <Screen onRefresh={() => dash.refetch()} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" accessibilityRole="header">{t(`v3.home.greeting.${greetKey}`, { name: d?.greeting_name ?? session?.user.preferred_name ?? '' })}</AppText>
          {d ? <AppText variant="caption">{t(`v3.home.stageLine.${journeyStage(d)}`)}</AppText> : null}
        </View>
        <IconButton icon={Bell} accessibilityLabel={t('common:nav.notifications')} onPress={() => router.push('/notifications')} />
      </View>
      {dash.isPending ? <LoadingState hero rows={3} /> : dash.isError && !d ? <ErrorState error={dash.error} onRetry={() => void dash.refetch()} /> : d ? <HomeContent d={d} /> : null}
    </Screen>
  );
}

function HomeContent({ d }: { d: Dashboard }) {
  const { t } = useTranslation();
  const f = useFormat();
  const stage = journeyStage(d);
  const na = d.next_action;
  const due = typeof na.params.due_at === 'string' ? na.params.due_at : null;
  const item = na.code === 'APPLICATION_ITEM' ? String(na.params.item ?? '') : null;
  const v5 = v5NextCopy(t, na);
  const body = v5 ? v5.body : item ? t(`v4.home.item.${item}.text`, { defaultValue: '' }) : t(`v3.home.nextBody.${String(na.params.type ?? na.code)}`, { defaultValue: '' });
  // V4 "say it once": the next action is not repeated under Coming up, and application closing dates live on the
  // application rows below — Coming up keeps only the other dated things (tasks, interviews, tuition, visa).
  const upcoming = d.deadlines.filter((x) => x.kind !== 'APPLICATION' && !(na.link && x.link === na.link) && x.title !== na.title).slice(0, 3);
  const docsToHandle = d.missing_documents.length;
  const waiting = na.code === 'WAIT';

  return (
    <>
      <JourneySteps stages={JOURNEY.map((k) => t(`v3.journey.${k}`))} current={JOURNEY.indexOf(stage)} />

      {/* V25: the next action shows where it leads — the campus of the application it is about, or the first one. */}
      {(() => {
        const id = /\/applications\/([0-9a-f-]{36})/.exec(na.link ?? '')?.[1];
        const app = d.applications.find((a) => a.id === id) ?? (id ? undefined : d.applications[0]);
        return app ? <CampusBanner photo={app.university.photo} name={localName(app.university)} /> : null;
      })()}
      {waiting ? (
        <NextAction
          calm
          title={t('v4.application.nothingForYou')}
          body={t('v3.home.nextBody.WAIT')}
          secondaryLabel={d.applications.length ? t('v3.home.applications') : undefined}
          onSecondary={() => router.push('/applications')}
        />
      ) : (
        <NextAction
          eyebrow={t('v3.home.nextEyebrow')}
          title={nextActionTitle(t, d, f.locale)}
          body={body || null}
          meta={due ? t('v3.home.due', { date: f.deadline(due), left: f.due(due) }) : null}
          actionLabel={v5 ? v5.cta : item ? t(`v4.home.item.${item}.cta`, { defaultValue: t('v3.home.nextCtaDefault') }) : t(`v3.home.nextCta.${String(na.params.type ?? na.code)}`, { defaultValue: t('v3.home.nextCtaDefault') })}
          onAction={() => go(na.link)}
          secondaryLabel={d.open_tasks > 1 ? t('v3.home.otherTasks', { count: d.open_tasks - 1 }) : undefined}
          onSecondary={() => router.push('/tasks')}
        />
      )}

      {upcoming.length ? (
        <View>
          <SectionTitle title={t('v3.home.upcoming')} action={t('v3.common.all')} onAction={() => router.push('/tasks')} />
          {upcoming.map((x, i) => {
            const days = f.daysUntil(x.date);
            return (
              <DateRow key={`${x.title}-${i}`} {...kstDayMonth(x.date, f.locale)}
                title={taskTitle(t, x)} meta={f.due(x.date)} urgent={days !== null && days <= 7} onPress={x.link ? () => go(x.link) : undefined} />
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <SectionTitle title={t('v3.home.applications')} action={d.applications.length ? t('v3.common.all') : undefined} onAction={() => router.push('/applications')} />
        {d.applications.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="body" secondary>{t('v3.home.noApplications')}</AppText>
            <Button label={t('v3.home.findUniversities')} variant="secondary" onPress={() => router.push('/explore')} />
          </View>
        ) : (
          <ListGroup>
            {d.applications.map((a) => (
              <ListItem key={a.id} title={localName(a.university)}
                subtitle={waiting ? t(statusSentenceKey(a.status), { university: localName(a.university) }) : localName(a.program)} leading={<CampusThumb photo={a.university.photo} />}
                meta={PRE_SUBMIT.has(a.status) ? t('v3.home.closes', { date: f.deadlineShort(a.intake.application_deadline), left: f.due(a.intake.application_deadline) }) : undefined}
                footer={waiting ? undefined : <StatusBadge kind="application" value={a.status} />}
                onPress={() => router.push(`/applications/${a.id}`)} />
            ))}
          </ListGroup>
        )}
      </View>

      {docsToHandle > 0 ? (
        <ListGroup>
          <ListItem icon={FileWarning} iconColor={theme.status.warning.fg} title={t('v3.home.documents', { count: docsToHandle })} subtitle={t('v3.home.documentsHint')} onPress={() => router.push('/documents')} />
        </ListGroup>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.home.team')} />
        {d.counselor ? (
          <View style={styles.personCard}>
          <View style={styles.person}>
            {/* V22/V23 team identity (REPORT §246 A3, §274 N2): the student is served by 한귤 유니브 상담팀 — never a staff
                name and never the partner agency's name. The API already sends the team object; the label is localized here. */}
            <Avatar name={t('v23.team.name')} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="subheading">{t('v23.team.name')}</AppText>
              {/* Same card as the web (REPORT §246 A4): the team identity, then the partner agency it works with. */}
              {d.counselor.organization ? <AppText variant="caption" numberOfLines={2}>{t('v23.team.withAgency', { org: d.counselor.organization })}</AppText> : null}
              {d.unread_messages > 0 ? <AppText variant="caption" color={theme.color.primaryText}>{t('v3.home.unread', { count: d.unread_messages })}</AppText> : null}
            </View>
          </View>
            {/* Under the identity, full width: beside it the button squeezed the team name onto two lines and cut the
                partner agency's name at 360-390 pt (visual pass, 2026-11). */}
            <Button label={t('v3.home.message')} variant="secondary" icon={MessageCircle} onPress={() => router.push('/messages')} fullWidth />
          </View>
        ) : (
          <View style={styles.empty}>
            <AppText variant="body" secondary>{t('v3.home.noCounselor')}</AppText>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  // A quiet warm aside instead of a dashed placeholder box or a bordered card (design foundation: one warm surface).
  empty: { gap: 12, padding: 16, borderRadius: theme.radius.xl, backgroundColor: theme.color.bgPaper, alignItems: 'flex-start' },
  personCard: { gap: 14, padding: 16, backgroundColor: theme.color.bgPaper, borderRadius: theme.radius.xl },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
