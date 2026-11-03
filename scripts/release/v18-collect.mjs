/**
 * V18 release handoff — collect the built binaries into `result/` with everything a stranger needs to
 * identify them.
 *
 * Rules this script enforces, from the brief:
 *   - a file is only copied if it actually exists and is a real binary; nothing is placeholdered;
 *   - every artifact gets a SHA-256, written beside it;
 *   - BUILD_INFO.json records how the thing was built, and is scanned for secrets before it is written;
 *   - signing status is reported as what it is (a locally generated key is not a Play upload key).
 *
 *   node scripts/release/v18-collect.mjs
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const APP = join(ROOT, 'apps/student-mobile');
const OUT = join(ROOT, 'result/student-mobile');
const OUT_ANDROID = join(OUT, 'android');
const OUT_META = join(OUT, 'metadata');
for (const d of [OUT_ANDROID, OUT_META, join(ROOT, 'result/qa'), join(ROOT, 'result/screenshots')]) mkdirSync(d, { recursive: true });

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo;
const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
const ver = (name) => {
  try { return JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version; } catch { return null; }
};

/** git commit, or an honest null — this workspace is not a git repository. */
function gitCommit() {
  try {
    return execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** What actually signed this APK, read back out of the artifact rather than assumed. */
function signerOf(apkPath) {
  const buildTools = join(ROOT, '../android-sdk/build-tools/36.0.0');
  try {
    const out = execFileSync(join(buildTools, 'apksigner'), ['verify', '--print-certs', apkPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const dn = out.match(/Signer #1 certificate DN:\s*(.+)/)?.[1]?.trim() ?? null;
    const sha = out.match(/Signer #1 certificate SHA-256 digest:\s*(\w+)/)?.[1] ?? null;
    return { verified: true, certificateDn: dn, certificateSha256: sha };
  } catch {
    return { verified: false, certificateDn: null, certificateSha256: null };
  }
}

const SOURCES = [
  { from: join(APP, 'android/app/build/outputs/apk/release/app-release.apk'), to: 'hangyul-univ-preview.apk', kind: 'apk', profile: 'preview / android-apk (gradle :app:assembleRelease)' },
  { from: join(APP, 'android/app/build/outputs/bundle/release/app-release.aab'), to: 'hangyul-univ-production.aab', kind: 'aab', profile: 'production (gradle :app:bundleRelease)' },
];

const artifacts = [];
for (const s of SOURCES) {
  if (!existsSync(s.from)) { console.error(`! missing: ${s.from} — not copied, not placeholdered`); continue; }
  const size = statSync(s.from).size;
  if (size < 1024 * 1024) { console.error(`! ${s.to} is only ${size} bytes — refusing to publish it as a build`); continue; }
  const dest = join(OUT_ANDROID, s.to);
  copyFileSync(s.from, dest);
  artifacts.push({
    filename: s.to,
    kind: s.kind,
    buildProfile: s.profile,
    sizeBytes: size,
    sizeHuman: `${(size / 1024 / 1024).toFixed(1)} MB`,
    sha256: sha256(dest),
    ...(s.kind === 'apk' ? { signing: signerOf(dest) } : {}),
  });
  console.log(`  ${s.to}  ${(size / 1024 / 1024).toFixed(1)} MB`);
}

const info = {
  product: 'Hangyul Univ — Student (native)',
  bundleId: { ios: appJson.ios?.bundleIdentifier, android: appJson.android?.package },
  version: appJson.version,
  versionCode: appJson.android?.versionCode,
  buildNumber: appJson.ios?.buildNumber,
  gitCommit: gitCommit(),
  gitCommitNote: gitCommit() ? undefined : 'This workspace is not a git repository; there is no commit to record.',
  builtAt: new Date().toISOString(),
  expoSdk: ver('expo'),
  reactNative: ver('react-native'),
  expoRouter: ver('expo-router'),
  node: process.version,
  buildMethod: 'local gradle (expo prebuild → ./gradlew), on Linux x86_64 with Android SDK 36 / NDK 27.1.12297006',
  easUsed: false,
  easNote: 'EAS cloud build was not used: `eas whoami` reported "Not logged in".',
  apiEnvironment: {
    EXPO_PUBLIC_API_URL: 'http://10.0.2.2:8001',
    EXPO_PUBLIC_STUDENT_WEB_URL: 'http://10.0.2.2:3101',
    note: 'Built against the local development API so the APK is testable on an emulator. There is no production API origin defined in this repository; the owner supplies it and both Android artifacts must be rebuilt with it before release. See docs/mobile/STORE_READINESS.md.',
  },
  signingStatus: {
    android: 'RELEASE_SIGNED_WITH_LOCAL_KEYSTORE',
    androidNote: 'Signed with a keystore generated on this machine (CN=Hangyul Univ). This is NOT a Google Play upload key and NOT Play App Signing. Before the first Play submission the owner must either register this key or let EAS/Play generate the upload key; the AAB must then be rebuilt and re-signed.',
    ios: 'SIGNED_IPA_BLOCKED_BY_APPLE_CREDENTIALS',
    iosNote: 'No iOS artifact of any kind was produced. This host is Linux (no macOS/Xcode) and EAS is not logged in, so even the Apple-membership-free simulator build was unavailable: IOS_SIMULATOR_BLOCKED_BY_EAS_LOGIN.',
  },
  artifacts,
  dependencies: { 'react-native': ver('react-native'), expo: ver('expo'), '@tanstack/react-query': ver('@tanstack/react-query') },
};

// Never ship a secret in the handoff metadata.
const blob = JSON.stringify(info);
const leaks = [/test_sk_[A-Za-z0-9]+/, /live_sk_[A-Za-z0-9]+/, /-----BEGIN/, /hangyulrelease/, /postgres(ql)?:\/\//, /Hangyul!2026/];
const hit = leaks.find((re) => re.test(blob));
if (hit) { console.error(`! BUILD_INFO would contain a secret matching ${hit} — aborting`); process.exit(1); }

writeFileSync(join(OUT_META, 'BUILD_INFO.json'), JSON.stringify(info, null, 2) + '\n');
writeFileSync(join(OUT_META, 'SHA256SUMS.txt'), artifacts.map((a) => `${a.sha256}  ${a.filename}`).join('\n') + '\n');
console.log(`\nBUILD_INFO.json + SHA256SUMS.txt written for ${artifacts.length} artifact(s)`);
if (!artifacts.length) process.exit(1);
