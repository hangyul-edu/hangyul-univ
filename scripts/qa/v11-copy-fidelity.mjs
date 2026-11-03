/**
 * V11 — Koreanasha copy-fidelity gate (brief: "VERIFY COPY FIDELITY AUTOMATICALLY").
 *
 * Compares every string in `docs/qa/v11/koreanasha-copy.json` against what the homepage actually ships, for
 * **both** owner-written locales — Korean and Russian. A mismatch means someone rewrote owner-authorised copy,
 * the exact failure this pass exists to prevent, so it exits non-zero and prints a character-level diff.
 *
 *   node scripts/qa/v11-copy-fidelity.mjs
 *
 * It also fails when a reused string still contains the old brand name, and when a key the manifest excluded
 * (Koreanasha staff bios, testimonials, prices, the consultation form) has reappeared in the Korean bundle.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const manifest = read('docs/qa/v11/koreanasha-copy.json');
const CANONICAL = manifest.source.locales;
const bundles = Object.fromEntries(CANONICAL.map((l) => [l, read(`packages/i18n/locales/${l}/marketing.json`)]));

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** First differing character, with a window of context — enough to see an "improved" word at a glance. */
function diff(expected, actual) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
  const w = (s) => JSON.stringify(s.slice(Math.max(0, i - 24), i + 36));
  return `       at char ${i}\n       expected …${w(expected)}\n       actual   …${w(actual)}`;
}

const failures = [];
let checked = 0;

for (const loc of CANONICAL) {
  for (const s of manifest.strings) {
    const actual = at(bundles[loc], s.hangyulKey);
    const want = s.expected[loc];
    if (typeof actual !== 'string') {
      failures.push(`MISSING  ${loc} ${s.hangyulKey}\n       no such key in locales/${loc}/marketing.json (source: ${s.sourceKey})`);
      continue;
    }
    checked++;
    if (actual !== want) {
      failures.push(`REWRITTEN ${loc} ${s.hangyulKey}  (Koreanasha ${s.sourceKey}, substitution: ${s.substitution})\n${diff(want, actual)}`);
    }
    if (/Koreanasha|코리아나샤|Корианаша/.test(actual)) {
      failures.push(`BRAND    ${loc} ${s.hangyulKey}\n       still contains the old brand name`);
    }
  }
}

/**
 * The renderer (`lib/koreanasha-copy.tsx`) understands exactly four tags. Anything else renders as visible
 * text — safe, but wrong — so a copy change that introduces one must fail here rather than on the page.
 */
const ALLOWED_TAGS = /^(?:<br\s*\/?>|<\/?h2(?: class="[^"]*")?>|<span class="text-(?:blue|gradation)">|<\/span>)$/;
for (const loc of CANONICAL) {
  for (const s of manifest.strings) {
    for (const tag of String(s.expected[loc]).match(/<[^>]+>/g) ?? []) {
      if (!ALLOWED_TAGS.test(tag)) {
        failures.push(`MARKUP   ${loc} ${s.hangyulKey}\n       ${tag} is not one of the four tags the renderer handles`);
      }
    }
  }
}

/** Nothing from an excluded group may be shipped — a staff bio or testimonial must not creep back in. */
const SENTINELS = [
  ['김예찬', 'Koreanasha founder’s name'],
  ['체보타레바', 'Koreanasha consultant’s name'],
  ['사이라노바', 'Koreanasha consultant’s name'],
  ['koreanasha333', 'Koreanasha contact address'],
  ['139-74-00672', 'Koreanasha business registration number'],
  ['80만 팔로워', 'Koreanasha founder’s follower credential'],
  ['Ким Йечан', 'Koreanasha founder’s name (ru)'],
  ['Чеботарева', 'Koreanasha consultant’s name (ru)'],
  ['Сайранова', 'Koreanasha consultant’s name (ru)'],
];
for (const loc of CANONICAL) {
  const text = JSON.stringify(bundles[loc]);
  for (const [needle, what] of SENTINELS) {
    if (text.includes(needle)) failures.push(`EXCLUDED  ${loc}: ${needle} — ${what} must not appear in Hangyul copy`);
  }
}

if (failures.length) {
  console.error(`\nKoreanasha copy fidelity: ${failures.length} problem(s) across ${CANONICAL.join(' + ')}\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}
const revised = manifest.strings.filter((s) => s.ruRevised).length;
console.log(`Koreanasha copy fidelity: OK — ${checked}/${manifest.strings.length * CANONICAL.length} strings (${CANONICAL.join(' + ')}) match the pinned text (substitutions: brand/count only); ko is the owner's source verbatim, ${revised} ru entries were re-rendered in V32 (ruRevised).`);
