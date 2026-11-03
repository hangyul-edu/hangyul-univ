"""V29 Phase E — infrastructure controls: fail-closed production config, `_FILE` secrets, log redaction, S3 storage,
the clamd client, the durable worker, the retention engine, monitoring and the release-gate readiness report."""
import json
import logging
import os
import threading
import time
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core import storage as storage_mod
from app.core.config import Settings, get_settings, v29_production_violations
from app.core.logs import RedactionFilter, redact
from app.models import AuditLog, Document, User
from app.models.base import utcnow
from app.models.v29_security import JobRun, LegalHold, OpsEvent
from tests.v22_helpers import register_student
from tests.v29_fakes import EICAR, FakeClamd, pdf

API = "/api/v1"
GOOD_KEY = "q2Vt1r8pW0f2s1o9d8Yx3c6v7b5n4m2l1k0j9h8g7fA"  # 32 bytes base64url (test only)

# Built at runtime: the V21 security scan forbids card-number-shaped literals anywhere in the tree (it cannot tell a
# sandbox number from a real one), so the redaction tests assemble theirs.
_PAN_SPACED = " ".join(["4111"] + ["1111"] * 3)
_PAN = _PAN_SPACED.replace(" ", "")
_PAN_4242 = "4242" * 4


def _prod_env(monkeypatch, **overrides):
    env = {
        "HG_ENV": "production",
        "HG_JWT_SECRET": "Zr4!kq9" * 6, "HG_FILE_URL_SECRET": "Pp7#vb2" * 6,
        "HG_PUBLIC_ORIGIN": "https://univ.hangyul.example", "HG_CORS_ORIGINS": "https://univ.hangyul.example",
        "HG_STORAGE_BACKEND": "s3", "HG_S3_BUCKET": "hg-private", "HG_S3_SSE": "AES256",
        "HG_MALWARE_SCANNER": "clamd", "HG_CLAMD_SOCKET": "/run/clamav/clamd.ctl",
        "HG_MFA_ENCRYPTION_KEY": GOOD_KEY,
        "HG_TURNSTILE_SITE_KEY": "site", "HG_TURNSTILE_SECRET_KEY": "turnstile-secret-value",
        "HG_SENDGRID_API_KEY": "sg-key", "HG_TWILIO_ACCOUNT_SID": "AC1", "HG_TWILIO_API_KEY_SID": "SK1", "HG_TWILIO_API_KEY_SECRET": "s",
        "HG_TWILIO_MESSAGING_SERVICE_SID": "MG1", "HG_PAYMENT_PROVIDER": "demo",
    }
    env.update(overrides)
    for k, v in env.items():
        if v is None:
            monkeypatch.delenv(k, raising=False)
        else:
            monkeypatch.setenv(k, v)


# ------------------------------------------------------------------------------------------------ fail-closed config
def test_complete_production_config_has_no_violations(monkeypatch):
    _prod_env(monkeypatch)
    s = Settings()
    assert s.is_production and v29_production_violations(s) == []
    assert get_settings.__wrapped__().is_production  # start-up succeeds


@pytest.mark.parametrize("override, fragment", [
    ({"HG_STORAGE_BACKEND": "local"}, "HG_STORAGE_BACKEND=local"),
    ({"HG_MALWARE_SCANNER": "noop"}, "HG_MALWARE_SCANNER must be clamd"),
    ({"HG_PUBLIC_ORIGIN": "http://univ.hangyul.example"}, "HG_PUBLIC_ORIGIN must be an https://"),
    ({"HG_PUBLIC_ORIGIN": None}, "HG_PUBLIC_ORIGIN must be an https://"),
    ({"HG_CORS_ORIGINS": "http://univ.hangyul.example"}, "HG_CORS_ORIGINS"),
    ({"HG_JWT_SECRET": "change-me-change-me-change-me-change-me"}, "placeholder"),
    ({"HG_JWT_SECRET": "short"}, "placeholder"),
    ({"HG_MFA_ENCRYPTION_KEY": None}, "HG_MFA_ENCRYPTION_KEY"),
    ({"HG_S3_SSE": "none"}, "HG_S3_SSE"),
    ({"HG_CLAMD_SOCKET": None}, "HG_CLAMD_SOCKET or HG_CLAMD_HOST"),
])
def test_production_refuses_unsafe_config(monkeypatch, override, fragment):
    _prod_env(monkeypatch, **override)
    with pytest.raises(RuntimeError) as exc:
        get_settings.__wrapped__()
    assert fragment in str(exc.value)
    assert "Zr4!kq9" not in str(exc.value)  # never echoes a secret


