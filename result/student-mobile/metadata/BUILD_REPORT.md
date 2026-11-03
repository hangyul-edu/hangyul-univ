# V22 build report — Hangyul Univ Student (native)

Generated 2026-10-25. Every statement here is about an artifact that exists on disk. The V18 report that stood here is
superseded; its artifacts (sha256 bb9f7bde… / 3311ee70…, built 2026-10-20 from V18 source) were replaced because they no
longer matched the source — V19–V22 changed the app they bundled (native registration, team identity, locale fallbacks).

---

## ANDROID APK

| | |
|---|---|
| **Built?** | **Yes.** `expo prebuild --platform android --clean` → `./gradlew --no-daemon --max-workers=1 :app:assembleRelease`, locally on Linux x86_64 (pinned to 2 CPUs; host is a 6 GB WSL VM shared with another workload) |
| **File** | `result/student-mobile/android/hangyul-univ-preview.apk` |
| **Size** | 121.7 MB (127,596,238 bytes) |
| **SHA-256** | `b30ca15ec41acc61f70dba0a8e8b397074d7776fd2da9ad6d50dfa6d600d539d` |
| **Package** | `kr.hangyul.univ.student` · versionName 1.0.0 · versionCode 1 · compileSdk 36 · ABIs arm64-v8a, armeabi-v7a, x86, x86_64 · Hermes, new architecture |
| **Signed?** | **Yes — QA key, not a store key.** `apksigner verify` → *Verifies*, APK Signature Scheme v2, one signer, `CN=Hangyul Univ QA (not for store), OU=QA, O=Hangyul, L=Seoul, C=KR` (keystore generated for V22 outside the repository, valid to 2036). The Hangyul Univ **upload** keystore that signed V18 (`CN=Hangyul Univ`) is not on this host; the only release keystore present belongs to a different product and was not used |
| **Installed?** | **Yes.** `adb install -r -g` → `Success` on emulator `hg35` (Android 15, API 35, x86_64, 1 GB) |
| **Launched?** | **Yes.** `MainActivity` in the foreground, signed-out entry rendered (Sign in · **Create account** · quick check); **0 fatal exceptions** in logcat |
| **Registration entry?** | **Yes.** *Create account* opens the native four-step sign-up on the installed build; with the API unreachable it shows its own localized message ("We could not reach Hangyul…"), not a raw error |
| **Login → authenticated home?** | **Not on this artifact, by design.** The release build refuses cleartext HTTP; it is built against `http://10.0.2.2:8001` (the only API this repository has), so sign-in shows the app's own network message. Reaching the authenticated home on an installed release artifact needs an **HTTPS production API origin**, which the owner has not supplied. The same code path was verified end to end on the emulator in development mode (Expo Go + Metro): `docs/qa/v22/completion/logs/native-signup-walk.log`, 18 assertions |
| **Secrets?** | None. `assets/index.android.bundle` scanned for SendGrid/Twilio/Turnstile needles and variable names: 0 hits (also `qa:v22` check N) |

## ANDROID AAB

| | |
|---|---|
| **Built?** | **Yes.** `./gradlew --no-daemon --max-workers=1 :app:bundleRelease` |
| **File** | `result/student-mobile/android/hangyul-univ-production.aab` |
| **Size** | 80.1 MB (84,032,813 bytes) |
| **SHA-256** | `2ad5e40ac3272c72fa99d2bcaeb4145de7afae152453c2b121a1e4c1a4b11dc0` |
| **Valid bundle?** | **Yes.** `base/manifest/AndroidManifest.xml`, `base/assets/index.android.bundle` (19.0 MB), per-ABI `libhermesvm.so` for the four ABIs |
| **Signed?** | **Yes**, with the same QA key — `jarsigner -verify` → *jar verified*; `keytool -printcert -jarfile` → `CN=Hangyul Univ QA (not for store)` |
| **Play-ready?** | **No.** (1) Signed with a QA key: re-sign or rebuild with the Play upload key (owner). (2) Built against the development API origin: rebuild with the production origin (owner). Everything else — package id, version, bundle layout, Hermes, 64-bit — is in place |

## IOS

Not produced. No macOS/Xcode and no EAS login on this Linux host; the app typechecks (`tsc --noEmit`, exit 0) and the
sign-up uses `textContentType="oneTimeCode"` for iOS code autofill. See REPORT §182/§265.

## Metadata

`BUILD_INFO.json` and `SHA256SUMS.txt` in this directory are rewritten from the binaries by
`node scripts/release/v22-build-info.mjs` (built 2026-10-24T17:54:19.585Z); `qa:v18` verifies them against the files and
`qa:v19` check F verifies the artifacts are newer than their source (green on 2026-10-25).
