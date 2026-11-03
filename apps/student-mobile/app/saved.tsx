import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { EmptyState, IconButton, ListGroup, ListItem, QueryState, Screen, theme } from '@hangyul/mobile-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart, School } from 'lucide-react-native';

import { qk, useSaved } from '../src/queries';

export default function SavedScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const saved = useSaved();
  const unsave = useMutation({ mutationFn: (id: string) => api.me.unsave(id), onSettled: () => qc.invalidateQueries({ queryKey: qk.saved }) });
  return (
    <Screen onRefresh={() => saved.refetch()}>
      <QueryState query={saved}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon={Heart} title={t('student.saved.empty')} body={t('student.saved.emptyBody')} actionLabel={t('common:nav.explore')} onAction={() => router.push('/explore')} />
          ) : (
            <ListGroup>
              {list.map((u) => (
                <ListItem
                  key={u.id}
                  icon={School}
                  title={u.name_en}
                  subtitle={`${u.name_ko} · ${u.city}`}
                  meta={u.note ?? null}
                  onPress={() => router.push(`/universities/${u.slug}`)}
                  trailing={
                    <IconButton
                      icon={Heart}
                      color={theme.color.primary}
                      accessibilityLabel={t('student.explore.unsave', { name: u.name_en })}
                      onPress={() => unsave.mutate(u.id)}
                    />
                  }
                />
              ))}
            </ListGroup>
          )
        }
      </QueryState>
    </Screen>
  );
}
