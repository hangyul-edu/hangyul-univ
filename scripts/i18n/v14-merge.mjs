/**
 * Merge a V14 translation batch into the locale bundles.
 *
 * Input is one JSON file shaped `{ "<locale>": { "<dotted.key>": "<text>" } }`. Keys are written into the
 * nested bundle at their dotted path; existing values are overwritten only with `--force`, so re-running a
 * batch is safe and a human correction made directly in a bundle is never silently reverted.
 *
 * Three checks run on every string before anything is written, because each of them has shipped before:
 *
 *   placeholders   `{{count}}`, `{{n}}` must survive translation. A dropped placeholder renders as a sentence
 *                  with a hole in it; an invented one renders as literal braces.
 *   markup         the renderer understands exactly four tags (`<br>`, `<h2 class=…>`, `<span class="text-blue">`,
 *                  `<span class="text-gradation">`). Anything else renders as visible angle brackets.
 *   untranslated   a value byte-identical to the English source is not a translation. It is reported rather
 *                  than written, so "100% coverage" cannot be reached by copying English into 29 files.
 *
 *   node scripts/i18n/v14-merge.mjs <batch.json> [--ns marketing] [--force] [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALES = join(ROOT, 'packages/i18n/locales');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/i18n/v14-merge.mjs <batch.json> [--ns marketing] [--force] [--dry]'); process.exit(2); }
const ns = args.includes('--ns') ? args[args.indexOf('--ns') + 1] : 'marketing';
const force = args.includes('--force');
const dry = args.includes('--dry');

const batch = JSON.parse(readFileSync(file, 'utf8'));
const COGNATES = JSON.parse(readFileSync(join(ROOT, 'scripts/i18n/v14-cognates.json'), 'utf8')).cognates;
const en = JSON.parse(readFileSync(join(LOCALES, 'en', `${ns}.json`), 'utf8'));

const at = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const put = (o, path, v) => {
  const parts = path.split('.');
  let cur = o;
  for (const k of parts.slice(0, -1)) cur = (cur[k] ??= {});
  cur[parts[parts.length - 1]] = v;
};

const ALLOWED_TAG = /^(?:<br\s*\/?>|<\/?h2(?: class="[^"]*")?>|<span class="text-(?:blue|gradation)">|<\/span>)$/;
const placeholders = (s) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

/**
 * Scripts that must not appear in a locale that does not use them (brief Part 63's mixed-script scan, moved
 * one step earlier so it catches a leak before it is written rather than after it is rendered).
 *
 * This is not hypothetical. Writing the first V14 batch by hand produced a Chinese sentence that ended in the
 * Russian word "материалы" and a Japanese one containing the Korean "설계" — both from the neighbouring
 * locale in the same file, both invisible to a coverage count, and both something a reader of that language
 * would notice immediately. Korean is the source language, so hangul leaking into a translation is the single
 * most likely failure and is checked everywhere except `ko`.
 */
const SCRIPTS = [
  ['hangul', /[\uAC00-\uD7AF\u1100-\u11FF]/, ['ko']],
  ['cyrillic', /[\u0400-\u04FF]/, ['ru', 'uk', 'sr', 'bg', 'mn', 'kk', 'ky', 'tg', 'be', 'mk']],
  ['han', /[\u4E00-\u9FFF]/, ['zh-Hans', 'zh-Hant', 'ja', 'ko']],
  ['kana', /[\u3040-\u30FF]/, ['ja']],
  ['arabic', /[\u0600-\u06FF]/, ['ar', 'fa', 'ur', 'ps']],
  // U+0964/U+0965 (danda, double danda) sit in the Devanagari block but are the sentence terminators of
  // Bengali, Assamese, Punjabi and others too, so they are excluded from the range rather than the locales
  // added to it — otherwise correct Bengali prose is rejected for using its own full stop.
  ['devanagari', /[\u0900-\u0963\u0966-\u097F]/, ['hi', 'mr', 'ne']],
  ['thai', /[\u0E00-\u0E7F]/, ['th']],
  ['hebrew', /[\u0590-\u05FF]/, ['he']],
];
function foreignScripts(loc, value) {
  return SCRIPTS.filter(([, re, allowed]) => !allowed.includes(loc) && re.test(value)).map(([name]) => name);
}

