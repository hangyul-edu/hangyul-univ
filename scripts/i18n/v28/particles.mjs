// V28 (brief §72) — particle-safe Korean. A particle written straight after a placeholder ("{{agency}}가") is wrong for half
// of all names; the pair form ("{{agency}}이(가)") is resolved from the real word by packages/i18n/src/particles.ts.
//   node scripts/i18n/v28/particles.mjs --check   → exit 1 and list offenders (the gate)
//   node scripts/i18n/v28/particles.mjs --fix     → rewrite offenders to pair form, keeping each file's indentation
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../packages/i18n/locales/ko');
const PAIR = { 가: '이(가)', 이: '이(가)', 는: '은(는)', 은: '은(는)', 를: '을(를)', 을: '을(를)', 와: '과(와)', 과: '과(와)', 로: '(으)로', 으로: '(으)로', 이에요: '이에요(예요)', 예요: '이에요(예요)' };
// longest first, then a boundary (space, punctuation, end) so "{{n}}이상" / "{{x}}로그인" are not touched
const RE = /(\{\{\s*[\w.]+\s*\}\})(이에요|예요|으로|가|이|는|은|를|을|와|과|로)(?=[\s.,!?·)」』"”'’:;]|$)/g;
const fix = process.argv.includes('--fix');
const offenders = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const p = path.join(DIR, f);
  const raw = fs.readFileSync(p, 'utf8');
  const indent = (raw.split('\n')[1]?.match(/^(\s+)/) ?? [, ' '])[1];
  const data = JSON.parse(raw);
  let changed = 0;
  const walk = (o, key) => {
    for (const [k, v] of Object.entries(o)) {
      const id = key ? `${key}.${k}` : k;
      if (v && typeof v === 'object') walk(v, id);
      else if (typeof v === 'string' && RE.test(v)) {
        RE.lastIndex = 0;
        offenders.push(`${f.replace('.json', '')}:${id}  ${v.slice(0, 80)}`);
        if (fix) { o[k] = v.replace(RE, (_m, ph, part) => `${ph}${PAIR[part]}`); changed += 1; }
      }
      RE.lastIndex = 0;
    }
  };
  walk(data, '');
  if (fix && changed) fs.writeFileSync(p, `${JSON.stringify(data, null, indent)}\n`);
}
console.log(`ko placeholder particles: ${offenders.length}${fix ? ' fixed' : ''}`);
if (!fix) for (const o of offenders.slice(0, 80)) console.log('  ✗', o);
process.exit(!fix && offenders.length ? 1 : 0);
