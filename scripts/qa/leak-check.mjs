// V5 localization QA: finds English (Latin-script) leaks on student-web screens in a non-English locale.
// Usage: node scripts/qa/leak-check.mjs [lang=my] [filter] [--widths=390,1440] [--json=out.json] [--shots=dir]
// Logs in as each persona, forces the locale (localStorage hg.locale + ?lang=), visits the core workflow screens and
// collects the visible text inside <main> and open dialogs. Every Latin-script word that is not an allowed token is
// reported per page. Allowed: catalogue university/program/city names (fetched from the API), exam/visa codes,
// currencies, emails, URLs, the brand, demo person/agency names (from the DB when psql is available) and ALLOW below.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const pos = args.filter((a) => !a.startsWith('--'));
const LANG = pos[0] ?? 'my';
const FILTER = pos[1];
const WIDTHS = opt('widths', '390,1440').split(',').map(Number);
const JSON_OUT = opt('json', '');
const SHOTS = opt('shots', '');
const S = process.env.STUDENT_URL ?? 'http://localhost:3101';
const API = `${S}/api/v1`;
const PW = 'Hangyul!2026';

// Tokens that may stay in Latin script in any locale. Elements marked [data-user-content] (text written by people) or
// [data-source-quote] / a [lang=en] block inside <details> (official or catalogue text quoted in its source language behind
// an "exact wording" disclosure) are skipped.
const ALLOW = new Set(`topik ielts toefl ibt d-2 d-4 gks krw usd won hangyul univ hangyul-univ hikorea t-money
  pdf jpg jpeg png heic webp kb mb`.split(/\s+/).filter(Boolean));
