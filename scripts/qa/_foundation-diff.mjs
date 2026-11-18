// node scripts/qa/_foundation-diff.mjs <before.png> <after.png> — % of pixels that differ (channel delta > 24), by 10 vertical bands
import fs from 'node:fs';
import { PNG } from 'pngjs';
const [a, b] = process.argv.slice(2).map((f) => PNG.sync.read(fs.readFileSync(f)));
if (a.width !== b.width) { console.log('width differs'); process.exit(); }
const h = Math.min(a.height, b.height); let n = 0; const bands = Array(10).fill(0);
for (let y = 0; y < h; y++) for (let x = 0; x < a.width; x++) { const i = (y * a.width + x) * 4; if (Math.abs(a.data[i] - b.data[i]) > 24 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 24 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) { n++; bands[Math.floor(y / h * 10)]++; } }
console.log(`${a.width}x${a.height} vs ${b.width}x${b.height} · ${(100 * n / (h * a.width)).toFixed(3)}% differ · bands ${bands.map((v) => (100 * v / (h * a.width / 10)).toFixed(1)).join(' ')}`);
