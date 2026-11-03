/**
 * V22 native sign-up building blocks (brief §6–§12, §21–§24).
 *
 *   StepDots        subtle 계정 · 인증 · 동의 · 완료 progress (no giant stepper)
 *   PasswordField   show/hide, password-manager friendly, compact strength hint
 *   PhoneField      country sheet (search · flag · calling code) + local number, E.164 preview
 *   OtpField        ONE accessible 6-digit input drawn as six boxes; OS one-time-code autofill (no READ_SMS)
 *   LegalSheet      the canonical document, served by the web app with `?embed=1` — never a copy in the bundle
 *   TurnstileChallenge  Cloudflare Turnstile inside a small controlled WebView; the app only ever receives a token
 */
import { useTranslation } from '@hangyul/i18n';
import { AppText, Button, Sheet, TextField, theme } from '@hangyul/mobile-ui';
import { countryName, flagEmoji, phoneCountries } from '@hangyul/utils';
import { Check, ChevronDown, Eye, EyeOff, Search } from 'lucide-react-native';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { WebView } from 'react-native-webview';

import { toE164Preview } from './phone';
import { PROGRESS_STEPS, type Step } from './state';

export const TANGERINE = '#CC4E00';

export function StepDots({ step }: { step: Step }) {
  const { t } = useTranslation();
  const idx = Math.max(0, PROGRESS_STEPS.indexOf(step === 'challenge' ? 'account' : (step as (typeof PROGRESS_STEPS)[number])));
  return (
    <View style={dots.row} accessibilityRole="progressbar" accessibilityLabel={t('mobile:signup.progress', { n: idx + 1, total: PROGRESS_STEPS.length, step: t(`mobile:signup.steps.${PROGRESS_STEPS[idx]}`) })}>
      {PROGRESS_STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <View key={s} style={dots.item} importantForAccessibility="no-hide-descendants">
            <View style={[dots.dot, state === 'current' && dots.dotCurrent, state === 'done' && dots.dotDone]}>
              {state === 'done' ? <Check size={11} color="#fff" strokeWidth={3} /> : <AppText variant="caption" color={state === 'current' ? '#fff' : theme.color.textTertiary} weight={state === 'current' ? 'semibold' : 'regular'}>{String(i + 1)}</AppText>}
            </View>
            {state === 'current' || i === idx ? <AppText variant="caption" color={theme.color.text} weight="semibold">{t(`mobile:signup.steps.${s}`)}</AppText> : null}
          </View>
        );
      })}
    </View>
  );
}
const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 4, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  dotCurrent: { backgroundColor: TANGERINE, borderColor: TANGERINE },
  dotDone: { backgroundColor: theme.color.text, borderColor: theme.color.text },
});

// ------------------------------------------------------------------------------------------- password
export function strength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 14 && classes >= 3) return 3;
  if (pw.length >= 12 || (pw.length >= 10 && classes >= 2)) return 2;
  return 1;
}

export const PasswordField = forwardRef<TextInput, Omit<TextInputProps, 'style'> & { label: string; error?: string | null; hint?: string | null; showStrength?: boolean; value: string }>(
  function PasswordField({ label, error, hint, showStrength, value, ...rest }, ref) {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);
    const level = showStrength ? strength(value) : 0;
    const strengthText = level ? t(`mobile:signup.strength.${level}`) : null;
    return (
      <View style={{ gap: 6 }}>
        <TextField
          ref={ref} label={label} value={value} error={error} hint={showStrength && strengthText ? strengthText : hint}
          secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} spellCheck={false}
          trailing={
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={show ? t('mobile:signup.hidePassword') : t('mobile:signup.showPassword')} style={pw.toggle}>
              {show ? <EyeOff size={18} color={theme.color.textSecondary} /> : <Eye size={18} color={theme.color.textSecondary} />}
            </Pressable>
          }
          {...rest}
        />
        {showStrength && value.length > 0 ? (
          <View style={pw.meter} importantForAccessibility="no-hide-descendants">
            {[1, 2, 3].map((n) => <View key={n} style={[pw.bar, level >= n && { backgroundColor: level === 1 ? theme.status.warning.solid : level === 2 ? theme.status.info.solid : theme.status.success.solid }]} />)}
          </View>
        ) : null}
      </View>
    );
  },
);
const pw = StyleSheet.create({
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginEnd: -8 },
  meter: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.color.border },
});

