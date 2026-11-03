/**
 * V22 §79 — synthetic user walkthroughs through the real API, recorded to docs/qa/v22/SIMULATIONS.md:
 *   four students registering from Nepal, Myanmar, Vietnam and the US (their own locale, phone format and country);
 *   two agency administrators answering the same student — the student must see ONE Hangyul team identity;
 *   two university administrators (Pusan, SKKU) — complete tenant isolation.
 * Prints and writes a table of outcomes; no code, token or secret is ever written.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const API = process.env.HG_QA_API ?? 'http://localhost:8001/api/v1';
const PASSWORD = 'Hangyul!2026';
const post = async (p, b, h = {}) => { const r = await fetch(`${API}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const get = async (p, h = {}) => { const r = await fetch(`${API}${p}`, { headers: h }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const login = async (email, client) => { const r = await post('/auth/login', { email, password: PASSWORD, client }); return r.status === 200 ? { h: { Authorization: `Bearer ${r.body.access_token}` }, body: r.body } : null; };
const sql = (q) => execSync(`psql ${process.env.HG_QA_DB ?? 'postgresql://hangyul:hangyul_dev@localhost:5432/hangyul_univ'} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const rows = [];
const stamp = Date.now();

const STUDENTS = [
  { who: 'Student from Nepal', locale: 'ne', nat: 'NP', phone: '98 4123 ' + String(stamp).slice(-4), name: 'Aarati Shrestha' },
  { who: 'Student from Myanmar', locale: 'my', nat: 'MM', phone: '09 77 123 ' + String(stamp).slice(-4), name: 'Hnin Wai Phyo' },
  { who: 'Student from Vietnam', locale: 'vi', nat: 'VN', phone: '0912 ' + String(stamp).slice(-6), name: 'Nguyễn Thị Lan' },
  { who: 'Student from the US', locale: 'en', nat: 'US', phone: '(415) 555-' + String(stamp).slice(-4), name: 'Maya Johnson' },
];
for (const s of STUDENTS) {
  const email = `sim-${s.nat.toLowerCase()}-${stamp}@example.com`;
  const sess = await post('/auth/signup/session', { captcha_token: null, locale: s.locale });
  const H = { 'X-Signup-Session': sess.body.signup_session };
  const e = await post('/auth/verification/send', { channel: 'EMAIL', target: email, purpose: 'SIGNUP', locale: s.locale }, H);
  const p = await post('/auth/verification/send', { channel: 'SMS', target: s.phone, phone_country: s.nat, purpose: 'SIGNUP', locale: s.locale }, H);
  const code = async (cid) => (await get(`/auth/verification/peek/${cid}`)).body.code;
  const ev = e.status === 200 ? await post('/auth/verification/verify', { challenge_id: e.body.challenge_id, code: await code(e.body.challenge_id) }) : { status: e.status, body: {} };
  const pv = p.status === 200 ? await post('/auth/verification/verify', { challenge_id: p.body.challenge_id, code: await code(p.body.challenge_id) }) : { status: p.status, body: {} };
  const reg = await post('/auth/register', { email, email_proof: ev.body.proof, phone: s.phone, phone_country: s.nat, phone_proof: pv.body.proof, password: 'a sentence i remember', password_confirm: 'a sentence i remember', full_name: s.name, locale: s.locale, nationality: s.nat, consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true, MARKETING: false } }, H);
  const stored = reg.status === 201 ? sql(`select phone||' · '||locale||' · consents='||(select count(*) from consent_records c where c.user_id=u.id and c.document_version is not null and c.locale='${s.locale}') from users u where email='${email}'`) : '—';
  const dash = reg.status === 201 ? await get('/me/dashboard', { Authorization: `Bearer ${reg.body.access_token}` }) : { status: 0 };
  rows.push([s.who, `locale ${s.locale} · phone "${s.phone}" (${s.nat})`, `email send ${e.status} · sms send ${p.status} · verify ${ev.status}/${pv.status} · register ${reg.status}`, stored, dash.status === 200 ? 'home loads' : `home ${dash.status}`]);
}

// --- two agency administrators answer the same student
const stu = await login('student@demo.hangyul.kr', 'student');
const a1 = await login('counselor@lotus.demo.hangyul.kr', 'agency');
const a2 = await login('reviewer@lotus.demo.hangyul.kr', 'agency');
const convs = (await get('/conversations', stu.h)).body;
const cid = convs[0].id;
await post(`/conversations/${cid}/messages`, { body: `sim ${stamp} first admin reply` }, a1.h);
await post(`/conversations/${cid}/messages`, { body: `sim ${stamp} second admin reply` }, a2.h);
const seen = (await get(`/conversations/${cid}/messages`, stu.h)).body.messages.filter((m) => m.body.startsWith(`sim ${stamp}`));
const idents = [...new Set(seen.map((m) => `${m.author?.kind}:${m.author?.full_name}`))];
const actors = sql(`select count(distinct author_user_id) from messages where body like 'sim ${stamp}%'`);
rows.push(['Agency Admin 1 then Admin 2 answer the same student', `${a1.body.active_org.role} + ${a2.body.active_org.role}`, `student sees ${seen.length} replies as ${idents.join(' / ')}`, `db authors: ${actors} distinct user ids`, idents.length === 1 && idents[0].startsWith('team:') ? 'one team identity ✓' : 'FAIL']);

// --- two university administrators, two tenants
const pnu = await login('admin@pusan.univ.demo.hangyul.kr', 'university');
const skku = await login('admin@sungkyunkwan.univ.demo.hangyul.kr', 'university');
const pApps = (await get('/applications?page_size=3', pnu.h)).body.items ?? [];
const sApps = (await get('/applications?page_size=3', skku.h)).body.items ?? [];
let leaks = 0;
for (const a of pApps) for (const path of [`/applications/${a.id}`, `/applications/${a.id}/documents`]) { const r = await get(path, skku.h); if (r.status === 200) leaks += 1; }
for (const a of sApps) { const r = await get(`/applications/${a.id}`, pnu.h); if (r.status === 200) leaks += 1; }
const pConv = (await get('/conversations', pnu.h)).body;
for (const c of pConv.slice(0, 3)) { const r = await get(`/conversations/${c.id}/messages`, skku.h); if (r.status === 200) leaks += 1; }
const pExport = await get(`/university/export/applications.csv?university_id=${pApps[0]?.university?.id}`, skku.h);
rows.push(['University Admin A (Pusan) vs Admin B (SKKU)', `A lands in ${pnu.body.active_org.org_name} (${pnu.body.memberships.length} membership) · B in ${skku.body.active_org.org_name}`, `${pApps.length + sApps.length} guessed application URLs, ${Math.min(3, pConv.length)} conversations, 1 export with a foreign university_id`, `cross-tenant 200s: ${leaks} · export ${pExport.status}`, leaks === 0 ? 'isolated ✓' : 'FAIL']);

const md = ['# V22 §79 user simulations', '', `Run ${new Date().toISOString()} against ${API}.`, '', '| scenario | input | steps | stored / observed | result |', '|---|---|---|---|---|', ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`), ''].join('\n');
writeFileSync('docs/qa/v22/SIMULATIONS.md', md);
console.log(md);
const bad = rows.filter((r) => /FAIL|home 4|register 4/.test(String(r[4]) + String(r[2])));
process.exit(bad.length ? 1 : 0);
