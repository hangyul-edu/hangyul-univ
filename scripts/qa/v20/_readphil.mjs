/**
 * V20 instrument — print the philosophy page the pipeline located, for a human to read (brief §25).
 *
 * `research-official.mjs` finds the page; a person writes the paraphrase. This fetches the page the
 * record points at, strips the chrome, and prints the window around the first 건학이념 / 교육이념 /
 * 교훈 heading. 82 institutions have a located page and 13 have been read, so this is the tool for
 * the other 69.
 *
 *   node scripts/qa/v20/_readphil.mjs <slug> [<slug> …]
 */
import { content, get, mainText, allowed } from '../../universities/lib.mjs';
const doc = content();
const slugs = process.argv.slice(2);
for (const s of slugs) {
  const rec = doc.records[s] ?? {};
  const url = rec.philosophy_url;
  console.log(`\n######## ${s}  ${url ?? '(no philosophy page found)'}`);
  if (!url) continue;
  if (!(await allowed(url))) { console.log('  robots: disallowed'); continue; }
  const r = await get(url, { timeout: 20000 });
  if (!r.ok) { console.log('  unreachable', r.error ?? r.status); continue; }
  const t = mainText(r.text);
  // Print the window around the first philosophy heading.
  const heads = ['건학이념','건학 이념','교육이념','교육 이념','창학정신','건학정신','교훈','교육목표','설립이념','Educational Philosophy','Founding','Mission','Vision'];
  let printed = false;
  for (const h of heads) {
    const i = t.indexOf(h);
    if (i < 0) continue;
    console.log('  [' + h + ']', t.slice(i, i + 700).replace(/\s+/g,' '));
    printed = true; break;
  }
  if (!printed) console.log('  ', t.slice(0, 500).replace(/\s+/g,' '));
}
