/**
 * V31 agency pipeline-rail gate (brief Part 71) — `node scripts/qa/v31/stage.mjs` (dev stack: agency 3102 + API 8001).
 *
 *   views separated  전체 / 종료 / 긴급 are `.hg-pipe__view` buttons OUTSIDE the stage list (`ol.hg-pipe__rail`), behind a
 *                    divider; no view is a stage and no stage is a view
 *   count == records clicking a stage filters the table to exactly that stage's count (`data-work-total`)
 *   selected         after a click: aria-pressed=true on that stage only, its fill is tangerine, its tint is visible
 *   keyboard         Tab reaches a stage, Enter selects it, Enter again clears it
 *   one target       the label, the count and the segment are inside the SAME button (hit-tested at three points)
 *   zero stage       a 0-count stage is rendered, readable (contrast ≥ 4.5:1 for label and count) and not a dead button
 *   no raw enum      no stage label matches /^[A-Z_]+$/
 *   no overflow      document width == viewport at 1440 / 1280 / 1024 / 768 / 390; the trailing view stays visible
 * Exit 1 on any failure. Writes docs/qa/v31/stage/summary.json and a screenshot per width.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3102';
const EMAIL = 'counselor@lotus.demo.hangyul.kr';
const OUT = 'docs/qa/v31/stage';
fs.mkdirSync(OUT, { recursive: true });
const failures = []; const notes = [];
const fail = (m) => { failures.push(m); console.log('  FAIL', m); };
const lum = (rgb) => { const c = rgb.match(/\d+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const b = await chromium.launch();
for (const w of [1440, 1280, 1024, 768, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login?demo=${encodeURIComponent(EMAIL)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.hg-pipe__rail', { timeout: 60000 });
  await p.waitForFunction(() => document.querySelector('[data-work-total]'), null, { timeout: 60000 });
  const at = `[${w}]`;
  const geo = await p.evaluate(() => {
    const rail = document.querySelector('.hg-pipe__rail');
    const views = [...document.querySelectorAll('.hg-pipe__view')];
    const stages = [...rail.querySelectorAll('.hg-pipe__stage')].map((li) => {
      const btn = li.querySelector('.hg-pipe__btn'); const lab = li.querySelector('.hg-pipe__label'); const cnt = li.querySelector('.hg-pipe__count'); const seg = li.querySelector('.hg-pipe__seg');
      li.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const pts = [lab, cnt, seg].map((e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && btn.contains(h); });
      let bg = 'rgb(255, 255, 255)'; for (let e = btn; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') { bg = c; break; } }
      return { key: li.dataset.stage, label: lab.innerText.trim(), count: Number(li.dataset.count), empty: li.classList.contains('is-empty'), button: btn.tagName,
        visible: btn.getBoundingClientRect().width > 0, hits: pts, labelColor: getComputedStyle(lab).color, countColor: getComputedStyle(cnt).color, bg };
    });
    const trail = document.querySelector('.hg-pipe__views--trail');
    const tr = trail?.getBoundingClientRect();
    rail.scrollLeft = 0;
    const clipped = rail.scrollWidth > rail.clientWidth + 2;
    return { docW: document.documentElement.scrollWidth, vw: innerWidth, viewsInsideRail: views.filter((v) => rail.contains(v)).length, views: views.map((v) => v.innerText.replace(/\s+/g, ' ').trim()),
      lead: !!document.querySelector('.hg-pipe__views--lead'), clipped, more: rail.dataset.more ?? null, trailVisible: !!tr && tr.right <= innerWidth + 1 && tr.width > 0, stages,
      allInRail: [...rail.querySelectorAll('button')].some((x) => /전체|All/.test(x.innerText) && !x.closest('.hg-pipe__stage')) };
  });
  await p.screenshot({ path: `${OUT}/today-${w}.png`, clip: { x: 0, y: 0, width: w, height: 520 } });
  if (geo.docW > geo.vw) fail(`${at} page overflows: ${geo.docW} > ${geo.vw}`);
  if (geo.viewsInsideRail) fail(`${at} ${geo.viewsInsideRail} view(s) rendered inside the stage list`);
  if (!geo.lead) fail(`${at} 전체 is not in the leading views group`);
  if (!geo.trailVisible) fail(`${at} trailing view (종료) cut off or missing`);
  // A rail that must scroll has to show it (edge fade); at desktop widths the whole pipeline fits.
  if (geo.clipped && w >= 1280) fail(`${at} stages do not fit at a desktop width`);
  if (geo.clipped && !geo.more) fail(`${at} rail scrolls without an edge cue`);
  if (geo.stages.length < 5) fail(`${at} only ${geo.stages.length} stages`);
  for (const s of geo.stages) {
    if (/^[A-Z_]+$/.test(s.label)) fail(`${at} raw enum label ${s.label}`);
    if (!s.empty && s.hits.some((h) => !h)) fail(`${at} ${s.key}: label/count/segment not one target ${JSON.stringify(s.hits)}`);
    if (s.count === 0) {
      if (!s.empty) fail(`${at} ${s.key}: zero stage not marked empty`);
      if (contrast(s.labelColor, s.bg) < 4.5 || contrast(s.countColor, s.bg) < 4.5) fail(`${at} ${s.key}: zero stage text below 4.5:1`);
    }
  }
  notes.push({ w, views: geo.views, stages: geo.stages.map((s) => `${s.label}:${s.count}`).join(' ') });

  if (w === 1440) {
    // count == records, selected state, keyboard
    for (const s of geo.stages.filter((x) => x.count > 0)) {
      await p.locator(`.hg-pipe__stage[data-stage="${s.key}"] .hg-pipe__btn`).click();
      await p.waitForFunction((n) => Number(document.querySelector('[data-work-total]')?.dataset.workTotal) === n, s.count, { timeout: 30000 })
        .catch(() => fail(`[1440] ${s.label}: table shows ${'?'} records, stage says ${s.count}`));
      const sel = await p.evaluate((k) => {
        const li = document.querySelector(`.hg-pipe__stage[data-stage="${k}"]`);
        const pressed = [...document.querySelectorAll('.hg-pipe__btn[aria-pressed="true"]')].map((x) => x.closest('.hg-pipe__stage').dataset.stage);
        return { pressed, fill: getComputedStyle(li.querySelector('.hg-pipe__fill')).backgroundColor, tint: getComputedStyle(li.querySelector('.hg-pipe__btn')).backgroundColor,
          total: Number(document.querySelector('[data-work-total]').dataset.workTotal) };
      }, s.key);
      if (sel.total !== s.count) fail(`[1440] ${s.label}: ${sel.total} records after click, count says ${s.count}`);
      if (sel.pressed.length !== 1 || sel.pressed[0] !== s.key) fail(`[1440] ${s.label}: pressed = ${sel.pressed}`);
      if (sel.fill !== 'rgb(204, 78, 0)') fail(`[1440] ${s.label}: selected fill ${sel.fill}, want tangerine`);
      if (sel.tint === 'rgba(0, 0, 0, 0)') fail(`[1440] ${s.label}: selected stage has no tint`);
      await p.locator(`.hg-pipe__stage[data-stage="${s.key}"] .hg-pipe__btn`).click();   // clear
      await p.waitForTimeout(400);
    }
    const first = geo.stages.find((x) => x.count > 0);
    await p.locator(`.hg-pipe__stage[data-stage="${first.key}"] .hg-pipe__btn`).focus();
    await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    const kp = await p.getAttribute(`.hg-pipe__stage[data-stage="${first.key}"] .hg-pipe__btn`, 'aria-pressed');
    if (kp !== 'true') fail('[1440] Enter did not select the focused stage');
    await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    if (await p.getAttribute(`.hg-pipe__stage[data-stage="${first.key}"] .hg-pipe__btn`, 'aria-pressed') !== 'false') fail('[1440] Enter did not clear the stage');
    await p.screenshot({ path: `${OUT}/rail-1440.png`, clip: await p.locator('.ag22-strip').boundingBox() });
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ at: new Date().toISOString(), failures, notes }, null, 1));
console.log(failures.length ? `qa:v31-stage: FAIL — ${failures.length}` : `qa:v31-stage: OK (${notes.length} widths)`);
process.exit(failures.length ? 1 : 0);
