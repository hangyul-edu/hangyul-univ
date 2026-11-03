# V23 iOS build — blocker

*Checked 2026-10-25 on the V23 host (Linux / WSL2, no macOS, no Xcode).*

## The single missing external action

**An Expo account that owns these projects must authenticate EAS on this host (or provide `EXPO_TOKEN`), and the Apple
Developer account must be connected to it.** Concretely, the owner runs once:

```
! npx eas-cli login            # or: export EXPO_TOKEN=<robot token from expo.dev → Access tokens>
```

and, on the first iOS build, lets EAS create/manage the iOS distribution certificate and provisioning profile with the
Apple Developer Program account (Apple ID + team; EAS prompts for it, or reads `EXPO_APPLE_*` / an App Store Connect
API key).

## Evidence

| check | result |
|---|---|
| `npx eas-cli@latest whoami` | `Not logged in` |
| `EXPO_TOKEN` / `EAS_*` in the environment | not set |
| `~/.expo/state.json` | device id only, no session |
| local Xcode / macOS | not available (Linux host) — a local `xcodebuild archive` is impossible here |
| `extra.eas.projectId` / `owner` in `app.json` (all three apps) | absent — `eas build` creates/links them on the first authenticated run (`eas init`) |

## What is ready, so the build is one command once the above exists

| app | bundle id | `eas.json` iOS profiles | typecheck |
|---|---|---|---|
| `apps/student-mobile` | `kr.hangyul.univ.student` (buildNumber 1, `ITSAppUsesNonExemptEncryption: false`) | `development` (simulator), `preview` (simulator), `production` (store) | clean |
| `apps/agency-mobile` | `kr.hangyul.univ.agency` (buildNumber 1, same) | same | clean |
| `apps/university-mobile` | `kr.hangyul.univ.university` (buildNumber 1, same) | same | clean |

Commands, per app directory, after authentication:

```
npx eas-cli build --platform ios --profile preview       # simulator .app (no Apple account needed for this one)
npx eas-cli build --platform ios --profile production    # store .ipa (needs the Apple Developer account)
```

`production` sets `EXPO_PUBLIC_TEST_LOGIN=false` (test sign-in compiled out); `preview` sets it `true`.
The production profile still needs the owner's **production API origin** in `EXPO_PUBLIC_API_URL` (and
`EXPO_PUBLIC_STUDENT_WEB_URL` for the student app) — the same open item as the Android store build (§284).

## What is NOT claimed

No iOS binary, simulator build or IPA was produced in V23. TypeScript compilation and Expo config validation are
source-level evidence only.
