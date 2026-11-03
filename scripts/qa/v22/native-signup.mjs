/**
 * V22 §27 — drive the native sign-up on the Android emulator (Expo Go + Metro, API on :8001 through `adb reverse`):
 * launch → sign-up → account → email code → SMS code → agreement → account created → signed in → first-run matching.
 * Codes are read through the development-only peek route (never printed); screenshots go to docs/qa/v22/shots/native.
 *
 *   node scripts/qa/v22/native-signup.mjs
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const ADB = '/root/android-sdk/platform-tools/adb';
const OUT = join(ROOT, 'docs/qa/v22/shots/native');
const API = 'http://127.0.0.1:8001/api/v1';
mkdirSync(OUT, { recursive: true });
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql postgresql://hangyul:hangyul_dev@localhost:5432/hangyul_univ -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const STAGE = (() => { const i = process.argv.indexOf('--stage'); return i >= 0 ? process.argv[i + 1] : 'all'; })();
const STATE_FILE = join(ROOT, 'docs/qa/v22/completion/logs/native-stage.json');
const stageState = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const stageOn = (name) => STAGE === 'all' || STAGE === name;
const results = [];
const record = (step, ok, detail = '') => { results.push({ step, ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`); };
let shotN = typeof stageState.shotN === 'number' && STAGE !== 'auth' && STAGE !== 'all' ? stageState.shotN : 0;
const shot = (name) => { shotN += 1; stageState.shotN = shotN; try { writeFileSync(STATE_FILE, JSON.stringify(stageState)); } catch { /* first stage creates it */ } const p = join(OUT, `${String(shotN).padStart(2, '0')}-${name}.png`); writeFileSync(p, execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })); return p; };

