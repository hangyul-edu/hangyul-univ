# Security & privacy

Hangyul Univ processes passports, transcripts, family and financial documents. Controls implemented now, and what production still needs.

## Authentication & sessions

- Passwords: Argon2id (`argon2-cffi`). Registration requires ≥ 10 characters.
- Access tokens: JWT (HS256), 15-minute lifetime, held in memory only on the client; include `client` and active `org`.
- Refresh tokens: random 384-bit values stored **hashed** (SHA-256); rotated on every refresh; **reuse of a rotated token revokes the whole token family** (theft detection, audited). Web: httpOnly `SameSite=Lax` cookie per client app scoped to `/api/v1/auth`; mobile: OS keychain via `expo-secure-store`.
- Each console only accepts roles that belong to it (a student cannot sign in to a console and vice versa). Org membership is re-checked on every request, so revoking membership takes effect immediately.
- Login attempts (success/failure, IP, user agent) are recorded in `login_events`.
- `HG_ENV` **defaults to `production` and fails closed** (V23): unset, empty or misspelled values are treated as production. Production start-up refuses development secrets (a `dev-only` secret raises), refuses to boot without the SendGrid/Twilio/Turnstile keys, and disables test sign-in.

## Authorization & tenant isolation

Enforced in the API (`server/app/services/access.py`), not by hiding UI:

- Students: only their own data.
- Agencies: only students with an ACTIVE assignment to their organisation. Since V22 a tenant has **one role**: every member is an `AGENCY_ADMIN` and sees the whole agency's students (no per-counselor caseload).
- Universities: only applications to their university from SUBMITTED onwards; documents only when explicitly shared for such an application. Every university member is a `UNIVERSITY_ADMIN` (V22).
- Hangyul staff: cross-tenant, audited.
- Out-of-tenant records return **404** (not 403) to avoid existence probing.
- Internal messages and internal essay comments are filtered server-side for students.

Covered by tests in `server/tests/test_security.py` (cross-agency access, every agency admin sees the whole agency, university scoping, every university member is an admin, internal-note and internal-comment leakage, vault access, upload validation, signed URL expiry, refresh reuse).

## Documents

- Uploads: 15 MB limit; MIME type sniffed from magic bytes (client `Content-Type` ignored); allowed PDF/PNG/JPEG/WEBP; filename sanitised.
- Malware-scan hook (`MalwareScanner`); development uses a no-op scanner that records `SKIPPED`. ~~Production: ClamAV (clamd) or a cloud AV service before a version becomes reviewable.~~ **V29:** `ClamdScanner`, required in production; see *V29 production security*.
- Private storage with random keys; path traversal guarded. No public URLs: downloads go through **HMAC-signed, 5-minute URLs** issued only after an authorization check; responses are `Cache-Control: private, no-store`, `nosniff`, sandboxed CSP.
- Every document access, review and export is written to `audit_logs` with the data subject.
- Passport numbers are stored only masked on the profile.

## Privacy

- Consent records are append-only, with version, locale, hashed IP, user agent and source. Sign-up and checkout consents come from the catalogue in `server/app/core/legal.py`: `TERMS`, `PRIVACY`, `CROSS_BORDER_VERIFICATION` (the identity-verification processors abroad), `MARKETING` (optional) and `PURCHASE_TERMS` (recorded at checkout, V22); in-product purposes are `SHARE_WITH_AGENCY`, `SHARE_WITH_UNIVERSITY`, `CROSS_BORDER_TRANSFER`, `OUTCOME_RESEARCH`.
- Data export and deletion requests (`data_requests`) with a due date; deletion marks the account and starts the review workflow (legal retention obligations may apply to some records — see below).
- Analytics dashboards aggregate; universities see pre-submission interest only as counts.

