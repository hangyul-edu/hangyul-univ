/**
 * The native sign-up talks to exactly the endpoints the web sign-up uses (brief §7–§8, §13, §28). The app never
 * learns which provider delivers a code and never holds a provider credential: it sends a target, receives a
 * challenge handle, and sends a code back.
 */
import type { ApiClient } from '@hangyul/api-client';
import type { RegisterBody, SignupConfig, VerificationSent, VerificationVerified } from '@hangyul/types';

export const fetchConfig = (api: ApiClient): Promise<SignupConfig> => api.auth.signupConfig();
export const startSession = (api: ApiClient, captchaToken: string | null, locale: string) => api.auth.signupSession(captchaToken, locale);
export const sendCode = (api: ApiClient, session: string, body: { channel: 'EMAIL' | 'SMS'; target: string; phone_country?: string; locale: string }): Promise<VerificationSent> =>
  api.auth.sendCode(session, { ...body, purpose: 'SIGNUP' });
export const verifyCode = (api: ApiClient, challengeId: string, code: string): Promise<VerificationVerified> => api.auth.verifyCode(challengeId, code);
export const register = (api: ApiClient, body: RegisterBody, session: string) => api.auth.register(body, session);

/** Carry the first-run answers into the new profile so the first recommendations are already personal. */
export async function applyQuickProfile(api: ApiClient, a: { nationality?: string; degree?: string; kind?: string; level?: number }) {
  const patch: Record<string, unknown> = {};
  if (a.nationality) patch.nationality = a.nationality;
  if (a.degree) patch.target_degree = a.degree;
  if (Object.keys(patch).length) await api.me.updateProfile(patch);
  if ((a.kind === 'TOPIK' || a.kind === 'IELTS') && a.level) await api.me.addLanguage({ test: a.kind, score: a.level });
}
