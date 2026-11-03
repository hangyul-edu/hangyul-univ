/**
 * V22 native sign-up (brief §4–§17, §22–§23). The same server state machine as the web: one session, two
 * proofs, granular consents, one write. Presentation is native: one step per screen, keyboard-safe, a subtle
 * progress line, one primary action per screen. Android back / iOS swipe go one step back without resending a
 * code, losing a verified value or duplicating anything (the reducer's `back`).
 */
import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, Button, Callout, ChipGroup, TextField, theme } from '@hangyul/mobile-ui';
import type { ConsentCatalogueItem, DegreeLevel, QuickLanguageKind, SignupConfig } from '@hangyul/types';
import { countryName } from '@hangyul/utils';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { bothVerified, codeExpired, expiresSeconds, initialState, missingRequired, nextStepAfterAccount, passwordMatch, reduce, resendSeconds, type SignupState } from './state';
import { looksPlausible } from './phone';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalSheet, OtpField, PasswordField, PhoneField, StepDots, TANGERINE, TurnstileChallenge } from './components';
import { applyQuickProfile, fetchConfig, register, sendCode, startSession, verifyCode } from './client';
import { mapSignupError } from './errors';
import { clearDraft, loadDraft, saveDraft } from './persist';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
/** Set by the flow on success so the authenticated app can land on recommendations instead of an empty home. */
let postSignup: { welcome: boolean } | null = null;
export const consumePostSignup = () => { const v = postSignup; postSignup = null; return v; };

/* register() signs the client in at once; the AuthGate would swap to the app before the "account created" step is seen.
 * The flow holds the gate from the register call until the student leaves the done step (or the call fails). */
let holdValue = false;
const holdListeners = new Set<(v: boolean) => void>();
const setHold = (v: boolean) => { holdValue = v; holdListeners.forEach((l) => l(v)); };
export function useSignupHold(): boolean {
  const [v, setV] = useState(holdValue);
  useEffect(() => { holdListeners.add(setV); return () => { holdListeners.delete(setV); }; }, []);
  return v;
}

