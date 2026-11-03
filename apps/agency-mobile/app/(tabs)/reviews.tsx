import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, Button, CheckRow, EmptyState, ListGroup, ListItem, QueryState, Screen, StatusText } from '@hangyul/mobile-ui';
import { flagEmoji } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FileCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { qk } from '../../src/queries';

const SLA_HOURS = 48;

/** Oldest first. Select mode allows bulk-verifying several clear documents at once. */
export default function ReviewQueueScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.reviewQueue, queryFn: () => api.documents.reviewQueue({ page_size: 100 }) });
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const bulk = useMutation({
    mutationFn: () => api.documents.bulk({ ids: picked, action: 'VERIFY' }),
    onSuccess: (r) => { setPicked([]); setSelecting(false); void qc.invalidateQueries({ queryKey: qk.reviewQueue }); void qc.invalidateQueries({ queryKey: ['agency'] }); Alert.alert(t('v3.reviews.bulkDone', { ok: r.ok, failed: r.failed })); },
    onError: (e: Error) => Alert.alert(t('common:states.error'), e.message),
  });
  const confirmBulk = () => Alert.alert(t('v3.reviews.bulkTitle', { count: picked.length }), t('v3.reviews.bulkBody'), [
    { text: t('common:actions.cancel'), style: 'cancel' }, { text: t('v3.reviews.verifyN', { count: picked.length }), onPress: () => bulk.mutate() },
  ]);
  return (
    <Screen title={t('agency.reviews.title')} onRefresh={() => q.refetch()}
      footer={selecting && picked.length ? <Button label={t('v3.reviews.verifyN', { count: picked.length })} onPress={confirmBulk} loading={bulk.isPending} fullWidth /> : undefined}>
      <QueryState query={q}>
        {(page) => page.items.length === 0 ? <EmptyState icon={FileCheck} title={t('agency.reviews.empty')} body={t('agency.reviews.emptyBody')} /> : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="caption" style={{ flex: 1 }}>{t('v3.reviews.summary', { count: page.total, over: page.items.filter((d) => (d.waiting_hours ?? 0) >= SLA_HOURS).length, hours: SLA_HOURS })}</AppText>
              <Button label={selecting ? t('common:actions.cancel') : t('v3.reviews.select')} size="sm" variant="ghost" onPress={() => { setSelecting(!selecting); setPicked([]); }} />
            </View>
            <ListGroup>
              {page.items.map((d) => {
                const hours = Math.round(d.waiting_hours ?? 0);
                const waiting = hours >= 48 ? t('agency.reviews.waitingDays', { count: Math.round(hours / 24) }) : t('agency.reviews.waitingHours', { count: hours });
                const title = t(`common:docCategory.${d.category}`, { defaultValue: d.title });
                const sub = `${flagEmoji(d.owner_nationality)} ${d.owner_name ?? ''}`.trim();
                return selecting ? (
                  <CheckRow key={d.id} label={title} detail={`${sub} · ${waiting}`} checked={picked.includes(d.id)}
                    onToggle={(on) => setPicked((p) => (on ? [...p, d.id] : p.filter((x) => x !== d.id)))} />
                ) : (
                  <ListItem key={d.id} title={title} subtitle={sub}
                    footer={<StatusText label={hours >= SLA_HOURS ? t('v3.reviews.overSla', { waiting }) : waiting} tone={hours >= SLA_HOURS ? 'danger' : 'neutral'} hollow={hours < SLA_HOURS} />}
                    onPress={() => router.push(`/reviews/${d.id}`)} />
                );
              })}
            </ListGroup>
          </>
        )}
      </QueryState>
    </Screen>
  );
}