## HTTP hardening

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`; CORS limited to configured origins; generic 500 messages (details only in server logs).

## Before production

Status measured in V29 (2026-10-30). ✅ = implemented and tested in the repository; ⛔ = blocked on something outside it.
Run `cd server && .venv/bin/python -m scripts.v29_prod_readiness` for the live per-control state.

- ✅ **V29** TLS/HSTS/CSP: `infra/csp.json` is the single source for each app's CSP. `node scripts/ops/gen-nginx.mjs` renders `infra/nginx/hangyul.conf` from it (HTTP→HTTPS redirect, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, per-app CSP). `node scripts/ops/check-csp.mjs` checks the built HTML. The API adds HSTS plus `default-src 'none'; frame-ancestors 'none'` only when `HG_ENV=production` and the request is not local plain HTTP. Production refuses to start without an `https://` `HG_PUBLIC_ORIGIN` and https-only `HG_CORS_ORIGINS`. ⛔ The real domains and certificates are not supplied yet.
- ✅ Secure cookies (`secure=True` whenever `HG_ENV=production`, httpOnly, SameSite=Lax), tested in V29.
- ~~Rate limiting / lockout on login, registration and refresh (e.g. Redis-backed); CAPTCHA on sign-up.~~ **Done in V22** (REPORT §263): Redis fixed-window limits on register, login, forgot-password and OTP send/verify (`services/ratelimit.py`); progressive login throttling with CAPTCHA escalation (never a permanent lock); Cloudflare Turnstile verified server-side and mandatory in production; email + SMS one-time codes (HMAC-stored, 5-min TTL, 5 attempts); refresh-token reuse detection (V3). ~~Still open: MFA for staff, CSP.~~ Both done in V29.
- ✅ **V29** malware scanning: `ClamdScanner` speaks clamd's INSTREAM protocol over a unix socket or TCP (`HG_MALWARE_SCANNER=clamd`, `HG_CLAMD_SOCKET` | `HG_CLAMD_HOST`/`HG_CLAMD_PORT`). Production refuses the no-op scanner. Verified against real ClamAV 1.5.4 with EICAR (`docs/qa/v29/security/clamd-eicar.txt`).
- ✅ **V29** S3/MinIO storage: `S3Storage` uses SSE (`HG_S3_SSE=AES256|aws:kms`), private objects and `Cache-Control: private, no-store`. Downloads still stream through the signed endpoint. Production refuses `HG_STORAGE_BACKEND=local`. A bucket policy template is in `scripts/ops/s3-bucket-policy.json`. ⛔ The real MinIO/S3 deny-public run is still open: community MinIO binaries now return 410 Gone, so the run used moto over HTTP (`minio-storage.txt`). No production bucket is provisioned.
- ✅ **V29** secret management: every secret setting also reads `<VAR>_FILE` (Docker/K8s/secret-manager mounts). Production rejects placeholder secrets (`dev-only`, `change-me`, under 32 chars, JWT secret equal to the file-URL secret). A log redaction filter is installed and `scripts/ops/scan-bundles-for-secrets.mjs` checks the bundles. ⛔ The production secret store itself (Secrets Manager / Vault) is infrastructure. "KMS-managed secrets" means whatever that store provides.
- Field-level encryption for especially sensitive columns (payment credentials since V21; MFA secrets since V29). Database encryption at rest: ⛔ a property of the managed database / disk.
- ✅ **V29** backups with a restore drill: `scripts/ops/backup.sh` + `scripts/ops/restore-test.sh`. The measured database-step RTO is about 12 s for 41 MB. RPO is an assumption: ≤ 24 h with daily dumps (`docs/qa/v29/security/backup-restore.md`). ⛔ Scheduling, off-host copies and WAL/PITR are not set up yet.
- ✅ **V29** MFA for staff roles. SSO for university tenants has existed since V3 (OIDC); for SSO-enforced tenants the IdP owns MFA.
- ✅ **V29** retention engine (`services/retention.py`, `app/data/retention_policy.json`): dry run, enforcement through the worker, legal holds, account anonymisation for DELETE data requests. ⛔ **Every period is null (OWNER_COUNSEL_REQUIRED)** until counsel sets the schedule under PIPA. The engine skips null periods. The cross-border transfer consent flow wired to the actual processors is unchanged (V22).
- ✅ **V29** threat-model pass with automated checks (`docs/qa/v29/security/THREAT_MODEL.md`). ⛔ An external penetration test is still required.

## V29 production security (Phase E)

**Staff MFA (TOTP).** Applies to accounts with an active agency or university membership or a `HANGYUL_*` role. The rules (`services/mfa.py`, `api/v1/mfa.py`):

- **Password step.** A correct password for an enrolled staff account returns 401 `MFA_REQUIRED` with a 5-minute `mfa_pending` token. No access token or cookie exists until `POST /auth/mfa/verify` accepts a TOTP code or an unused recovery code.
- **Enrolment policy.** `HG_STAFF_MFA_REQUIRED` defaults to true in production. When it applies, an unenrolled staff login returns 403 `MFA_ENROLLMENT_REQUIRED` with an `mfa_enroll` token. That token is accepted only by `/auth/mfa/{status,enroll,activate}`. An unenrolled staff refresh token cannot be extended.
- **Secrets.** Generated server-side (160-bit) and sealed with AES-256-GCM under `HG_MFA_ENCRYPTION_KEY`.
- **Replay.** Each 30-s step is accepted once.
- **Recovery codes.** 10 codes, SHA-256-hashed and shown once.
- **Limits.** 5 attempts per user per 15 min and 30 per IP.
- **Reset and step-up.** Only a Hangyul super admin can reset a factor (`POST /hq/accounts/{id}/mfa/reset`). That call requires a step-up with `X-MFA-Code`, as do legal holds and account deletion.
- **Audit.** Every event is audited: `mfa.*`.
- **No SMS factor.**

