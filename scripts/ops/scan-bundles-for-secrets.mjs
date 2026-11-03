#!/usr/bin/env node
// V29 — greps every built web bundle (apps/*/dist) for server secret NAMES and secret-shaped VALUES.
// A browser bundle may legitimately contain a public Turnstile site key and a Toss *client* key (test_ck_/live_ck_);
// it must never contain a server secret, a secret's variable name, a private key or a credentialed URL.
// Also checks the actual values from server/.env (when present) without printing them. Skips cleanly without dist/.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { APP_DIRS, ROOT } from './csp.mjs';

const NAMES = [
  'HG_JWT_SECRET', 'HG_FILE_URL_SECRET', 'HG_PAYMENT_TOKEN_ENCRYPTION_KEY', 'HG_MFA_ENCRYPTION_KEY', 'HG_S3_SECRET_ACCESS_KEY',
  'HG_TOSS_NORMAL_SECRET_KEY', 'HG_TOSS_SECRET_KEY', 'TOSS_SECRET_KEY', 'SENDGRID_API_KEY', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY_SECRET',
  'TURNSTILE_SECRET_KEY', 'HG_DATABASE_URL', 'HG_ALERT_WEBHOOK_URL', 'AWS_SECRET_ACCESS_KEY',
];
const PATTERNS = [
  [/\b(?:test|live)_sk_[A-Za-z0-9]{8,}/, 'Toss secret key'],
  [/\b(?:test|live)_gsk_[A-Za-z0-9]{8,}/, 'Toss widget secret key'],
  [/\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/, 'SendGrid API key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/postgres(?:ql)?(?:\+psycopg)?:\/\/[^:\s"'/]+:[^@\s"'/]+@/, 'credentialed database URL'],
  [/redis:\/\/[^:\s"']*:[^@\s"']+@/, 'credentialed redis URL'],
  [/dev-only-[a-z-]+-?secret/i, 'development secret value'],
  [/hooks\.slack\.com\/services\/[A-Z0-9/]+/, 'Slack webhook'],
];

function envValues() {
  const f = resolve(ROOT, 'server/.env');
  if (!existsSync(f)) return [];
  const out = [];
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (!m) continue;
    const [, name, value] = m;
    if (!/SECRET|PASSWORD|TOKEN|PRIVATE|ENCRYPTION|API_KEY|SECURITY_KEY|DATABASE_URL/.test(name)) continue;
    if (/CLIENT_KEY|SITE_KEY/.test(name) || value.length < 12) continue;
    out.push([name, value]);
  }
  return out;
}

const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(js|mjs|html|css|json|map|txt)$/.test(f) ? [p] : [];
});
const values = envValues();
const findings = [];
let scanned = 0;
let apps = 0;
for (const [app, dirName] of Object.entries(APP_DIRS)) {
  const dist = resolve(ROOT, 'apps', dirName, 'dist');
  if (!existsSync(dist)) { console.log(`SKIP ${app}: apps/${dirName}/dist not built`); continue; }
  apps += 1;
  for (const f of files(dist)) {
    scanned += 1;
    const text = readFileSync(f, 'utf8');
    const rel = f.slice(ROOT.length + 1);
    for (const n of NAMES) if (text.includes(n)) findings.push(`${rel}: secret setting name ${n}`);
    for (const [re, label] of PATTERNS) if (re.test(text)) findings.push(`${rel}: ${label}`);
    for (const [name, v] of values) if (text.includes(v)) findings.push(`${rel}: value of ${name} from server/.env`);
  }
}
if (!apps) { console.log('No apps/*/dist present — nothing to scan (build first).'); process.exit(0); }
if (findings.length) { console.error(`SECRET SCAN FAILED (${findings.length}):\n- ${findings.join('\n- ')}`); process.exit(1); }
console.log(`Secret scan passed: ${scanned} files in ${apps} app bundle(s); ${NAMES.length} names, ${PATTERNS.length} patterns, ${values.length} server/.env values checked.`);