// ------------------------------------------------------------------------------------------- phone
export const PhoneField = forwardRef<TextInput, { country: string; local: string; onChange: (v: { country: string; local: string }) => void; error?: string | null; hint?: string | null; returnKeyType?: TextInputProps['returnKeyType']; onSubmitEditing?: () => void }>(
  function PhoneField({ country, local, onChange, error, hint, returnKeyType, onSubmitEditing }, ref) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const locale = i18n.language;
    const all = useMemo(() => phoneCountries((iso) => countryName(iso, locale)), [locale]);
    const shown = useMemo(() => {
      const s = q.trim().toLowerCase().replace(/^\+/, '');
      if (!s) return all;
      return all.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase() === s || c.dial.startsWith(s) || countryName(c.code, 'en').toLowerCase().includes(s));
    }, [all, q]);
    const dial = all.find((c) => c.code === country)?.dial ?? '';
    const preview = toE164Preview(country, local);
    return (
      <View style={{ gap: 6 }}>
        <AppText variant="label" color={theme.color.text}>{t('mobile:signup.phone')}</AppText>
        <View style={ph.row}>
          <Pressable onPress={() => setOpen(true)} style={[ph.country, !!error && { borderColor: theme.status.danger.solid }]} accessibilityRole="button"
            accessibilityLabel={t('mobile:signup.phoneCountry', { country: countryName(country, locale), dial })}>
            <AppText variant="body" style={{ fontSize: 18 }}>{flagEmoji(country)}</AppText>
            <AppText variant="body" weight="semibold">+{dial}</AppText>
            <ChevronDown size={14} color={theme.color.textSecondary} />
          </Pressable>
          <TextField
            ref={ref} containerStyle={{ flex: 1 }} label={t('mobile:signup.phone')} hideLabel value={local} onChangeText={(v) => onChange({ country, local: v })}
            keyboardType="phone-pad" autoComplete="tel-national" textContentType="telephoneNumber" placeholder={t('mobile:signup.phonePlaceholder')}
            error={error} hint={hint ?? (preview ? t('mobile:signup.phonePreview', { e164: preview }) : null)} returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing}
          />
        </View>
        <Sheet visible={open} title={t('mobile:signup.phoneCountryPick')} onClose={() => { setOpen(false); setQ(''); }} closeLabel={t('common:actions.close')}>
          <View style={ph.search}>
            <Search size={16} color={theme.color.textTertiary} />
            <TextInput style={ph.searchInput} value={q} onChangeText={setQ} placeholder={t('mobile:signup.phoneSearch')} placeholderTextColor={theme.color.textTertiary} autoFocus accessibilityLabel={t('mobile:signup.phoneSearch')} autoCapitalize="none" autoCorrect={false} />
          </View>
          <FlatList
            data={shown} keyExtractor={(c) => c.code} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" initialNumToRender={30}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange({ country: item.code, local }); setOpen(false); setQ(''); }} style={({ pressed }) => [ph.opt, pressed && { backgroundColor: theme.color.surfaceWarm }]}
                accessibilityRole="button" accessibilityState={{ selected: item.code === country }} accessibilityLabel={`${item.name} +${item.dial}`}>
                <AppText variant="body" style={{ fontSize: 20, width: 28 }}>{flagEmoji(item.code)}</AppText>
                <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>{item.name}</AppText>
                <AppText variant="body" secondary>+{item.dial}</AppText>
                {item.code === country ? <Check size={16} color={TANGERINE} /> : null}
              </Pressable>
            )}
          />
        </Sheet>
      </View>
    );
  },
);
const ph = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  country: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.color.borderStrong, borderRadius: theme.radius.md, backgroundColor: theme.color.surface },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.color.borderStrong, borderRadius: theme.radius.md, paddingHorizontal: 10, minHeight: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 16, color: theme.color.text, paddingVertical: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 6, minHeight: 48 },
});

// ------------------------------------------------------------------------------------------- one-time code
export const OtpField = forwardRef<TextInput, { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; invalid?: boolean; disabled?: boolean; label: string }>(
  function OtpField({ value, onChange, onComplete, invalid, disabled, label }, ref) {
    const inner = useRef<TextInput | null>(null);
    useEffect(() => { if (value.length === 6) onComplete?.(value); }, [value, onComplete]);
    const digits = value.padEnd(6, ' ').slice(0, 6).split('');
    return (
      <Pressable onPress={() => inner.current?.focus()} accessible={false}>
        <View style={otp.boxes} importantForAccessibility="no-hide-descendants">
          {digits.map((d, i) => (
            <View key={i} style={[otp.box, i === Math.min(value.length, 5) && !disabled && otp.boxActive, invalid && otp.boxInvalid]}>
              <AppText variant="title" weight="semibold">{d.trim()}</AppText>
            </View>
          ))}
        </View>
        {/* One real input: screen readers see a single 6-digit field; iOS `oneTimeCode` and Android `sms-otp` autofill
            both target it; paste works. No READ_SMS permission is requested anywhere. */}
        <TextInput
          ref={(node) => { inner.current = node; if (typeof ref === 'function') ref(node); else if (ref) (ref as { current: TextInput | null }).current = node; }}
          value={value} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))} maxLength={6} keyboardType="number-pad" inputMode="numeric"
          textContentType="oneTimeCode" autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} editable={!disabled}
          accessibilityLabel={label} style={otp.hidden} caretHidden importantForAutofill="yes"
        />
      </Pressable>
    );
  },
);
const otp = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: { width: 46, height: 54, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface },
  boxActive: { borderColor: TANGERINE, borderWidth: 2 },
  boxInvalid: { borderColor: theme.status.danger.solid },
  hidden: { position: 'absolute', opacity: 0.01, width: '100%', height: 54, color: 'transparent' },
});

