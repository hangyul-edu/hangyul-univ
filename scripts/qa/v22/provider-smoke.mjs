/**
 * V22 §77 — the controlled provider smoke. Sends ONE verification email and ONE verification SMS to the explicitly
 * configured QA targets (`QA_EMAIL_TARGET`, `QA_SMS_TARGET` in server/.env) through the real services, and prints
 * the provider request result and the delivery state where available — never the code, never a secret, never the
 * payload. If credentials or targets are absent it prints BLOCKED with the exact reason and exits 0 (a skip with a
 * stated reason), so the rest of qa:v22 is never silently skipped.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const envText = existsSync(join(ROOT, 'server/.env')) ? readFileSync(join(ROOT, 'server/.env'), 'utf8') : '';
const has = (k) => new RegExp(`^(HG_)?${k}=.+`, 'm').test(envText);
const blocked = [];
if (!has('SENDGRID_API_KEY')) blocked.push('SENDGRID_API_KEY not set in server/.env');
if (!has('TWILIO_API_KEY_SECRET') || !has('TWILIO_ACCOUNT_SID') || !has('TWILIO_MESSAGING_SERVICE_SID')) blocked.push('TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET / TWILIO_MESSAGING_SERVICE_SID not set in server/.env');
if (!has('QA_EMAIL_TARGET')) blocked.push('QA_EMAIL_TARGET not set (the only address the smoke may mail)');
if (!has('QA_SMS_TARGET')) blocked.push('QA_SMS_TARGET not set (the only number the smoke may text)');
if (blocked.length) {
  console.log('V22 provider smoke — BLOCKED');
  for (const b of blocked) console.log(`  – ${b}`);
  process.exit(0);
}
const out = execFileSync(join(ROOT, 'server/.venv/bin/python'), ['-m', 'scripts.v22_provider_smoke'], { cwd: join(ROOT, 'server'), encoding: 'utf8', timeout: 60000 });
process.stdout.write(out);
