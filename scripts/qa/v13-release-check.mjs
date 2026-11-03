/**
 * V13 — release gate (brief Part 26).
 *
 *     npm run release:check                  # report all three levels, fail if Marketing Preview is not ready
 *     npm run release:check -- --require=beta        # fail unless Closed Beta is ready
 *     npm run release:check -- --require=production
 *     npm run release:check -- --json
 *
 * The brief's instruction is the whole design: **"Do NOT say 'Ready to launch' because tests passed."** Green
 * tests mean the code does what it was written to do. They say nothing about whether a company exists, a
 * refund policy is approved, uploads are scanned in production, or anyone has agreed a price. So this gate
 * reads *configuration and records*, not test results, and it names the exact blocker and who can clear it —
 * never "configuration incomplete".
 *
 * Three levels, because "launch" is three different decisions:
 *
 *   MARKETING PREVIEW      the public site is visible to strangers. Nobody has an account.
 *   CLOSED BETA            real people put real documents in. Nobody has paid.
 *   COMMERCIAL PRODUCTION  money changes hands and the promises are contractual.
 *
 * A level includes every level below it. The facts come from three places, all of them the product's own:
 *   - `server/scripts/v13_launch_json.py` → `hq_ops.launch_items`, the existing classifier that reads real
 *     settings and real rows (it refuses to call an integration active merely because a variable exists);
 *   - `apps/marketing-web/src/lib/legal/entity.ts`, the ten company-identity fields;
 *   - this file, for the few requirements that are policy rather than configuration and have nowhere else to
 *     live. Those are marked `manual` and are always blockers until something records them — a gate that
 *     passes because nobody wrote the requirement down is the failure this whole command exists to prevent.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Always resolve against the repo root, so the command works from any directory. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = (...p) => resolve(ROOT, ...p);

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const REQUIRE = (args.find((a) => a.startsWith('--require='))?.split('=')[1] ?? 'preview').toLowerCase();

const LEVELS = ['preview', 'beta', 'production'];
const LEVEL_TITLE = { preview: 'MARKETING PREVIEW', beta: 'CLOSED BETA', production: 'COMMERCIAL PRODUCTION' };

/** Who can clear a blocker. Code cannot clear any of these except `engineering`. */
const OWNER = {
  legal: 'the owner + Korean counsel',
  business: 'the owner (a business decision)',
  provider: 'a contracted provider',
  engineering: 'engineering',
  reviewer: 'a named human reviewer',
};

// ------------------------------------------------------------------------------------ requirement catalogue
//
// `launch` maps to a key from `hq_ops.launch_items`: the requirement is met when that item is CODE_COMPLETE.
// `manual` means nothing in the repository records the answer yet, so it is open by construction.

