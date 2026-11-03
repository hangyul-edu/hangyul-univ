// V9 student-journey key manifest → packages/i18n/locales/_student_manifest.json
// The set of translation keys reachable from STUDENT surfaces, per namespace. Union of three passes:
//   1. static scan of the student web app and the shared packages it renders (literal keys, `ns:key`, template-literal
//      prefixes → whole subtree, string concatenation prefixes `'a.b.' + x` → subtree, `_one/_other` plural families);
//   2. server-driven codes: string literals / f-strings in server/app that are (prefixes of) keys in the student
//      namespaces (title_key "task.*", f"task.concierge.{type}.{status}", …);
//   3. runtime: every key resolved by i18next while visiting every student route as the main personas (dev-only recorder
//      `installKeyRecorder` in packages/i18n, enabled by localStorage hg.recordKeys = '1'). Cached in
//      scripts/i18n/v9-data/runtime-keys.json; refresh with --runtime (needs the dev stack on :3101 and :8000).
// The native student app (apps/student-mobile + packages/mobile-ui) is scanned the same way; its keys are the `native`
// surface (adds the `mobile` namespace). Staff-only subtrees are excluded only when neither the student static scan nor
// the runtime pass touched them (server code alone does not keep them: the server also serves the consoles).
//
//   node scripts/i18n/v9-manifest.mjs              # static + server + cached runtime
//   node scripts/i18n/v9-manifest.mjs --runtime    # re-record runtime keys first (Playwright, one Chromium)
//   node scripts/i18n/v9-manifest.mjs --explain=student:onboarding.title   # why is a key in the manifest?
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const LOC = join(root, 'packages/i18n/locales');
const RUNTIME = join(here, 'v9-data', 'runtime-keys.json');
const args = process.argv.slice(2);
const explain = (args.find((a) => a.startsWith('--explain=')) ?? '').slice(10);

