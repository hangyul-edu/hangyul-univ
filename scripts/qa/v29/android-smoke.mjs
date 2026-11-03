// V29 (fork of v27/android-smoke.mjs) — emulator smoke for the three V29 preview APKs (REPORT §377).
// install → launch → login screen shows the test-account sign-in → tap it → the app's first signed-in screen →
// no FATAL EXCEPTION in the crash buffer. Screenshots: docs/qa/v29/shots/android/<app>-{login,home}.png.
//   node scripts/qa/v29/android-smoke.mjs [student,agency,university]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const ADB = '/root/android-sdk/platform-tools/adb';
const OUT = path.join(ROOT, 'docs/qa/v29/shots/android');
fs.mkdirSync(OUT, { recursive: true });
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APPS = {
  student: { pkg: 'kr.hangyul.univ.student', apk: 'result/student-mobile/android/hangyul-student-v29-preview.apk', home: /Home|홈|Universities|대학|Applications/ },
  agency: { pkg: 'kr.hangyul.univ.agency', apk: 'result/agency-mobile/android/hangyul-agency-v29-preview.apk', home: /Today|오늘|Students|학생/ },
  university: { pkg: 'kr.hangyul.univ.university', apk: 'result/university-mobile/android/hangyul-university-v29-preview.apk', home: /Applicants|지원자|Messages|메시지/ },
};
// `uiautomator dump` leaves the previous file in place when it cannot get an idle screen, and a stale dump reads as the
// current screen. Remove it first; a failed dump is an empty screen, never yesterday's.
const dump = () => {
  try { adb('shell', 'rm', '-f', '/sdcard/ui.xml'); } catch { /* fine */ }
  try { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); } catch { return ''; }
  try { return adb('shell', 'cat', '/sdcard/ui.xml'); } catch { return ''; }
};
const texts = (xml) => [...xml.matchAll(/(?:text|content-desc)="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
const shot = (name) => { const buf = execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }); fs.writeFileSync(path.join(OUT, name), buf); };
const results = {};
for (const name of (process.argv[2] ?? 'student,agency,university').split(',')) {
  const a = APPS[name]; const r = (results[name] = { checks: [] });
  const ok = (label, cond, ev = '') => { r.checks.push({ label, pass: !!cond, ev }); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name} · ${label}${ev ? ` — ${ev}` : ''}`); };
  for (const o of Object.values(APPS)) { try { adb('uninstall', o.pkg); } catch { /* not installed */ } }  // a clean device per app
  adb('install', '-r', path.join(ROOT, a.apk));
  // Close the other apps first, or a previous app left in the foreground is mistaken for this one.
  for (const o of Object.values(APPS)) { try { adb('shell', 'am', 'force-stop', o.pkg); } catch { /* not installed */ } }
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  adb('logcat', '-c');
  // V26: the check must be made on *this* app's window. A previous run left another Hangyul app in the recents and its login
  // screen (same button label) was mistaken for this one's. Launch, then wait until the focused window belongs to a.pkg.
  const focused = () => { try { return (adb('shell', 'dumpsys', 'window') .match(/mCurrentFocus=.*?\s([a-z0-9_.]+)\//) || [])[1] || ''; } catch { return ''; } };
  let fg = '';
  for (let k = 0; k < 6 && fg !== a.pkg; k += 1) { adb('shell', 'monkey', '-p', a.pkg, '-c', 'android.intent.category.LAUNCHER', '1'); await sleep(6000); fg = focused(); }
  ok('the launched window belongs to this app', fg === a.pkg, fg || '(no focused window)');
  let xml = ''; let t = [];
  // A cold 1-GB emulator throws system ANR dialogs ("Digital Wellbeing isn't responding · Close app · Wait") over whatever is
  // in front; they are the host's, not the app's. Press "Wait" and keep looking — the check below still has to find the button.
  const dismissAnr = (x) => { const m = x.match(/isn't responding[\s\S]*?<node[^>]*text="(?:Wait|대기)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/); if (m) { const [x1, y1, x2, y2] = m.slice(1).map(Number); adb('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2))); console.log(`  note  ${name} · dismissed a system ANR dialog`); return true; } return false; };
  for (let i = 0; i < 14; i += 1) { await sleep(5000); xml = dump(); if (dismissAnr(xml)) { await sleep(3000); xml = dump(); } t = texts(xml); if (t.some((x) => /test account|테스트 계정/.test(x))) break; }
  shot(`${name}-login.png`);
  const btn = xml.match(/<node[^>]*(?:text|content-desc)="(?:Sign in with test account|테스트 계정으로 로그인)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  ok('login screen shows the test-account sign-in', !!btn, t.slice(0, 6).join(' | '));
  ok('no password shown', !t.some((x) => /Hangyul!2026/.test(x)));
  if (btn) {
    const [x1, y1, x2, y2] = btn.slice(1).map(Number);
    adb('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
    let home = false;
    for (let i = 0; i < 24 && !home; i += 1) { await sleep(5000); const x = dump(); if (dismissAnr(x)) { await sleep(3000); } t = texts(x); // Language-neutral: the account's own language decides the copy (the agency demo account is Vietnamese).
      home = !t.some((x) => /test account|테스트 계정|Sign in to|로그인/.test(x)) && (t.some((x) => a.home.test(x)) || t.length >= 6); }
    shot(`${name}-home.png`);
    ok('signs in and reaches the first signed-in screen', home, t.slice(0, 8).join(' | '));
  }
  const crash = adb('logcat', '-d', '-b', 'crash');
  const fatal = (crash.match(/FATAL EXCEPTION/g) ?? []).length + (adb('logcat', '-d').match(/FATAL EXCEPTION/g) ?? []).length;
  ok('no FATAL EXCEPTION in logcat', fatal === 0, `${fatal}`);
}
fs.writeFileSync(path.join(OUT, 'RESULT.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const failed = Object.values(results).flatMap((r) => r.checks).filter((c) => !c.pass).length;
console.log(`android smoke — ${Object.values(results).flatMap((r) => r.checks).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