// Text written by people (reviewer notes, comments, essays, messages, document titles, file names): quoted as written.
const HUMAN = [];
const HUMAN_EXACT = new Set(); // document titles: user-named, matched only as a whole text
const allow = new Set(ALLOW);
const addWords = (s) => { for (const w of String(s ?? '').match(/[A-Za-z][A-Za-z'’.\-]*/g) ?? []) allow.add(norm(w)); };
function norm(w) { return w.toLowerCase().replace(/[.’'\-]+$/g, '').replace(/^[-.]+/, ''); }

async function loadCatalogue(request) {
  for (const path of ['universities', 'programs']) {
    for (let page = 1; page < 40; page++) {
      const r = await request.get(`${API}/${path}?page=${page}&page_size=100`);
      if (!r.ok()) break;
      const j = await r.json();
      for (const it of j.items ?? []) { addWords(it.name_en); addWords(it.city); addWords(it.region); addWords(it.university_name); addWords(it.university?.name_en); }
      if (!j.items?.length || (j.total != null && page * 100 >= j.total)) break;
    }
  }
  try {
    const q = (sql) => execSync(`psql -h localhost -U hangyul -d hangyul_univ -Atc "${sql}"`, { env: { ...process.env, PGPASSWORD: 'hangyul_dev' }, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString();
    // one row per value; newlines inside values become spaces (psql -A prints them raw, so split on a sentinel)
    const human = q("select replace(replace(x, chr(10), ' '), chr(13), ' ') || '<<END>>' from (select rejection_reason x from documents union select note from document_requests union select body from essay_comments union select quote from essay_comments union select suggestion from essay_comments union select note from essay_versions union select body from messages union select note from document_findings union select original_filename from document_versions union select params->>'reason' from notifications) t where x is not null and length(x) > 2");
    human.split('<<END>>').map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length > 2).sort((a, b) => b.length - a.length).forEach((x) => HUMAN.push(x));
    q("select title from documents where title is not null").split('\n').forEach((x) => x.trim() && HUMAN_EXACT.add(x.trim()));
    const sql = "select coalesce(full_name,'') from users union all select coalesce(name,'') from organizations union all select name from dormitories";
    const out = execSync(`psql -h localhost -U hangyul -d hangyul_univ -Atc "${sql}"`, { env: { ...process.env, PGPASSWORD: 'hangyul_dev' }, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    out.split('\n').forEach(addWords);
  } catch { /* no psql: person names will be reported, review them manually */ }
}

async function token(request, email) {
  const r = await request.post(`${API}/auth/login`, { data: { email, password: PW, client: 'student' } });
  if (!r.ok()) return null;
  return (await r.json()).access_token;
}
async function apiGet(request, tok, path) {
  const r = await request.get(`${API}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  return r.ok() ? r.json() : null;
}

// persona → routes (functions receive fetched ids)
const PERSONAS = [
  { email: 'student.myanmar@demo.hangyul.kr', tag: 'hnin', routes: ['/', '/applications', 'APP', '/documents', '/documents?upload=PASSPORT', 'DOC', '/essays', 'ESSAY', '/tasks', '/notifications', '/visa', '/housing', '/arrival', '/help'] },
  { email: 'student@demo.hangyul.kr', tag: 'lan', routes: ['/', '/applications', 'APP', '/documents', '/documents?upload=PASSPORT', 'DOC', '/essays', 'ESSAY', '/tasks', '/notifications', '/visa', '/housing', '/arrival', '/help'] },
  { email: 'student.dossier@demo.hangyul.kr', tag: 'dossier', routes: ['/', '/documents', 'DOC', 'APP'] },
  { email: 'student.offer@demo.hangyul.kr', tag: 'offer', routes: ['/', 'APP'] },
  { email: 'student.visaroute@demo.hangyul.kr', tag: 'visaroute', routes: ['/', 'APP', '/visa', '/documents', '/housing', '/arrival', '/help'] },
  { email: 'student.visa@demo.hangyul.kr', tag: 'visa', routes: ['/', 'APP', '/visa', '/housing', '/arrival', '/help'] },
  { email: 'student.arrival@demo.hangyul.kr', tag: 'arrival', routes: ['/', '/housing', '/arrival', '/help'] },
  { email: 'student.arrived@demo.hangyul.kr', tag: 'arrived', routes: ['/', '/housing', '/arrival', '/help'] },
];

const browser = await chromium.launch();
const ctx0 = await browser.newContext();
await loadCatalogue(ctx0.request);
const report = [];
let totalLeaks = 0;

for (const p of PERSONAS) {
  if (FILTER && !p.tag.includes(FILTER) && !p.email.includes(FILTER)) continue;
  const tok = await token(ctx0.request, p.email);
  if (!tok) { console.log(`\n## ${p.tag} (${p.email}) — login failed, skipped`); report.push({ persona: p.tag, skipped: 'login failed' }); continue; }
  const apps = (await apiGet(ctx0.request, tok, '/applications?page_size=50'))?.items ?? [];
  const app = apps.find((a) => ['PREPARING', 'DRAFT', 'IN_PROGRESS', 'DOCUMENTS'].includes(a.status)) ?? apps[0];
  const essays = (await apiGet(ctx0.request, tok, '/essays?page_size=50'))?.items ?? [];
  const dossier = await apiGet(ctx0.request, tok, '/me/dossier');
  const docRow = dossier?.rows?.find((r) => r.document?.id);
  const resolve = (r) => (r === 'APP' ? (app ? `/applications/${app.id}` : null) : r === 'ESSAY' ? (essays[0] ? `/essays/${essays[0].id}` : null) : r === 'DOC' ? (docRow ? `/documents?doc=${docRow.document.id}` : null) : r);

  const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${S}/login?lang=${LANG}`);
  await page.evaluate((l) => localStorage.setItem('hg.locale', l), LANG);
  await page.fill('#email', p.email); await page.fill('#password', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  console.log(`\n## ${p.tag} (${p.email})`);

  for (const r of p.routes) {
    const path = resolve(r);
    if (!path) { console.log(`  ${r}: no data for this persona`); continue; }
    const leaksByText = new Map();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
      const url = `${S}${path}${path.includes('?') ? '&' : '?'}lang=${LANG}`;
      await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(700);
      // open every <details> so collapsed rows are checked too
      await page.evaluate(() => document.querySelectorAll('main details').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(150);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${p.tag}${path.replace(/[/?=&]+/g, '_')}-${w}.png`, fullPage: true }); }
      const texts = await page.evaluate(() => {
        const roots = [...document.querySelectorAll('main, [role=dialog], .hg-drawer, .hg-modal')];
        if (!roots.length) roots.push(document.body);
        const out = [];
        const seen = new Set();
        for (const root of roots) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const el = n.parentElement;
            if (!el || seen.has(n)) continue; seen.add(n);
            if (el.closest('script,style,noscript,textarea,[contenteditable=true],[data-user-content],[data-source-quote],details [lang=en],details[lang=en]')) continue;
            const cs = getComputedStyle(el); const rect = el.getBoundingClientRect();
            const hiddenAncestor = el.closest('[hidden],[aria-hidden=true]');
            if (hiddenAncestor || cs.display === 'none' || cs.visibility === 'hidden' || (rect.width === 0 && rect.height === 0)) continue;
            const s = n.textContent.replace(/\s+/g, ' ').trim();
            if (s) out.push({ s, ctx: (el.closest('li,tr,p,h1,h2,h3,h4,label,button,a,section') ?? el).textContent.replace(/\s+/g, ' ').trim().slice(0, 160) });
          }
          for (const el of root.querySelectorAll('input[placeholder],textarea[placeholder],[aria-label]')) {
            const v = el.getAttribute('placeholder') || el.getAttribute('aria-label');
            if (v) out.push({ s: v, ctx: `[attr] ${v}` });
          }
        }
        return out;
      });
      for (const { s, ctx: c } of texts) {
        if (HUMAN_EXACT.has(s)) continue;
        let clean = s;
        for (const h of HUMAN) if (clean.includes(h)) clean = clean.split(h).join(' ');
        clean = clean.replace(/[\w.+-]+@[\w.-]+\.\w+/g, ' ').replace(/https?:\/\/\S+|www\.\S+|\b[\w-]+\.(go|ac|or|co)\.kr\S*|\b[\w-]+\.(com|org|net|kr|mm)\b\S*/gi, ' ');
        const bad = (clean.match(/[A-Za-z0-9][A-Za-z0-9'’.\-_]*/g) ?? []).filter((wd) => {
          if (!/[A-Za-z]/.test(wd) || /\d/.test(wd)) return false; // numbers and identifiers (v2, D-2-2, DEMO-AB80CD67)
          const k = norm(wd);
          if (!k || allow.has(k)) return false;
          if (/^[a-z]$/i.test(wd)) return false; // single letters (list markers, initials)
          if (/^(am|pm)$/i.test(k)) return false;
          return true;
        });
        if (bad.length) {
          const key = s.slice(0, 200);
          const prev = leaksByText.get(key) ?? { text: key, words: [...new Set(bad)], ctx: c, widths: [] };
          if (!prev.widths.includes(w)) prev.widths.push(w);
          leaksByText.set(key, prev);
        }
      }
    }
    const leaks = [...leaksByText.values()];
    totalLeaks += leaks.length;
    report.push({ persona: p.tag, path, leaks });
    console.log(`  ${path}: ${leaks.length ? `${leaks.length} leak(s)` : 'clean'}`);
    for (const l of leaks) console.log(`    - "${l.text}"  [${l.words.join(', ')}]${l.ctx !== l.text ? `  ← ${l.ctx}` : ''} @${l.widths.join('/')}`);
  }
  await ctx.close();
}
await browser.close();
console.log(`\nTotal leaking text nodes: ${totalLeaks}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ lang: LANG, at: new Date().toISOString(), report }, null, 1));
