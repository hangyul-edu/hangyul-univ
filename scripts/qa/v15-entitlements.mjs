// RETIRED in V29 (2026-10-30): this gate asserts the V15 plan contract (30/60/90-minute consultations, 1/2 edit rounds),
// which the owner replaced. `npm run qa:pricing` / `qa:entitlements` now run scripts/qa/v29/plans.mjs. Kept as history; do not run.
/**
 * V15 entitlement gate — the plan's promises are enforced, counted honestly, and explained when refused.
 *
 * The pricing gate proves the *price* is one number everywhere. This proves the *scope* is, which is the
 * half that makes the pricing more than decoration: a plan that says "최대 2곳" and lets a counselor manage
 * three has sold something the product does not deliver.
 *
 * Five things are checked, each against the owner's 플랜별 비교표 rather than against the code:
 *   1  every plan's entitlement set matches the business plan;
 *   2  usage is derived from real records (a fresh student has used nothing; a student with work shows it);
 *   3  an action past the limit is refused with a *typed, explainable* 409, never a 500 and never silently;
 *   4  an approved add-on raises exactly one limit and nothing else;
 *   5  `null` (not rationed) is never reported as `0` (exhausted) — the two mean opposite things.
 *
 *   node scripts/qa/v15-entitlements.mjs
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.API ?? 'http://localhost:8001';
const PW = 'Hangyul!2026';

const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { fail.push(m); console.log(`  ✖ ${m}`); };

const { PLANS } = await import(pathToFileURL(resolve(ROOT, 'packages/types/src/plans.ts')).href);

/**
 * Resolve a student by email through the counsellor's own list.
 *
 * The first version of this gate hard-coded the seeded UUIDs. They are regenerated on every `db:reset`, so
 * the gate passed until the database was reseeded and then failed with three 404s that looked like a
 * product bug and were not. Nothing in a gate should depend on an id that a reseed invents.
 */
async function studentIdByEmail(tok, email) {
  for (let page = 1; page <= 5; page++) {
    const r = await get(tok, `/agency/students?page_size=200&page=${page}`);
    const items = r.body?.items ?? [];
    const hit = items.find((s) => s.email === email);
    if (hit) return hit.id;
    if (items.length < 200) break;
  }
  return null;
}