export function SignupFlow({ onCancel, defaultNationality = 'VN' }: { onCancel: () => void; defaultNationality?: string }) {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const locale = i18n.language;
  const [s, dispatch] = useReducer(reduce, defaultNationality, initialState);
  const [config, setConfig] = useState<SignupConfig | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restored, setRestored] = useState(false);
  const [legal, setLegal] = useState<{ doc: string; version: string } | null>(null);
  const [codes, setCodes] = useState({ email: '', sms: '' });
  const [fieldErr, setFieldErr] = useState<Record<string, string | null>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [doneName, setDoneName] = useState('');
  const [quick, setQuick] = useState<{ degree: DegreeLevel; kind: QuickLanguageKind; level: number }>({ degree: 'BACHELOR', kind: 'TOPIK', level: 3 });
  const emailRef = useRef<TextInput>(null); const phoneRef = useRef<TextInput>(null); const pwRef = useRef<TextInput>(null); const pw2Ref = useRef<TextInput>(null);
  const smsOtpRef = useRef<TextInput>(null);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    fetchConfig(api).then((c) => { setConfig(c); dispatch({ type: 'captcha', required: c.captcha.required && c.captcha.provider === 'turnstile' && !!c.captcha.site_key }); })
      .catch(() => dispatch({ type: 'error', error: { key: 'signup.err.network' } }));
    loadDraft().then((d) => { if (d) { dispatch({ type: 'restore', state: { account: d.account as SignupState['account'], consents: d.consents } }); setRestored(true); } });
  }, [api]);
  useEffect(() => { void saveDraft(s); }, [s]);
  // Android hardware back: one step back; never out of the flow by accident from a step that holds a verified value.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (s.step === 'done') return true;
      if (s.step === 'account') { onCancel(); return true; }
      dispatch({ type: 'back' }); return true;
    });
    return () => sub.remove();
  }, [s.step, onCancel]);

  const errText = (e: { key: string; params?: Record<string, string | number> } | null) => (e ? t(`mobile:${e.key}`, e.params) : null);
  const fail = (err: unknown) => {
    const m = mapSignupError(err);
    if (m.code?.startsWith('SIGNUP_SESSION')) { dispatch({ type: 'session-expired' }); return; }
    dispatch({ type: 'error', error: { key: m.key, params: m.params } });
  };

  // ------------------------------------------------------------------ account → session → codes
  const validateAccount = () => {
    const a = s.account; const e: Record<string, string | null> = {};
    if (!a.fullName.trim()) e.fullName = t('mobile:signup.err.required');
    if (!EMAIL_RE.test(a.email.trim())) e.email = t('mobile:signup.err.emailInvalid');
    if (!looksPlausible(a.phoneCountry, a.phoneLocal)) e.phone = t('mobile:signup.err.phoneInvalid');
    if (a.password.length < 10) e.password = t('mobile:signup.err.passwordShort');
    if (a.password !== a.passwordConfirm) e.passwordConfirm = t('mobile:signup.err.passwordMismatch');
    setFieldErr(e); return Object.keys(e).length === 0;
  };
  const beginSession = async (token: string | null) => {
    dispatch({ type: 'busy', busy: true });
    try {
      const r = await startSession(api, token, locale);
      dispatch({ type: 'session', token: r.signup_session, expiresIn: r.expires_in });
      dispatch({ type: 'busy', busy: false });
      dispatch({ type: 'step', step: 'verify' });
      await Promise.all([send('email', r.signup_session), send('sms', r.signup_session)]);
    } catch (err) { setCaptchaToken(null); fail(err); }
  };
  const continueFromAccount = async () => {
    if (!validateAccount()) return;
    const next = nextStepAfterAccount(s.captchaRequired);
    if (next === 'challenge') { dispatch({ type: 'step', step: 'challenge' }); return; }
    await beginSession(null);
  };
  const send = async (channel: 'email' | 'sms', session = s.session) => {
    if (!session) { dispatch({ type: 'session-expired' }); return; }
    dispatch({ type: 'chan-busy', channel, busy: true });
    try {
      const target = channel === 'email' ? s.account.email.trim().toLowerCase() : s.account.phoneLocal;
      const r = await sendCode(api, session, { channel: channel === 'email' ? 'EMAIL' : 'SMS', target, phone_country: s.account.phoneCountry, locale });
      dispatch({ type: 'chan-sent', channel, challengeId: r.challenge_id, expiresIn: r.expires_in, resendIn: r.resend_in, targetMasked: r.target_masked, delivery: r.delivery, now: Date.now() });
      setCodes((c) => ({ ...c, [channel]: '' }));
    } catch (err) {
      const m = mapSignupError(err);
      if (m.code?.startsWith('SIGNUP_SESSION')) { dispatch({ type: 'session-expired' }); return; }
      dispatch({ type: 'chan-error', channel, error: { key: m.key, params: m.params } });
    }
  };
  const verify = useCallback(async (channel: 'email' | 'sms', code: string) => {
    const ch = s[channel];
    if (!ch.challengeId || ch.proof || ch.busy) return;
    dispatch({ type: 'chan-busy', channel, busy: true });
    try {
      const r = await verifyCode(api, ch.challengeId, code);
      dispatch({ type: 'chan-verified', channel, proof: r.proof });
      if (channel === 'email') smsOtpRef.current?.focus();
    } catch (err) {
      const m = mapSignupError(err);
      setCodes((c) => ({ ...c, [channel]: '' }));
      dispatch({ type: 'chan-error', channel, error: { key: m.key, params: m.params }, attemptsLeft: m.attemptsLeft ?? null, reset: m.code === 'TOO_MANY_ATTEMPTS' || m.code === 'CODE_EXPIRED' });
    }
  }, [api, s]);

  // ------------------------------------------------------------------ consent → register
  const items: ConsentCatalogueItem[] = config?.consents.items ?? [];
  const submit = async () => {
    const missing = missingRequired(s.consents, items);
    if (missing.length) { dispatch({ type: 'error', error: { key: 'signup.err.consentRequired' } }); return; }
    if (!s.session || !s.email.proof || !s.sms.proof) { dispatch({ type: 'session-expired' }); return; }
    dispatch({ type: 'busy', busy: true });
    setHold(true);
    try {
      const tr = await register(api, {
        email: s.account.email.trim().toLowerCase(), email_proof: s.email.proof, phone: s.account.phoneLocal, phone_country: s.account.phoneCountry, phone_proof: s.sms.proof,
        password: s.account.password, password_confirm: s.account.passwordConfirm, full_name: s.account.fullName.trim(), locale, nationality: s.account.nationality || s.account.phoneCountry,
        consents: Object.fromEntries(items.map((i) => [i.key, !!s.consents[i.key]])),
      }, s.session);
      setDoneName(tr.user.preferred_name || tr.user.full_name.split(' ')[0] || tr.user.full_name);
      await clearDraft();
      dispatch({ type: 'busy', busy: false });
      dispatch({ type: 'step', step: 'done' });
    } catch (err) {
      const m = mapSignupError(err);
      if (m.code === 'VERIFICATION_EXPIRED' || m.code === 'VERIFICATION_MISMATCH' || m.code === 'EMAIL_NOT_VERIFIED' || m.code === 'PHONE_NOT_VERIFIED') {
        dispatch({ type: 'chan-reset', channel: 'email' }); dispatch({ type: 'chan-reset', channel: 'sms' }); dispatch({ type: 'step', step: 'verify' });
        dispatch({ type: 'error', error: { key: m.key } }); setHold(false); return;
      }
      setHold(false);
      fail(err);
    }
  };
  const finish = async () => {
    // The account exists and the session is live; the quick profile is optional and never blocks the student.
    try { await applyQuickProfile(api, { nationality: s.account.nationality || s.account.phoneCountry, degree: quick.degree, kind: quick.kind, level: quick.kind === 'TOPIK' || quick.kind === 'IELTS' ? quick.level : undefined }); } catch { /* profile can be completed later */ }
    postSignup = { welcome: true };
    // Signing in already happened inside register(); releasing the hold lets the AuthGate render the app.
    setHold(false);
  };
  const skipQuick = () => { postSignup = { welcome: true }; setHold(false); };

  const match = passwordMatch(s.account);
  const header = (
    <View style={st.header}>
      {s.step !== 'done' ? (
        <Pressable onPress={() => (s.step === 'account' ? onCancel() : dispatch({ type: 'back' }))} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('mobile:signup.back')} style={st.back}>
          <ArrowLeft size={22} color={theme.color.text} />
        </Pressable>
      ) : <View style={st.back} />}
      <StepDots step={s.step} />
    </View>
  );

  return (
    <SafeAreaView style={st.root} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {header}
          {s.step === 'account' && (
            <View style={st.form}>
              <AppText variant="title" accessibilityRole="header">{t('mobile:signup.title')}</AppText>
              <AppText variant="body" secondary>{t('mobile:signup.subtitle')}</AppText>
              {restored ? <Callout tone="info" body={t('mobile:signup.draftRestored')} /> : null}
              {errText(s.formError) ? <Callout tone="danger" body={errText(s.formError)!} /> : null}
              <FieldText label={t('mobile:signup.fullName')} hint={t('mobile:signup.fullNameHint')} value={s.account.fullName} onChangeText={(v) => dispatch({ type: 'account', patch: { fullName: v } })} error={fieldErr.fullName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
              <FieldText ref={emailRef} label={t('mobile:signup.email')} value={s.account.email} onChangeText={(v) => dispatch({ type: 'account', patch: { email: v } })} error={fieldErr.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
              <PhoneField ref={phoneRef} country={s.account.phoneCountry} local={s.account.phoneLocal} onChange={(v) => dispatch({ type: 'account', patch: { phoneCountry: v.country, phoneLocal: v.local } })} error={fieldErr.phone} returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} />
              <PasswordField ref={pwRef} label={t('mobile:signup.password')} value={s.account.password} onChangeText={(v) => dispatch({ type: 'account', patch: { password: v } })} error={fieldErr.password} hint={t('mobile:signup.passwordHint')} showStrength autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => pw2Ref.current?.focus()} />
              <View style={{ gap: 6 }}>
                <PasswordField ref={pw2Ref} label={t('mobile:signup.passwordConfirm')} value={s.account.passwordConfirm} onChangeText={(v) => dispatch({ type: 'account', patch: { passwordConfirm: v } })} error={fieldErr.passwordConfirm} autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={() => void continueFromAccount()} />
                {match !== null && !fieldErr.passwordConfirm ? (
                  <View style={st.match} accessibilityLiveRegion="polite">
                    {match ? <Check size={14} color={theme.status.success.fg} /> : null}
                    <AppText variant="caption" color={match ? theme.status.success.fg : theme.status.danger.fg}>{match ? t('mobile:signup.passwordMatch') : t('mobile:signup.passwordMismatch')}</AppText>
                  </View>
                ) : null}
              </View>
              <Button label={t('mobile:signup.continue')} onPress={() => void continueFromAccount()} loading={s.busy || !config} fullWidth />
              <Pressable onPress={onCancel} accessibilityRole="button" style={st.linkRow}>
                <AppText variant="body" secondary align="center">{t('mobile:signup.haveAccount')} <AppText variant="body" weight="semibold" color={TANGERINE}>{t('mobile:signup.login')}</AppText></AppText>
              </Pressable>
            </View>
          )}

          {s.step === 'challenge' && config?.captcha.site_key && (
            <View style={st.form}>
              <AppText variant="title" accessibilityRole="header">{t('mobile:signup.captchaTitle')}</AppText>
              <AppText variant="body" secondary>{t('mobile:signup.captchaText')}</AppText>
              {errText(s.formError) ? <Callout tone="danger" body={errText(s.formError)!} /> : null}
              <TurnstileChallenge siteKey={config.captcha.site_key} onToken={(tok) => { setCaptchaToken(tok); void beginSession(tok); }} onError={() => dispatch({ type: 'error', error: { key: 'signup.err.captchaFailed' } })} />
              {!captchaToken ? <AppText variant="caption" align="center">{t('mobile:signup.captchaWaiting')}</AppText> : null}
            </View>
          )}

          {s.step === 'verify' && (
            <View style={st.form}>
              <AppText variant="title" accessibilityRole="header">{t('mobile:signup.verifyTitle')}</AppText>
              <AppText variant="body" secondary>{t('mobile:signup.verifyText')}</AppText>
              {errText(s.formError) ? <Callout tone="danger" body={errText(s.formError)!} /> : null}
              {(['email', 'sms'] as const).map((channel) => {
                const ch = s[channel];
                const wait = resendSeconds(ch, now); const left = expiresSeconds(ch, now); const expired = codeExpired(ch, now);
                const target = channel === 'email' ? s.account.email : ch.targetMasked ?? '';
                return (
                  <View key={channel} style={[st.chan, ch.proof && st.chanDone]}>
                    <View style={st.chanHead}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="subheading">{t(channel === 'email' ? 'mobile:signup.emailCode' : 'mobile:signup.smsCode')}</AppText>
                        <AppText variant="caption" numberOfLines={1}>{ch.challengeId ? t('mobile:signup.sentTo', { target: ch.targetMasked ?? target }) : target}</AppText>
                      </View>
                      {ch.proof ? (
                        <View style={st.ok}><Check size={14} color={theme.status.success.fg} /><AppText variant="caption" color={theme.status.success.fg} weight="semibold">{t('mobile:signup.verified')}</AppText></View>
                      ) : (
                        <Pressable onPress={() => dispatch({ type: 'step', step: 'account' })} hitSlop={8} accessibilityRole="button"><AppText variant="caption" color={TANGERINE} weight="semibold">{t('mobile:signup.change')}</AppText></Pressable>
                      )}
                    </View>
                    {!ch.proof ? (
                      <>
                        <OtpField ref={channel === 'sms' ? smsOtpRef : undefined} label={t(channel === 'email' ? 'mobile:signup.emailCode' : 'mobile:signup.smsCode')} value={codes[channel]} invalid={!!ch.error} disabled={!ch.challengeId || ch.busy || expired}
                          onChange={(v) => { setCodes((c) => ({ ...c, [channel]: v })); }} onComplete={(v) => void verify(channel, v)} />
                        <View style={st.chanFoot}>
                          <View style={{ flex: 1 }}>
                            {ch.error ? <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{errText(ch.error)}{ch.attemptsLeft != null && ch.attemptsLeft > 0 ? ` · ${t('mobile:signup.attemptsLeft', { count: ch.attemptsLeft })}` : ''}</AppText>
                              : expired ? <AppText variant="caption" tone="danger">{t('mobile:signup.expired')}</AppText>
                                : ch.challengeId ? <AppText variant="caption">{t('mobile:signup.expiresIn', { seconds: left })}</AppText> : null}
                          </View>
                          <Pressable disabled={wait > 0 || ch.busy} onPress={() => void send(channel)} accessibilityRole="button" accessibilityState={{ disabled: wait > 0 || ch.busy }} hitSlop={8} style={st.resend}>
                            <AppText variant="caption" weight="semibold" color={wait > 0 ? theme.color.textTertiary : TANGERINE}>{wait > 0 ? t('mobile:signup.resendIn', { seconds: wait }) : t('mobile:signup.resend')}</AppText>
                          </Pressable>
                        </View>
                        {ch.delivery === 'console' ? <AppText variant="caption" color={theme.color.textTertiary}>{t('mobile:signup.consoleHint')}</AppText> : null}
                      </>
                    ) : null}
                  </View>
                );
              })}
              <Button label={t('mobile:signup.continue')} onPress={() => dispatch({ type: 'step', step: 'consent' })} disabled={!bothVerified(s)} fullWidth />
            </View>
          )}

          {s.step === 'consent' && (
            <View style={st.form}>
              <AppText variant="title" accessibilityRole="header">{t('mobile:signup.consentTitle')}</AppText>
              <AppText variant="body" secondary>{t('mobile:signup.consentText')}</AppText>
              {errText(s.formError) ? <Callout tone="danger" body={errText(s.formError)!} /> : null}
              <View style={st.consents}>
                <ConsentRow label={t('mobile:signup.consentAll')} bold checked={items.length > 0 && items.every((i) => s.consents[i.key])} onToggle={(v) => dispatch({ type: 'consent-all', keys: items.map((i) => i.key), value: v })} />
                {items.map((i) => (
                  <ConsentRow key={i.key} tag={i.required ? t('mobile:signup.required') : t('mobile:signup.optional')} required={i.required}
                    label={t(`mobile:signup.consent.${i.key}.label`, { defaultValue: i.key })} summary={t(`mobile:signup.consent.${i.key}.summary`, { defaultValue: '' }) || undefined}
                    checked={!!s.consents[i.key]} onToggle={(v) => dispatch({ type: 'consent', key: i.key, value: v })}
                    onView={i.document ? () => setLegal({ doc: i.document!, version: i.version }) : undefined} viewLabel={t('mobile:signup.view')} />
                ))}
              </View>
              {locale !== 'ko' ? <AppText variant="caption" color={theme.color.textTertiary}>{t('mobile:signup.canonical')}</AppText> : null}
              <Button label={t('mobile:signup.submit')} onPress={() => void submit()} loading={s.busy} fullWidth />
            </View>
          )}

          {s.step === 'done' && (
            <View style={st.form}>
              <View style={st.doneHead}><ShieldCheck size={28} color={theme.status.success.solid} /><AppText variant="title" accessibilityRole="header">{t('mobile:signup.doneTitle', { name: doneName })}</AppText></View>
              <AppText variant="body" secondary>{t('mobile:signup.doneText')}</AppText>
              <AppText variant="label">{t('mobile:signup.quickDegree')}</AppText>
              <ChipGroup options={(['LANGUAGE', 'BACHELOR', 'TRANSFER', 'MASTER', 'DOCTORATE'] as DegreeLevel[]).map((d) => ({ value: d, label: t(`mobile:signup.degree.${d}`) }))} selected={[quick.degree]} onToggle={(d) => setQuick((q) => ({ ...q, degree: d as DegreeLevel }))} />
              <AppText variant="label">{t('mobile:signup.quickLanguage')}</AppText>
              <ChipGroup options={(['TOPIK', 'IELTS', 'NONE', 'PREPARING'] as QuickLanguageKind[]).map((k) => ({ value: k, label: t(`mobile:signup.lang.${k}`) }))} selected={[quick.kind]} onToggle={(k) => setQuick((q) => ({ ...q, kind: k as QuickLanguageKind, level: k === 'IELTS' ? 6 : 3 }))} />
              {quick.kind === 'TOPIK' || quick.kind === 'IELTS' ? (
                <ChipGroup options={(quick.kind === 'TOPIK' ? [1, 2, 3, 4, 5, 6] : [5, 5.5, 6, 6.5, 7, 7.5]).map((n) => ({ value: String(n), label: `${t('mobile:signup.quickLevel')} ${n}` }))} selected={[String(quick.level)]} onToggle={(v) => setQuick((q) => ({ ...q, level: Number(v) }))} />
              ) : null}
              <Button label={t('mobile:signup.quickGo')} onPress={() => void finish()} fullWidth />
              <Button label={t('mobile:signup.quickSkip')} variant="ghost" onPress={skipQuick} fullWidth />
              <AppText variant="caption" align="center" color={theme.color.textTertiary}>{countryName(s.account.nationality || s.account.phoneCountry, locale)}</AppText>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <LegalSheet doc={legal?.doc ?? null} version={legal?.version ?? ''} visible={!!legal} onClose={() => setLegal(null)} />
    </SafeAreaView>
  );
}

const FieldText = forwardRef<TextInput, Parameters<typeof TextField>[0]>(function FieldText(props, ref) { return <TextField ref={ref} {...props} />; });

function ConsentRow({ label, summary, tag, required, bold, checked, onToggle, onView, viewLabel }: {
  label: string; summary?: string; tag?: string; required?: boolean; bold?: boolean; checked: boolean; onToggle: (v: boolean) => void; onView?: () => void; viewLabel?: string;
}) {
  return (
    <View style={[st.consent, bold && st.consentAll]}>
      <Pressable onPress={() => onToggle(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${tag ? `${tag}. ` : ''}${label}`} style={st.consentMain} hitSlop={6}>
        <View style={[st.box, checked && st.boxOn]}>{checked ? <Check size={14} color="#fff" strokeWidth={3} /> : null}</View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="body" weight={bold ? 'semibold' : 'regular'}>
            {tag ? <AppText variant="caption" weight="semibold" color={required ? '#B84600' : theme.color.textTertiary}>{tag} </AppText> : null}{label}
          </AppText>
          {summary ? <AppText variant="caption">{summary}</AppText> : null}
        </View>
      </Pressable>
      {onView ? <Pressable onPress={onView} accessibilityRole="button" accessibilityLabel={viewLabel} hitSlop={8} style={st.view}><AppText variant="caption" weight="semibold" color={TANGERINE}>{viewLabel}</AppText></Pressable> : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bgCanvas },
  content: { padding: 20, paddingTop: 8, gap: 16, flexGrow: 1, maxWidth: 520, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  back: { width: 40, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  form: { gap: 14 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  chan: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: 14, gap: 12, backgroundColor: theme.color.surface },
  chanDone: { borderColor: theme.status.success.solid, backgroundColor: theme.status.success.bg },
  chanHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ok: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chanFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resend: { minHeight: 36, justifyContent: 'center' },
  consents: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, overflow: 'hidden' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: theme.color.border, gap: 8 },
  consentAll: { borderTopWidth: 0, backgroundColor: theme.color.surfaceWarm },
  consentMain: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start', minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: theme.color.surface },
  boxOn: { backgroundColor: theme.color.text, borderColor: theme.color.text },
  view: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
