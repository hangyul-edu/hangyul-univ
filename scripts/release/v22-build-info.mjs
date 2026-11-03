/**
 * V22 — rewrite `result/student-mobile/metadata/BUILD_INFO.json` and `SHA256SUMS.txt` from the binaries on disk after
 * the V22 Android rebuild, and record the signing state exactly as it is. Nothing is carried over from an older build.
 *
 *   node scripts/release/v22-build-info.mjs --signing QA_SIGNED_NOT_FOR_STORE --signer "CN=…"
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const META = join(ROOT, 'result/student-mobile/metadata/BUILD_INFO.json');
const SUMS = join(ROOT, 'result/student-mobile/metadata/SHA256SUMS.txt');
const OUT = join(ROOT, 'result/student-mobile/android');
const ARG = process.argv.slice(2);
const val = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };

const info = JSON.parse(readFileSync(META, 'utf8'));
const app = JSON.parse(readFileSync(join(ROOT, 'apps/student-mobile/app.json'), 'utf8')).expo;
const pkg = (n) => JSON.parse(readFileSync(join(ROOT, 'node_modules', n, 'package.json'), 'utf8')).version;
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const human = (b) => `${(b / 1048576).toFixed(1)} MB`;

const files = [['hangyul-univ-preview.apk', 'apk'], ['hangyul-univ-production.aab', 'aab']];
const artifacts = [];
const sums = [];
for (const [filename, kind] of files) {
  const p = join(OUT, filename);
  if (!existsSync(p)) { console.error(`missing ${p}`); process.exit(1); }
  const size = statSync(p).size; const digest = sha(p);
  artifacts.push({ kind, filename, path: `result/student-mobile/android/${filename}`, sizeBytes: size, sizeHuman: human(size), sha256: digest, builtAt: statSync(p).mtime.toISOString() });
  sums.push(`${digest}  ${filename}`);
  console.log(`  ${filename}: ${size} bytes (${human(size)}) sha256 ${digest}`);
}
info.artifacts = artifacts;
info.version = app.version; info.versionCode = app.android?.versionCode ?? info.versionCode; info.buildNumber = String(app.ios?.buildNumber ?? info.buildNumber);
info.builtAt = new Date().toISOString();
info.expoSdk = pkg('expo'); info.reactNative = pkg('react-native'); info.expoRouter = pkg('expo-router'); info.node = process.version;
info.apiEnvironment = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8001',
  EXPO_PUBLIC_STUDENT_WEB_URL: process.env.EXPO_PUBLIC_STUDENT_WEB_URL ?? 'http://10.0.2.2:3101',
  EXPO_PUBLIC_MARKETING_URL: process.env.EXPO_PUBLIC_MARKETING_URL ?? 'http://10.0.2.2:3100',
  note: 'Built against the local development origins so the APK is testable on an emulator. No production API origin exists in this repository; the owner supplies it and both artifacts must be rebuilt with it before release.',
};
info.signingStatus = {
  android: val('--signing', info.signingStatus?.android ?? 'UNKNOWN'),
  androidSigner: val('--signer', ''),
  androidNote: val('--note', ''),
};
info.rebuildNote = 'Rebuilt in V22 (native registration, one-role tenancy, team display identity, console redesign); sizes and SHA-256s read from the binaries on disk.';
delete info.easNote; info.easUsed = false; info.easNote = 'EAS cloud build was not used: no EAS login on this host.';
writeFileSync(META, `${JSON.stringify(info, null, 2)}\n`);
writeFileSync(SUMS, `${sums.join('\n')}\n`);
console.log(`\nBUILD_INFO.json and SHA256SUMS.txt rewritten · builtAt ${info.builtAt} · signing ${info.signingStatus.android}`);