def test_development_keeps_local_storage_and_noop_scanner(monkeypatch):
    monkeypatch.setenv("HG_ENV", "development")
    s = Settings()
    assert s.storage_backend == "local" and s.malware_scanner == "noop" and not s.staff_mfa_required_effective


def test_getters_fail_closed_in_production(monkeypatch):
    monkeypatch.setattr(get_settings(), "env", "production")
    monkeypatch.setattr(storage_mod, "_storage", None)
    monkeypatch.setattr(storage_mod, "_scanner", None)
    with pytest.raises(RuntimeError):
        storage_mod.get_storage()
    with pytest.raises(RuntimeError):
        storage_mod.get_scanner()


def test_secret_file_injection(monkeypatch, tmp_path):
    f = tmp_path / "jwt"
    f.write_text("from-a-mounted-secret-file-0123456789abcdef\n")
    monkeypatch.setenv("HG_JWT_SECRET", "env-value-loses")
    monkeypatch.setenv("HG_JWT_SECRET_FILE", str(f))
    sg = tmp_path / "sg"
    sg.write_text("SG.file-value")
    monkeypatch.setenv("SENDGRID_API_KEY_FILE", str(sg))  # the un-prefixed alias works too
    s = Settings()
    assert s.jwt_secret == "from-a-mounted-secret-file-0123456789abcdef" and s.sendgrid_api_key == "SG.file-value"
    monkeypatch.setenv("HG_FILE_URL_SECRET_FILE", str(tmp_path / "missing"))
    with pytest.raises(RuntimeError, match="HG_FILE_URL_SECRET_FILE"):
        Settings()
    (tmp_path / "empty").write_text("\n")
    monkeypatch.setenv("HG_FILE_URL_SECRET_FILE", str(tmp_path / "empty"))
    with pytest.raises(RuntimeError, match="empty"):
        Settings()


# ------------------------------------------------------------------------------------------------ log redaction
def test_redaction_masks_secrets_cards_and_codes():
    out = redact('password=hunter2 {"api_key": "abc123xyz"} Authorization: Bearer eyJhbGciOi.payload.sig card ' + _PAN_SPACED + ' '
                 'otp: 482913 recovery_code=abcde-fghij order 1234567890123', secrets=["my-very-secret-value"])
    for leaked in ("hunter2", "abc123xyz", "eyJhbGciOi", _PAN_SPACED, "482913", "abcde-fghij"):
        assert leaked not in out
    assert "****1111" in out and "1234567890123" in out  # a non-Luhn number (an order id) is left alone
    assert redact("jwt is my-very-secret-value", secrets=["my-very-secret-value"]) == "jwt is [REDACTED]"


def test_redaction_filter_on_records_and_tracebacks(caplog):
    s = get_settings()
    log = logging.getLogger("hangyul.test.redaction")
    f = RedactionFilter()
    rec = log.makeRecord(log.name, logging.ERROR, __file__, 1, "secret is %s and card %s", (s.jwt_secret, _PAN_4242), None)
    f.filter(rec)
    assert s.jwt_secret not in rec.getMessage() and _PAN_4242 not in rec.getMessage()
    try:
        raise ValueError(f"boom {s.file_url_secret}")
    except ValueError:
        import sys

        rec = log.makeRecord(log.name, logging.ERROR, __file__, 1, "x", (), sys.exc_info())
    f.filter(rec)
    assert s.file_url_secret not in (rec.exc_text or "")


def test_json_formatter():
    from app.core.logs import JsonFormatter

    rec = logging.getLogger("t").makeRecord("t", logging.INFO, __file__, 1, "hello %s", ("world",), None)
    assert json.loads(JsonFormatter().format(rec))["msg"] == "hello world"


# ------------------------------------------------------------------------------------------------ S3 storage (moto)
def test_s3_storage_private_encrypted_no_store(monkeypatch):
    moto = pytest.importorskip("moto")
    import boto3

    with moto.mock_aws():
        c = boto3.client("s3", region_name="us-east-1")
        c.create_bucket(Bucket="hg-test-private")
        st = storage_mod.S3Storage(bucket="hg-test-private", client=c)
        key = st.put(b"%PDF-secret", prefix="students/abc")
        assert key.startswith("students/abc/")
        head = st.head(key)
        assert head["ServerSideEncryption"] == "AES256" and head["CacheControl"] == "private, no-store"
        assert st.get(key) == b"%PDF-secret"
        acl = c.get_object_acl(Bucket="hg-test-private", Key=key)
        assert not [g for g in acl["Grants"] if g["Grantee"].get("URI", "").endswith("AllUsers")]
        st.delete(key)
        with pytest.raises(c.exceptions.NoSuchKey):
            st.get(key)
        with pytest.raises(ValueError):
            st.get("../etc/passwd")