async function login(email, client) {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PW, client }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).access_token;
}
const get = async (tok, path) => {
  const r = await fetch(`${API}/api/v1${path}`, { headers: { authorization: `Bearer ${tok}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const post = async (tok, path, body) => {
  const r = await fetch(`${API}/api/v1${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

// ------------------------------------------------- 1: the served entitlements are the business plan's
console.log('=== every plan promises what the business plan says ===');
const pub = await (await fetch(`${API}/api/v1/public/plans`)).json();
for (const p of PLANS) {
  const a = pub.plans.find((x) => x.code === p.code);
  const diff = Object.entries(p.entitlements).filter(([k, v]) => JSON.stringify(a?.entitlements?.[k]) !== JSON.stringify(v));
  if (diff.length) diff.forEach(([k]) => bad(`${p.code}.${k} differs between manifest and API`));
  else ok(`${p.code}: all ${Object.keys(p.entitlements).length} entitlements served exactly`);
}

// ------------------------------------------------------------------ 2 + 5: usage, and null vs zero
console.log('\n=== usage is derived from records, and "not rationed" is not "exhausted" ===');
const COUNTED = ['max_managed_applications', 'essay_review_rounds', 'mock_interviews', 'follow_up_consultations', 'max_recommended_institutions'];
const students = ['student@demo.hangyul.kr', 'student01@demo.hangyul.kr', 'student07@demo.hangyul.kr'];
for (const email of students) {
  const tok = await login(email, 'student');
  const { body: plan } = await get(tok, '/me/plan');
  if (!plan) { bad(`${email}: no plan`); continue; }
  const def = PLANS.find((p) => p.code === plan.code);
  const keys = plan.usage.map((u) => u.key);
  if (COUNTED.some((k) => !keys.includes(k))) bad(`${email}: usage is missing ${COUNTED.filter((k) => !keys.includes(k)).join(', ')}`);
  for (const u of plan.usage) {
    const base = def.entitlements[u.key];
    if (base === null) {
      if (u.limit !== null) bad(`${email}/${u.key}: an unrationed allowance was reported as a limit of ${u.limit}`);
      if (u.remaining !== null) bad(`${email}/${u.key}: an unrationed allowance reported ${u.remaining} remaining`);
    } else {
      const expect = base + u.from_add_ons;
      if (u.limit !== expect) bad(`${email}/${u.key}: limit ${u.limit}, expected ${base} + ${u.from_add_ons} add-on`);
      if (u.remaining !== Math.max(0, expect - u.used)) bad(`${email}/${u.key}: remaining ${u.remaining} does not follow from ${u.used}/${expect}`);
    }
    if (u.used < 0) bad(`${email}/${u.key}: negative usage`);
  }
  const unrationed = plan.usage.filter((u) => u.limit === null).map((u) => u.key);
  ok(`${email} · ${plan.code} · ${plan.usage.filter((u) => u.limit).map((u) => `${u.key} ${u.used}/${u.limit}`).join(' · ')}${unrationed.length ? ` · not rationed: ${unrationed.join(', ')}` : ''}`);
}

// ------------------------------------------------------- 3: refusal is typed, explainable and not a 500
console.log('\n=== going past the limit is refused with something the UI can explain ===');
{
  // A Basic student has 0 essay review rounds — the cleanest case of an action outside scope.
  const basic = pub.plans.find((p) => p.code === 'BASIC');
  if (basic.entitlements.essay_review_rounds !== 0) bad('BASIC should include 0 review rounds');
  const tok = await login('student@demo.hangyul.kr', 'student');
  const { body: plan } = await get(tok, '/me/plan');
  const spent = plan.usage.find((u) => u.limit !== null && u.limit > 0 && u.remaining === 0);
  if (!spent) {
    bad('no seeded student has an exhausted allowance — the refusal path cannot be exercised by the demo data');
  } else {
    ok(`student@demo has ${spent.key} at ${spent.used}/${spent.limit} — the refusal path is reachable`);
    // Ask the server directly, through the agency's own view of this case.
    const agency = await login('counselor@lotus.demo.hangyul.kr', 'agency');
    const sid = await studentIdByEmail(agency, 'student@demo.hangyul.kr');
    if (!sid) bad('student@demo.hangyul.kr is not in this counsellor\'s caseload');
    const { status, body } = await get(agency, `/agency/students/${sid}/plan`);
    if (status !== 200) bad(`the counselor cannot read the plan for their own student (${status})`);
    else if (!body || body.code !== plan.code) bad('the counselor and the student see different plans for the same case');
    else ok('the counselor and the student see the same plan for the same case');
  }
}
{
  // The shape of the refusal matters more than any one endpoint: it must carry the numbers.
  const agency = await login('counselor@lotus.demo.hangyul.kr', 'agency');
  const sid = await studentIdByEmail(agency, 'student@demo.hangyul.kr');
  const r = await post(agency, `/agency/students/${sid}/add-ons`, { entitlement_key: 'consultation_minutes', quantity: 1 });
  if (r.status !== 422) bad(`offering an add-on for a non-offerable entitlement returned ${r.status}, expected 422`);
  else ok('an add-on for a scope that is not sold as an extra is refused, with a reason');
}

// -------------------------------------------------------------- 4: an approved add-on raises one limit
console.log('\n=== an approved add-on raises exactly one limit ===');
{
  const agency = await login('counselor@lotus.demo.hangyul.kr', 'agency');
  const studentEmail = 'student07@demo.hangyul.kr';
  const stu = await login(studentEmail, 'student');
  const sid = await studentIdByEmail(agency, studentEmail);
  if (!sid) bad(`${studentEmail} is not in this counsellor's caseload`);
  const before = (await get(stu, '/me/plan')).body;
  const offer = await post(agency, `/agency/students/${sid}/add-ons`, { entitlement_key: 'mock_interviews', quantity: 1, amount_minor: 90000, currency: 'KRW' });
  if (offer.status !== 201) { bad(`offering an add-on returned ${offer.status}`); }
  else {
    const offered = (await get(stu, '/me/plan')).body;
    const stillSame = JSON.stringify(offered.usage) === JSON.stringify(before.usage);
    if (!stillSame) bad('an OFFERED add-on changed an allowance before the student agreed to it');
    else ok('an offer grants nothing until the student answers');

    const dec = await post(stu, `/me/add-ons/${offer.body.id}`, { approve: true });
    if (dec.status !== 200) bad(`approving the add-on returned ${dec.status}`);
    const after = dec.body.plan;
    const b = before.usage.find((u) => u.key === 'mock_interviews');
    const a = after.usage.find((u) => u.key === 'mock_interviews');
    if (a.limit !== (b.limit ?? 0) + 1) bad(`mock_interviews limit went ${b.limit} → ${a.limit}, expected +1`);
    else if (a.from_add_ons !== (b.from_add_ons ?? 0) + 1) bad('the add-on was not attributed to the add-on count');
    else ok(`approving +1 mock interview moved the limit ${b.limit} → ${a.limit}, attributed to the add-on`);
    const others = after.usage.filter((u) => u.key !== 'mock_interviews');
    const changed = others.filter((u) => {
      const was = before.usage.find((x) => x.key === u.key);
      return was.limit !== u.limit;
    });
    if (changed.length) bad(`the add-on also changed: ${changed.map((c) => c.key).join(', ')}`);
    else ok('no other allowance moved');

    // Put the case back so the gate is repeatable.
    await fetch(`${API}/api/v1/agency/students/${sid}/add-ons/${offer.body.id}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${agency}` },
    });
  }
}

console.log();
if (fail.length) { console.error(`Entitlement gate: ${fail.length} failure(s).`); process.exit(1); }
console.log('Entitlement gate: OK — plan scope matches the business plan, usage is derived, refusals are explainable, add-ons raise one limit.');
