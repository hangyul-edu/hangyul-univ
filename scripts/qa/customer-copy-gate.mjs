#!/usr/bin/env node
/**
 * Customer copy gate (corrective pass 2026-11-28) — Hangyul's research workflow never reaches a customer page.
 *
 * Rule (docs/FRONTEND_CONVENTIONS.md › "Unknown facts on customer pages"): a public or student page shows verified
 * facts, an official page for a topic, or nothing. It never says that Hangyul has not verified something
 * ("아직 확인되지 않음", "Not yet verified", "needs checking", "unverified"…). Unknown stays unknown in the data.
 *
 * Two layers:
 *   1. Source: the customer-facing locale subtrees (marketing and student namespaces; common › uniDetail, uni27, fit.tier) in every
 *      locale contain none of the forbidden phrases. Staff vocabulary (common › freshness, Operations namespaces)
 *      is out of scope by design — provenance is legitimate there.
 *   2. Rendered: real pages of a running Marketing build (text + aria-label/title/alt), every university detail page
 *      by default, in the locales given. Needs `LD_LIBRARY_PATH` for Chromium on the QA machine.
 *
 *   node scripts/qa/customer-copy-gate.mjs                       # source layer only
 *   node scripts/qa/customer-copy-gate.mjs --base http://localhost:4803 --locales ko,en [--limit 40] [--headed]
 *
 * Exit 1 on any finding. Exceptions must be listed in ALLOW with the reason.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const LOC = join(ROOT, 'packages/i18n/locales');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

/** Research-state wording, per language. Case-insensitive; matched on whole phrases, not single words. */
const FORBIDDEN = [
  /아직\s*확인되지\s*않/, /확인되지\s*않음/, /미확인/, /검증\s*필요/, /아직\s*조사/, /한귤이\s*아직\s*확인하지\s*못/,
  /not\s+(yet\s+)?verified/i, /not\s+confirmed\s+yet/i, /\bunverified\b/i, /needs\s+checking/i, /not\s+researched/i,
  /verification\s+pending/i, /hangyul\s+(has\s*n[o']t|hasn['’]t)\s+(verified|confirmed|checked)/i,
  /\b(we|hangyul)\s+(have\s*n[o']t|haven['’]t|has\s*n[o']t|hasn['’]t)\s+(yet\s+)?(verified|checked|confirmed)/i, /not\s+checked\s+yet/i,
  /아직\s*확인하지\s*(못|않)/,
  /未確認/, /まだ確認(され|でき)てい/, /尚未(核实|核實|确认|確認)/, /未核实/, /未經?核實/,
  /chưa\s+(được\s+)?xác\s+minh/i, /не\s+проверен/i, /ещё\s+не\s+провер/i, /henüz\s+doğrulanmad/i,
  /belum\s+(di)?verifikasi/i, /यह?\s*सत्यापित\s+नहीं/,
];

/** Explicit, justified exceptions: [regex on `<locale>/<namespace>:<key>` or on a page path, reason]. */
const ALLOW = [
  [/\/student:settingsV3\.translation\.MACHINE_DRAFT$/, 'tells the reader the interface translation itself is a machine draft — a translation-quality notice, not a research state about a university'],
];
const allowed = (id) => ALLOW.some(([rx]) => rx.test(id));

const SUBTREES = { marketing: [''], student: [''], common: ['uniDetail', 'uni27', 'fit.tier'] };

function* strings(node, path) {
  if (typeof node === 'string') yield [path, node];
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* strings(v, path ? `${path}.${k}` : k);
}

const findings = [];
const hit = (s) => FORBIDDEN.find((rx) => rx.test(s));

// ---- 1. source
let scanned = 0;
for (const loc of readdirSync(LOC).filter((d) => !d.startsWith('_'))) {
  for (const [ns, roots] of Object.entries(SUBTREES)) {
    const f = join(LOC, loc, `${ns}.json`);
    if (!existsSync(f)) continue;
    const o = JSON.parse(readFileSync(f, 'utf8'));
    for (const r of roots) {
      const sub = r ? r.split('.').reduce((a, k) => a?.[k], o) : o;
      for (const [p, s] of strings(sub, r)) {
        scanned++;
        const rx = hit(s);
        if (rx && !allowed(`${loc}/${ns}:${p}`)) findings.push(`source ${loc}/${ns}:${p} — "${s.slice(0, 90)}"`);
      }
    }
  }
}
console.log(`source: ${scanned} customer strings scanned`);

// ---- 2. rendered
const base = arg('base');
if (base) {
  const { chromium } = await import('@playwright/test');
  const locales = arg('locales', 'ko,en').split(',');
  const limit = Number(arg('limit', '0'));
  const data = JSON.parse(readFileSync(join(ROOT, 'apps/marketing-web/public/data/public/institutions.json'), 'utf8'));
  let slugs = data.items.map((i) => i.slug);
  if (limit) slugs = slugs.filter((_, i) => i % Math.ceil(slugs.length / limit) === 0);
  const pages = ['/', '/universities', ...slugs.map((s) => `/universities/${s}`)];
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Third-party widgets are not our copy; block them so the scan reads only Hangyul's page.
  await ctx.route(/channel\.io|cdninstagram|youtube|ytimg|googletagmanager/, (r) => r.abort());
  const page = await ctx.newPage();
  let rendered = 0;
  for (const loc of locales) {
    for (const path of pages) {
      const url = `${base}${path}${path.includes('?') ? '&' : '?'}lang=${loc}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('main h1', { timeout: 30000 });
        await page.waitForTimeout(400);
      } catch (e) { findings.push(`render ${loc} ${path} — did not load (${String(e).split('\n')[0].slice(0, 80)})`); continue; }
      const text = await page.evaluate(() => {
        const parts = [document.body.innerText];
        document.querySelectorAll('[aria-label],[title],img[alt]').forEach((n) => parts.push(n.getAttribute('aria-label') ?? '', n.getAttribute('title') ?? '', n.getAttribute('alt') ?? ''));
        return parts.join('\n');
      });
      rendered++;
      for (const line of text.split('\n')) {
        const rx = hit(line);
        if (rx && !allowed(path)) { findings.push(`render ${loc} ${path} — "${line.trim().slice(0, 100)}"`); break; }
      }
      if (rendered % 100 === 0) console.log(`  rendered ${rendered}…`);
    }
  }
  await browser.close();
  console.log(`rendered: ${rendered} page views (${pages.length} pages × ${locales.join(', ')})`);
}

if (findings.length) {
  console.error(`\n✖ customer copy gate: ${findings.length} finding(s)\n  ${findings.slice(0, 60).join('\n  ')}`);
  process.exit(1);
}
console.log('\n✔ customer copy gate: no research-state wording on customer surfaces');