// ------------------------------------------------------------------------------------------- legal document sheet
export function legalUrl(doc: string, locale: string): string {
  // The local fallback is development-only: a production build without EXPO_PUBLIC_MARKETING_URL still opens the public
  // site, never an emulator address (V32: the sign-up consent documents pointed at 10.0.2.2 in a store build).
  const fallback = __DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:3100' : 'http://localhost:3100') : 'https://univ.talkhangyul.com';
  const base = (process.env.EXPO_PUBLIC_MARKETING_URL ?? fallback).replace(/\/$/, '');
  const [path, hash] = doc.split('#');
  return `${base}${path}?lang=${encodeURIComponent(locale)}&embed=1${hash ? `#${hash}` : ''}`;
}

export function LegalSheet({ doc, version, visible, onClose }: { doc: string | null; version: string; visible: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!doc) return null;
  const retry = () => { setFailed(false); setLoading(true); setAttempt((n) => n + 1); };
  return (
    <Sheet visible={visible} title={t('mobile:signup.legalTitle')} onClose={onClose} closeLabel={t('common:actions.close')}
      footer={(
        <View style={{ gap: 10 }}>
          <AppText variant="caption" align="center">{t('mobile:signup.legalVersion', { version })}</AppText>
          <Button label={t('common:actions.close')} variant="secondary" onPress={onClose} />
        </View>
      )}>
      <View style={{ height: 520 }}>
        {loading && !failed ? <ActivityIndicator color={TANGERINE} style={{ position: 'absolute', top: 24, alignSelf: 'center' }} /> : null}
        {failed ? (
          // The WebView's own error page would show a raw URL and a Chromium error code; this is the app's message instead.
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }} accessibilityLiveRegion="polite">
            <AppText variant="body" align="center">{t('common:states.errorDetail')}</AppText>
            <Pressable onPress={retry} accessibilityRole="button" style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: theme.radius.md, backgroundColor: TANGERINE }}>
              <AppText variant="body" weight="semibold" color="#fff">{t('common:actions.retry')}</AppText>
            </Pressable>
          </View>
        ) : (
          <WebView key={attempt} source={{ uri: legalUrl(doc, i18n.language) }} onLoadEnd={() => setLoading(false)}
            onError={() => { setFailed(true); setLoading(false); }} onHttpError={() => { setFailed(true); setLoading(false); }}
            style={{ flex: 1, backgroundColor: '#fff' }} setSupportMultipleWindows={false} />
        )}
      </View>
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------- Turnstile
/** The challenge page. Served from the student web origin so the Turnstile site key's hostname rules apply; styled as a
 * Hangyul step. The page posts the token (and only the token) back to the app. */
export function turnstileHtml(siteKey: string, locale: string, heading: string, text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<style>body{margin:0;font-family:Pretendard,-apple-system,Segoe UI,Roboto,sans-serif;background:#FFFDF8;color:#181A1F;padding:24px 20px}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#555A62;font-size:15px;line-height:1.5}#w{min-height:70px}</style></head>
<body><h1>${esc(heading)}</h1><p>${esc(text)}</p><div id="w"></div>
<script>function go(){if(!window.turnstile){return setTimeout(go,120)}window.turnstile.render('#w',{sitekey:'${siteKey}',language:'${locale}',theme:'light',appearance:'always',callback:function(t){window.ReactNativeWebView.postMessage(JSON.stringify({token:t}))},'error-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({error:true}))},'expired-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({expired:true}))}})}go()</script></body></html>`;
}

export function TurnstileChallenge({ siteKey, onToken, onError }: { siteKey: string; onToken: (t: string) => void; onError: () => void }) {
  const { t, i18n } = useTranslation();
  const origin = (process.env.EXPO_PUBLIC_TURNSTILE_ORIGIN ?? process.env.EXPO_PUBLIC_STUDENT_WEB_URL ?? 'http://localhost:3101').replace(/\/$/, '');
  return (
    <View style={{ height: 260, borderRadius: theme.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.color.border }}>
      <WebView
        originWhitelist={['*']} source={{ html: turnstileHtml(siteKey, i18n.language, t('mobile:signup.captchaTitle'), t('mobile:signup.captchaText')), baseUrl: origin }}
        onMessage={(e) => { try { const m = JSON.parse(e.nativeEvent.data); if (m.token) onToken(m.token); else onError(); } catch { onError(); } }}
        javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} style={{ backgroundColor: '#FFFDF8' }}
      />
    </View>
  );
}
