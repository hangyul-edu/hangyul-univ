# V29 threat model: threats, controls, tests

Scope: the FastAPI API, the four static web apps (marketing, student, agency, university), the worker, Postgres, Redis and object storage. The assets are passports, transcripts, family and financial documents, payment records, and staff access across tenants.

Tests are in `server/tests/test_v29_security.py` (S), `server/tests/test_v29_infra.py` (I) and the older `server/tests/test_security.py` (T). **EXTERNAL** means the control cannot be verified on this host. It needs a penetration test, production infrastructure or a third party.

| # | Threat | Control | Verified by |
|---|---|---|---|
| 1 | Agency A reads agency B's student | `services/access.py` scopes every query to ACTIVE assignments. Out-of-tenant records return 404. | S `test_other_agency_student_is_404`; T `test_agency_cannot_see_other_agency_students` |
| 2 | IDOR on documents (read / download / edit another student's file) | `_get_doc` runs a permission check on every route and returns 404. | S `test_document_idor_is_404` |
| 3 | IDOR on orders and add-ons (`POST /me/add-ons/{id}`, `/me/orders/{id}/cancel`) | Owner check under `SELECT … FOR UPDATE`; returns 404. | S `test_add_on_and_order_idor_is_404` |
| 4 | University sees documents that were not shared with it | `university_visible_document_ids` | T (university scoping tests) |
| 5 | Signed file URL is tampered with, replayed after expiry, or used by someone else | HMAC-SHA256 over key \| user \| exp \| disposition; 5-min TTL | S `test_signed_url_tamper_and_expiry` |
| 6 | Stolen refresh token is replayed | Refresh tokens rotate; reusing one outside the 20-s grace window revokes the whole family and is audited. | S `test_refresh_token_reuse_revokes_family`; T |
| 7 | OTP brute force (10⁶ codes) | 5 attempts per challenge, per-target and per-IP Redis limits, 5-min TTL | S `test_otp_brute_force_cannot_succeed` |
| 8 | Credential stuffing / password guessing | Progressive throttle, CAPTCHA escalation, per-IP ceiling (V22) | `test_v22_registration.py` limiter tests |
| 9 | Double charge from a retried confirm | Toss `Idempotency-Key` derived from the order id | S `test_payment_idempotency_key_is_derived_from_the_order` |
| 10 | Staff account takeover with a phished password | TOTP step-up. A correct password alone yields no token: 401 `MFA_REQUIRED` plus a 5-min challenge token. | S `test_mfa_login_step_up_and_bypass_attempts` |
| 11 | MFA bypass: challenge token used as an access token, wrong client, tampered token, missing code, demo-login path | `typ` claim checked; the client is bound to the challenge; `demo-login` runs the same gate | S `test_mfa_login_step_up_and_bypass_attempts` |
| 12 | TOTP replay / shoulder surfing | `last_used_step`: each 30-s step is accepted once | S (replay assertion) |
| 13 | TOTP brute force | 5 attempts per user per 15 min, 30 per IP; Redis limiter | S `test_mfa_verify_is_rate_limited` |
| 14 | Lost authenticator becomes a permanent lockout or a weak recovery path | 10 hashed one-time recovery codes, shown once. Reset only by a Hangyul **super admin**, with step-up, and audited. | S `test_mfa_reset_requires_super_admin_and_step_up` |
| 15 | Staff without MFA in production | `HG_STAFF_MFA_REQUIRED` (default on in production) gives 403 plus an enrol-only token that reads nothing. Refresh of an unenrolled staff session is refused. | S `test_mfa_required_gives_enrol_only_token` |
| 16 | TOTP secrets leak from a DB dump | AES-256-GCM under `HG_MFA_ENCRYPTION_KEY`, AAD bound to the user id; production requires the key | S (ciphertext assertion); I `test_production_refuses_unsafe_config` |
| 17 | Malicious upload (exe/html disguised, oversize, truncated, path traversal) | Magic-byte sniffing, 15 MB limit, truncation check, filename sanitising | S `test_upload_abuse_is_refused` |
| 18 | Malware is stored and later downloaded by staff | clamd INSTREAM scan. INFECTED: bytes deleted, version blocked, 410 on every path, audited, ops event. Scanner error: PENDING/ERROR (423) until the worker rescans. | S `test_infected_file_is_blocked_and_never_downloadable`, `test_scanner_error_stays_pending_until_worker_rescan`, `test_scanner_unreachable_records_error`; real clamd: `clamd-eicar.txt` |
| 19 | Production boots with the no-op scanner, local disk, dev secrets, HTTP origin | `config.v29_production_violations` refuses start-up; `get_storage`/`get_scanner` refuse too | I `test_production_refuses_unsafe_config`, `test_getters_fail_closed_in_production` |
| 20 | Public object URLs / bucket made public | No object URL is ever issued (server streams through the signed route); objects are written private with SSE and `no-store`. Bucket policy and Block Public Access live in `scripts/ops/s3-bucket-policy.json`. | I `test_s3_storage_private_encrypted_no_store`. Real deny-public check: **EXTERNAL** (MinIO binaries 410; see `minio-storage.txt`). |
| 21 | Cross-origin requests from an attacker site | CORS allow-list; credentials only for listed origins | S `test_cors_allow_list` |
| 22 | XSS → token theft | CSP per app with no `unsafe-eval` and no inline script (`scripts/ops/check-csp.mjs`). Access token held in memory only; refresh cookie is httpOnly. | `node scripts/ops/check-csp.mjs`; actual browser enforcement: **EXTERNAL (pentest)** |
| 23 | Clickjacking | `frame-ancestors 'none'` (apps + API), `X-Frame-Options: DENY` | S `test_security_headers_only_in_production_over_https` |
| 24 | TLS stripping | HTTP→HTTPS redirect and HSTS (1 y, includeSubDomains) in nginx; API HSTS in production. Production requires an https `HG_PUBLIC_ORIGIN`. | S (headers test), I (config test); real TLS configuration: **EXTERNAL** |
| 25 | Session cookie sent over HTTP | `Secure` cookie in production | S `test_secure_cookie_in_production` |
| 26 | Secrets in a checked-in `.env` / image | `<VAR>_FILE` injection for every secret; production rejects placeholder values | I `test_secret_file_injection` |
| 27 | Secrets, OTPs or card numbers in logs or alerts | Redaction filter on every handler; alert payloads built from an allow-list | I `test_redaction_*`, `test_alert_webhook_payload_is_sanitised_and_rate_limited`, `test_api_5xx_is_recorded` |
| 28 | Server secrets in browser bundles | `scripts/ops/scan-bundles-for-secrets.mjs` (names, patterns, actual `.env` values) | script run (passed on the current dist/) |
| 29 | Silent job failure (reminders stop, scans never retried) | `job_runs` ledger, JOB_FAILED ops event plus webhook, `/hq/ops/health` | I `test_worker_records_failure_and_retries`, `test_ops_health_is_hangyul_only` |
| 30 | Duplicate job execution across replicas | Postgres advisory lock plus unique (job, window) | I `test_worker_runs_once_per_window_under_concurrency` |
| 31 | Over-retention / deletion of held data | Retention engine; null periods are skipped; legal hold blocks deletion; every run audited | I `test_retention_*`, `test_account_deletion_respects_legal_hold_and_deletes_files` |
| 32 | Data loss / ransomware | `backup.sh` plus restore drill (RTO measured). Off-host copies and PITR: **EXTERNAL** | `backup-restore.md` |
| 33 | Insider at Hangyul browsing student data | Every document access, review and export is audited (V3+); MFA for staff | T audit tests; misuse detection over audit data: **EXTERNAL (process)** |
| 34 | SSRF / injection / deserialisation in the API | Parameterised SQLAlchemy; no user-supplied URLs fetched by the API | **EXTERNAL (pentest)** |
| 35 | Business-logic abuse of payments and refunds (amount tampering, state races) | Server-side amounts, provider confirm, row locks (V16–V21 tests) | existing payment tests; **EXTERNAL (pentest)** |
| 36 | Dependency vulnerabilities | Pinned dependencies | `pip-audit` / `npm audit` in CI: **EXTERNAL** (no CI on this host) |
| 37 | SSO tenants' MFA | The IdP enforces MFA for OIDC-enforced tenants; Hangyul MFA applies to password sign-ins | **EXTERNAL** (IdP configuration) |
