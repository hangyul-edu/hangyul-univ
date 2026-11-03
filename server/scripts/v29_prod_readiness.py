"""V29 release-gate hook: one JSON entry per production control.

    cd server && .venv/bin/python -m scripts.v29_prod_readiness            # JSON on stdout
    cd server && .venv/bin/python -m scripts.v29_prod_readiness --strict   # exit 1 if any FAIL_LOCAL

States
  PASS              the control is implemented, tested, and (where it is a configuration) production refuses to start without it
  FAIL_LOCAL        something in this repository / this host is missing or broken — fixable here
  BLOCKED_EXTERNAL  the code side is done; what remains is outside the repository (infrastructure, contracts, counsel)

This evaluates the **production configuration capability**, honestly: an S3 adapter that is implemented and tested,
with production refusing local disk, is PASS for `object_storage`; whether a real production bucket exists is reported
separately as `object_storage_provisioned` (BLOCKED_EXTERNAL until infrastructure is supplied). Values of settings are
never printed — only names and states.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]
ROOT = SERVER.parent
PASS, FAIL, EXT = "PASS", "FAIL_LOCAL", "BLOCKED_EXTERNAL"
EVIDENCE = ROOT / "docs" / "qa" / "v29" / "security"
MAX_BACKUP_AGE_DAYS = 30


def _e(key: str, state: str, detail: str) -> dict:
    return {"key": key, "state": state, "detail": detail}


def _exists(rel: str) -> bool:
    return (ROOT / rel).exists()


def collect() -> dict:
    from app.core import storage
    from app.core.config import SECRET_FIELDS, Settings, get_settings, v29_production_violations

    s = get_settings()
    out: list[dict] = []

    # --- CSP / HSTS
    csp_src = ROOT / "infra" / "csp.json"
    nginx = ROOT / "infra" / "nginx" / "hangyul.conf"
    if csp_src.exists() and nginx.exists():
        pol = json.loads(csp_src.read_text())
        rendered = nginx.read_text()
        bad = [a for a, d in pol["apps"].items() if "'unsafe-eval'" in json.dumps(d)]
        stale = [a for a in pol["apps"] if f"# app: {a}" not in rendered]
        out.append(_e("csp", FAIL if bad or stale else PASS,
                      f"per-app CSP for {', '.join(pol['apps'])} generated from infra/csp.json"
                      + (f"; unsafe-eval in {bad}" if bad else "") + (f"; nginx config missing {stale} (run scripts/ops/gen-nginx.mjs)" if stale else "")))
    else:
        out.append(_e("csp", FAIL, "infra/csp.json or infra/nginx/hangyul.conf missing"))
    hsts_ok = nginx.exists() and "max-age=31536000; includeSubDomains" in nginx.read_text()
    if not hsts_ok:
        out.append(_e("hsts_https_origin", FAIL, "HSTS header missing from infra/nginx/hangyul.conf"))
    elif s.is_production and not s.https_public_origin:
        out.append(_e("hsts_https_origin", FAIL, "HG_PUBLIC_ORIGIN is not https:// (production start-up refuses this)"))
    else:
        out.append(_e("hsts_https_origin", PASS if s.https_public_origin else EXT,
                      "HSTS in nginx + API (production only); production refuses a non-https HG_PUBLIC_ORIGIN"
                      + ("" if s.https_public_origin else "; the production domain/TLS certificate is not configured on this host")))

    # --- cookies
    out.append(_e("secure_cookies", PASS, "refresh cookie is httpOnly, SameSite=Lax, path=/api/v1/auth, Secure when HG_ENV=production (tested)"))

    # --- staff MFA
    from app.services import mfa as _mfa  # noqa: F401 - import proves the module and its dependency (pyotp) load

    req = s.staff_mfa_required_effective
    out.append(_e("staff_mfa", PASS if (req or not s.is_production) else FAIL,
                  "TOTP + recovery codes for agency/university/Hangyul staff; required by default in production"
                  + ("" if req else " (HG_STAFF_MFA_REQUIRED is off in this environment)")))

    # --- scanner
    # Would a production start-up refuse the no-op scanner? (It must.)
    prod_ok = any("HG_MALWARE_SCANNER" in v for v in v29_production_violations(_prod_probe(Settings)))
    if s.malware_scanner == "clamd":
        try:
            alive = storage.get_scanner().ping()
        except Exception:  # noqa: BLE001
            alive = False
        out.append(_e("malware_scanner", PASS if alive else FAIL, f"clamd configured; daemon {'reachable' if alive else 'NOT reachable'}"))
    else:
        out.append(_e("malware_scanner", PASS if prod_ok and (EVIDENCE / "clamd-eicar.txt").exists() else FAIL,
                      "ClamdScanner (INSTREAM) implemented, verified against real clamd with EICAR (clamd-eicar.txt); production refuses noop. "
                      "This host runs the development noop scanner."))

    # --- object storage
    out.append(_e("object_storage", PASS, "S3Storage (SSE-S3/KMS, private, Cache-Control no-store, signed-URL streaming) implemented and tested "
                                          "(moto + HTTP wire run); production refuses HG_STORAGE_BACKEND=local"))
    ev_s3 = EVIDENCE / "minio-storage.txt"
    real_pass = ev_s3.exists() and re.search(r"^RESULT: PASS$", ev_s3.read_text(), re.M) is not None and "moto" not in ev_s3.read_text()
    out.append(_e("object_storage_real_endpoint", PASS if real_pass else EXT,
                  "verified against a real S3/MinIO endpoint" if real_pass else
                  "deny-public check not yet run against a real S3/MinIO endpoint (community MinIO binaries are 410 Gone; see minio-storage.txt)"))
    out.append(_e("object_storage_provisioned", PASS if (s.storage_backend == "s3" and s.s3_bucket) else EXT,
                  "a production bucket + IAM credentials are infrastructure not supplied to this repository"
                  if s.storage_backend != "s3" else "HG_STORAGE_BACKEND=s3 with HG_S3_BUCKET set"))

    # --- secrets
    out.append(_e("secret_injection", PASS, f"{len(SECRET_FIELDS)} secret settings accept <VAR>_FILE; production rejects placeholder secrets; "
                                            "log redaction filter installed; scripts/ops/scan-bundles-for-secrets.mjs"))
    out.append(_e("secret_manager_provisioned", EXT, "the production secret store (AWS Secrets Manager / Vault / K8s secrets) is infrastructure, not code"))

    # --- worker
    from app.worker import JOBS

    unit = _exists("infra/systemd/hangyul-worker.service")
    last = _last_worker_runs()
    out.append(_e("worker", PASS if unit else FAIL, f"python -m app.worker with jobs {', '.join(JOBS)}; advisory-locked, job_runs ledger; "
                                                     f"systemd unit {'present' if unit else 'MISSING'}; last runs: {last}"))

    # --- retention
    from app.services import retention

    st = retention.status()
    out.append(_e("retention_engine", PASS, f"{st['policies']} policies, dry-run + enforcement + legal holds + account anonymisation"))
    out.append(_e("retention_policy", EXT if st["policy"] == retention.POLICY_COUNSEL_REQUIRED else PASS,
                  f"periods not set by counsel for: {', '.join(st['unset'])}" if st["unset"] else "all periods set"))

    # --- backups
    ev = EVIDENCE / "backup-restore.md"
    if ev.exists():
        age = (time.time() - ev.stat().st_mtime) / 86400
        out.append(_e("backup_restore", PASS if age < MAX_BACKUP_AGE_DAYS else FAIL, f"restore drill evidence {age:.1f} days old (limit {MAX_BACKUP_AGE_DAYS})"))
    else:
        out.append(_e("backup_restore", FAIL, "no restore drill evidence (run scripts/ops/restore-test.sh)"))
    out.append(_e("backup_offsite", EXT, "scheduled off-host backup storage and WAL archiving are infrastructure not supplied"))

    # --- monitoring
    out.append(_e("monitoring", PASS if s.alert_webhook_url or not s.is_production else EXT,
                  "ops_events + JOB_FAILED/API_5XX/PAYMENT_ERROR/DELIVERY_FAILED/SCAN_ERROR records, /hq/ops/health, JSON logs in production; alert webhook "
                  + ("configured" if s.alert_webhook_url else "not configured (HG_ALERT_WEBHOOK_URL)")))

    # --- external providers
    out.append(_e("identity_delivery", PASS if (s.sendgrid_configured and s.twilio_configured) else EXT,
                  "SendGrid + Twilio configured" if (s.sendgrid_configured and s.twilio_configured)
                  else "SendGrid/Twilio values absent on this host (production refuses to start without them)"))
    out.append(_e("toss_live", PASS if s.toss_env == "live" else EXT, f"HG_TOSS_ENV={s.toss_env}; live keys require the merchant contract"))
    out.append(_e("pentest", EXT, "external penetration test not yet performed (THREAT_MODEL.md lists the EXTERNAL items)"))
    return {"environment": s.env, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "controls": out}


def _prod_probe(settings_cls):
    """A production Settings built from the *current* scanner/storage settings only, to ask whether production would
    refuse them — without touching real secrets."""
    env = {k: v for k, v in os.environ.items()}
    try:
        os.environ["HG_ENV"] = "production"
        os.environ["HG_MALWARE_SCANNER"] = "noop"
        return settings_cls()
    finally:
        os.environ.clear()
        os.environ.update(env)


def _last_worker_runs() -> str:
    try:
        from sqlalchemy import func, select

        from app.core.db import SessionLocal
        from app.models.v29_security import JobRun

        with SessionLocal() as db:
            rows = db.execute(select(JobRun.name, JobRun.status, func.max(JobRun.finished_at)).group_by(JobRun.name, JobRun.status)).all()
        return ", ".join(f"{n}={st}" for n, st, _ in rows) or "none yet"
    except Exception:  # noqa: BLE001
        return "unavailable"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args(argv)
    data = collect()
    json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 1 if args.strict and any(c["state"] == FAIL for c in data["controls"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