// uiautomator waits up to 10 s for an idle window; a ticking countdown never idles, so a dump on the verify step costs
// ~10 s ("could not get idle state" on stderr) but still succeeds. Keep dumps few and never trust a stale file.
function dump() {
  for (let i = 0; i < 2; i += 1) {
    const xml = rawDump();
    // the React Native element inspector overlay occasionally gets toggled while driving; close it through the dev menu
    if (/Tap something to inspect it/.test(xml)) {
      adb('shell', 'input', 'keyevent', '82');
      for (let k = 0; k < 6; k += 1) { const m = rawDump(); const item = nodes(m).find((x) => /Element Inspector/i.test(x.text) || /Element Inspector/i.test(x.desc)); if (item) { adb('shell', 'input', 'tap', String(Math.round(item.x)), String(Math.round(item.y))); break; } }
      continue;
    }
    if (xml.includes('<node')) return xml;
  }
  return '';
}
function rawDump() {
  for (let i = 0; i < 2; i += 1) {
    try { adb('shell', 'rm', '-f', '/sdcard/ui.xml'); execFileSync(ADB, ['shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 60000 }); } catch { /* idle timeout is reported as an error but the file is written */ }
    const xml = (() => { try { return adb('shell', 'cat', '/sdcard/ui.xml'); } catch { return ''; } })();
    if (xml.includes('<node')) return xml;
  }
  return '';
}
function nodes(xml) {
  return [...xml.matchAll(/<node [^>]*>/g)].map((m) => {
    const a = (k) => (new RegExp(`${k}="([^"]*)"`).exec(m[0]) ?? [])[1] ?? '';
    const b = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(m[0]);
    return { text: a('text'), desc: a('content-desc'), cls: a('class'), focused: a('focused') === 'true', x: b ? (Number(b[1]) + Number(b[3])) / 2 : 0, y: b ? (Number(b[2]) + Number(b[4])) / 2 : 0, h: b ? Number(b[4]) - Number(b[2]) : 0 };
  });
}
async function find(re, { tries = 8, cls } = {}) {
  for (let i = 0; i < tries; i += 1) {
    const n = nodes(dump()).find((x) => (re.test(x.text) || re.test(x.desc)) && (!cls || x.cls.includes(cls)));
    if (n) return n;
    await sleep(1000);
  }
  return null;
}
async function tap(re, opts) { const n = await find(re, opts); if (!n) throw new Error(`not found: ${re}`); adb('shell', 'input', 'tap', String(Math.round(n.x)), String(Math.round(n.y))); await sleep(500); return n; }
async function fillByLabel(re, value) {
  // the TextField's accessibilityLabel lands on the EditText's content-desc; dismiss any keyboard first so the tap
  // cannot land on the keyboard (which would type into the previously focused field), then tap, clear, type
  await hideKeyboard();
  const n = await find(re, { cls: 'EditText' });
  if (!n) throw new Error(`field not found: ${re}`);
  adb('shell', 'input', 'tap', String(Math.round(n.x)), String(Math.round(n.y)));
  await sleep(300);
  adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
  for (let i = 0; i < 40; i += 1) adb('shell', 'input', 'keyevent', 'KEYCODE_DEL');
  adb('shell', 'input', 'text', value.replace(/ /g, '%s'));
  await sleep(300);
}
// BACK with no keyboard open would trigger the flow's own back navigation, so only send it while the IME is shown
const keyboardShown = () => /mInputShown=true/.test(adb('shell', 'dumpsys', 'input_method'));
async function hideKeyboard() { if (keyboardShown()) { adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(500); } }

/* ---------------------------------------------------------------- launch in Expo Go */
console.log(`\nNative sign-up smoke (Expo Go on emulator) — stage ${STAGE}\n`);
if (stageOn('auth')) {
// Launch through Expo Go and wait for the signed-out entry. A force-stop followed immediately by the deep link
// sometimes lands on the launcher instead, so the start is retried; a restored draft (previous run) is backed out.
const ENTRY = /^(Sign in to Hangyul Univ|Create account|회원가입|로그인)$/;
// never read the screen of an installed release build by mistake: only Expo Go's window counts
try { adb('shell', 'am', 'force-stop', 'kr.hangyul.univ.student'); } catch { /* not installed */ }
// a previous walk leaves a signed-in session in Expo Go's secure storage; start from a signed-out app
if (stageOn('auth')) { try { adb('shell', 'pm', 'clear', 'host.exp.exponent'); } catch { /* fresh install */ } }
const focusedIsExpoGo = () => /mCurrentFocus=.*host\.exp\.exponent/.test(adb('shell', 'dumpsys', 'window'));
for (let attempt = 0; attempt < 4 && !(focusedIsExpoGo() && (await find(ENTRY, { tries: 2 }))); attempt += 1) {
  adb('shell', 'am', 'force-stop', 'host.exp.exponent'); await sleep(2000);
  adb('shell', 'am', 'start', '-n', 'host.exp.exponent/.LauncherActivity', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8081');
  for (let i = 0; i < 30; i += 1) {
    await sleep(3000);
    const xml = dump();
    // Expo Go's first-run developer-menu intro (after `pm clear`): dismiss it
    if (/This is the developer menu/.test(xml)) { const c = nodes(xml).find((x) => x.text === 'Continue'); if (c) { adb('shell', 'input', 'tap', String(Math.round(c.x)), String(Math.round(c.y))); await sleep(1500); continue; } }
    if (/text="Wait"/.test(xml)) { const w = nodes(xml).find((x) => x.text === 'Wait'); adb('shell', 'input', 'tap', String(Math.round(w.x)), String(Math.round(w.y))); continue; }
    if (/Create your account|계정 만들기/.test(xml)) { const b = nodes(xml).find((x) => x.desc === 'Back'); if (b) { adb('shell', 'input', 'tap', String(Math.round(b.x)), String(Math.round(b.y))); await sleep(1500); } }
    if (focusedIsExpoGo() && nodes(xml).some((x) => ENTRY.test(x.text))) break;
  }
}
let n = focusedIsExpoGo() ? await find(/Sign in to|Create account|회원가입|로그인/, { tries: 10 }) : null;
record('app launched to the signed-out entry (Expo Go)', !!n, n ? n.text || n.desc : 'no entry screen');
shot('entry');
await tap(/^(Create account|회원가입)$/);
await sleep(1200);
shot('signup-account');
n = await find(/Create your account|계정 만들기/);
record('sign-up opens natively (no browser)', !!n);

/* ---------------------------------------------------------------- account */
stageState.email = `native-${Date.now()}@example.com`;
stageState.phoneLocal = `0912${String(Date.now()).slice(-6)}`;
writeFileSync(STATE_FILE, JSON.stringify(stageState));
}
const { email, phoneLocal } = stageState;
if (stageOn('auth')) {
await fillByLabel(/Full name|이름/, 'Aarati Native');
await fillByLabel(/^Email$|이메일/, email);
await fillByLabel(/Mobile number|휴대폰 번호/, phoneLocal);
await fillByLabel(/^Password$|^비밀번호$/, 'a sentence i remember');
await fillByLabel(/Confirm password|비밀번호 확인/, 'a sentence i remember');
await hideKeyboard();
await sleep(500);
const match = await find(/Passwords match|일치합니다/);
record('password confirmation feedback shown', !!match);
shot('account-filled');
await tap(/^(Continue|계속)$/);
await sleep(2500);
}

/* ---------------------------------------------------------------- verify */
if (stageOn('verify')) {
let verifyScreen = await find(/Verify your contact details|연락처 인증/, { tries: 12 });
record('verification step reached (email + SMS codes requested through the API)', !!verifyScreen);
shot('verify');
const emailCid = sql(`select id from verification_challenges where target='${email}' and purpose='SIGNUP_EMAIL' order by created_at desc limit 1`);
const smsCid = sql(`select id from verification_challenges where purpose='SIGNUP_PHONE' and target like '+84%' and consumed_at is null and invalidated_at is null order by created_at desc limit 1`);
record('server created one email challenge and one SMS challenge', !!emailCid && !!smsCid);
const code = async (cid) => (await (await fetch(`${API}/auth/verification/peek/${cid}`)).json()).code;
const typeInto = async (re, digits) => { const f = await find(re, { cls: 'EditText', tries: 3 }); if (!f) throw new Error(`otp field not found: ${re}`); adb('shell', 'input', 'tap', String(Math.round(f.x)), String(Math.round(f.y))); await sleep(400); adb('shell', 'input', 'text', digits); await sleep(2500); };
// wrong code first: the UI must show the localised invalid-code state (never a raw code)
await typeInto(/Email code|이메일 인증번호/, '000000');
const invalid = await find(/not correct|올바르지 않아요/, { tries: 3 });
record('wrong email code → localised message (attempts left)', !!invalid, invalid ? (invalid.text || invalid.desc).slice(0, 60) : '');
shot('verify-wrong-code');
await typeInto(/Email code|이메일 인증번호/, await code(emailCid));
record('email verified', !!(await find(/^Verified$|인증 완료/, { tries: 3 })));
await typeInto(/Text-message code|문자 인증번호/, await code(smsCid));
let verifiedCount = 0;
for (let i = 0; i < 3 && verifiedCount < 2; i += 1) { verifiedCount = nodes(dump()).filter((x) => /^Verified$|인증 완료/.test(x.text)).length; }
record('phone verified (two verified badges)', verifiedCount >= 2, String(verifiedCount));
await hideKeyboard();
shot('verify-done');
await tap(/^(Continue|계속)$/);
await sleep(1500);
}

/* ------------------------------------------------- verify-sms: recover an expired SMS code with the Resend control */
if (STAGE === 'verify-sms') {
  const before = sql(`select count(*) from verification_challenges where purpose='SIGNUP_PHONE'`);
  // the e-mail card is already verified, so the only "Resend code" left belongs to the text-message card
  await tap(/^(Resend code|인증번호 다시 받기)$/);
  let smsCid2 = '';
  for (let i = 0; i < 10 && !smsCid2; i += 1) { await sleep(1500); if (sql(`select count(*) from verification_challenges where purpose='SIGNUP_PHONE'`) !== before) smsCid2 = sql(`select id from verification_challenges where purpose='SIGNUP_PHONE' order by created_at desc limit 1`); }
  record('resend creates a fresh SMS challenge on the server', !!smsCid2);
  const code2 = async (cid) => (await (await fetch(`${API}/auth/verification/peek/${cid}`)).json()).code;
  const f = await find(/Text-message code|문자 인증번호/, { cls: 'EditText', tries: 3 });
  if (!f) throw new Error('sms otp field not found');
  adb('shell', 'input', 'tap', String(Math.round(f.x)), String(Math.round(f.y))); await sleep(400);
  adb('shell', 'input', 'text', await code2(smsCid2)); await sleep(3000);
  let n2 = 0;
  for (let i = 0; i < 3 && n2 < 2; i += 1) { n2 = nodes(dump()).filter((x) => /^Verified$|인증 완료/.test(x.text)).length; }
  record('phone verified after resend (two verified badges)', n2 >= 2, String(n2));
  await hideKeyboard();
  shot('verify-done');
  await tap(/^(Continue|계속)$/);
  await sleep(1500);
}

/* ---------------------------------------------------------------- consent */
if (stageOn('consent')) {
record('agreement step reached', !!(await find(/How we handle your information|개인정보 처리 안내/)));
shot('consent');
// required/optional distinguishable; submit without consent is refused
await tap(/^(Create account|계정 만들기)$/);
await sleep(1500);
record('submitting without required consent is refused with a localised message', !!(await find(/agree to the required|필수 항목에 동의/)));
await tap(/^(Read|보기)$/);
let legalLoaded = null;
// the first open of a marketing page on a cold Vite dev server can take ~20 s; the app shows its own retry state on failure
for (let i = 0; i < 14 && !legalLoaded; i += 1) { await sleep(2500); const xml = dump(); if (/Webpage not available|ERR_SOCKET/.test(xml)) break; legalLoaded = nodes(xml).find((x) => /terms of service|이용약관/i.test(x.text)) ?? null; }
shot('legal-sheet');
record('legal document opens in-app as the canonical web page (embed mode, real content)', !!legalLoaded, legalLoaded ? legalLoaded.text.slice(0, 40) : 'page did not load');
// the sheet's footer Close button (the full-screen backdrop is also labelled Close; skip it by requiring a Button node)
{ const btn = nodes(dump()).find((x) => /^(Close|닫기)$/.test(x.text) && x.cls.includes('Button') && x.h < 400); if (btn) adb('shell', 'input', 'tap', String(Math.round(btn.x)), String(Math.round(btn.y))); else adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1200); }
record('legal sheet closes with its Close button', !(await find(/^Document$|^문서$/, { tries: 1 })));
await tap(/Agree to all|전체 동의/);
await sleep(300);
// untick the optional one: required must remain enough
await tap(/news and event|소식과 이벤트/).catch(() => null);
await sleep(300);
shot('consent-ticked');
await tap(/^(Create account|계정 만들기)$/);
await sleep(4000);
}

/* ---------------------------------------------------------------- done → signed in → onboarding */
if (stageOn('post')) {
const done = await find(/Welcome|환영합니다/, { tries: 20 });
record('account created and welcome shown', !!done);
shot('done');
const row = sql(`select phone||' '||(email_verified_at is not null)||' '||(phone_verified_at is not null)||' '||(select count(*) from consent_records c where c.user_id=u.id and c.source='SIGNUP') from users u where email='${email}'`);
record('database: E.164 phone, both verified, 4 consent rows', /^\+84\d+ true true 4$/.test(row), row);
const marketing = sql(`select granted from consent_records where purpose='MARKETING' and user_id=(select id from users where email='${email}')`);
record('optional marketing consent stored as declined', marketing === 'f', marketing);
await tap(/Bachelor|학사/).catch(() => null);
await tap(/Show my matches|내 추천 보기/);
await sleep(5000);
shot('after-signup');
const explore = await find(/Universities|For you|추천|대학/, { tries: 15 });
record('signed in and landed on the matching screen', !!explore, explore ? (explore.text || explore.desc).slice(0, 40) : '');
const prof = sql(`select nationality||' '||coalesce(target_degree,'') from student_profiles where user_id=(select id from users where email='${email}')`);
record('quick profile carried into the account', /^VN BACHELOR$/.test(prof), prof);

}

const ok = results.filter((r) => r.ok).length;
console.log(`\nNative sign-up smoke — ${ok}/${results.length} steps passed\n`);
const prior = STAGE !== 'all' && STAGE !== 'auth' && existsSync(join(OUT, 'RESULT.json')) ? JSON.parse(readFileSync(join(OUT, 'RESULT.json'), 'utf8')).results ?? [] : [];
writeFileSync(join(OUT, 'RESULT.json'), JSON.stringify({ email, results: [...prior, ...results], at: new Date().toISOString(), stage: STAGE }, null, 2));
process.exit(ok === results.length ? 0 : 1);
