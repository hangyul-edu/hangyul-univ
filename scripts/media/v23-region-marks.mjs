// V23 — the tier-E identity composition's location mark: Korea drawn faintly, the institution's own
// province (광역자치단체) solid. One static SVG per region (17), generated from the same KOSTAT boundary set
// the directory map uses (apps/marketing-web/src/media/korea-regions.ts, "free to share or remix"), written to
// every app that draws a university. It states a registry fact (where the institution is) and nothing else.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const src = fs.readFileSync(path.join(ROOT, 'apps/marketing-web/src/media/korea-regions.ts'), 'utf8');
const viewBox = src.match(/KOREA_VIEWBOX = '([^']+)'/)[1];
const regions = [...src.matchAll(/\{ key: '([A-Za-z]+)', nameKo: '[^']+', label: \[([\d.]+), ([\d.]+)\], d: '([^']+)' \}/g)].map((m) => ({ key: m[1], x: Number(m[2]), y: Number(m[3]), d: m[4] }));
// Metropolitan cities are a few pixels wide at tile size; a ring around the label point makes "here" readable (V23 §74).
const SMALL = new Set(['Seoul', 'Sejong', 'Gwangju', 'Daejeon', 'Ulsan', 'Daegu', 'Incheon', 'Busan']);
if (regions.length !== 17) throw new Error(`expected 17 regions, parsed ${regions.length}`);

const outDirs = ['apps/marketing-web/public/media/region-mark', 'apps/student-web/public/media/region-mark'];
for (const dir of outDirs) fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
for (const r of regions) {
  const others = regions.filter((x) => x.key !== r.key).map((x) => x.d).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">`
    + `<path d="${others}" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<path d="${r.d}" fill="#FF6700" stroke="#FF8a3d" stroke-width="1.2" stroke-linejoin="round"/>`
    + (SMALL.has(r.key) ? `<circle cx="${r.x}" cy="${r.y}" r="26" fill="none" stroke="#FF6700" stroke-width="5"/><circle cx="${r.x}" cy="${r.y}" r="9" fill="#FF6700"/>` : '')
    + `</svg>\n`;
  for (const dir of outDirs) fs.writeFileSync(path.join(ROOT, dir, `${r.key}.svg`), svg);
}
console.log(`wrote ${regions.length} region marks × ${outDirs.length} apps`);
