// V27 static gate (REPORT §361): registry in sync, every locale's V27 strings valid, no HUMAN_REVIEWED claim anywhere in
// the status record, research files well-formed (every fact with evidence + source), no quarantined file loaded.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const fails = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { fails.push(m); console.log(`  ✗ ${m}`); };
const run = (cmd, args) => { try { execFileSync(cmd, args, { stdio: 'pipe' }); return true; } catch { return false; } };

run('node', ['scripts/admissions/sync.mjs', '--check']) ? ok('shared/admissions.json in sync') : bad('shared/admissions.json stale');
run('node', ['scripts/i18n/v27/validate.mjs']) ? ok('V27 strings valid in every locale') : bad('V27 l10n validator reports problems');
const status = JSON.parse(readFileSync('docs/qa/v27/l10n/STATUS.json', 'utf8'));
const human = Object.entries(status.locales).filter(([, v]) => v.human_reviewed || v.status === 'HUMAN_REVIEWED');
human.length ? bad(`HUMAN_REVIEWED claimed for ${human.map(([k]) => k)}`) : ok(`${Object.keys(status.locales).length} locales, none claims human review`);
for (const kind of ['facts', 'guides']) {
  const dir = `server/app/data/research/v27/${kind}`;
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    const ids = new Set((d.sources ?? []).map((s) => s.id));
    const facts = kind === 'facts' ? [...(d.scholarships ?? []), ...(d.language_rules ?? [])] : (d.guides ?? []).flatMap((g) => g.requirements ?? []);
    for (const x of facts) {
      if (!x.evidence) bad(`${f}: a fact without evidence (${x.name ?? x.test ?? x.category})`);
      if (kind === 'facts' && x.source && !ids.has(x.source)) bad(`${f}: unknown source id ${x.source}`);
      n += 1;
    }
  }
  ok(`${kind}: ${n} facts checked`);
}
existsSync('server/app/data/research/v27/facts/sejong-university.json') ? bad('quarantined Sejong file is in facts/') : ok('quarantined evidence not loaded');
console.log(`qa:v27 static: ${fails.length ? `FAIL (${fails.length})` : 'OK'}`);
process.exit(fails.length ? 1 : 0);