export const WEB_NS = ['common', 'student', 'dossier', 'success', 'writing', 'visaroute', 'concierge'];
export const NATIVE_NS = [...WEB_NS, 'mobile'];
const ALL_NS = NATIVE_NS;
const WEB_DIRS = ['apps/student-web/src', 'packages/ui/src', 'packages/utils/src', 'packages/auth/src', 'packages/validation/src'];
// Keys looked up with a fully dynamic key from the server (`common:${title_key}`): whole subtrees, documented here.
const DYNAMIC = [
  ['common', 'notify.', 'Notifications.tsx: t(`common:${n.title_key}`) for notify.* title keys'],
  ['common', 'task.', 'localizedTitle(): t(`common:${item.title_key}`) — server task title keys (tasks, home next action)'],
  ['common', 'validation.', 'Register/Messages: t(`common:${zodIssue.message}`) — validation messages'],
];
// Candidate subtrees that the static scan reaches only through a staff-only code path. Excluded when no student file
// matches `proof` (evidence that the student app takes that path).
const VERIFIED_UNUSED = [
  { id: 'success:agencyItem.', proof: /itemTitle\(\s*t\s*,[^;\n]*,\s*['"]agency['"]\s*\)/, note: "lib/success.ts itemTitle(audience='agency') — never called with 'agency' in student code" },
];
const NATIVE_DIRS = ['apps/student-mobile/app', 'apps/student-mobile/src', 'packages/mobile-ui/src'];
// Candidate staff-only subtrees (ns → prefixes). Excluded only when unused by the student app (verified below).
const STAFF_CANDIDATES = {
  success: ['agencyItem.', 'agency.', 'queue.', 'university.'],
  dossier: ['agency.'],
  writing: ['queue.', 'insights.', 'ws.'],
  visaroute: ['staff.', 'today.'],
  concierge: ['staff.', 'staffStatus.', 'vendors.', 'metrics.', 'today.', 'view.'],
  mobile: ['agency.', 'university.', 'devAccess.', 'v3.agency.', 'v3.university.', 'v3.uni.', 'v3.ag.'],
};
const PLURAL = /_(zero|one|two|few|many|other)$/;

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const en = Object.fromEntries(ALL_NS.map((ns) => [ns, new Map(flat(JSON.parse(readFileSync(join(LOC, 'en', `${ns}.json`), 'utf8'))))]));
const enKeys = Object.fromEntries(ALL_NS.map((ns) => [ns, [...en[ns].keys()]]));

// ---------- lexer: string literals of JS/TS (templates: ${…} → \0) and Python (f-string {…} → \0) ----------
function jsLiterals(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1; let s = '';
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; } s += src[j++]; }
      out.push(s); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1; let s = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1; j += 2; const start = j;
          while (j < n && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
          out.push(...jsLiterals(src.slice(start, j - 1))); // literals inside the expression (e.g. ternary keys)
          s += '\0'; continue;
        }
        s += src[j++];
      }
      out.push(s); i = j + 1; continue;
    }
    i++;
  }
  return out;
}
function pyLiterals(src) {
  const out = [];
  for (const m of src.matchAll(/(?<![A-Za-z0-9_])([fFrRbB]{0,2})(['"])((?:(?!\2)[^\\\n]|\\.)*)\2/g)) {
    const isF = /f/i.test(m[1]);
    out.push(isF ? m[3].replace(/\{[^}]*\}/g, '\0') : m[3]);
  }
  return out;
}

// ---------- key resolution ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matchLiteral(lit, nsCandidates, add, why) {
  const s = lit.trim();
  if (!s || s.length > 140 || !/^[A-Za-z0-9_.:\-\0]+$/.test(s) || !/[A-Za-z]/.test(s)) return;
  let nsList = nsCandidates; let key = s;
  const m = s.match(/^([a-zA-Z]+):(.*)$/);
  if (m) { if (!ALL_NS.includes(m[1])) return; nsList = [m[1]]; key = m[2]; }
  else if (s.startsWith('\0:')) { nsList = nsCandidates; key = s.slice(2); }
  if (!key) return;
  if (key.includes('\0')) {
    const prefix = key.slice(0, key.indexOf('\0'));
    if (!/[A-Za-z]{2}/.test(prefix)) { why.skipped.add(lit); return; } // `${x}` or `common:${x}`: resolved by the server/runtime passes
    const re = new RegExp(`^${key.split('\0').map(esc).join('.+')}(?:$|[._])`);
    for (const ns of nsList) for (const k of enKeys[ns]) if (re.test(k)) add(ns, k);
    return;
  }
  if (!key.includes('.') && !m && !why.callArg) return; // bare words ('title', 'status') only count as t('word') arguments
  for (const ns of nsList) {
    const map = en[ns];
    if (map.has(key)) add(ns, key);
    for (const k of enKeys[ns]) {
      if (PLURAL.test(k) && k.replace(PLURAL, '') === key) add(ns, k); // t('x', { count }) → x_one, x_other
      else if (key.includes('.') && k.startsWith(`${key}.`)) add(ns, k); // object node used as a base (returnObjects / `${base}.${x}`)
      else if ((key.endsWith('.') || key.endsWith('_')) && key.length >= 4 && k.startsWith(key)) add(ns, k); // 'a.b.' + x
    }
  }
}

function filesUnder(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const f of readdirSync(abs)) {
    const p = join(abs, f);
    if (f === 'node_modules' || f === 'test' || f === '__tests__') continue;
    if (statSync(p).isDirectory()) out.push(...filesUnder(relative(root, p)));
    else if (/\.(tsx?|mjs|js|py)$/.test(f) && !/\.(test|spec)\.|\.d\.ts$/.test(f)) out.push(p);
  }
  return out;
}

