# Store readiness — Hangyul Univ native apps (student, agency, university)

**Status: prepared, not submitted.** No Google Play or App Store account is connected to this project and no
submission was attempted. Everything below is the material a submission needs, written so the owner can act
on it without reverse-engineering the app. Fields that depend on something only the owner has — a developer
account, a production domain, a privacy policy URL — are marked **OWNER**.

Last updated: 2026-10-27 (V26). First written for the student app in V18; V25 built all three apps.

## 0. Artifacts (current)

| | Android | iOS |
|---|---|---|
| State | **Six V25 artifacts exist** — a preview APK (cleartext allowed for the emulator) and a store-shaped production AAB (cleartext refused); V32 removed the test sign-in from every build profile, so preview and production differ only in signing and network policy for each of the three apps. **V26 rebuilds are planned.** | **Not built.** EAS is not logged in on this host and there is no macOS/Xcode; nothing iOS has been produced |
| Latest artifacts | see `result/<app>-mobile/android/BUILD_INFO.json` (file names, sizes, SHA-256, signer, `builtAt`) | — |
| Build method | local Gradle (`expo prebuild` → `./gradlew`, no daemon, 1 worker), Expo SDK 57, RN 0.86, ABIs arm64-v8a + x86_64 | — |
| Signing | **QA keystore (CN=Hangyul Univ QA) — not for store.** The Hangyul Univ upload keystore is not on this host; re-sign or rebuild with it before any upload | — |
| API origin baked in | `http://10.0.2.2:8001` (the local API as seen from the emulator). A production HTTPS origin is an owner input | — |

---

## 1. Identity

| | Student | Agency | University |
|---|---|---|---|
| Display name | **Hangyul Univ** | Hangyul Univ — agency | Hangyul Univ — university |
| Android package / iOS bundle identifier | `kr.hangyul.univ.student` | `kr.hangyul.univ.agency` | `kr.hangyul.univ.university` |
| Version · versionCode · buildNumber | `1.0.0` · `1` · `1` | `1.0.0` · `1` · `1` | `1.0.0` · `1` · `1` |
| URL scheme | `hangyul-student://` | `hangyul-agency://` | `hangyul-university://` |
| Expo slug | `hangyul-student` | `hangyul-agency` | `hangyul-university` |

Sections 2–4 below (listing copy, privacy declarations, screenshots) were written for the **student** app, the one meant for
public store listing; the agency and university apps have no listing copy yet and are distributed to partner staff.

The package and bundle identifiers were **not** changed in V18 or since — they are the project's existing canonical
values, and changing an identifier after any install exists orphans those installs.

`version` was set to `1.0.0` in V18 (from `0.1.0`), with `versionCode`/`buildNumber` introduced at `1`. This
is a judgement call, not something the brief specified: a store listing at 0.1.0 reads as a prototype. It is
one line in `app.json` if the owner prefers otherwise.

---

## 2. Listing copy

### App name (30 chars max on both stores)
`Hangyul Univ` (12)

### Subtitle / short description (Play: 80 chars, App Store subtitle: 30)
- Play (80): `Study in Korea — universities, applications, documents and visa in one app.` (75)
- App Store (30): `Study in Korea, step by step` (28)

### Full description (Play: 4000 chars)

> **Everything you need to study in Korea, from your first question to your first semester.**
>
> Hangyul Univ helps international students find Korean universities they can actually get into, prepare
> every document correctly the first time, and keep track of what happens next — applications, essays, visa,
> housing and arrival.
>
> **Find universities that fit you**
> Answer three questions and see the programmes open to someone with your nationality, your intended degree
> and the language scores you have today. Every match is checked against published admission requirements —
> never a prediction, and never a promise. Universities decide.
>
> **Prepare documents once**
> Upload a document once and reuse it across applications. Hangyul checks what each university needs, tells
> you in plain language what to fix — a missing apostille, an expired certificate, the wrong copy — and
> keeps a single list of what still needs you.
>
> **Know what happens next**
> Each application has its own checklist and its own deadline. Your visa stage, your tasks and your
> counsellor's messages are all in one place, so you always know the next step.
>
> **Works when your connection doesn't**
> Your applications, documents, messages and plan are kept on your device, so you can check them on the
> subway or on a weak connection. Hangyul tells you when what you're reading was last updated.
>
> **In your language**
> Hangyul is available in the languages of the markets we serve, with the application, payment and visa
> flows fully translated.
>
> **Honest about money**
> Plans are one-time purchases, not subscriptions. Hangyul never collects your tuition — under Korean
> Ministry of Education guidance, tuition is paid by you, in your own name, directly to the university.

### Keywords (App Store, 100 chars)
`korea,study abroad,university,admission,visa,TOPIK,student,application,korean,scholarship` (89)

