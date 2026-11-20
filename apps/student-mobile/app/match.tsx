/**
 * `/match` — personalised university matching and selection (261119, owner requirement 1), the native mirror of the
 * web route. Signed-in is guaranteed by the root gate; the plan is checked here: no plan → the way to a plan (checkout
 * hands off to the web and returns here), a plan → matching itself. The plan is refetched on focus so a student coming
 * back from the browser sees matching without a manual refresh.
 */
import { useTranslation } from '@hangyul/i18n';
import { AppText, LoadingState, Screen } from '@hangyul/mobile-ui';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { matchGated, planState } from '../src/access';
import { useServices } from '../src/plan';
import { ForYou, MatchPlanPath, useMatches } from './(tabs)/explore';

export default function MatchScreen() {
  const { t } = useTranslation();
  const services = useServices();
  const matches = useMatches();
  useFocusEffect(useCallback(() => { void services.refetch(); }, [services.refetch]));
  const plan = planState(services);
  const browse = () => router.push('/explore?tab=all');
  return (
    <Screen onRefresh={() => Promise.all([services.refetch(), matches.refetch()])}>
      <AppText variant="body" secondary>{t('mobile:v261119.match.subtitle')}</AppText>
      {/* Only a definite "no plan" gates; an unknown plan state shows matching (whose own query reports its errors). */}
      {plan === 'loading' ? <LoadingState rows={4} /> : matchGated(plan) ? <MatchPlanPath onBrowse={browse} /> : <ForYou onBrowse={browse} />}
    </Screen>
  );
}
