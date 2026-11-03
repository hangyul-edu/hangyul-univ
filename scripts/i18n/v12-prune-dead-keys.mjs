/**
 * Remove the development and disclaimer copy V11 and V12 stopped rendering (V12, brief Part 1).
 *
 *     node scripts/i18n/v12-prune-dead-keys.mjs --dry      # report only
 *     node scripts/i18n/v12-prune-dead-keys.mjs            # prune
 *
 * These strings are not a leak — nothing renders them, and the leak scan measures rendered text for exactly that
 * reason. They are still worth removing: they ship in every bundle (the `mobile` namespace is bundled into the
 * web apps, so "Development build · API {{url}}" is sitting in the production marketing chunk in 55 locales),
 * and a dead key is an invitation to wire it up again.
 *
 * **Safety.** i18n keys are frequently built at runtime — `t(`review.scanStatus.${status}`)` — so a key can be
 * live while its full path appears nowhere in the source. A candidate is therefore pruned only when:
 *
 *   · its full dotted path does not appear in any source file, **and**
 *   · its parent path does not appear either (which would mean a dynamic lookup), **unless** it is listed in
 *     `VERIFIED_DEAD` — a short list of leaves whose code path was read and whose branch no longer calls `t`.
 *
 * Anything that fails those checks is kept and reported, so the script can never quietly delete a live string.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const LOCALES = 'packages/i18n/locales';
const SOURCE_ROOTS = ['apps', 'packages'];

/**
 * Candidates, by namespace. Each was found by the §83 audit and confirmed to have no render site.
 */
const CANDIDATES = {
  marketing: [
    // The V11 draft legal pages, replaced by v12.privacy / v12.terms.
    'legalPages',
    'seo.privacy', 'seo.terms',
    // Development/sample labelling on public surfaces.
    'footer.demoNote', 'search.demoNote', 'detail.demoTitle', 'detail.demoText', 'detail.partnerTitleDemo',
    'trust.demoTitle', 'trust.demoText', 'trust.status.DEMO', 'trust.statusText.DEMO', 'trust.types.DEMO',
    'home.preview', 'quick.quality',
    // Machine-translation labelling for the guides, removed in V11.
    'guides.machineDraftShort', 'article.machineTitle', 'article.translation', 'countryGuide.machineLanguage',
    // The standing disclaimers (brief Part 5).
    'footer.visaNote', 'detail.noGuarantee', 'visa.notIssuerTitle', 'visa.notIssuerText',
    'quick.disclaimer', 'v7.apply.note', 'v7.check.sign', 'v8.work.note',
  ],
  common: ['freshness.demoTooltip', 'demo.badge'],
  student: [
    'visa.disclaimerTitle', 'visa.disclaimer',
    'services.honestTitle', 'services.honestText',
    'start.result.honest', 'start.result.perYear',
    'dashboard.readiness.notProbability',
  ],
  mobile: [
    'devAccess', 'login.apiBase', 'settings.machineDraft',
    'student.visa.disclaimer', 'student.visa.disclaimerTitle', 'student.matches.honesty', 'student.home.readinessDisclaimer',
    'v3.discover.notGuarantee', 'v3.quick.notGuarantee',
  ],
  visaroute: ['disclaimerTitle', 'disclaimer'],
  success: ['queue.fixture', 'queue.fixtureNote'],
  writing: ['prompt.status.SAMPLE', 'prompt.sampleStaff', 'insights.demo'],
  agency: [
    'v8.channel.notConnected', 'v8.channel.needsAgreement', 'v8.channel.timelineNote',
    'v8.settings.channelsHint', 'review.scanStatus.SKIPPED',
  ],
};

/**
 * Leaves whose parent IS looked up dynamically, and whose branch provably no longer reaches `t()`.
 * Each names the code that makes it dead, so the claim can be rechecked.
 */
const VERIFIED_DEAD = new Set([
  // `scanText()` returns null for SKIPPED before it calls `t` (DocumentReviewPanel.tsx).
  'agency:review.scanStatus.SKIPPED',
  // `ChannelPicker` filters to `can_send` channels and renders nothing below two (MessageThread.tsx).
  'agency:v8.channel.notConnected',
  'agency:v8.channel.needsAgreement',
  // The per-year cost line was removed from the pre-account eligibility result (Start.tsx, brief Part 10).
  'student:start.result.perYear',
  // The marketing SEO titles are superseded by `v12.seo.*`, which the new pages use.
  'marketing:seo.privacy',
  'marketing:seo.terms',
]);

const grep = (needle) => {
  try {
    execFileSync('grep', ['-rqF', needle, ...SOURCE_ROOTS, '--include=*.ts', '--include=*.tsx'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Is this path looked up *dynamically* — `t(`trust.${kind}`)` — rather than merely sharing a prefix with a key
 * that is used by its full name?
 *
 * The first version of this check asked only whether the parent path appeared anywhere, and kept 43 candidates
 * on that basis. Most were false: `trust.` appears because `trust.checked` and `trust.neverChecked` are used on
 * /credits by their full names, which says nothing about `trust.demoText`. What actually makes a sibling unsafe
 * to remove is an interpolation, and an interpolation always has a backtick in front of the prefix.
 */
const dynamicLookup = (parent) =>
  grep(`\`${parent}.`) || grep(`${parent}.$\{`) || grep(`\`${parent}.$\{`);

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function remove(obj, path) {
  const parts = path.split('.');
  const leaf = parts.pop();
  const parent = parts.reduce((o, k) => (o == null ? o : o[k]), obj);
  if (parent && leaf in parent) {
    delete parent[leaf];
    // Leave no empty husks behind.
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const owner = parts.slice(0, i).reduce((o, k) => (o == null ? o : o[k]), obj);
      const key = parts[i];
      if (owner && owner[key] && typeof owner[key] === 'object' && Object.keys(owner[key]).length === 0) delete owner[key];
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- decide, once, from the reference locale
const pruned = [];
const kept = [];
for (const [ns, paths] of Object.entries(CANDIDATES)) {
  const en = JSON.parse(readFileSync(`${LOCALES}/en/${ns}.json`, 'utf8'));
  for (const path of paths) {
    if (get(en, path) === undefined) continue;                    // already gone
    const id = `${ns}:${path}`;
    const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : null;
    const liveExact = grep(path);
    const liveParent = parent ? dynamicLookup(parent) : false;
    if (liveExact || (liveParent && !VERIFIED_DEAD.has(id))) {
      kept.push({ id, why: liveExact ? 'referenced directly' : `parent "${parent}" is interpolated at runtime` });
      continue;
    }
    pruned.push({ id, ns, path });
  }
}

// ---------------------------------------------------------------- apply to every locale
let edits = 0;
if (!DRY) {
  for (const loc of readdirSync(LOCALES).filter((d) => !d.startsWith('_'))) {
    for (const ns of new Set(pruned.map((p) => p.ns))) {
      const file = `${LOCALES}/${loc}/${ns}.json`;
      let json;
      try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
      let touched = false;
      for (const p of pruned.filter((x) => x.ns === ns)) if (remove(json, p.path)) touched = true;
      if (touched) {
        writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
        edits += 1;
      }
    }
  }
}

for (const k of kept) console.log(`  kept    ${k.id} — ${k.why}`);
for (const p of pruned) console.log(`  pruned  ${p.id}`);
console.log(`\n${pruned.length} key path(s) ${DRY ? 'would be' : ''} pruned, ${kept.length} kept${DRY ? '' : `, ${edits} locale file(s) rewritten`}`);
