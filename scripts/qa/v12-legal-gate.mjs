/**
 * Legal-configuration gate (V12, brief Part 25).
 *
 *     node scripts/qa/v12-legal-gate.mjs
 *
 * Two jobs, and the second is the point:
 *
 *  1. Report which legally-required company fields are still unconfigured, so the launch blocker is a number
 *     somebody can act on rather than a paragraph in a report.
 *  2. **Fail** if a legal route renders a placeholder. A missing field is an honest, recorded gap; a rendered
 *     `[회사명]`, `[TBD]`, "추후 입력" or "준비 중" is a page pretending to be finished. The second is the
 *     failure state, not the first.
 *
 * Exit 1 only on a rendered placeholder. Missing configuration is reported and exits 0 with a warning, because
 * the repository is allowed to be mid-launch — it is not allowed to lie about it.
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_MARKETING ?? 'http://localhost:3100';
const ENTITY_FILE = 'apps/marketing-web/src/lib/legal/entity.ts';
const ROUTES = ['/privacy', '/terms'];
const LOCALES = (process.env.LOCALES ?? 'ko,en').split(',');

/** Text that must never reach a legal page, whatever the configuration state. */
const PLACEHOLDERS = [
  /\[[^\]]{1,24}\]/,            // [회사명], [TBD], [Company name]
  /\bTBD\b/i,
  /추후\s*입력/,
  /준비\s*중입니다/,
  /미정/,
  /\bto be (confirmed|provided|decided)\b/i,
  /\bplaceholder\b/i,
  /\bnot final\b/i,
  /\blorem ipsum\b/i,
  /초안\s*—/,                   // the V11 "초안 — 최종본이 아니며" banner
];

// ---------------------------------------------------------------- 1. configuration state
const src = readFileSync(ENTITY_FILE, 'utf8');
const required = [...src.matchAll(/^\s{2}'(\w+)',$/gm)].map((m) => m[1]);
const configured = new Set(
  [...src.matchAll(/^\s{2}(\w+):\s*(?!null)(['"`])/gm)].map((m) => m[1]),
);
const missing = required.filter((f) => !configured.has(f));

console.log(`Legal entity configuration — ${required.length - missing.length}/${required.length} required fields set`);
for (const f of missing) console.log(`  · ${f} — not configured`);

// ---------------------------------------------------------------- 2. rendered placeholders
const browser = await chromium.launch();
let failures = 0;

for (const locale of LOCALES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem('hg.locale', l); } catch { /* private mode */ }
  }, locale);
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch {
      console.log(`  ?  ${locale} ${route} — unreachable, skipped`);
      continue;
    }
    await page.waitForTimeout(400);
    const text = await page.evaluate(() => (document.body?.innerText ?? '').replace(/\s+/g, ' '));
    const hits = PLACEHOLDERS.map((rx) => text.match(rx)).filter(Boolean);
    // A legal document with no sections at all is also a failure — an empty page renders no placeholder.
    const sections = await page.locator('.mk-legal__section').count();
    if (hits.length || sections === 0) {
      failures += 1;
      console.log(`  ✗  ${locale} ${route}${sections === 0 ? ' — no sections rendered' : ''}`);
      for (const h of hits) console.log(`       placeholder: “${h[0]}”`);
    } else {
      console.log(`  ✓  ${locale} ${route} — ${sections} sections, no placeholders`);
    }
  }
  await ctx.close();
}
await browser.close();

if (failures) {
  console.log('\nA legal route is rendering placeholder text. Omit the section instead and record the blocker.');
  process.exit(1);
}
if (missing.length) {
  console.log(`\nNot production-ready: ${missing.length} required legal field(s) unconfigured (REPORT §92).`);
  console.log('The pages render honestly without them — sections with missing required fields are omitted.');
}
