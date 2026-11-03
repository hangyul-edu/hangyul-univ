// V23 §74 — manual visual sampling of directory tiles: 14 well-known, 20 random, 20 that had no hero in V22, 20 small /
// regional institutions. Renders each tile alone (the real InstitutionTile via the directory search) into contact
// sheets docs/qa/v23/shots/sample-<group>.png for a person to review. Seeded random so the sample is reproducible.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'docs/qa/v23/shots');
fs.mkdirSync(OUT, { recursive: true });
const rows = fs.readFileSync(path.join(ROOT, 'docs/qa/v23/UNIVERSITY_VISUAL_COVERAGE.csv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => { const c = [...l.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1]); return { slug: c[0], ko: c[1], en: c[2], region: c[3], type: c[4], tier: c[5] }; });
const v22 = fs.readFileSync(path.join(ROOT, 'docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => { const c = [...l.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1]); return { slug: c[1], hero: c[3] }; });
let seed = 2310; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const shuffle = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const WELL = ['서울대학교', '연세대학교', '고려대학교', '한국과학기술원', '포항공과대학교', '성균관대학교', '한양대학교', '경희대학교', '이화여자대학교', '부산대학교', '경북대학교', '중앙대학교', '서강대학교', '한국외국어대학교'];
const noHeroV22 = new Set(v22.filter((r) => r.hero === 'no').map((r) => r.slug));
const groups = {
  wellknown: WELL.map((ko) => rows.find((r) => r.ko === ko)).filter(Boolean),
  random: shuffle(rows).slice(0, 20),
  noHeroBefore: shuffle(rows.filter((r) => noHeroV22.has(r.slug))).slice(0, 20),
  regional: shuffle(rows.filter((r) => !['Seoul', 'Gyeonggi', 'Incheon', 'Busan'].includes(r.region) && r.type !== 'UNIVERSITY')).slice(0, 20),
};
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const summary = {};
for (const [g, list] of Object.entries(groups)) {
  const shots = [];
  for (const r of list) {
    await p.goto(`http://localhost:3100/universities?lang=ko&q=${encodeURIComponent(r.ko)}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const card = p.locator('.mk-unicard', { has: p.locator(`a[href*="/universities/${r.slug}"]`) }).first();
    if (!(await card.count())) { shots.push({ slug: r.slug, missing: true }); continue; }
    const buf = await card.screenshot();
    shots.push({ slug: r.slug, tier: r.tier, b64: buf.toString('base64') });
  }
  const html = `<html><body style="margin:0;padding:16px;background:#fff;font:12px sans-serif;display:grid;grid-template-columns:repeat(5,260px);gap:12px">${shots.map((s) => s.missing ? `<div>MISSING ${s.slug}</div>` : `<figure style="margin:0"><img src="data:image/png;base64,${s.b64}" style="width:260px"><figcaption>${s.slug} · ${s.tier}</figcaption></figure>`).join('')}</body></html>`;
  const sheet = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await sheet.setContent(html); await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(OUT, `sample-${g}.png`), fullPage: true }); await sheet.close();
  summary[g] = { n: list.length, tiers: shots.reduce((a, s) => ({ ...a, [s.tier ?? 'missing']: (a[s.tier ?? 'missing'] ?? 0) + 1 }), {}), slugs: list.map((r) => r.slug) };
  console.log(g, JSON.stringify(summary[g].tiers));
}
fs.writeFileSync(path.join(OUT, 'sample-groups.json'), JSON.stringify(summary, null, 1));
await browser.close();
