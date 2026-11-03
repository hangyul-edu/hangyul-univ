/**
 * V31 homepage pricing-tail gate (brief Part 72) — `node scripts/qa/v31/pricing.mjs` (BASE = marketing, default :3100).
 *
 * At 1440 / 1024 / 768 / 390 (ko, en, vi, ar):
 *   one composition  the add-ons and the notes disclosure are inside ONE `.kn-pricing__more` panel whose width equals the
 *                    plans' row (±48 px); no element of the panel is an isolated right column (the notes span the panel)
 *   rows align       every add-on row in a column has the same left edge; price right-aligned within its row (±2 px);
 *                    name ≥ unit in font size and weight; price is not lighter than the unit
 *   two columns      ≥ 900 px: rows sit in two columns; < 900 px: one column
 *   disclosure       the notes summary has a title + a summary line; opening it shows 4 labelled groups and changes no
 *                    width; at ≥ 900 px the groups are two columns, below one; nothing overflows
 *   blank region     no vertical gap > 160 px between the compare control and the panel, or inside the panel
 *   sticky header    after navigating to #plan-notes the summary is fully below the floating header
 * Exit 1 on any failure; screenshots in docs/qa/v31/pricing/.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const OUT = 'docs/qa/v31/pricing';
fs.mkdirSync(OUT, { recursive: true });
const failures = []; const notes = [];
const fail = (m) => { failures.push(m); console.log('  FAIL', m); };
const b = await chromium.launch();
for (const loc of (process.env.LOCALES ?? 'ko,en,vi,ar').split(',')) for (const w of [1440, 1024, 768, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=${loc}`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 50)); } });
  await p.locator('.kn-pricing__more').scrollIntoViewIfNeeded();
  const at = `[${loc}@${w}]`;
  const m = () => p.evaluate(() => {
    const R = (e) => e?.getBoundingClientRect();
    const panel = document.querySelector('.kn-pricing__more'); const plans = document.querySelector('.kn-plans');
    const rows = [...document.querySelectorAll('.kn-addons__row')].map((r) => {
      const n = r.querySelector('.kn-addons__name'), u = r.querySelector('.kn-addons__unit'), pr = r.querySelector('.kn-addons__price');
      const cs = (e) => getComputedStyle(e);
      const rtl = getComputedStyle(r).direction === 'rtl';
      // inline-end edge: right in LTR, left in RTL
      return { l: Math.round(rtl ? R(r).right : R(r).left), r: Math.round(rtl ? R(r).left : R(r).right), top: Math.round(R(r).top), priceRight: Math.round(rtl ? R(pr).left : R(pr).right),
        nameSize: parseFloat(cs(n).fontSize), unitSize: parseFloat(cs(u).fontSize), nameW: +cs(n).fontWeight, unitW: +cs(u).fontWeight, priceW: +cs(pr).fontWeight };
    });
    const notes = document.querySelector('#plan-notes');
    const compare = document.querySelector('.kn-compare-wrap');
    return { docW: document.documentElement.scrollWidth, panel: R(panel) && { l: R(panel).left, r: R(panel).right, w: R(panel).width, top: R(panel).top, h: R(panel).height },
      plans: R(plans) && { l: R(plans).left, r: R(plans).right, w: R(plans).width }, rows,
      notes: { w: R(notes).width, l: R(notes).left, inPanel: panel.contains(notes), title: !!notes.querySelector('.kn-notes__title')?.innerText.trim(),
        summary: !!notes.querySelector('.kn-notes__summary')?.innerText.trim(), open: notes.open,
        groups: [...notes.querySelectorAll('.kn-notes__group')].map((g) => ({ l: Math.round(R(g).left), t: Math.round(R(g).top), titled: !!g.querySelector('.kn-notes__gtitle')?.innerText.trim() })) },
      gapAbove: R(panel).top - R(compare).bottom };
  });
  const g = await m();
  if (g.docW > w) fail(`${at} overflow ${g.docW}`);
  if (!g.notes.inPanel) fail(`${at} notes disclosure is outside the add-ons panel`);
  if (Math.abs(g.notes.w - (g.panel.w - (g.notes.l - g.panel.l) * 2)) > 4) fail(`${at} notes do not span the panel (${Math.round(g.notes.w)} of ${Math.round(g.panel.w)})`);
  if (w >= 1024 && Math.abs(g.panel.w - g.plans.w) > 96) fail(`${at} panel ${Math.round(g.panel.w)} vs plans ${Math.round(g.plans.w)}`);
  if (g.gapAbove > 160) fail(`${at} ${Math.round(g.gapAbove)} px blank above the panel`);
  if (!g.notes.title || !g.notes.summary) fail(`${at} notes summary lacks a title or summary line`);
  const lefts = [...new Set(g.rows.map((r) => r.l))];
  if (w >= 900 && lefts.length !== 2) fail(`${at} add-on rows in ${lefts.length} columns (want 2)`);
  if (w < 900 && lefts.length !== 1) fail(`${at} add-on rows in ${lefts.length} columns (want 1)`);
  for (const r of g.rows) {
    if (Math.abs(r.priceRight - r.r) > 2) fail(`${at} price not at the inline end of its row (${r.priceRight} vs ${r.r})`);
    if (r.nameSize < r.unitSize || r.nameW < r.unitW || r.priceW < r.unitW) fail(`${at} row hierarchy: name ${r.nameSize}/${r.nameW}, unit ${r.unitSize}/${r.unitW}, price w ${r.priceW}`);
  }
  // open the disclosure
  await p.locator('#plan-notes summary').click(); await p.waitForTimeout(300);
  const o = await m();
  if (!o.notes.open) fail(`${at} notes did not open`);
  if (o.notes.groups.length !== 4 || o.notes.groups.some((x) => !x.titled)) fail(`${at} ${o.notes.groups.length} note groups, titled ${o.notes.groups.filter((x) => x.titled).length}`);
  const gl = [...new Set(o.notes.groups.map((x) => x.l))];
  if (w >= 900 && gl.length !== 2) fail(`${at} note groups in ${gl.length} columns (want 2)`);
  if (w < 900 && gl.length !== 1) fail(`${at} note groups in ${gl.length} columns (want 1)`);
  if (Math.abs(o.panel.w - g.panel.w) > 1) fail(`${at} opening the notes changed the panel width`);
  if (o.docW > w) fail(`${at} overflow after opening ${o.docW}`);
  if (w === 1440 || w === 390) await p.screenshot({ path: `${OUT}/tail-${loc}-${w}-open.png`, clip: { x: 0, y: Math.max(0, o.panel.top - 30), width: w, height: Math.min(o.panel.h + 60, 2400) } });
  // sticky header: navigate to the anchor and check the summary clears the floating pill
  await p.evaluate(() => { location.hash = ''; location.hash = '#plan-notes'; }); await p.waitForTimeout(600);
  const clear = await p.evaluate(() => {
    const head = document.querySelector('.kn-header, header'); const s = document.querySelector('#plan-notes summary');
    return { headBottom: head.getBoundingClientRect().bottom, sumTop: s.getBoundingClientRect().top };
  });
  if (clear.sumTop < clear.headBottom) fail(`${at} #plan-notes lands under the header (${Math.round(clear.sumTop)} < ${Math.round(clear.headBottom)})`);
  notes.push({ at, panel: Math.round(g.panel.w), plans: Math.round(g.plans?.w ?? 0), rows: g.rows.length, gapAbove: Math.round(g.gapAbove) });
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ at: new Date().toISOString(), failures, notes }, null, 1));
console.log(failures.length ? `qa:v31-pricing: FAIL — ${failures.length}` : `qa:v31-pricing: OK (${notes.length} measurements)`);
process.exit(failures.length ? 1 : 0);