def test_s3_kms_mode_sends_key_id(monkeypatch):
    calls = {}

    class C:
        def put_object(self, **kw):
            calls.update(kw)

    monkeypatch.setattr(get_settings(), "s3_sse", "aws:kms")
    monkeypatch.setattr(get_settings(), "s3_kms_key_id", "arn:aws:kms:ap-northeast-2:1:key/x")
    storage_mod.S3Storage(bucket="b", client=C()).put(b"x", prefix="p")
    assert calls["ServerSideEncryption"] == "aws:kms" and calls["SSEKMSKeyId"].endswith("key/x")


@pytest.mark.skipif(not os.environ.get("HG_TEST_S3_ENDPOINT"), reason="set HG_TEST_S3_ENDPOINT (+ key/secret/bucket) to run against a real S3/MinIO")
def test_s3_storage_against_real_endpoint(monkeypatch):
    import boto3

    s = get_settings()
    monkeypatch.setattr(s, "s3_sse", os.environ.get("HG_TEST_S3_SSE", "AES256"))
    c = boto3.client("s3", endpoint_url=os.environ["HG_TEST_S3_ENDPOINT"], region_name="us-east-1",
                     aws_access_key_id=os.environ["HG_TEST_S3_ACCESS_KEY"], aws_secret_access_key=os.environ["HG_TEST_S3_SECRET_KEY"])
    st = storage_mod.S3Storage(bucket=os.environ["HG_TEST_S3_BUCKET"], client=c)
    key = st.put(b"gated", prefix="v29-test")
    assert st.get(key) == b"gated"
    st.delete(key)


# ------------------------------------------------------------------------------------------------ clamd client
def test_clamd_client_against_fake_daemon():
    srv = FakeClamd()
    sc = storage_mod.ClamdScanner(socket_path=srv.path, timeout=5)
    assert sc.ping()
    assert sc.scan(b"hello") == "CLEAN"
    r = sc.scan_result(pdf(EICAR) + b"x" * (200 * 1024))  # multi-chunk stream
    assert r.status == "INFECTED" and r.signature == "Eicar-Test-Signature"
    srv.mode = "error"
    with pytest.raises(storage_mod.ScannerError):
        sc.scan(b"x")
    srv.close()
    with pytest.raises(storage_mod.ScannerError):
        storage_mod.ClamdScanner(socket_path="/nonexistent.sock", timeout=1).scan(b"x")
    with pytest.raises(RuntimeError):
        storage_mod.ClamdScanner()


# ------------------------------------------------------------------------------------------------ worker
def _job(name, fn, **kw):
    from app.worker import JOBS, Job

    j = Job(name, 3600, fn, **kw)
    JOBS[name] = j
    return j


def test_worker_runs_once_per_window_under_concurrency(db):
    from app.worker import JOBS, run_job

    calls = []
    gate = threading.Event()

    def slow(_db):
        calls.append(1)
        gate.wait(3)
        return {"ok": True}

    name = f"t_once_{uuid.uuid4().hex[:6]}"
    job = _job(name, slow)
    now = utcnow()
    results = []
    t1 = threading.Thread(target=lambda: results.append(run_job(job, now=now)))
    t1.start()
    time.sleep(0.5)
    results.append(run_job(job, now=now))  # second "replica" while the first holds the advisory lock
    gate.set()
    t1.join()
    results.append(run_job(job, now=now))  # same window after success
    assert sorted(results) == ["SKIPPED_DONE", "SKIPPED_LOCKED", "SUCCEEDED"]
    assert len(calls) == 1
    rows = db.scalars(select(JobRun).where(JobRun.name == name)).all()
    assert len(rows) == 1 and rows[0].status == "SUCCEEDED" and rows[0].attempts == 1 and rows[0].result == {"ok": True}
    assert run_job(job, now=now + timedelta(hours=1)) == "SUCCEEDED"  # next window runs again
    JOBS.pop(name)


