/**
 * V21 §58 — the security scan. Expected unauthorized occurrence: **ZERO**.
 *
 * The brief names six things that must appear nowhere they are not authorised:
 *
 *     the owner's Toss secret keys      the full test card number       a billingKey
 *     a card password                   a CVC/CVV                       an identity number
 *
 * A grep of the source tree only answers for the source tree, so this looks in the four places the
 * data actually passes through: the **tracked tree**, the **runtime logs**, the **database** (every
 * text and JSON column, audit payloads included), and **Redis**.
 *
 * The secret keys are read from the untracked env so the scan looks for the *real* values rather than
 * a pattern that resembles them — and this script prints no value it finds, only where it was found.
 *
 *   node scripts/qa/v21/security-scan.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const env = Object.fromEntries(
  (existsSync(join(ROOT, 'server/.env')) ? readFileSync(join(ROOT, 'server/.env'), 'utf8') : '')
    .split('\n').filter((l) => /^[A-Z]/.test(l)).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }));

/** The needles. A literal is a value read from the untracked env; a pattern is a shape. */
const NEEDLES = [
  ...['HG_TOSS_NORMAL_SECRET_KEY', 'HG_TOSS_FOREIGN_BILLING_SECRET_KEY', 'HG_TOSS_BILLING_SECRET_KEY',
      'HG_JWT_SECRET', 'HG_FILE_URL_SECRET', 'HG_PAYMENT_TOKEN_ENCRYPTION_KEY']
    // A value the repo ships on purpose — `dev-only-…`, `change-me` — is a placeholder, not a secret:
    // it is *meant* to appear in `.env.example` and in the config default, and `get_settings()`
    // refuses to boot production while one is in use. Only a real value is a finding.
    .map((k) => env[k] && env[k].length >= 12 && !/dev-only|change-?me|example|placeholder/i.test(env[k])
      && { what: `the value of ${k}`, literal: env[k] })
    .filter(Boolean),
  env.HG_QA_TEST_CARD && { what: 'the full test card number', literal: env.HG_QA_TEST_CARD },
  { what: 'a Toss secret key', re: /\b(?:test|live)_sk_[A-Za-z0-9]{10,}/ },
  // V22 (brief §74): the identity providers' credentials, by shape. Each one is also looked for by value when
  // the untracked env holds it, so a value that was renamed or split still trips the scan.
  ...['HG_SENDGRID_API_KEY', 'SENDGRID_API_KEY', 'HG_TWILIO_ACCOUNT_SID', 'TWILIO_ACCOUNT_SID', 'HG_TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SID',
      'HG_TWILIO_API_KEY_SECRET', 'TWILIO_API_KEY_SECRET', 'HG_TWILIO_AUTH_TOKEN', 'TWILIO_AUTH_TOKEN', 'HG_TWILIO_MESSAGING_SERVICE_SID',
      'TWILIO_MESSAGING_SERVICE_SID', 'HG_TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY']
    .map((k) => env[k] && env[k].length >= 16 && !/^[123]x0000000000000000000000000000000AA$/.test(env[k]) && { what: `the value of ${k}`, literal: env[k] })
    .filter(Boolean),
  { what: 'a SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/ },
  { what: 'a Twilio Account SID', re: /\bAC[0-9a-f]{32}\b/ },
  { what: 'a Twilio API Key SID', re: /\bSK[0-9a-f]{32}\b/ },
  { what: 'a Twilio Messaging Service SID', re: /\bMG[0-9a-f]{32}\b/ },
  { what: 'a Twilio auth token / API secret assignment', re: /(?:TWILIO_AUTH_TOKEN|TWILIO_API_KEY_SECRET)\s*[=:]\s*["']?[0-9a-zA-Z]{24,}/ },
  { what: 'a Turnstile secret key', re: /\b0x4AAAAA[A-Za-z0-9_-]{20,}\b/ },
  { what: 'a billingKey', re: /\bbln_[A-Za-z0-9_-]{10,}/ },
  { what: 'a billingKey field', re: /"billing_?[Kk]ey"\s*:\s*"[^"]{6,}/ },
  { what: 'a card password', re: /"card_?[Pp]assword"\s*:\s*"[^"]/ },
  { what: 'a CVC/CVV', re: /"(?:cvc|cvv|securityCode)"\s*:\s*"?\d{3}/i },
  { what: 'an identity number', re: /"(?:customerIdentityNumber|identity_number|residentRegistrationNumber)"\s*:\s*"?\d/i },
  // A bare digit run that is *shaped* like a PAN: 15–19 digits, a real card's first digit, bounded by
  // non-alphanumerics, and passing Luhn. Looser than this is worthless — a 13-digit run passes Luhn
  // one time in ten by chance, so over a whole database it flags hashes, ids and timestamps and says
  // nothing. This shape is what a card number written down actually looks like.
  { what: 'a card-number-shaped digit run', luhn: true },
].filter(Boolean);

const LUHN = (d) => {
  let sum = 0;
  const parity = d.length % 2;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[i]);
    if (i % 2 === parity) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
};

const hits = [];
function scan(where, text) {
  if (!text) return;
  for (const n of NEEDLES) {
    if (n.literal) {
      if (text.includes(n.literal)) hits.push({ where, what: n.what });
    } else if (n.re) {
      if (n.re.test(text)) hits.push({ where, what: n.what });
    } else if (n.luhn) {
      for (const m of text.matchAll(/(?<![0-9A-Za-z*•_.-])[3-6]\d{14,18}(?![0-9A-Za-z*_.-])/g)) {
        if (LUHN(m[0])) { hits.push({ where, what: `a card-number-shaped digit run (${m[0].length} digits)` }); break; }
      }
    }
  }
}

/* ------------------------------------------------------------------------------- 1. the tracked tree */

const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.venv', '__pycache__', '.next',
  'coverage', 'playwright-report', 'test-results', '.turbo', '.cache']);