**Upload → scan → review.** The flow (`core/scanning.py`):

- The upload is stored privately with status `PENDING`, then scanned.
- `CLEAN` makes it reviewable. `SKIPPED` happens only with the development no-op scanner.
- `INFECTED`: the bytes are deleted from storage and the version is kept as a blocked record. The document moves to `NEEDS_CORRECTION`. Every download path returns **410 `FILE_BLOCKED`**. The event is audited (`document.malware_blocked`) and raised as a `MALWARE_DETECTED` ops event.
- Scanner error: the version goes to `ERROR` and the document to `PROCESSING`. Downloads return **423 `FILE_SCAN_PENDING`** until the worker's `scan_retry` job gets a verdict.
- Message attachments follow the same rules.

**Monitoring.** `ops_events` records API 5xx, job failures, payment transport errors, verification-delivery failures, scan errors and detections, each written in its own transaction. The optional `HG_ALERT_WEBHOOK_URL` sends at most one alert per kind per `HG_ALERT_MIN_INTERVAL_SECONDS`. The payload is built from an allow-list and redacted, so it never carries document content, OTPs, card data or secrets. `GET /api/v1/hq/ops/health` is for Hangyul staff only. Logs are JSON lines in production (`HG_LOG_FORMAT`).

**CSP and `unsafe-inline` for styles.** `script-src` never allows inline script: the builds emit one external module script, and `check-csp.mjs` fails on any inline `<script>` or `on*=` handler. `style-src` keeps `'unsafe-inline'` because:

- the Toss Payments SDK and Cloudflare Turnstile inject `<style>` elements;
- the YNEX console theme sets style attributes in markup.

React `style={{…}}` (about 120 files) goes through CSSOM and is not affected. Removing `unsafe-inline` from styles would need nonces from a server-rendered `index.html`, which these static builds do not have. Before tightening the Toss directives (`*.tosspayments.com`), roll out once with `"report_only": true` in `infra/csp.json` and run the live Toss smoke test.

New settings: `HG_PUBLIC_ORIGIN`, `HG_STAFF_MFA_REQUIRED`, `HG_MFA_ENCRYPTION_KEY`, `HG_MFA_ISSUER`, `HG_MALWARE_SCANNER=clamd`, `HG_CLAMD_SOCKET`, `HG_CLAMD_HOST`, `HG_CLAMD_PORT`, `HG_CLAMD_TIMEOUT_SECONDS`, `HG_STORAGE_BACKEND=s3`, `HG_S3_BUCKET`, `HG_S3_ENDPOINT_URL`, `HG_S3_REGION`, `HG_S3_ACCESS_KEY_ID`, `HG_S3_SECRET_ACCESS_KEY`, `HG_S3_SSE`, `HG_S3_KMS_KEY_ID`, `HG_S3_KEY_PREFIX`, `HG_ALERT_WEBHOOK_URL`, `HG_ALERT_MIN_INTERVAL_SECONDS`, `HG_LOG_FORMAT`, `HG_WORKER_POLL_SECONDS` and `HG_RETENTION_POLICY_PATH`. Every secret setting can also be given as `<VAR>_FILE`.

## V9 additions

- **Sponsor links:** token = random, shown once, stored as SHA-256; scopes enforced in the serializer (payload tests assert no private field exists); expiry 30 days by default; revoked/expired/unknown all return the same 404; every view is recorded and audited; consent records on create and revoke.
- **Bulk by filter:** the filter-based bulk endpoints reuse the single-item permission checks per item; `expected_total` returns 409 if the matched set changed between preview and execute; hard cap 1,000; decision actions are not available (404).
- **Deactivation:** agency and university member deactivation is atomic with reassignment, audited, refuses self/last-admin and analyst targets.
- **Agency identity:** "registration" is never shown as verified unless a real value exists; seeded licence numbers do not count.
- **Document visibility:** `/me/dossier` returns who can see each document (consent-backed) and where it was sent.
- **Not done (dependencies, REPORT §64):** MFA for staff, CSP, malware scanning, S3 + encryption, retention job, penetration test. Rate limiting/lockout and sign-up CAPTCHA were closed by V22 (REPORT §263).
