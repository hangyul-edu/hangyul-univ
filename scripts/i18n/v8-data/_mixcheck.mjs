// Flags words that mix Latin letters with another script (typing slips in hand-drafted translations).
// Usage: node scripts/i18n/v8-data/_mixcheck.mjs <file.json>...
import { readFileSync } from 'node:fs';
const fl = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? fl(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const other = /[Ͱ-ϿЀ-ӿ԰-֏֐-ۿऀ-෿฀-໿က-႟Ⴀ-ჿሀ-፿ក-៿぀-ヿ一-鿿가-힯]/;
let n = 0;
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  for (const [k, v] of fl(j)) {
    for (const w of v.replace(/\{\{[^}]*\}\}/g, ' ').split(/[\s·,.;:!?()“”"'«»„—–/\-]+/)) {
      if (/[A-Za-z]/.test(w) && other.test(w) && !/-(ის|მა|ში|ს|ის)$/.test(w)) { console.log(f, k, w); n++; }
    }
  }
}
console.log(n ? `${n} mixed-script word(s)` : 'no mixed-script words');