const problems = [];
let written = 0, skipped = 0, same = 0;

for (const [loc, entries] of Object.entries(batch)) {
  const path = join(LOCALES, loc, `${ns}.json`);
  if (!existsSync(path)) { problems.push(`${loc}: no locales/${loc}/${ns}.json`); continue; }
  const bundle = JSON.parse(readFileSync(path, 'utf8'));
  let touched = 0;

  for (const [key, value] of Object.entries(entries)) {
    const source = at(en, key);
    if (typeof source !== 'string') { problems.push(`${loc} ${key}: not a key in en/${ns}.json`); continue; }
    if (typeof value !== 'string' || !value.trim()) { problems.push(`${loc} ${key}: empty`); continue; }

    const ps = placeholders(source).join(), pt = placeholders(value).join();
    if (ps !== pt) { problems.push(`${loc} ${key}: placeholders ${ps || '(none)'} → ${pt || '(none)'}`); continue; }

    const tags = value.match(/<[^>]+>/g) ?? [];
    const badTag = tags.find((t) => !ALLOWED_TAG.test(t));
    if (badTag) { problems.push(`${loc} ${key}: markup ${badTag} is not one of the four tags the renderer understands`); continue; }

    // A handful of words are genuinely the same in English and the target language. Each one is an entry in
    // v14-cognates.json with a reason, so "the translation equals the English" is always either a recorded
    // decision or a failure, never a silent pass.
    // `en` IS the source; comparing it to itself is meaningless.
    if (loc !== 'en' && value === source && !COGNATES[`${loc}|${key}|${value}`]) {
      same += 1;
      problems.push(`${loc} ${key}: identical to the English source — not a translation (add it to scripts/i18n/v14-cognates.json with a reason if it genuinely is one)`);
      continue;
    }

    const foreign = foreignScripts(loc, value);
    if (foreign.length) { problems.push(`${loc} ${key}: contains ${foreign.join(' + ')} characters, which this locale does not use`); continue; }

    // One page, one numbering system. A translator writing digits by hand has no idea which system
    // `Intl.NumberFormat` will use for the *formatted* figures on the same page, and CLDR's answer is not
    // always the obvious one — its default for `ar` is **Latin**, so the V14 Arabic draft wrote ١٠٠٪ beside a
    // university count rendered as 200. Hand-written digits must match what the product formats in.
    // `resolvedOptions().numberingSystem` is the answer directly. Deriving it by formatting a number and
    // stripping `\D` does not work: outside the `u` flag, `\D` treats every non-ASCII digit as a non-digit,
    // so Bengali digits are stripped to an empty string and every Bengali string is flagged.
    const system = new Intl.NumberFormat(loc).resolvedOptions().numberingSystem;
    const SYSTEMS = { arab: '٠١٢٣٤٥٦٧٨٩', beng: '০১২৩৪৫৬৭৮৯', deva: '०१२३४५६७८९', thai: '๐๑๒๓๔๕๖๗๘๙', latn: '0123456789' };
    // Prose only. A class name (`class="mb-4"`) and an interpolation (`{{count}}`) are markup the renderer
    // owns, not digits a reader sees — flagging them would make every locale fail on the one string that
    // carries the owner's own `<h2 class="mb-4">`.
    const prose = value.replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, '');
    for (const [name, digits] of Object.entries(SYSTEMS)) {
      if (name === system) continue;
      if ([...prose].some((c) => digits.includes(c))) {
        problems.push(`${loc} ${key}: hand-written ${name} digits, but Intl formats this locale's numbers with "${system}" — one page, one numbering system`);
        break;
      }
    }

    const existing = at(bundle, key);
    if (typeof existing === 'string' && !force) { skipped += 1; continue; }
    put(bundle, key, value);
    touched += 1;
  }

  if (touched && !dry) writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
  if (touched) { written += touched; console.log(`${loc.padEnd(8)} ${touched} key(s)${dry ? ' (dry run)' : ''}`); }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.error(`  ✗ ${p}`);
  if (problems.length > 40) console.error(`  … ${problems.length - 40} more`);
}
console.log(`\n${written} written, ${skipped} already present (use --force to overwrite), ${same} identical to English`);
process.exit(problems.length ? 1 : 0);