### Category
- Play: **Education**
- App Store: **Education** (secondary: Reference)

### Content / age rating
- Play: **Everyone**. Questionnaire: no violence, no sexual content, no gambling, no user-generated public
  content. There **is** private messaging between a student and their assigned counsellor — declare it, it
  is not public social interaction.
- App Store: **4+**.

---

## 3. Privacy and permissions

### Permissions the app requests, and the wording the stores will show

| Permission | Where | Why |
|---|---|---|
| Camera | `expo-image-picker` | "Hangyul uses the camera so you can photograph a document and upload it." |
| Photo library | `expo-image-picker` | "Hangyul opens your photos so you can choose a document to upload." |
| Notifications | `expo-notifications` | Deadline reminders and counsellor messages |

Microphone is explicitly **disabled** in the image-picker plugin config. The app requests no location, no
contacts, no calendar.

### Data safety (Play) / App privacy (App Store) — declare

- **Collected and linked to the user:** name, email, nationality, date of birth, education history,
  uploaded identity and academic documents, messages with counsellors, purchase history.
- **Purpose:** app functionality and account management. **Not** advertising, **not** tracking.
- **Encrypted in transit:** yes. **Can the user request deletion:** yes — **OWNER** must publish the route.
- **Third parties:** Toss Payments (payment processing, TEST mode today). Payment is handed off to Hangyul's own card
  form on the student web (system browser), not done in the app; the server relays card number and expiry to Toss and
  stores neither, and no card data ever enters the app. Identity verification: Twilio SendGrid (e-mail code), Twilio
  Programmable Messaging (SMS code), Cloudflare Turnstile — all declared in `/privacy`.
- **On-device storage:** the app caches applications, documents *metadata*, messages, saved universities,
  visa status and plan on the device so it works offline. It never caches payment confirmations or document
  file contents. The cache is cleared on sign-out. Credentials live in the OS keychain/keystore.

### Required URLs — **OWNER**

| | |
|---|---|
| Privacy policy URL | **OWNER** — required by both stores before submission |
| Terms of service URL | **OWNER** |
| Support URL / email | **OWNER** (`myung@talkhangyul.com` exists but a support page is better) |
| Marketing URL | the Hangyul Univ marketing site, once it has a public origin |

---

## 4. Screenshots plan

Not produced in V18. Both stores require them; what is needed:

- **Play:** phone screenshots (min 2, max 8) at ≥ 1080 px on the short side; a 1024 × 500 feature graphic;
  a 512 × 512 icon.
- **App Store:** 6.7" (1290 × 2796) and 6.5" sets; a 5.5" set if supporting older devices.

Suggested six, in order, because they tell the story in the order a student lives it:
1. Quick check result — "programmes open to applicants like you"
2. University detail with the mission and campus video
3. Applications list with deadlines and what is blocking each
4. Documents — "3 of 8 ready", with what needs you
5. Document upload sheet (camera / photos / files)
6. Visa stage with the next action

The emulator screenshots already captured at 1080 × 2400 in `result/screenshots/android/` are the right
resolution for Play but are **development-API** screenshots and show demo data; store screenshots should be
retaken against production data with the demo labelling absent.

---

## 5. Release blockers, in order

1. **Production API origin.** The Android artifacts were built against `http://10.0.2.2:8001` so they could
   be tested on an emulator. There is no production API origin anywhere in this repository. All six artifacts
   must be rebuilt with `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_STUDENT_WEB_URL` set to real HTTPS origins —
   and because the payment return is a deep link back from the web checkout, `toss_return_origin` must match.
2. **Play signing.** The AABs are signed with the V22 **QA keystore** (CN=Hangyul Univ QA, "not for store"); the
   Hangyul Univ upload keystore is not on this host. The owner must supply it (or let Play App Signing generate the
   upload key), then rebuild or re-sign.
3. **Toss live keys and contracts.** Toss runs in TEST mode (plans bought by foreign-card key-in on MID
   `bill_talkoab1`); `toss_live_keys_ready`, `toss_card_review_ready`, `toss_foreign_card_contract_ready` and the USD
   multi-currency contract are all outstanding (`docs/payments/TOSS_FOREIGN_CARD_REVIEW.md` §7). Shipping to a store with
   test keys would take money from nobody and fail every real purchase.
   **Identity providers:** SendGrid / Twilio / Turnstile credentials are absent on this host; production refuses to boot
   without them, and sign-up cannot send a real code until they exist.
4. **Privacy policy and terms URLs** — both stores reject without them.
5. **Apple Developer Program membership** (US$99/yr) for any iOS distribution, plus a macOS machine or an
   authenticated EAS account to build at all — **no iOS build exists**.
6. **Google Play Developer account** (US$25 one-time).

Nothing in 5 or 6 was purchased or registered — the brief forbids creating paid accounts without explicit
owner action.
