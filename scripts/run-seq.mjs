// Runs a script in every workspace that defines it, one at a time (keeps memory use low on small machines).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { c, ROOT, run } from './lib.mjs';

const script = process.argv[2];
const only = process.argv[3];
const dirs = ['packages', 'apps'].flatMap((d) => readdirSync(join(ROOT, d)).map((n) => join(ROOT, d, n)));
let ran = 0;
for (const dir of dirs) {
  const pj = join(dir, 'package.json');
  if (!existsSync(pj)) continue;
  const pkg = JSON.parse(readFileSync(pj, 'utf8'));
  if (!pkg.scripts?.[script] || (only && !pkg.name.includes(only))) continue;
  console.log(c.orange(`\n▶ ${pkg.name} › ${script}`));
  run('npm', ['run', script, '-w', pkg.name]);
  ran++;
}
console.log(c.green(`\n✔ ${script} finished for ${ran} workspace(s)`));
