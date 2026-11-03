import { useApi, useAuth } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, Avatar, ListGroup, ListItem, ProgressBar, Screen, SectionTitle, StatusText } from '@hangyul/mobile-ui';
import { countryName } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

/**
 * Me: who I am to Hangyul, and what completing my profile unlocks.
 *
 * V17 moved the 다른 곳 list, the language picker and 로그아웃 out of here — they were never about *me*, they
 * were everything else wearing an avatar. They live in 더보기 and 설정 now, and this screen is one subject.
 */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const { session } = useAuth();
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api.me.profile() });
  const p = profile.data;
  const steps = p?.completion?.steps ?? [];
  const missing = steps.filter((s) => !s.done);
  return (
    <Screen onRefresh={() => profile.refetch()}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={session?.user.full_name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{session?.user.full_name}</AppText>
          <AppText variant="caption" numberOfLines={1}>
            {[p?.nationality ? countryName(p.nationality, i18n.language) : null, p?.target_degree ? t(`common:degree.${p.target_degree}`) : null,
              p?.target_intake_term && p.target_intake_year ? t('common:intakeLabel', { term: t(`common:term.${p.target_intake_term}`), year: p.target_intake_year }) : null].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </View>

      {steps.length && !missing.length ? (
        <ListGroup><ListItem title={t('v3.profile.completeTitle')} subtitle={t('v3.profile.editOnWeb')} trailing={<StatusText label={t('v3.profile.done')} tone="success" />} /></ListGroup>
      ) : steps.length ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={t('v3.profile.unlockTitle')} />
          <ProgressBar value={p?.completion?.percent ?? 0} height={6} tone="success" accessibilityLabel={t('student.profile.completion')} />
          <ListGroup>
            {steps.map((s) => (
              <ListItem key={s.key} title={t(`student.profile.step.${s.key}`, { defaultValue: s.key })}
                subtitle={s.done ? null : t(`v3.profile.unlock.${s.key}`, { defaultValue: t('v3.profile.unlock.default') })}
                trailing={<StatusText label={s.done ? t('v3.profile.done') : t('v3.profile.todo')} tone={s.done ? 'success' : 'neutral'} hollow={!s.done} />} />
            ))}
          </ListGroup>
          <AppText variant="caption">{t('v3.profile.editOnWeb')}</AppText>
        </View>
      ) : null}

    </Screen>
  );
}