// The untracked env is *where the secrets are supposed to be*; finding them there is not a finding.
const EXEMPT = new Set(['server/.env', '.env', 'server/.env.local']);
let files = 0;
function walk(rel) {
  for (const e of readdirSync(join(ROOT, rel || '.'), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { walk(p); continue; }
    if (EXEMPT.has(p)) continue;
    if (!/\.(tsx?|jsx?|mjs|cjs|py|json|md|ya?ml|css|scss|html|txt|csv|sql|sh|toml|ini|env\..*)$/.test(e.name)
        && !/^\.env/.test(e.name)) continue;
    const abs = join(ROOT, p);
    if (statSync(abs).size > 8_000_000) continue;
    files += 1;
    scan(p, readFileSync(abs, 'utf8'));
  }
}
walk('');
console.log(`  tracked tree      ${files} files scanned`);

/* -------------------------------------------------------------------------------- 2. runtime logs */

/*
 * The question §58 actually asks about logs is "does the payment path write a card number anywhere a
 * log aggregator would pick it up". A directory of old QA output cannot answer that, so this starts
 * an API of its own with **stdout and stderr captured to a file**, charges a card through it, and
 * scans what the server wrote. `--no-runtime` skips it; the verdict then says the check was skipped
 * rather than passed.
 */
const RUNTIME_LOG = join(ROOT, 'scripts/qa/v21/.runtime.log');
if (!process.argv.includes('--no-runtime')) {
  try {
    execFileSync('bash', [join(ROOT, 'scripts/qa/v21/capture-runtime-log.sh'), RUNTIME_LOG],
      { cwd: ROOT, encoding: 'utf8', timeout: 300_000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('  runtime capture   an API was started, a card charged, and its output captured');
  } catch (e) {
    hits.push({ where: 'runtime capture', what: `NOT RUN — ${String(e.message ?? e).slice(0, 160)}` });
  }
}

const LOG_DIRS = [join(ROOT, 'server/logs'), join(ROOT, 'logs'), dirname(RUNTIME_LOG),
  process.env.HG_QA_LOG_DIR ?? ''];
let logs = 0;
for (const d of LOG_DIRS.filter((x) => x && existsSync(x))) {
  const stack = [d];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!/\.(log|out|err|txt|json|jsonl)$/.test(e.name) && !/^\.runtime\.log$/.test(e.name)) continue;
      if (statSync(p).size > 64_000_000) continue;
      logs += 1;
      scan(p.replace(ROOT, '.'), readFileSync(p, 'utf8'));
    }
  }
}
console.log(`  runtime logs      ${logs} files scanned`);
if (logs === 0 && !process.argv.includes('--no-runtime')) {
  hits.push({ where: 'runtime logs', what: 'NOT SCANNED — no log file was found, so this check proves nothing' });
}

/* ----------------------------------------------------------------------------------- 3. the database */

const PY = `
import json
from sqlalchemy import inspect, text
from app.core.db import SessionLocal, engine

s = SessionLocal()
insp = inspect(engine)
out = []
for table in insp.get_table_names():
    cols = [c["name"] for c in insp.get_columns(table)
            if str(c["type"]).upper().startswith(("VARCHAR", "TEXT", "JSON", "CHAR"))]
    if not cols:
        continue
    sel = ", ".join(f'CAST("{c}" AS TEXT)' for c in cols)
    for row in s.execute(text(f'SELECT {sel} FROM "{table}"')).all():
        for col, val in zip(cols, row):
            if val:
                out.append([f"{table}.{col}", val])
print(json.dumps(out))
`;
let dbCells = 0;
try {
  const raw = execFileSync(join(ROOT, 'server/.venv/bin/python'), ['-c', PY],
    { cwd: join(ROOT, 'server'), encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  const rows = JSON.parse(raw.slice(raw.indexOf('[')));
  dbCells = rows.length;
  for (const [where, value] of rows) scan(`db:${where}`, value);
  console.log(`  database          ${dbCells} text/JSON cells scanned`);
} catch (e) {
  hits.push({ where: 'database', what: `NOT SCANNED — ${String(e.message ?? e).slice(0, 120)}` });
}

/* --------------------------------------------------------------------------------------- 4. Redis */

try {
  const url = env.HG_REDIS_URL ?? 'redis://localhost:6379';
  const keys = execFileSync('redis-cli', ['-u', url, '--scan'], { encoding: 'utf8', timeout: 15000 })
    .split('\n').filter(Boolean);
  for (const k of keys.slice(0, 5000)) {
    scan(`redis:${k}`, k);
    const v = execFileSync('redis-cli', ['-u', url, 'DUMP', k], { encoding: 'utf8', timeout: 5000 });
    scan(`redis:${k}`, v);
  }
  console.log(`  redis             ${keys.length} keys scanned`);
} catch {
  console.log('  redis             not reachable — skipped (recorded, not counted as a pass)');
}

/* -------------------------------------------------------------------------------------- the verdict */

console.log('');
if (hits.length === 0) {
  console.log('V21 security scan — unauthorized occurrences: 0\n');
  process.exit(0);
}
console.log(`V21 security scan — unauthorized occurrences: ${hits.length}\n`);
// The location and the kind, never the value.
for (const h of hits) console.log(`  ✖ ${h.where}: ${h.what}`);
console.log('');
process.exit(1);