const REQUIREMENTS = [
  // ---- MARKETING PREVIEW: a stranger can see the public site
  { level: 'preview', id: 'company_identity', owner: 'business', entity: true,
    title: 'The company exists in the product',
    detail: 'The ten legally required company fields in apps/marketing-web/src/lib/legal/entity.ts.' },
  { level: 'preview', id: 'legal_pages_render', owner: 'engineering', gate: 'qa:legal',
    title: '/privacy and /terms render with no placeholder text',
    detail: 'Gated by scripts/qa/v12-legal-gate.mjs, which fails on a rendered placeholder.' },
  { level: 'preview', id: 'no_dev_leakage', owner: 'engineering', gate: 'qa:leak',
    title: 'No development vocabulary on any rendered route',
    detail: 'Gated by scripts/qa/v12-leak-scan.mjs, signed in, ko + en.' },
  { level: 'preview', id: 'no_third_party_tracking', owner: 'engineering', gate: 'qa:data-map',
    title: 'No third-party analytics or advertising cookies',
    detail: 'Gated by scripts/qa/v12-privacy-data-map.mjs; one httpOnly refresh cookie and UI preferences only.' },
  { level: 'preview', id: 'no_public_demo_data', owner: 'engineering', launch: 'verified_catalogue',
    title: 'Nothing published publicly is sample data',
    detail: 'Every active programme verified against an official source.' },
  { level: 'preview', id: 'conversion_hierarchy', owner: 'engineering', gate: 'e2e/v13-hierarchy.spec.ts',
    title: 'One primary conversion action, consistent across header, hero and closing band',
    detail: 'Gated by e2e/v13-hierarchy.spec.ts and scripts/qa/v13-composition.mjs.' },

  // ---- CLOSED BETA: real people, real documents, no money
  { level: 'beta', id: 'document_storage', owner: 'engineering', launch: 'file_storage',
    title: 'Documents stored on production object storage with encryption at rest' },
  { level: 'beta', id: 'malware_scanning', owner: 'engineering', launch: 'malware_scan',
    title: 'Uploads are scanned for malware before anyone can open them',
    detail: 'The privacy policy §8 already states this. It is true of the pipeline and not yet of the deployment.' },
  { level: 'beta', id: 'secrets', owner: 'engineering', launch: 'secrets',
    title: 'Production secrets supplied from a secret manager, not defaults' },
  { level: 'beta', id: 'demo_signin_off', owner: 'engineering', launch: 'demo_signin',
    title: 'Demo sign-in refused by the deployed environment' },
  { level: 'beta', id: 'pipa_consent', owner: 'legal', launch: 'pipa_cross_border',
    title: 'Cross-border transfer consent wording approved under PIPA' },
  { level: 'beta', id: 'retention_schedule', owner: 'legal', manual: true,
    title: 'An approved retention period for applicant documents, accounts and audit logs',
    detail: 'LEGAL_DEPENDENCIES.md L8, open since V9. The policy publishes the rule and no period, and no retention job exists to enforce one.' },
  { level: 'beta', id: 'incident_process', owner: 'business', manual: true,
    title: 'A named incident contact and a breach-notification process',
    detail: 'PIPA requires notification; nothing in this repository records who does it or how.' },
  { level: 'beta', id: 'worker', owner: 'engineering', launch: 'scheduled_jobs_worker',
    title: 'A job runner in production for scans, reminders and exports' },

  // ---- COMMERCIAL PRODUCTION: money, and promises that bind
  { level: 'production', id: 'approved_prices', owner: 'business', launch: 'service_pricing',
    title: 'Approved service prices (not sample prices)' },
  { level: 'production', id: 'refund_matrix', owner: 'business', manual: true,
    title: 'An approved refund matrix',
    detail: 'Terms article 9 publishes only what the product implements. Hangyul\'s own fee refund ladder is absent rather than invented.' },
  { level: 'production', id: 'payment_provider', owner: 'provider', launch: 'payments',
    title: 'A live payment provider' },
  { level: 'production', id: 'legal_approved', owner: 'legal', launch: 'legal_pages',
    title: 'Terms and privacy text reviewed by Korean counsel' },
  { level: 'production', id: 'moe_agreement', owner: 'legal', launch: 'moe_standard_agreement',
    title: 'The MOE standard university–agency agreement, once its text is published' },
  { level: 'production', id: 'partner_agreements', owner: 'provider', launch: 'provider_agreements',
    title: 'Signed agreements with every provider the product calls a partner' },
  { level: 'production', id: 'translation_review', owner: 'reviewer', launch: 'translation_review',
    title: 'Priority locales reviewed by a named human',
    detail: 'No locale is HUMAN_REVIEWED, and none may be labelled so without a named reviewer and a date.' },
  { level: 'production', id: 'rate_limiting', owner: 'engineering', manual: true,
    title: 'Rate limiting on authentication and upload endpoints' },
  { level: 'production', id: 'csp', owner: 'engineering', manual: true,
    title: 'A Content-Security-Policy served in production' },
  { level: 'production', id: 'mfa', owner: 'engineering', manual: true,
    title: 'MFA available for staff and university accounts' },
  { level: 'production', id: 'pen_test', owner: 'business', manual: true,
    title: 'An independent penetration test, with findings closed' },
  { level: 'production', id: 'monitoring', owner: 'engineering', manual: true,
    title: 'Production monitoring and alerting' },
  { level: 'production', id: 'backups', owner: 'engineering', manual: true,
    title: 'Backups with a tested restore' },
  { level: 'production', id: 'support_process', owner: 'business', manual: true,
    title: 'A real customer support process with a published response time' },
  { level: 'production', id: 'usability_research', owner: 'reviewer', launch: 'usability_research',
    title: 'Usability sessions with real students, counsellors and university staff',
    detail: 'The synthetic simulations in docs/qa/v13 are not research and do not clear this.' },
];

