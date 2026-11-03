import { useTranslation } from '@hangyul/i18n';
import { ChipGroup, IconButton, Screen, TextField, theme } from '@hangyul/mobile-ui';
import { useLocalSearchParams } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { ApplicantList, useApplicants } from '../../src/ApplicantList';
import { HEAD_VIEWS, VIEWS, type ViewKey } from '../../src/views';

/** Admissions-grade list: quick views by where each application stands, plus search. */
export default function ApplicantsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ view?: string }>();
  const known = (v?: string): v is ViewKey => (VIEWS as readonly string[]).includes(v ?? '') || (HEAD_VIEWS as readonly string[]).includes(v ?? '');
  const [view, setView] = useState<ViewKey>(known(params.view) ? params.view : 'review');
  useEffect(() => { if (known(params.view)) setView(params.view); }, [params.view]);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const h = setTimeout(() => setQ(input.trim()), 300); return () => clearTimeout(h); }, [input]);
  const list = useApplicants(view, q);
  return (
    <Screen title={t('v3.uni.tab.applicants')} onRefresh={() => list.refetch()}>
      <TextField label={t('v3.uni.search')} hideLabel placeholder={t('v3.uni.search')} value={input} onChangeText={setInput} autoCorrect={false}
        trailing={input ? <IconButton icon={X} size={18} accessibilityLabel={t('student.explore.clear')} onPress={() => setInput('')} /> : <Search size={18} color={theme.color.textTertiary} />} />
      {/* A headline figure opened from the home stays visible as the selected chip, so the reader sees what the list is. */}
      <ChipGroup<ViewKey> options={[...((HEAD_VIEWS as readonly string[]).includes(view) ? [{ value: view, label: t(`v26.uni.head.${view}`) }] : []), ...VIEWS.map((v) => ({ value: v as ViewKey, label: t(`v3.uni.view.${v}`) }))]}
        selected={[view]} onToggle={setView} />
      <ApplicantList query={list} emptyTitle={t(`v3.uni.empty.${view}`, { defaultValue: t('v3.uni.empty.all') })} />
    </Screen>
  );
}
