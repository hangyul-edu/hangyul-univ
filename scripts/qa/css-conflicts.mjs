// V10: finds a property declared twice for the same selector, under the same at-rule condition, in one
// file — where the first value can never apply. Most hits are a later generation's deliberate re-tuning block
// (V8/V9 density passes), which is sound CSS, so this reports rather than rewrites: read each one before acting.
// Usage: node scripts/qa/css-conflicts.mjs <css...>
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
for (const f of process.argv.slice(2)) {
  const seen = new Map();
  postcss.parse(readFileSync(f, 'utf8')).walkRules((rule) => {
    const cond = [];
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) cond.push(p.params);
    for (const sel of rule.selectors) {
      const key = `${cond.join('|')}::${sel}`;
      for (const d of rule.nodes.filter((n) => n.type === 'decl')) {
        const prev = seen.get(`${key}::${d.prop}`);
        if (prev && prev.value !== d.value) console.log(`${f}:${d.source.start.line}  ${sel} { ${d.prop} } ${prev.value} (line ${prev.line}) overridden by ${d.value}`);
        seen.set(`${key}::${d.prop}`, { value: d.value, line: d.source.start.line });
      }
    }
  });
}
