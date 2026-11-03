// V23 — apply string changes to the locale bundles from one JSON patch file.
//
//   node scripts/i18n/v23-set.mjs <patch.json> [--dry]
//
// patch.json: { "<ns>": { "<dotted.key>": { "<locale>": "value" | null, ... } } }
//   a string sets the key (creating parents), null deletes it. "*" as a locale applies to every locale directory
//   (useful for deletions). Each file keeps its own indentation; key order is preserved, new keys are appended.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const LOC = path.join(ROOT, 'packages/i18n/locales');
const [patchFile, ...rest] = process.argv.slice(2);
const DRY = rest.includes('--dry');
const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
const locales = fs.readdirSync(LOC).filter((d) => !d.startsWith('_') && fs.statSync(path.join(LOC, d)).isDirectory());

const cache = new Map();
function load(loc, ns) {
  const p = path.join(LOC, loc, `${ns}.json`);
  if (!cache.has(p)) {
    const raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{}\n';
    const indent = (raw.split('\n')[1]?.match(/^(\s+)/) ?? [, ' '])[1];
    cache.set(p, { p, data: JSON.parse(raw), indent, dirty: false, existed: fs.existsSync(p) });
  }
  return cache.get(p);
}
function setPath(obj, key, value) {
  const parts = key.split('.');
  let o = obj;
  for (const k of parts.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') { if (value === null) return false; o[k] = {}; }
    o = o[k];
  }
  const last = parts.at(-1);
  if (value === null) {
    if (!(last in o)) return false;
    delete o[last];
    // prune parents left empty by the deletion
    for (let i = parts.length - 1; i > 0; i -= 1) {
      const parent = parts.slice(0, i - 1).reduce((x, k) => x[k], obj);
      const k = parts[i - 1];
      if (parent[k] && typeof parent[k] === 'object' && !Object.keys(parent[k]).length) delete parent[k]; else break;
    }
    return true;
  }
  if (o[last] === value) return false;
  o[last] = value;
  return true;
}

let changes = 0;
for (const [ns, keys] of Object.entries(patch)) {
  for (const [key, perLocale] of Object.entries(keys)) {
    for (const [loc, value] of Object.entries(perLocale)) {
      for (const l of loc === '*' ? locales : [loc]) {
        if (!locales.includes(l)) throw new Error(`unknown locale ${l}`);
        const f = load(l, ns);
        if (!f.existed && value === null) continue;
        if (setPath(f.data, key, value)) { f.dirty = true; changes += 1; }
      }
    }
  }
}
for (const f of cache.values()) {
  if (f.dirty && !DRY) fs.writeFileSync(f.p, JSON.stringify(f.data, null, f.indent) + '\n');
}
console.log(`${DRY ? '[dry] ' : ''}${changes} string changes in ${[...cache.values()].filter((f) => f.dirty).length} files`);
