// V9 localization leak check for ANY locale (Latin-script ones too). Successor of scripts/qa/leak-check.mjs.
// Usage: node scripts/qa/leak-check-v9.mjs <loc> [persona-filter] [--widths=390,1440] [--shots=dir] [--no-record]
// For each persona: signs in (dev Demo access), forces the locale (localStorage hg.locale + ?lang=) and visits the core
// student journey (auth, quick check, profile, discovery, program, compare, budget, applications, documents, writing,
// visa, housing, arrival, messages, notifications, errors). Collects visible text in <main> and dialogs and flags:
//   (a) PHRASE leak — the text equals or contains an English source fragment of ≥ 2 words from the student namespaces
//       (en values split at {{placeholders}} and tags; fragments made only of allowed tokens are ignored);
//   (b) WORD leak  — non-Latin-script locales only: any Latin word that is not an allowed token (as leak-check.mjs);
//   (c) ENGLISH-LIKE — text with several English function words (the, and, your, before…) that matches no i18n
//       source, or (Latin-script locales) ≥ 2 words that occur in the English sources but nowhere in this locale's files
//       making up ≥ 50 % of the text: catches server/catalogue English (scholarship rules, embassy document names).
// Allowed / skipped: [data-user-content], [data-source-quote], <details> [lang=en] blocks, catalogue names (universities,
// programs, cities from the API; scholarship names), people/organisation/dormitory names and human-written text from the DB
// (messages, comments, notes, file names, school names, task titles typed by a counselor), emails, URLs.
// A full run (no persona filter) records { date, leaks, widths } as leak_check in packages/i18n/locales/_student_status.json
// and writes docs/qa/v9/l10n/leaks/<loc>.json.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const pos = args.filter((a) => !a.startsWith('--'));
const LANG = pos[0];
if (!LANG || LANG === 'en') { console.error('usage: leak-check-v9.mjs <loc≠en> [filter] [--widths=390,1440]'); process.exit(2); }
const FILTER = pos[1];
const WIDTHS = opt('widths', '390,1440').split(',').map(Number);
const SHOTS = opt('shots', '');
const RECORD = !args.includes('--no-record') && !FILTER;
const S = process.env.STUDENT_URL ?? 'http://localhost:3101';
const API = `${S}/api/v1`;
const PW = 'Hangyul!2026';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const LOC = path.join(ROOT, 'packages/i18n/locales');
const NS = ['common', 'student', 'dossier', 'success', 'writing', 'visaroute', 'concierge'];
const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v6-ids.json'), 'utf8'));