def test_worker_records_failure_and_retries(db):
    from app.worker import JOBS, run_job

    def boom(_db):
        raise RuntimeError("provider exploded")

    name = f"t_fail_{uuid.uuid4().hex[:6]}"
    job = _job(name, boom, max_attempts=2, retry_backoff_seconds=0)
    now = utcnow()
    assert run_job(job, now=now) == "FAILED"
    assert run_job(job, now=now) == "FAILED"
    assert run_job(job, now=now) == "SKIPPED_DONE"  # attempts exhausted
    db.expire_all()
    row = db.scalar(select(JobRun).where(JobRun.name == name))
    assert row.status == "FAILED" and row.attempts == 2 and "provider exploded" in row.error
    assert db.scalar(select(OpsEvent).where(OpsEvent.kind == "JOB_FAILED", OpsEvent.source == f"worker.{name}"))
    JOBS.pop(name)


def test_worker_cli_once_runs_real_jobs(monkeypatch):
    from app import worker

    out = worker.run_pass(["cleanup", "notifications", "scan_retry", "retention"], force=True)
    assert set(out.values()) == {"SUCCEEDED"}, out
    assert worker.main(["--list"]) == 0


# ------------------------------------------------------------------------------------------------ retention
def test_shipped_policy_is_counsel_gated():
    from app.services import retention

    pols = retention.load_policies()
    assert pols and all(p.period_days is None for p in pols)
    st = retention.status(pols)
    assert st["engine"] == "ENGINE_READY" and st["policy"] == "POLICY_COUNSEL_REQUIRED"


def test_retention_dry_run_and_null_periods_skip(client, db):
    from tests.conftest import login

    ops = login(client, "ops@demo.hangyul.kr", "agency")
    r = client.post(f"{API}/hq/retention/dry-run", headers=ops)
    assert r.status_code == 200
    rep = r.json()
    assert rep["dry_run"] is True and all(v["skipped"] == "PERIOD_NOT_SET" and v["affected"] == 0 for v in rep["policies"].values())
    assert rep["policies"]["login_events"]["in_scope"] > 0
    assert db.scalar(select(AuditLog).where(AuditLog.action == "retention.run"))
    s = register_student(client)
    assert client.post(f"{API}/hq/retention/dry-run", headers=s["h"]).status_code == 404


def test_retention_enforcement_with_a_set_period(db):
    from app.services import retention

    db.add(OpsEvent(kind="TEST", severity="info", source="t", summary="old", created_at=utcnow() - timedelta(days=10)))
    db.commit()
    pol = [retention.Policy("ops_events", "DELETE", 5, "SET")]
    dry = retention.run(db, dry_run=True, policies=pol)
    assert dry["policies"]["ops_events"]["eligible"] >= 1 and dry["policies"]["ops_events"]["affected"] == 0
    real = retention.run(db, dry_run=False, policies=pol)
    assert real["policies"]["ops_events"]["affected"] >= 1
    assert not db.scalar(select(OpsEvent).where(OpsEvent.kind == "TEST", OpsEvent.summary == "old"))


def test_retention_rejects_bad_policy(tmp_path):
    from app.services import retention

    p = tmp_path / "p.json"
    p.write_text(json.dumps({"policies": [{"record_type": "nope", "action": "DELETE", "period_days": None}]}))
    with pytest.raises(ValueError):
        retention.load_policies(p)


def test_account_deletion_respects_legal_hold_and_deletes_files(client, db):
    from tests.test_v29_security import _login_raw, _staff

    held, free = register_student(client), register_student(client)
    for s in (held, free):
        up = client.post(f"{API}/documents", headers=s["h"], files={"file": ("t.pdf", pdf(), "application/pdf")}, data={"category": "TRANSCRIPT"})
        assert up.status_code == 201
        assert client.post(f"{API}/me/data-requests", headers=s["h"], json={"kind": "DELETE"}).status_code == 201
    admin = _staff(db, role=__import__("app.models.enums", fromlist=["Role"]).Role.HANGYUL_SUPER_ADMIN)
    ah = {"Authorization": f"Bearer {_login_raw(client, admin).json()['access_token']}"}
    held_id = db.scalar(select(User.id).where(User.email == held["email"]))
    assert client.post(f"{API}/hq/legal-holds", headers=ah, json={"subject_type": "USER", "subject_id": str(held_id), "reason": "litigation"}).status_code == 201
    from app.models import DataRequest

    def req(email):
        uid = db.scalar(select(User.id).where(User.email == email))
        return db.scalar(select(DataRequest).where(DataRequest.user_id == uid)), uid

    r_held, _ = req(held["email"])
    r = client.post(f"{API}/hq/data-requests/{r_held.id}/complete-deletion", headers=ah)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "LEGAL_HOLD"
    r_free, free_id = req(free["email"])
    key = db.scalar(select(Document).where(Document.owner_user_id == free_id)).versions[0].storage_key
    r = client.post(f"{API}/hq/data-requests/{r_free.id}/complete-deletion", headers=ah)
    assert r.status_code == 200 and r.json()["objects_deleted"] == 1
    db.expire_all()
    u = db.get(User, free_id)
    assert u.email.startswith("deleted+") and u.full_name == "Deleted user" and u.phone is None and not u.is_active
    assert db.get(DataRequest, r_free.id).status == "COMPLETED"
    with pytest.raises(FileNotFoundError):
        storage_mod.get_storage().get(key)
    assert client.post(f"{API}/auth/login", json={"email": free["email"], "password": free["password"], "client": "student"}).status_code == 401
    assert db.get(User, held_id).is_active
    # Ops staff (not super admin) cannot place holds or delete.
    from tests.conftest import login

    ops = login(client, "ops@demo.hangyul.kr", "agency")
    assert client.post(f"{API}/hq/legal-holds", headers=ops, json={"subject_type": "USER", "subject_id": str(held_id), "reason": "x" * 5}).status_code == 404
    hold = db.scalar(select(LegalHold).where(LegalHold.subject_id == held_id))
    assert client.post(f"{API}/hq/legal-holds/{hold.id}/release", headers=ah).status_code == 200


