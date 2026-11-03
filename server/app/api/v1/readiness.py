"""V8 production readiness — which integrations would work in production today (Hangyul staff only).

Statuses come only from real settings and from what the code actually implements. Nothing is reported ACTIVE because
a variable exists: an adapter that is "wired but not enabled" is NEEDS_AGREEMENT, a development stand-in (demo payments,
local disk, development secrets) is DEVELOPMENT_ONLY. Environment variable values are never returned — only names.

  ACTIVE           works now with the current configuration
  DEVELOPMENT_ONLY a stand-in that is fine for development but must be replaced before production
  NEEDS_AGREEMENT  configuration present, but no implemented adapter / provider contract — nothing is sent
  NOT_CONFIGURED   nothing configured; the feature is off or falls back (stated in `fallback`)
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.common import iso
from app.api.v1.hq_ops import require_hangyul
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import Principal
from app.models import Organization
from app.models.base import utcnow
from app.models.university_ops import OrgSSOConfig
from app.services import ai_provider, channels

router = APIRouter(tags=["v8", "admin"])

ACTIVE, DEV, NEEDS, NOT = "ACTIVE", "DEVELOPMENT_ONLY", "NEEDS_AGREEMENT", "NOT_CONFIGURED"
SEVERITY = {NOT: 0, NEEDS: 1, DEV: 2, ACTIVE: 3}
# Must be ACTIVE before real students use the product; the others are optional (they have a stated fallback).
REQUIRED = {"database", "secrets", "demo_signin", "file_storage", "malware_scan", "payments", "channel_in_app"}


def _item(key: str, group: str, status: str, *, requires: list[str] | None = None, setting: str | None = None, fallback: str | None = None,
          note: str | None = None) -> dict:
    return {"key": key, "group": group, "required": key in REQUIRED, "status": status, "requires": requires or [], "setting": setting, "fallback": fallback, "note": note}


def integrations(db: Session) -> list[dict]:
    s = get_settings()
    out: list[dict] = []

    # --- platform
    try:
        db.execute(text("select 1"))
        out.append(_item("database", "platform", ACTIVE, setting="HG_DATABASE_URL"))
    except Exception:  # noqa: BLE001 — reported, not raised
        out.append(_item("database", "platform", NOT, setting="HG_DATABASE_URL", note="Database not reachable."))
    dev_secrets = "dev-only" in s.jwt_secret or "dev-only" in s.file_url_secret
    out.append(_item("secrets", "platform", DEV if dev_secrets else ACTIVE, requires=["HG_JWT_SECRET", "HG_FILE_URL_SECRET"],
                     note="Development secrets are in use; production refuses to start with them." if dev_secrets else None))
    out.append(_item("demo_signin", "platform", DEV if s.demo_logins_enabled else ACTIVE, setting="HG_DEMO_LOGINS",
                     note="One-click demo sign-in is on (always off in production)." if s.demo_logins_enabled else None))

    # --- files
    if s.storage_backend == "s3":
        out.append(_item("file_storage", "files", NEEDS, setting="HG_STORAGE_BACKEND", requires=["HG_STORAGE_BACKEND=s3", "S3 credentials"],
                         note="S3 is selected but the S3 adapter is not implemented in this build; uploads would fail."))
    else:
        out.append(_item("file_storage", "files", DEV, setting="HG_STORAGE_BACKEND", requires=["HG_STORAGE_BACKEND=s3", "S3 credentials"],
                         fallback="Local disk on the API server."))
    out.append(_item("malware_scan", "files", NOT, setting="HG_MALWARE_SCANNER", requires=["ClamAV (clamd) or a cloud AV hook"],
                     fallback="Uploads are stored with scan status SKIPPED.",
                     note=f"HG_MALWARE_SCANNER={s.malware_scanner} — only the no-op scanner exists in this build." if s.malware_scanner != "noop" else None))

    # --- payments
    if s.payment_provider == "demo":
        out.append(_item("payments", "money", DEV, setting="HG_PAYMENT_PROVIDER", requires=["HG_PAYMENT_PROVIDER=stripe|toss", "provider secret key", "merchant agreement"],
                         fallback="Demo checkout approves immediately (refused in production)."))
    else:
        key = {"stripe": s.stripe_secret_key, "toss": s.toss_secret_key}.get(s.payment_provider)
        env = {"stripe": "HG_STRIPE_SECRET_KEY", "toss": "HG_TOSS_SECRET_KEY"}.get(s.payment_provider, "provider key")
        out.append(_item("payments", "money", NEEDS if key else NOT, setting="HG_PAYMENT_PROVIDER", requires=[env, "merchant agreement"],
                         note=f"{s.payment_provider}: checkout is wired but not enabled in this build — no payment can be taken."))

    # --- messaging
    for c in channels.statuses():
        out.append(_item(f"channel_{c['code'].lower()}", "messaging", c["status"], requires=c["requires"],
                         fallback=None if c["status"] == ACTIVE else "In-app messages."))
    out.append(_item("push", "messaging", ACTIVE if s.push_provider == "expo" else NOT, setting="HG_PUSH_PROVIDER", requires=["HG_PUSH_PROVIDER=expo"],
                     fallback=None if s.push_provider == "expo" else "In-app notifications only."))

    # --- sign-in
    sso = db.execute(select(OrgSSOConfig, Organization.name).join(Organization, Organization.id == OrgSSOConfig.organization_id)).all()
    if not sso:
        out.append(_item("sso", "signin", NOT, requires=["per-organization OIDC/SAML configuration"], fallback="Email and password."))
    for c, org in sso:
        secret = bool(c.client_secret_ref and os.environ.get(c.client_secret_ref))
        st = ACTIVE if c.enabled and secret else (NEEDS if c.enabled else NOT)
        out.append(_item("sso", "signin", st, requires=[c.client_secret_ref] if c.client_secret_ref else ["client secret reference"],
                         note=f"{org} · {c.protocol}" + ("" if secret else " · client secret not present")))

    # --- data providers
    ai = ai_provider.status()
    out.append(_item("ai_provider", "data", NEEDS if ai.requested != "none" else NOT, setting="HG_AI_PROVIDER",
                     fallback="Rule-based automatic checks (no model).", note=ai.note))
    flight = (os.environ.get("HG_FLIGHT_PROVIDER") or "none").strip().lower()
    out.append(_item("flight_data", "data", NEEDS if flight != "none" else NOT, setting="HG_FLIGHT_PROVIDER",
                     fallback="Flight times are entered manually.",
                     note=f"HG_FLIGHT_PROVIDER={flight} is not implemented in this build." if flight != "none" else None))
    return out


@router.get("/admin/readiness")
def readiness(p: Principal = Depends(require_hangyul), db: Session = Depends(get_db)):
    s = get_settings()
    items = integrations(db)
    items.sort(key=lambda i: (not i["required"], SEVERITY[i["status"]]))
    counts = {k: sum(1 for i in items if i["status"] == k) for k in (NOT, NEEDS, DEV, ACTIVE)}
    blocking = [i["key"] for i in items if i["required"] and i["status"] != ACTIVE]
    return {"generated_at": iso(utcnow()), "environment": s.env, "ready_for_production": not blocking, "blocking": blocking,
            "counts": counts, "items": items}