// --------------------------------------------------------------------------------------------- evaluate
function launchItems() {
  const py = at('server/.venv/bin/python');
  if (!existsSync(py)) return { error: `no interpreter at ${py}`, items: [], environment: null };
  try {
    const out = execFileSync(py, ['-m', 'scripts.v13_launch_json'], { cwd: at('server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out);
  } catch (e) {
    return { error: String(e.stderr || e.message).trim().split('\n').slice(-1)[0], items: [], environment: null };
  }
}

function entityState() {
  const f = at('apps/marketing-web/src/lib/legal/entity.ts');
  if (!existsSync(f)) return { required: [], missing: ['entity.ts not found'] };
  const src = readFileSync(f, 'utf8');
  const required = [...src.matchAll(/^\s{2}'(\w+)',$/gm)].map((m) => m[1]);
  const configured = new Set([...src.matchAll(/^\s{2}(\w+):\s*(?!null)(['"`])/gm)].map((m) => m[1]));
  return { required, missing: required.filter((k) => !configured.has(k)) };
}

const launch = launchItems();
const byKey = new Map(launch.items.map((i) => [i.key, i]));
const entity = entityState();

const results = REQUIREMENTS.map((r) => {
  let met = false;
  let evidence;
  if (r.entity) {
    met = entity.missing.length === 0;
    evidence = met
      ? `all ${entity.required.length} company fields configured`
      : `${entity.missing.length} of ${entity.required.length} unconfigured: ${entity.missing.join(', ')}`;
  } else if (r.launch) {
    const it = byKey.get(r.launch);
    met = it?.category === 'CODE_COMPLETE';
    evidence = it ? (it.evidence ?? it.category) : `no launch item "${r.launch}"`;
    if (!met && it?.requires?.length) evidence += ` — needs: ${it.requires.join('; ')}`;
  } else if (r.gate) {
    // A gate is a thing somebody runs; this command records that it must be green, and does not re-run it.
    met = null;
    evidence = `run \`${r.gate}\``;
  } else {
    met = false;
    evidence = 'nothing in this repository records an answer';
  }
  return { ...r, met, evidence };
});

const levelState = {};
for (const lvl of LEVELS) {
  const upTo = LEVELS.slice(0, LEVELS.indexOf(lvl) + 1);
  const scope = results.filter((r) => upTo.includes(r.level));
  const blockers = scope.filter((r) => r.met === false);
  const manualGates = scope.filter((r) => r.met === null);
  levelState[lvl] = { pass: blockers.length === 0, blockers, manualGates, total: scope.length };
}

if (JSON_OUT) {
  console.log(JSON.stringify({ environment: launch.environment, levels: levelState, requirements: results }, null, 2));
} else {
  const line = '─'.repeat(78);
  console.log(`\nHangyul Univ — release readiness   (environment: ${launch.environment ?? 'unknown'})`);
  if (launch.error) console.log(`\n  ! launch items unavailable: ${launch.error}\n    Everything derived from them is reported as a blocker.`);
  console.log(line);
  for (const lvl of LEVELS) {
    const s = levelState[lvl];
    console.log(`\n${LEVEL_TITLE[lvl].padEnd(24)} ${s.pass ? 'PASS' : 'FAIL'}   (${s.total - s.blockers.length}/${s.total} requirements met)`);
    if (!s.pass) {
      console.log(`\n  Blockers (${s.blockers.length}) — exactly what is missing, and who can clear it:\n`);
      for (const b of s.blockers) {
        console.log(`   ✖ ${b.title}`);
        console.log(`       owner:    ${OWNER[b.owner]}`);
        console.log(`       state:    ${b.evidence}`);
        if (b.detail) console.log(`       note:     ${b.detail}`);
        console.log('');
      }
    }
    if (s.manualGates.length) {
      console.log(`  Gates that must be green at release (not re-run here): ${s.manualGates.map((g) => g.gate).join(', ')}`);
    }
  }
  console.log(`\n${line}`);
  console.log('A PASS here means every recorded requirement is met. It does not mean the product is good,');
  console.log('and it is not a substitute for the gates listed above actually being run.\n');
}

const required = LEVELS.includes(REQUIRE) ? REQUIRE : 'preview';
process.exit(levelState[required].pass ? 0 : 1);
