// RTL locales: prefixes an invisible RIGHT-TO-LEFT MARK (U+200F) to every string that contains right-to-left text but
// does not start with it (e.g. "Hangyul أثناء العمل", "{{university}}: …", "TOPIK 3 مطلوب").
// Why: student/marketing CSS sets `unicode-bidi: plaintext` on text blocks under [dir=rtl] (V8 RTL QA) so that English
// fallback paragraphs keep correct punctuation and number order. plaintext takes each paragraph's direction from its
// first strong character, so translated strings must start with a strong RTL character — the RLM provides one.
// Idempotent. Usage: node scripts/i18n/rtl-mark.mjs [--check]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const RTL = ['ar', 'fa', 'ur', 'he', 'ps'];
const RLM = '‏';
const rtlChar = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const check = process.argv.includes('--check');
let changed = 0;
const fix = (v) => {
  if (typeof v !== 'string' || !rtlChar.test(v) || v.startsWith(RLM)) return v;
  const lead = v.replace(/^[\s"'“”«»(\[\-–—•·]+/, '');
  return rtlChar.test(lead[0] ?? '') ? v : (changed++, RLM + v);
};
const walk = (o) => { for (const [k, v] of Object.entries(o)) o[k] = v && typeof v === 'object' ? walk(v) : fix(v); return o; };
for (const loc of RTL) {
  const dir = `packages/i18n/locales/${loc}`;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const before = changed;
    const j = walk(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
    if (changed > before) { console.log(`${loc}/${f}: ${changed - before}`); if (!check) writeFileSync(`${dir}/${f}`, JSON.stringify(j, null, 2) + '\n'); }
  }
}
console.log(`${changed} string(s) ${check ? 'would be' : ''} marked`);