// ---------- English phrase index ----------
const flat = (o, p = '') => Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const normP = (s) => ` ${String(s).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const ALLOW = new Set(`topik ielts toefl ibt d-2 d-4 gks krw usd won hangyul univ hangyul-univ hikorea t-money kakaotalk zalo
  pdf jpg jpeg png heic webp kb mb gpa arc ok id sim esim nhis nrc sop us vfs kvac kiip moj moe hcch apostille travel helpline`.split(/\s+/).filter(Boolean));
// Official venue/office names stay in their published form in every language (like TOPIK or HiKorea).
const BRAND_NAMES = ['Hangyul Partner Scholarship', 'Hangyul Partner', 'Hangyul Univ', 'Korea Visa Application Centre', 'Korea Visa Application Center', 'Korea Travel Helpline'];
const norm = (w) => w.toLowerCase().replace(/[.’'\-]+$/g, '').replace(/^[-.]+/, '');
const okSame = new Set((JSON.parse(fs.existsSync(path.join(ROOT, 'scripts/i18n/v9-data/identical-ok.json')) ? fs.readFileSync(path.join(ROOT, 'scripts/i18n/v9-data/identical-ok.json'), 'utf8') : '{}')[LANG]) ?? []);
const PHRASES = new Map(); // normalized fragment → "ns:key"
for (const ns of NS) {
  const p = path.join(LOC, 'en', `${ns}.json`);
  for (const [k, v] of flat(JSON.parse(fs.readFileSync(p, 'utf8')))) {
    if (okSame.has(`${ns}:${k}`)) continue;
    for (const frag of v.split(/\{\{[^}]*\}\}|<\/?\w+\s*\/?>/)) {
      const words = frag.match(/[A-Za-z][A-Za-z'’]+/g) ?? [];
      const real = words.filter((w) => !ALLOW.has(norm(w)));
      if (words.length < 2 || real.length < 1) continue;
      const n = normP(frag);
      if (n.trim().length < 6 || !/[a-z]/.test(n)) continue;
      if (!PHRASES.has(n)) PHRASES.set(n, `${ns}:${k}`);
    }
  }
}
const STOP = new Set(`the and your you with before this are have from that which when been would should their there about after only must
  please here has our they what how these those does don't can't won't isn't yet`.split(/\s+/).filter(Boolean));
// English-only vocabulary: words of the English sources that never occur in this locale's own files (catches short
// server/catalogue English labels such as "Statement of purpose" that match no i18n source).
const wordsOf = (str) => (String(str).replace(/\{\{[^}]*\}\}/g, ' ').toLowerCase().match(/[a-z][a-z'’]+/g) ?? []);
const EN_VOCAB = new Set();
for (const ns of NS) for (const [, v] of flat(JSON.parse(fs.readFileSync(path.join(LOC, 'en', `${ns}.json`), 'utf8')))) wordsOf(v).forEach((w) => EN_VOCAB.add(w));
const LOC_VOCAB = new Set();
for (const f of fs.readdirSync(path.join(LOC, LANG)).filter((x) => x.endsWith('.json'))) for (const [, v] of flat(JSON.parse(fs.readFileSync(path.join(LOC, LANG, f), 'utf8')))) wordsOf(v).forEach((w) => LOC_VOCAB.add(w));
const PHRASE_LIST = [...PHRASES.keys()].sort((a, b) => b.length - a.length);
// Script of the locale: Latin when most letters of its common.json are Latin.
const sample = flat(JSON.parse(fs.readFileSync(path.join(LOC, LANG, 'common.json'), 'utf8'))).map(([, v]) => v).join(' ');
const letters = sample.match(/\p{L}/gu) ?? [];
const LATIN_LOCALE = letters.filter((c) => /[A-Za-zÀ-ɏḀ-ỿ]/.test(c)).length / Math.max(1, letters.length) > 0.5;

// ---------- allow-lists from catalogue + DB ----------
const HUMAN = []; const HUMAN_EXACT = new Set(); const CATALOGUE = new Set();
const allow = new Set(ALLOW);
const addWords = (s) => { for (const w of String(s ?? '').match(/[A-Za-z][A-Za-z'’.\-]*/g) ?? []) allow.add(norm(w)); };
const addName = (s) => { if (s && String(s).trim().length > 2) { CATALOGUE.add(String(s).trim()); addWords(s); } };
async function loadCatalogue(request) {
  // Catalogue entities keep their published name in every language (universities, programs and scholarship programmes).
  for (const p of ['universities', 'programs', 'scholarships']) {
    for (let page = 1; page < 40; page++) {
      const r = await request.get(`${API}/${p}?page=${page}&page_size=100`);
      if (!r.ok()) break;
      const j = await r.json();
      for (const it of Array.isArray(j) ? j : (j.items ?? [])) { addName(it.name_en); addName(it.city); addName(it.region); addName(it.university_name); addName(it.university?.name_en); addName(it.short_name); addName(it.name); }
      if (Array.isArray(j) || !j.items?.length || (j.total != null && page * 100 >= j.total)) break;
    }
  }
  try {
    const q = (sql) => execSync(`psql -h localhost -U hangyul -d hangyul_univ -Atc "${sql}"`, { env: { ...process.env, PGPASSWORD: 'hangyul_dev' }, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString();
    const human = q("select replace(replace(x, chr(10), ' '), chr(13), ' ') || '<<END>>' from (select rejection_reason x from documents union select note from document_requests union select body from essay_comments union select quote from essay_comments union select suggestion from essay_comments union select note from essay_versions union select body from messages union select note from document_findings union select original_filename from document_versions union select params->>'reason' from notifications union select title from essays union select institution from student_educations union select major from student_educations union select title from tasks where title_key is null and created_by_id is not null union select career_goal from student_profiles) t where x is not null and length(x) > 2");
    human.split('<<END>>').map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length > 2).sort((a, b) => b.length - a.length).forEach((x) => HUMAN.push(x));
    q('select title from documents where title is not null').split('\n').forEach((x) => x.trim() && HUMAN_EXACT.add(x.trim()));
    q("select coalesce(full_name,'') from users union all select coalesce(name,'') from organizations union all select name from dormitories").split('\n').forEach(addName);
    // scholarship names and providers are catalogue proper nouns ("Global Korea Scholarship (GKS)", "NIIED")
    q("select name from scholarships union select coalesce(provider,'') from scholarships").split('\n').forEach(addName);
    q("select name_en from programs union select name_en from universities").split('\n').forEach(addName);
  } catch { /* no psql or a missing table: names are reported, review them manually */ }
}

const L = 'student@demo.hangyul.kr';
// Personas of scripts/qa/leak-check.mjs + the V9 core-journey routes (auth, quick check, discovery, program, compare, budget…).
const PERSONAS = [
  { email: null, tag: 'anon', routes: ['/login', '/register', '/start', '/no-such-page'] },
  { email: L, tag: 'lan', routes: ['/', '/explore', '/explore?tab=all', `/universities/${ids.uniSlug}`, '/saved', '/compare', '/budget', '/applications', 'APP', '/documents', '/documents?upload=PASSPORT', 'DOC', '/essays', 'ESSAY', '/tasks', '/messages', '/notifications', '/visa', '/housing', '/arrival', '/help', '/scholarships', '/services', '/support', '/profile', '/settings', '/more', '/no-such-page'] },
  { email: 'student.new@demo.hangyul.kr', tag: 'new', routes: ['/', '/explore', '/profile', '/budget', '/applications'] },
  { email: 'student.myanmar@demo.hangyul.kr', tag: 'hnin', routes: ['/', '/applications', 'APP', '/documents', 'DOC', '/essays', 'ESSAY', '/tasks', '/notifications', '/visa', '/housing', '/arrival', '/help'] },
  { email: 'student.dossier@demo.hangyul.kr', tag: 'dossier', routes: ['/', '/documents', 'DOC', 'APP'] },
  { email: 'student.offer@demo.hangyul.kr', tag: 'offer', routes: ['/', '/applications', 'APP', '/budget'] },
  { email: 'student.visaroute@demo.hangyul.kr', tag: 'visaroute', routes: ['/', 'APP', '/visa', '/documents', '/housing', '/arrival', '/help'] },
  { email: 'student.visa@demo.hangyul.kr', tag: 'visa', routes: ['/', 'APP', '/visa', '/housing', '/arrival', '/help'] },
  { email: 'student.arrival@demo.hangyul.kr', tag: 'arrival', routes: ['/', '/housing', '/arrival', '/help'] },
  { email: 'student.arrived@demo.hangyul.kr', tag: 'arrived', routes: ['/', '/housing', '/arrival', '/help'] },
  { email: 'student.nepal@demo.hangyul.kr', tag: 'nepal', routes: ['/', '/documents', '/applications', '/visa'] },
];

async function token(request, email) {
  const r = await request.post(`${API}/auth/login`, { data: { email, password: PW, client: 'student' } });
  return r.ok() ? (await r.json()).access_token : null;
}
async function apiGet(request, tok, p) {
  const r = await request.get(`${API}${p}`, { headers: { Authorization: `Bearer ${tok}` } });
  return r.ok() ? r.json() : null;
}

const browser = await chromium.launch({ args: ['--headless=new'] });
const ctx0 = await browser.newContext();
await loadCatalogue(ctx0.request);
const CATALOGUE_LIST = [...CATALOGUE].sort((a, b) => b.length - a.length);
const report = [];
let totalLeaks = 0; let pages = 0;

for (const p of PERSONAS) {
  if (FILTER && !p.tag.includes(FILTER) && !(p.email ?? '').includes(FILTER)) continue;
  let resolve = (r) => r;
  if (p.email) {
    const tok = await token(ctx0.request, p.email);
    if (!tok) { console.log(`\n## ${p.tag} — login failed, skipped`); report.push({ persona: p.tag, skipped: 'login failed' }); continue; }
    const apps = (await apiGet(ctx0.request, tok, '/applications?page_size=50'))?.items ?? [];
    const app = apps.find((a) => ['PREPARING', 'DRAFT', 'IN_PROGRESS', 'DOCUMENTS'].includes(a.status)) ?? apps[0];
    const essays = (await apiGet(ctx0.request, tok, '/essays?page_size=50'))?.items ?? [];
    const dossier = await apiGet(ctx0.request, tok, '/me/dossier');
    const docRow = dossier?.rows?.find((r) => r.document?.id);
    resolve = (r) => (r === 'APP' ? (app ? `/applications/${app.id}` : null) : r === 'ESSAY' ? (essays[0] ? `/essays/${essays[0].id}` : null) : r === 'DOC' ? (docRow ? `/documents?doc=${docRow.document.id}` : null) : r);
  }
  const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* */ } }, LANG);
  const page = await ctx.newPage();
  if (p.email) {
    await page.goto(`${S}/login?lang=${LANG}&demo=${encodeURIComponent(p.email)}`);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 }).catch(() => {});
  }
  console.log(`\n## ${p.tag} (${p.email ?? 'signed out'})`);
  for (const r of p.routes) {
    const route = resolve(r);
    if (!route) { console.log(`  ${r}: no data for this persona`); continue; }
    const leaksByText = new Map();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
      await page.goto(`${S}${route}${route.includes('?') ? '&' : '?'}lang=${LANG}`, { waitUntil: 'networkidle' }).catch(() => {});
      // The locale bundle can resolve after networkidle (first page of a fresh context): wait until <html lang> is the
      // locale under test, so a slow first load is never reported as an English leak.
      await page.waitForFunction((l) => document.documentElement.lang?.split('-')[0] === l.split('-')[0], LANG, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(700);
      await page.evaluate(() => document.querySelectorAll('main details').forEach((d) => { d.open = true; })).catch(() => {});
      await page.waitForTimeout(150);
      pages++;
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${p.tag}${route.replace(/[/?=&]+/g, '_')}-${w}.png`, fullPage: true }); }
      // A late client-side redirect can destroy the context mid-scan: wait and retry once.
      const scan = () => page.evaluate(() => {
        const roots = [...document.querySelectorAll('main, [role=dialog], .hg-drawer, .hg-modal')];
        if (!roots.length) roots.push(document.body);
        const out = []; const seen = new Set();
        for (const root of roots) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const el = n.parentElement;
            if (!el || seen.has(n)) continue; seen.add(n);
            if (el.closest('script,style,noscript,textarea,[contenteditable=true],[data-user-content],[data-source-quote],details [lang=en],details[lang=en],[data-dev-only],.hg-devchip,.hg-demo-access')) continue;
            const cs = getComputedStyle(el); const rect = el.getBoundingClientRect();
            if (el.closest('[hidden],[aria-hidden=true]') || cs.display === 'none' || cs.visibility === 'hidden' || (rect.width === 0 && rect.height === 0)) continue;
            const s = n.textContent.replace(/\s+/g, ' ').trim();
            if (s) out.push({ s, ctx: (el.closest('li,tr,p,h1,h2,h3,h4,label,button,a,section') ?? el).textContent.replace(/\s+/g, ' ').trim().slice(0, 160) });
          }
          for (const el of root.querySelectorAll('input[placeholder],textarea[placeholder],[aria-label]')) {
            if (el.closest('[data-user-content],[data-source-quote],.hg-devchip,.hg-demo-access')) continue;
            const v = el.getAttribute('placeholder') || el.getAttribute('aria-label');
            if (v) out.push({ s: v, ctx: `[attr] ${v}` });
          }
        }
        return out;
      });
      let texts;
      try { texts = await scan(); } catch { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800); texts = await scan().catch(() => []); }
      for (const { s, ctx: c } of texts) {
        if (HUMAN_EXACT.has(s)) continue;
        let clean = s;
        for (const h of HUMAN) if (clean.includes(h)) clean = clean.split(h).join(' ');
        for (const h of CATALOGUE_LIST) if (clean.includes(h)) clean = clean.split(h).join(' ');
        // Hangyul's own programme names are proper nouns that stay in Latin in every language (like TOPIK or HiKorea).
        for (const b of BRAND_NAMES) if (clean.includes(b)) clean = clean.split(b).join(' ');
        clean = clean.replace(/[\w.+-]+@[\w.-]+\.\w+/g, ' ').replace(/https?:\/\/\S+|www\.\S+|\b[\w-]+\.(go|ac|or|co)\.kr\S*|\b[\w-]+\.(com|org|net|kr|mm)\b\S*/gi, ' ');
        const n = normP(clean);
        const phrases = [];
        if (n.trim()) for (const f of PHRASE_LIST) if (n.includes(f)) { phrases.push(PHRASES.get(f)); if (phrases.length >= 3) break; }
        // (c) ENGLISH-LIKE — server/catalogue English that matches no i18n source: ≥ 4 words, ≥ 2 distinct English
        //     function words that do not occur in the other Latin-script locales, making up ≥ 20 % of the words.
        const allWords = clean.match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
        const stop = [...new Set(allWords.map((x) => x.toLowerCase()).filter((x) => STOP.has(x)))];
        if (!phrases.length && allWords.length >= 4 && stop.length >= 2 && allWords.filter((x) => STOP.has(x.toLowerCase())).length / allWords.length >= 0.2) phrases.push(`english-like (${stop.slice(0, 4).join(' ')})`);
        if (!phrases.length && LATIN_LOCALE) {
          const ws = wordsOf(clean).filter((x) => !allow.has(norm(x)));
          const enOnly = ws.filter((x) => EN_VOCAB.has(x) && !LOC_VOCAB.has(x));
          if (enOnly.length >= 2 && enOnly.length / ws.length >= 0.5) phrases.push(`english words (${enOnly.slice(0, 4).join(' ')})`);
        }
        let words = [];
        if (!LATIN_LOCALE) {
          words = (clean.match(/[A-Za-z0-9][A-Za-z0-9'’.\-_]*/g) ?? []).filter((wd) => {
            if (!/[A-Za-z]/.test(wd) || /\d/.test(wd)) return false;
            const k = norm(wd);
            return !!k && !allow.has(k) && !/^[a-z]$/i.test(wd) && !/^(am|pm)$/i.test(k);
          });
        }
        if (phrases.length || words.length) {
          const key = s.slice(0, 200);
          const prev = leaksByText.get(key) ?? { text: key, phrases, words: [...new Set(words)], ctx: c, widths: [] };
          if (!prev.widths.includes(w)) prev.widths.push(w);
          leaksByText.set(key, prev);
        }
      }
    }
    const leaks = [...leaksByText.values()];
    totalLeaks += leaks.length;
    report.push({ persona: p.tag, path: route, leaks });
    console.log(`  ${route}: ${leaks.length ? `${leaks.length} leak(s)` : 'clean'}`);
    for (const l of leaks) console.log(`    - "${l.text}"${l.phrases.length ? `  [en: ${l.phrases.join(', ')}]` : ''}${l.words.length ? `  [${l.words.join(', ')}]` : ''}${l.ctx !== l.text ? `  ← ${l.ctx}` : ''} @${l.widths.join('/')}`);
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${LANG}: ${pages} page views, ${LATIN_LOCALE ? 'Latin-script (phrase check)' : 'non-Latin (phrase + Latin-word check)'} — total leaking text nodes: ${totalLeaks}`);
if (RECORD) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(ROOT, 'docs/qa/v9/l10n/leaks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${LANG}.json`), JSON.stringify({ lang: LANG, at: new Date().toISOString(), widths: WIDTHS, pages, leaks: totalLeaks, report }, null, 1) + '\n');
  const sp = path.join(LOC, '_student_status.json');
  const st = JSON.parse(fs.readFileSync(sp, 'utf8')); // re-read right before writing
  st.locales ??= {};
  (st.locales[LANG] ??= { manifest_pct: 0, leak_check: null, synthetic_review: null }).leak_check = { date, leaks: totalLeaks, widths: WIDTHS, pages };
  fs.writeFileSync(sp, JSON.stringify(st, null, 1) + '\n');
  console.log(`recorded leak_check for ${LANG} in packages/i18n/locales/_student_status.json`);
}
