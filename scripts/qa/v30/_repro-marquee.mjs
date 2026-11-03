// V30 reproduction: which visible crests does a pointer actually reach? (BEFORE evidence)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = process.env.OUT ?? 'docs/qa/v30/before';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
await p.locator('.kn-crests').scrollIntoViewIfNeeded();
await p.waitForTimeout(800);
const report = [];
for (const frac of [0, 0.25, 0.5, 0.75]) {
  // Pause every row at the same fraction of its own loop.
  await p.evaluate((f) => document.querySelectorAll('.kn-marquee__track').forEach((t) => {
    for (const a of t.getAnimations()) { a.pause(); a.currentTime = f * a.effect.getComputedTiming().duration; }
  }), frac);
  await p.waitForTimeout(150);
  const rows = await p.evaluate(() => [...document.querySelectorAll('.kn-crests .kn-marquee')].map((m, ri) => {
    const mr = m.getBoundingClientRect();
    return [...m.querySelectorAll('.kn-crest')].map((a, i) => {
      const r = a.getBoundingClientRect();
      const visible = r.right > mr.left + 4 && r.left < mr.right - 4 && r.width > 0;
      if (!visible) return null;
      const cx = Math.max(mr.left + 2, Math.min(mr.right - 2, r.left + r.width / 2)), cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      return { row: ri + 1, idx: i, name: a.querySelector('img')?.alt, href: a.getAttribute('href'),
        inert: !!a.closest('[inert]'), hitsSelf: !!hit && (hit === a || a.contains(hit)), hitTag: hit?.className?.toString().slice(0, 40) };
    }).filter(Boolean);
  }).flat());
  const ok = rows.filter((r) => r.hitsSelf).length;
  console.log(`loop ${frac * 100}%: visible ${rows.length}, pointer reaches ${ok}, dead ${rows.length - ok}`);
  report.push({ frac, rows });
  await p.screenshot({ path: `${OUT}/marquee-1440-${frac * 100}.png`, clip: await p.locator('.kn-crests').boundingBox() });
}
// Real click on a dead one
const dead = report[0].rows.find((r) => !r.hitsSelf);
if (dead) {
  const box = await p.evaluate(({ row, idx }) => { const a = document.querySelectorAll('.kn-crests .kn-marquee')[row - 1].querySelectorAll('.kn-crest')[idx]; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, dead);
  await p.evaluate(() => document.querySelectorAll('.kn-marquee__track').forEach((t) => t.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; })));
  const before = p.url();
  await p.mouse.click(box.x, box.y); await p.waitForTimeout(800);
  console.log(`real click on dead "${dead.name}" (row ${dead.row} #${dead.idx}, href ${dead.href}): ${before} -> ${p.url()}`);
}
fs.writeFileSync(`${OUT}/marquee-instances.json`, JSON.stringify(report, null, 1));
await b.close();
