import { useAuth } from '@hangyul/auth';
import { isConsoleLocale, isStudentAppLocale, LOCALES, MARKETS, marketForLocale, useLocale, type Market } from '@hangyul/i18n';
import Constants from 'expo-constants';
import { Check, Globe, LogOut, Server } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { getApiBaseUrl } from '../bootstrap/api';
import { setAppLocale } from '../bootstrap/i18n';
import { theme } from '../theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Callout } from './Feedback';
import { MarketFlag } from './Flag';
import { Divider, ListGroup, ListItem, Row } from './List';
import { SectionTitle } from './Patterns';

/** Signed-in identity: name, email, then organization · role as quiet text (V3: no card, no pills). */
export function AccountCard() {
  const { session } = useAuth();
  const { t } = useLocale();
  if (!session) return null;
  const role = session.active_org?.role ?? session.roles[0];
  const where = [session.active_org?.org_name, role ? t(`common:role.${role}`, { defaultValue: role }) : null].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel={[session.user.full_name, session.user.email, where].filter(Boolean).join(', ')}>
      <Avatar name={session.user.full_name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="heading" numberOfLines={1}>{session.user.full_name}</AppText>
        <AppText variant="caption" numberOfLines={1}>{session.user.email}</AppText>
        {where ? <AppText variant="caption" color={theme.color.textTertiary} numberOfLines={2}>{where}</AppText> : null}
      </View>
    </View>
  );
}

/**
 * Language picker. Machine-draft locales are labelled; RTL locales note that layout mirrors after restart.
 *
 * `surface="student"` (the student app) lists **the 33 markets**, each with its flag and its language named
 * in that language — the same list, from the same manifest, that the web picker offers (V17, brief §15).
 * It used to list the 52 locale bundles filtered by the V9 native gate, which meant the app and the website
 * offered different languages, and that a third of the rows belonged to no market Hangyul serves.
 *
 * Staff apps keep `surface="all"`: an agency counsellor's language is not a market.
 */
export function LanguagePicker({ surface = 'all' }: { surface?: 'all' | 'student' | 'agency' | 'university' } = {}) {
  const { t, locale } = useLocale();
  const studentOnly = surface === 'student';
  // The markets, in manifest order, each resolved to the bundle it reads. A market whose locale has no
  // bundle is dropped rather than shown as a dead row — and there are none, which is the point of the
  // manifest being the single list.
  const marketRows = MARKETS
    .map((m) => ({ market: m, def: LOCALES.find((l) => l.code === m.locale) }))
    .filter((r): r is { market: Market; def: (typeof LOCALES)[number] } => !!r.def);
  // If the reader is somehow on a locale no market carries, keep their own row listed: a picker that does
  // not show the current selection looks like it has forgotten it.
  const stray = studentOnly && !marketRows.some((r) => r.def.code === locale) ? LOCALES.find((l) => l.code === locale) : undefined;
  const offered: { market?: Market; def: (typeof LOCALES)[number] }[] = studentOnly
    ? [...marketRows, ...(stray ? [{ market: marketForLocale(locale), def: stray }] : [])]
    // V29 (brief §30): the staff apps offer only locales whose console namespace is complete.
    : surface === 'agency' || surface === 'university'
      ? marketRows.filter((r) => isConsoleLocale(surface, r.def.code))
      : LOCALES.map((def) => ({ def }));
  const [busy, setBusy] = useState<string | null>(null);
  const [rtlNote, setRtlNote] = useState(false);
  const choose = async (code: string) => {
    setBusy(code);
    try {
      const r = await setAppLocale(code);
      setRtlNote(r.rtl !== r.layoutRTL);
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={t('mobile:settings.language')} />
      <AppText variant="caption">{t('mobile:settings.languageHint')}</AppText>
      {rtlNote ? <Callout tone="info" body={t('mobile:settings.rtlNote')} /> : null}
      <ListGroup>
        {offered.map(({ market, def: l }) => (
          <ListItem
            key={market ? `${market.code}:${l.code}` : l.code}
            // The language in its own language, with the country beside it. Two markets can share a bundle
            // (en for the United States and the United Kingdom), so the country is what tells them apart.
            title={market?.languageNative ?? l.name}
            subtitle={[
              market ? market.nameNative : l.english,
              studentOnly && !isStudentAppLocale(l.code, 'native') ? t('common:i18n.v9.websiteOnly')
                : l.status === 'MACHINE_DRAFT' ? t('mobile:settings.machineDraft') : null,
            ].filter(Boolean).join(' · ')}
            leading={studentOnly ? <MarketFlag code={market?.code} /> : undefined}
            onPress={() => void choose(l.code)}
            chevron={false}
            accessibilityLabel={[market?.languageNative ?? l.name, market?.nameEn ?? l.english,
              l.code === locale ? t('mobile:settings.selected') : null].filter(Boolean).join(', ')}
            trailing={l.code === locale ? <Check size={20} color={theme.color.primary} /> : busy === l.code ? <AppText variant="caption">…</AppText> : null}
          />
        ))}
      </ListGroup>
      {/* V17 removed the footer note that used to sit here. It said "a language appears here once every
          student screen is translated", which stopped being true the moment the list became the 33 markets
          — and the rows that are not fully translated already say so, on the row, where it applies. */}
    </View>
  );
}

/** Sign out with confirmation + build/environment info. */
export function SignOutSection() {
  const { logout } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const confirm = () =>
    Alert.alert(t('mobile:settings.signOutTitle'), t('mobile:settings.signOutBody'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('common:actions.signOut'), style: 'destructive',
        onPress: async () => { setLoading(true); try { await logout(); } finally { setLoading(false); } },
      },
    ]);
  return (
    <View style={{ gap: 12 }}>
      <Button label={t('common:actions.signOut')} variant="secondary" icon={LogOut} onPress={confirm} loading={loading} fullWidth />
      <Divider />
      <Row gap={6}>
        <Server size={14} color={theme.color.textTertiary} />
        <AppText variant="caption" color={theme.color.textTertiary}>{t('mobile:settings.server', { url: getApiBaseUrl() })}</AppText>
      </Row>
      <Row gap={6}>
        <Globe size={14} color={theme.color.textTertiary} />
        <AppText variant="caption" color={theme.color.textTertiary}>
          {t('mobile:settings.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
        </AppText>
      </Row>
    </View>
  );
}