// custom hooks such as `function useCT() { return useLocale(['concierge', …]) }` → their default namespace
const HOOKS = new Map();
for (const f of [...WEB_DIRS, ...NATIVE_DIRS].flatMap(filesUnder)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/function (use\w+)\(\)[^{]*\{[^}]{0,120}?use(?:Locale|Translation)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
    const ns = (m[2].match(/['"]([a-zA-Z]+)['"]/) ?? [])[1];
    if (ns) HOOKS.set(m[1], ns);
  }
}
function defaultNs(src, fallback) {
  // first namespace of each useLocale/useTranslation/custom hook in the file (unprefixed keys resolve there, then in common)
  const out = new Set();
  for (const [hook, ns] of HOOKS) if (new RegExp(`\\b${hook}\\(`).test(src)) out.add(ns);
  for (const m of src.matchAll(/use(?:Locale|Translation)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")?\s*\)/g)) {
    const first = m[1] ? (m[1].match(/['"]([a-zA-Z]+)['"]/) ?? [])[1] : undefined;
    out.add(first ?? fallback);
  }
  if (/\buseT\(\)/.test(src) || /\bTFn\b/.test(src)) out.add(fallback);
  if (!out.size) out.add(fallback);
  out.add('common');
  return [...out].filter((n) => ALL_NS.includes(n));
}

function scanDirs(dirs, fallbackNs, label, keys, why) {
  for (const f of dirs.flatMap(filesUnder)) {
    const src = readFileSync(f, 'utf8');
    const nsc = defaultNs(src, fallbackNs);
    const rel = relative(root, f);
    const add = (ns, k) => { const id = `${ns}:${k}`; if (!keys.has(id)) keys.set(id, `${label} ${rel}`); };
    // t('word') / i18nKey="word" bare arguments
    for (const m of src.matchAll(/\b(?:t|tr\(\s*t\s*,)\s*\(?\s*['"]([A-Za-z0-9_]+)['"]/g)) matchLiteral(m[1], nsc, add, { ...why, callArg: true });
    for (const lit of jsLiterals(src)) matchLiteral(lit, nsc, add, why);
  }
}

// ---------- 1. static ----------
const why = { skipped: new Set() };
const webStatic = new Map();
scanDirs(WEB_DIRS, 'student', 'static', webStatic, why);
const nativeStatic = new Map();
scanDirs(NATIVE_DIRS, 'mobile', 'static-native', nativeStatic, why);

for (const [ns, prefix, note] of DYNAMIC) for (const k of enKeys[ns]) if (k.startsWith(prefix) && !webStatic.has(`${ns}:${k}`)) webStatic.set(`${ns}:${k}`, `dynamic ${note}`);
const studentSrc = [...WEB_DIRS, ...NATIVE_DIRS].flatMap(filesUnder).map((f) => readFileSync(f, 'utf8')).join('\n');
const forceExcluded = VERIFIED_UNUSED.filter((v) => !v.proof.test(studentSrc));

// ---------- 2. server-driven codes ----------
const server = new Map();
for (const f of filesUnder('server/app')) {
  if (!f.endsWith('.py')) continue;
  const rel = relative(root, f);
  const add = (ns, k) => { const id = `${ns}:${k}`; if (!server.has(id)) server.set(id, `server ${rel}`); };
  for (const lit of pyLiterals(readFileSync(f, 'utf8'))) if (lit.includes('.') || lit.includes(':')) matchLiteral(lit, WEB_NS, add, why);
}

// ---------- 3. runtime ----------
if (args.includes('--runtime')) await recordRuntime();
const runtime = new Map();
const runtimeOnly = [];
const runtimeData = existsSync(RUNTIME) ? JSON.parse(readFileSync(RUNTIME, 'utf8')) : null;
for (const id of runtimeData?.keys ?? []) {
  const [ns, ...rest] = id.split(':');
  const k = rest.join(':');
  if (!ALL_NS.includes(ns)) continue;
  if (en[ns].has(k)) runtime.set(id, 'runtime');
  else for (const kk of enKeys[ns]) if (PLURAL.test(kk) && kk.replace(PLURAL, '') === k.replace(PLURAL, '')) runtime.set(`${ns}:${kk}`, 'runtime');
}

for (const id of runtime.keys()) if (!webStatic.has(id) && !nativeStatic.has(id) && !server.has(id)) runtimeOnly.push(id);

// ---------- union + verified staff exclusion ----------
const studentHits = new Set([...webStatic.keys(), ...nativeStatic.keys(), ...runtime.keys()]);
const excluded = {};
const isForced = (id) => forceExcluded.find((v) => id.startsWith(v.id))?.id ?? null;
const isExcluded = (id) => {
  const [ns, ...rest] = id.split(':'); const k = rest.join(':');
  for (const p of STAFF_CANDIDATES[ns] ?? []) if (k.startsWith(p)) return `${ns}:${p}`;
  if (k.split('.').some((seg) => /^staff/i.test(seg))) return `${ns}:*.staff*`;
  return null;
};
// a candidate subtree is "used by the student app" if any of its keys was hit by the student static scan or runtime
const usedSubtrees = new Set([...studentHits].map(isExcluded).filter(Boolean));
function build(sources, nsList) {
  const out = Object.fromEntries(nsList.map((ns) => [ns, new Set()]));
  const kept = {};
  for (const src of sources) for (const [id, origin] of src) {
    const ns = id.split(':')[0];
    if (!nsList.includes(ns)) continue;
    const forced = isForced(id);
    if (forced) { (excluded[forced] ??= new Set()).add(id); continue; }
    const ex = isExcluded(id);
    if (ex && !usedSubtrees.has(ex)) { (excluded[ex] ??= new Set()).add(id); continue; }
    if (ex) kept[ex] = (kept[ex] ?? 0) + 1;
    out[ns].add(id.slice(ns.length + 1));
    if (explain && id === explain) console.log(`explain ${id}: ${origin}`);
  }
  return { keys: Object.fromEntries(Object.entries(out).map(([ns, s]) => [ns, [...s].sort()])), kept };
}
const web = build([webStatic, server, runtime], WEB_NS);
const native = build([nativeStatic, server, runtime], NATIVE_NS);
// native ⊇ union for shared namespaces (the native app uses the same server codes); web keys of shared namespaces count too
for (const ns of WEB_NS) native.keys[ns] = [...new Set([...native.keys[ns], ...web.keys[ns]])].sort();

const count = (ks) => Object.fromEntries(Object.entries(ks).map(([ns, l]) => [ns, l.length]));
const src = (m) => [...m.keys()].length;
const manifest = {
  generated_at: new Date().toISOString(),
  generator: 'scripts/i18n/v9-manifest.mjs',
  method: 'union of static scan (literal keys, ns:key, template/concat prefixes → subtree, plural families), server-driven key literals in server/app, and the dev runtime key recorder over every student route',
  runtime_only_keys: runtimeOnly.sort(),
  sources: { runtime_only: runtimeOnly.length, static_web: src(webStatic), static_native: src(nativeStatic), server: src(server), runtime: runtime.size, runtime_recorded_at: runtimeData?.recorded_at ?? null, runtime_routes: runtimeData?.routes?.length ?? 0 },
  surfaces: { web: WEB_NS, native: NATIVE_NS },
  counts: { web: count(web.keys), native: count(native.keys), en_total: Object.fromEntries(ALL_NS.map((ns) => [ns, en[ns].size])) },
  excluded_staff_subtrees: Object.fromEntries(Object.entries(excluded).map(([k, s]) => [k, s.size])),
  kept_candidate_subtrees: { ...web.kept },
  verified_unused: forceExcluded.map((v) => `${v.id} — ${v.note}`),
  dynamic_subtrees: DYNAMIC.map(([ns, p, n]) => `${ns}:${p} — ${n}`),
  dynamic_unresolved_templates: [...why.skipped].map((s) => s.replace(/\0/g, '${…}')).slice(0, 50),
  web: web.keys,
  native: native.keys,
};
writeFileSync(join(LOC, '_student_manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0);
console.log('ns           web  native  en-total');
for (const ns of NATIVE_NS) console.log(`${ns.padEnd(10)} ${String(manifest.counts.web[ns] ?? '-').padStart(5)}  ${String(manifest.counts.native[ns]).padStart(6)}  ${String(en[ns].size).padStart(8)}`);
console.log(`${'total'.padEnd(10)} ${String(tot(manifest.counts.web)).padStart(5)}  ${String(tot(manifest.counts.native)).padStart(6)}`);
console.log('sources', JSON.stringify(manifest.sources));
console.log('excluded staff subtrees', JSON.stringify(manifest.excluded_staff_subtrees));
console.log('candidate subtrees kept (student uses them)', JSON.stringify(manifest.kept_candidate_subtrees));

// ---------- runtime recorder pass ----------
async function recordRuntime() {
  const { chromium } = await import('@playwright/test');
  const S = process.env.STUDENT_URL ?? 'http://localhost:3101';
  const ids = JSON.parse(readFileSync(join(root, 'scripts/qa/v6-ids.json'), 'utf8'));
  const L = 'student@demo.hangyul.kr';
  // Student routes and personas of scripts/qa/v9-capture.mjs (student app), plus leak-check personas and a few states.
  const ROUTES = [
    ['/login', null], ['/register', null], ['/start', null], ['/no-such-page', null],
    ['/', L], ['/explore', L], ['/explore?tab=all', L], [`/universities/${ids.uniSlug}`, L], ['/saved', L], ['/compare', L], ['/budget', L],
    ['/applications', L], [`/applications/${ids.lanApp}`, L], ['/documents', L], ['/documents?upload=PASSPORT', L], ['/essays', L], ['/tasks', L],
    ['/messages', L], ['/notifications', L], ['/visa', L], ['/scholarships', L], ['/services', L], ['/support', L], ['/profile', L],
    ['/settings', L], ['/more', L], ['/housing', L], ['/arrival', L], ['/help', L], ['/no-such-page', L],
    ['/', 'student.new@demo.hangyul.kr'], ['/explore', 'student.new@demo.hangyul.kr'], ['/profile', 'student.new@demo.hangyul.kr'], ['/budget', 'student.new@demo.hangyul.kr'], ['/applications', 'student.new@demo.hangyul.kr'], ['/documents', 'student.new@demo.hangyul.kr'],
    ['/', 'student.offer@demo.hangyul.kr'], ['/applications', 'student.offer@demo.hangyul.kr'], [`/applications/${ids.offerApp}`, 'student.offer@demo.hangyul.kr'], ['/budget', 'student.offer@demo.hangyul.kr'],
    ['/', 'student.visa@demo.hangyul.kr'], ['/visa', 'student.visa@demo.hangyul.kr'], ['/housing', 'student.visa@demo.hangyul.kr'], ['/applications', 'student.visa@demo.hangyul.kr'], ['/arrival', 'student.visa@demo.hangyul.kr'],
    ['/', 'student.arrived@demo.hangyul.kr'], ['/arrival', 'student.arrived@demo.hangyul.kr'], ['/help', 'student.arrived@demo.hangyul.kr'], ['/housing', 'student.arrived@demo.hangyul.kr'],
    ['/', 'student.arrival@demo.hangyul.kr'], ['/arrival', 'student.arrival@demo.hangyul.kr'], ['/housing', 'student.arrival@demo.hangyul.kr'],
    ['/', 'student.nepal@demo.hangyul.kr'], ['/documents', 'student.nepal@demo.hangyul.kr'], ['/applications', 'student.nepal@demo.hangyul.kr'], ['/visa', 'student.nepal@demo.hangyul.kr'],
    ['/', 'student.myanmar@demo.hangyul.kr'], ['/visa', 'student.myanmar@demo.hangyul.kr'], ['/documents', 'student.myanmar@demo.hangyul.kr'], ['/essays', 'student.myanmar@demo.hangyul.kr'],
    ['/', 'student.dossier@demo.hangyul.kr'], ['/documents', 'student.dossier@demo.hangyul.kr'], ['/applications', 'student.dossier@demo.hangyul.kr'],
    ['/', 'student.visaroute@demo.hangyul.kr'], ['/visa', 'student.visaroute@demo.hangyul.kr'], ['/documents', 'student.visaroute@demo.hangyul.kr'], ['/applications', 'student.visaroute@demo.hangyul.kr'],
  ];
  const keys = new Set(); const missing = new Set(); const visited = [];
  const browser = await chromium.launch({ args: ['--headless=new'] });
  const byAccount = new Map();
  for (const [p, a] of ROUTES) { const k = a ?? '__anon'; if (!byAccount.has(k)) byAccount.set(k, []); byAccount.get(k).push(p); }
  for (const [account, paths] of byAccount) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('hg.recordKeys', '1'); localStorage.setItem('hg.locale', 'en'); } catch { /* */ } });
    const page = await ctx.newPage();
    if (account !== '__anon') {
      await page.goto(`${S}/login?demo=${encodeURIComponent(account)}`);
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 }).catch(() => console.log('login failed', account));
    }
    // also follow in-app links/tabs that live on the same route set: expand <details>, open the first tab of each tablist
    for (const p of paths) {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(S + p, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(600);
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })).catch(() => {});
        const tabs = await page.$$('[role=tab]');
        for (const tab of tabs.slice(0, 8)) { await tab.click().catch(() => {}); await page.waitForTimeout(250); }
        const got = await page.evaluate(() => ({ k: Object.keys(window.__hgKeys ?? {}), m: Object.keys(window.__hgMissingKeys ?? {}) })).catch(() => ({ k: [], m: [] }));
        got.k.forEach((k) => keys.add(k)); got.m.forEach((k) => missing.add(k));
        visited.push(`${account} ${p} @${width}: ${got.k.length}`);
        console.log('runtime', account, p, width, got.k.length);
      }
    }
    await ctx.close();
  }
  await browser.close();
  mkdirSync(dirname(RUNTIME), { recursive: true });
  writeFileSync(RUNTIME, JSON.stringify({ recorded_at: new Date().toISOString(), base: S, routes: visited, keys: [...keys].sort(), missing: [...missing].sort() }, null, 1) + '\n');
  if (!keys.size) console.warn('WARNING: runtime pass recorded 0 keys — is the recorder installed (dev build) and the stack up?');
}