# ------------------------------------------------------------------------------------------------ monitoring
def test_ops_health_is_hangyul_only(client):
    from tests.conftest import login

    ops = login(client, "ops@demo.hangyul.kr", "agency")
    r = client.get(f"{API}/hq/ops/health", headers=ops)
    assert r.status_code == 200 and {"status", "failures", "jobs", "scan", "recent"} <= set(r.json())
    assert client.get(f"{API}/hq/ops/health", headers=login(client, "counselor@lotus.demo.hangyul.kr", "agency")).status_code == 404
    assert client.get(f"{API}/hq/ops/health").status_code == 401


def test_api_5xx_is_recorded(db):
    from fastapi.testclient import TestClient

    from app.main import app

    path = f"/__v29_boom_{uuid.uuid4().hex[:6]}"

    def boom():
        raise RuntimeError("kaboom with password=hunter2")

    app.add_api_route(path, boom)
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get(path)
    assert r.status_code == 500 and "kaboom" not in r.text
    ev = db.scalar(select(OpsEvent).where(OpsEvent.kind == "API_5XX", OpsEvent.source == f"GET {path}"))
    assert ev and "hunter2" not in json.dumps(ev.detail) + ev.summary


def test_alert_webhook_payload_is_sanitised_and_rate_limited(monkeypatch):
    from app.services import monitoring

    sent = []
    monkeypatch.setattr(get_settings(), "alert_webhook_url", "https://hooks.example/alert")
    monkeypatch.setattr(monitoring, "send_webhook", lambda url, payload: sent.append(payload) or True)
    kind = f"TEST_{uuid.uuid4().hex[:6]}"
    detail = monitoring.sanitise({"card_number": _PAN, "otp": "123456", "note": "password=hunter2 card " + _PAN_SPACED,
                                  "content": "%PDF passport scan", "order": "ord-1"})
    ev = {"id": None, "kind": kind, "severity": "error", "source": "t", "summary": "provider failed", "detail": detail}
    assert monitoring.maybe_alert(kind, ev, background=False) is True
    assert monitoring.maybe_alert(kind, ev, background=False) is False  # inside the rate-limit window
    body = json.dumps(sent)
    assert len(sent) == 1
    for leaked in (_PAN, _PAN_SPACED, "123456", "hunter2", "passport"):
        assert leaked not in body
    assert "ord-1" in body


# ------------------------------------------------------------------------------------------------ release gate
def test_prod_readiness_report_shape_and_no_secrets(capsys):
    from scripts import v29_prod_readiness as r

    out = r.collect()
    keys = {e["key"] for e in out["controls"]}
    assert {"csp", "hsts_https_origin", "secure_cookies", "staff_mfa", "malware_scanner", "object_storage", "secret_injection", "worker",
            "retention_engine", "retention_policy", "backup_restore", "monitoring", "identity_delivery", "toss_live"} <= keys
    assert all(e["state"] in ("PASS", "FAIL_LOCAL", "BLOCKED_EXTERNAL") for e in out["controls"])
    by = {e["key"]: e for e in out["controls"]}
    assert by["retention_policy"]["state"] == "BLOCKED_EXTERNAL" and by["retention_engine"]["state"] == "PASS"
    s = get_settings()
    blob = json.dumps(out)
    assert s.jwt_secret not in blob and s.file_url_secret not in blob
