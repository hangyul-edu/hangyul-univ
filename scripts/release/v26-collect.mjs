// V26 (fork of v25-collect.mjs, artifact names carry v26) — copy one app's freshly built APK or AAB into result/<app>-mobile/android/, verify the signature, record
// SHA-256 and write BUILD_INFO.json + SHA256SUMS.txt. Run right after the matching build stage (the production build
// reuses the same android/ tree, so the APK must be collected before it).
//   node scripts/release/v23-collect.mjs <student|agency|university> <apk|aab>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [app, kind] = process.argv.slice(2);
const dir = path.join(ROOT, 'apps', `${app}-mobile`);
const out = path.join(ROOT, 'result', `${app}-mobile`, 'android');
fs.mkdirSync(out, { recursive: true });
const BT = '/root/android-sdk/build-tools/' + fs.readdirSync('/root/android-sdk/build-tools').sort().pop();
const appJson = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8')).expo;
const src = kind === 'apk' ? path.join(dir, 'android/app/build/outputs/apk/release/app-release.apk') : path.join(dir, 'android/app/build/outputs/bundle/release/app-release.aab');
const name = kind === 'apk' ? `hangyul-${app}-v26-preview.apk` : `hangyul-${app}-v26-production.aab`;
const dst = path.join(out, name);
const st = fs.statSync(src);
if (Date.now() - st.mtimeMs > 6 * 3600_000) throw new Error(`${src} is older than 6 h — not collecting a stale artifact`);
fs.copyFileSync(src, dst);
const sha = createHash('sha256').update(fs.readFileSync(dst)).digest('hex');
let signature;
if (kind === 'apk') signature = execFileSync(path.join(BT, 'apksigner'), ['verify', '--print-certs', dst], { encoding: 'utf8' }).split('\n').filter((l) => /Signer #1 certificate DN|SHA-256/.test(l)).join(' | ');
else signature = execFileSync('jarsigner', ['-verify', '-certs', dst], { encoding: 'utf8' }).split('\n').filter((l) => /jar verified|CN=/.test(l)).slice(0, 2).map((l) => l.trim()).join(' | ');
const infoP = path.join(out, 'BUILD_INFO.json');
const info = fs.existsSync(infoP) ? JSON.parse(fs.readFileSync(infoP, 'utf8')) : {};
const pkgs = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', p, 'package.json'), 'utf8')).version;
Object.assign(info, {
  product: `Hangyul Univ — ${app} (native)`, applicationId: appJson.android.package, version: appJson.version, versionCode: appJson.android.versionCode,
  expoSdk: pkgs('expo'), reactNative: pkgs('react-native'), node: process.version, pass: 'V26',
  buildMethod: 'local Gradle (expo prebuild → ./gradlew, no daemon, 1 worker, 2 CPUs), Linux x86_64, Android SDK 36; EAS not used (not authenticated on this host)',
  abis: ['arm64-v8a', 'x86_64'],
  signing: 'QA_SIGNED_NOT_FOR_STORE — V22 QA keystore (CN=Hangyul Univ QA). The Hangyul Univ upload keystore is not on this host; re-sign or rebuild with it before any store upload.',
  apiOrigin: process.env.HG_ANDROID_API_URL ?? 'http://10.0.2.2:8001 (local development API as seen from the Android emulator; production origin is an owner input)',
});
info.artifacts = (info.artifacts ?? []).filter((a) => a.kind !== kind);
info.artifacts.push({
  kind, file: `result/${app}-mobile/android/${name}`, bytes: st.size, sha256: sha, builtAt: st.mtime.toISOString(), signature,
  ...(kind === 'apk' ? { profile: 'preview (QA)', EXPO_PUBLIC_TEST_LOGIN: 'true', qa_cleartext: true, note: 'Non-production QA build: shows 테스트 계정으로 로그인 and may use http:// to reach a local API.' }
    : { profile: 'production', EXPO_PUBLIC_TEST_LOGIN: 'false', qa_cleartext: false, note: 'Store-shaped: no test sign-in compiled in, cleartext refused. Needs the owner\'s production API origin and upload key before release.' }),
});
fs.writeFileSync(infoP, JSON.stringify(info, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), info.artifacts.map((a) => `${a.sha256}  ${path.basename(a.file)}`).join('\n') + '\n');
console.log(`${name} ${(st.size / 1e6).toFixed(1)} MB sha256 ${sha}\n  ${signature}`);
