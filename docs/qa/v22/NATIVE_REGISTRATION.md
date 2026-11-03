# V22 — Student native registration (Android / iOS)

The React Native Student app (`apps/student-mobile`) creates accounts through the **same** V22 backend as the web:
`POST /auth/signup/session` → `POST /auth/verification/send` / `verify` (email via SendGrid, SMS via Twilio Messaging
Service) → `POST /auth/register`. No native-only endpoint, no native-only verification rule, no provider credential in
the app. Code lives in `apps/student-mobile/src/signup/` (`state.ts` reducer, `client.ts`, `components.tsx`,
`SignupFlow.tsx`, `persist.ts`, `errors.ts`, `phone.ts`) and `src/AuthEntry.tsx` (login ⇄ sign-up).

## Web ↔ native parity matrix

| Capability | Web (`apps/student-web/pages/Register.tsx`) | Native (`apps/student-mobile/src/signup`) | Same server rule |
|---|---|---|---|
| Steps | Account → Verification → Agreement → Complete | Account → (CAPTCHA) → Verification → Agreement → Complete; progress dots, back navigation | — |
| Full name, nationality | text + `CountrySelect` | text + nationality sheet (prefills phone country) | `RegisterIn.full_name/nationality` |
| Phone | `PhoneInput` (country + local) | `PhoneField`: searchable country sheet (flag, name, +dial), local digits, live E.164 preview | server normalises to E.164 (`phonenumbers`), native preview is display-only |
| Password | `PasswordInput` show/hide + strength | `PasswordField` show/hide + strength + "Passwords match / do not match" | `password_confirm` compared server-side; min length 10 |
| Email OTP | `OtpInput` 6 boxes | `OtpField`: one real `TextInput`, six boxes, `textContentType="oneTimeCode"`, Android `autoComplete="sms-otp"`, paste; **no READ_SMS** | 5-min TTL, 60-s resend, 5 attempts, Redis limits |
| SMS OTP | same component | same component (`sms` channel) | same |
| Resend / expiry | server `resend_in`/`expires_in` countdowns | same values, same countdowns | server rejects early resend (`OTP_RESEND_TOO_SOON`) |
| Change email/phone before verified | "Change" link | "Change" returns to the account step; verified channel keeps its proof | proofs are bound to the exact target |
| CAPTCHA | Turnstile widget in page | `TurnstileChallenge`: controlled `react-native-webview`, site key only, token posted to the app, sent once to `/auth/signup/session` | `captcha.required` from `/auth/signup/config`; production fail-closed (boot refuses without Turnstile) |
| Consents | catalogue from `/auth/signup/config`, required/optional tags, "Agree to all", per-item summary, document links | identical: catalogue-driven, `전체 동의` is a convenience that only toggles items, required enforced individually | `CONSENT_REQUIRED` with keys; consent rows store `document_version`, `locale`, `source=SIGNUP` |
| Legal documents | marketing pages | `LegalSheet` opens the **canonical** marketing page in a WebView with `?embed=1` (no header/footer), version from the catalogue is recorded | same document versions |
| Create account | `register(body, signup_session)` | `register(body, signup_session)` | one write; no account before it |
| After sign-up | signed in, onboarding | signed in through the existing token store, quick profile (degree / test / level) → `/explore?welcome=1` | `/me/profile` |
| Login entry | 로그인 / 회원가입 | `LoginScreen` shows **Sign in** and **Create account** as equals; the quick check also offers sign-up | — |
| Existing account | `EMAIL_TAKEN` → message + link to login | same key → `signup.err.emailTaken` + "Already have an account? Sign in" | 409 |
| Interrupted registration | browser keeps form state | `persist.ts` saves name/email/phone/nationality/consents + step to SecureStore for 24 h; **never** password, codes, proofs, session or CAPTCHA token (`persistable()` strips them; unit-tested) | signup session expiry → `SIGNUP_SESSION_EXPIRED` → account step |
| Errors | localised by code | `errors.ts` maps every code (and 408/429/5xx) to `signup.err.*`; provider text never shown | — |
| Rate limiting | 429 with retry_after | same; countdown shown | Redis limits in `services/ratelimit.py` |
| Localisation | 33 markets (`student:register.*`) | 33 markets (`mobile:signup.*`, 104 keys; reused web strings where the English is identical) incl. Nepali and Burmese with native digits | — |
| Accessibility | labels, focus order | every field labelled, OTP is one 6-digit field for screen readers, progress announced (`progressbar`), checkbox roles/states, 44-pt targets, dynamic type via theme | — |

## Secrets
Native source, the exported Android JS bundle (`expo export`) and the release APK/AAB are scanned by `qa:v22`
(needles: SendGrid `SG.`, Twilio `AC`/`SK`/`MG` ids, Turnstile `0x4AAAAA…` secrets, and the variable names
`TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SECRET`, `SENDGRID_API_KEY`, `TURNSTILE_SECRET`). The app only ever knows
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_MARKETING_URL` and (production) `EXPO_PUBLIC_TURNSTILE_ORIGIN`; the Turnstile
*site* key arrives from `/auth/signup/config`.

## Tests
- `npm test -w @hangyul/student-mobile` — vitest: reducer (back/restore/consents/timers/password match), error mapping,
  E.164 preview, persistence redaction, and an **integration** test that performs the whole sign-up against the running
  API (`HG_QA_API`, default `http://localhost:8001`).
- `node scripts/qa/v22/native-signup.mjs` — Android emulator walk-through (Expo Go + Metro, `adb reverse`), with
  screenshots in `docs/qa/v22/shots/native/` and `RESULT.json`.
- iOS: `tsc` typecheck of the app only. There is no Xcode, no macOS runner and no EAS account on this host, so no iOS
  simulator run and no iOS build were performed; the OTP field uses `textContentType="oneTimeCode"` for iOS autofill.
