import { useTranslation } from '@hangyul/i18n';
import {
  AccountCard, AppText, Callout, ListGroup, ListItem, Screen, SectionTitle, StatusText,
} from '@hangyul/mobile-ui';
import { formatMoney } from '@hangyul/utils';
import { router } from 'expo-router';
import { Bell, CreditCard, FileText, Heart, House, LifeBuoy, ListChecks, PlaneLanding, Settings, Stamp, UserRound } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { getWebAppUrl, useServices } from '../../src/plan';

/**
 * **더보기** — the fifth tab (V17, brief §36).
 *
 * The four fixed destinations are jobs a student does repeatedly: now, find, track, talk. Everything that
 * is visited *occasionally* used to be buried at the bottom of 프로필, which made 프로필 a drawer wearing an
 * avatar. This screen is that drawer, named honestly, and 프로필 is one of the things in it.
 *
 * The plan is at the top because it is the one row whose state a student cannot guess: on the web it is a
 * whole screen with a price on it, and a native app that never mentions what was bought is a native app
 * that looks like a free trial.
 */
export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const services = useServices();
  const plan = services.data?.plan ?? null;

  return (
    <Screen title={t('common:nav.journey')} onRefresh={() => services.refetch()}>
      <AccountCard />

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('mobile:more.plan')} />
        <ListGroup>
          <ListItem
            icon={CreditCard}
            title={plan ? (i18n.language === 'ko' ? plan.name_ko : plan.name_en) : t('mobile:more.noPlan')}
            subtitle={plan
              ? formatMoney(plan.amount_minor, plan.currency, i18n.language, { minor: true })
              : t('mobile:more.noPlanHint')}
            trailing={plan
              ? <StatusText label={t('mobile:more.active')} tone="success" />
              : <StatusText label={t('mobile:more.choose')} tone="neutral" hollow />}
            onPress={() => router.push('/services')}
          />
        </ListGroup>
        {/* The one thing a student cannot work out from the row above: an allowance that has run out is not
            a bug, and the screen behind the row says which plan covers it. */}
        {plan?.usage?.some((u) => u.limit !== null && u.used >= u.limit) ? (
          <Callout tone="info" body={t('mobile:more.allowanceSpent')} />
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.profile.places')} />
        <ListGroup>
          <ListItem icon={UserRound} title={t('common:nav.profile')} onPress={() => router.push('/profile')} />
          <ListItem icon={FileText} title={t('common:nav.documents')} onPress={() => router.push('/documents')} />
          <ListItem icon={Stamp} title={t('common:nav.visa')} onPress={() => router.push('/visa')} />
          {/* V23 §274 N1: housing and arrival live on the web (one implementation, one set of providers); the app opens
              them in the browser in the student's language rather than shipping a second, thinner copy. */}
          <ListItem icon={House} title={t('common:nav.housing')} subtitle={t('mobile:v23.more.opensWeb')} onPress={() => void Linking.openURL(`${getWebAppUrl()}/housing?lang=${encodeURIComponent(i18n.language)}`)} />
          <ListItem icon={PlaneLanding} title={t('common:nav.arrival')} subtitle={t('mobile:v23.more.opensWeb')} onPress={() => void Linking.openURL(`${getWebAppUrl()}/arrival?lang=${encodeURIComponent(i18n.language)}`)} />
          <ListItem icon={ListChecks} title={t('student.tasks.title')} onPress={() => router.push('/tasks')} />
          <ListItem icon={Heart} title={t('common:nav.saved')} onPress={() => router.push('/saved')} />
          <ListItem icon={Bell} title={t('common:nav.notifications')} onPress={() => router.push('/notifications')} />
        </ListGroup>
      </View>

      <View style={{ gap: 8 }}>
        <ListGroup>
          <ListItem icon={Settings} title={t('mobile:settings.title')} onPress={() => router.push('/settings')} />
          <ListItem icon={LifeBuoy} title={t('mobile:more.support')} subtitle={t('mobile:more.supportHint')}
            onPress={() => router.push('/messages')} />
        </ListGroup>
      </View>

      <AppText variant="caption">{t('mobile:more.webNote')}</AppText>
    </Screen>
  );
}
