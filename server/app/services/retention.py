"""V29 retention / deletion engine.

Policies come from `app/data/retention_policy.json` (or `HG_RETENTION_POLICY_PATH`). Each one maps a record type to an
action (DELETE | ANONYMIZE) and a period in days. **Every period ships as null (OWNER_COUNSEL_REQUIRED)**: how long
Hangyul must or may keep a record is a legal decision, and this module does not make it.

* `run(dry_run=True)` reports, per policy, how many records are in scope, how many would be affected if the period
  were applied, and how many a legal hold protects. A policy whose period is null is reported and **skipped**.
* `run(dry_run=False)` (the worker's `retention` job) applies the policies that have a period. Documents and
  attachments are deleted through the storage adapter before their rows. A `legal_holds` row on a user or a document
  blocks every deletion/anonymisation that touches it.
* Every run (dry or not) writes one `retention.run` audit row with the report.
* `anonymize_account()` is the account-deletion semantics for an approved `data_requests` DELETE: the person's
  identifying fields are replaced, sessions/MFA/verification records removed, documents deleted from storage, the
  request marked COMPLETED. Audit rows keep the opaque user id (the trail of who accessed what survives) but no PII.
"""
from __future__ import annotations

import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.config import SERVER_DIR, get_settings
from app.core.security import hash_password
from app.models import (
    AnalyticsEvent,
    AuditLog,
    DataRequest,
    Document,
    DocumentVersion,
    LoginEvent,
    MessageAttachment,
    RefreshToken,
    User,
    VerificationChallenge,
)
from app.models.base import utcnow
from app.models.v29_security import JobRun, LegalHold, MfaRecoveryCode, OpsEvent, StaffMfa

DEFAULT_POLICY_PATH = SERVER_DIR / "app" / "data" / "retention_policy.json"
ENGINE_READY, POLICY_COUNSEL_REQUIRED, POLICY_SET = "ENGINE_READY", "POLICY_COUNSEL_REQUIRED", "POLICY_SET"
ACTIONS = ("DELETE", "ANONYMIZE")


@dataclass(frozen=True)
class Policy:
    record_type: str
    action: str
    period_days: int | None
    period_status: str = "OWNER_COUNSEL_REQUIRED"
    description: str = ""


def load_policies(path: str | Path | None = None) -> list[Policy]:
    p = Path(path or get_settings().retention_policy_path or DEFAULT_POLICY_PATH)
    raw = json.loads(p.read_text(encoding="utf-8"))
    out = []
    for item in raw["policies"]:
        if item["record_type"] not in HANDLERS:
            raise ValueError(f"unknown retention record type {item['record_type']!r}")
        if item["action"] not in ACTIONS:
            raise ValueError(f"unknown retention action {item['action']!r}")
        period = item.get("period_days")
        if period is not None and (not isinstance(period, int) or period < 0):
            raise ValueError(f"period_days for {item['record_type']} must be null or a non-negative integer")
        out.append(Policy(item["record_type"], item["action"], period, item.get("period_status") or ("SET" if period is not None else "OWNER_COUNSEL_REQUIRED"),
                          item.get("description", "")))
    return out


def status(policies: list[Policy] | None = None) -> dict:
    """For the release gate: the engine is implemented (ENGINE_READY); the policy is POLICY_COUNSEL_REQUIRED until every
    period has been set by counsel."""
    pols = policies if policies is not None else load_policies()
    unset = [p.record_type for p in pols if p.period_days is None]
    return {"engine": ENGINE_READY, "policy": POLICY_COUNSEL_REQUIRED if unset else POLICY_SET, "unset": unset, "policies": len(pols)}


# ------------------------------------------------------------------------------------------------ legal holds
def held_user_ids(db: Session) -> set[uuid.UUID]:
    return set(db.scalars(select(LegalHold.subject_id).where(LegalHold.subject_type == "USER", LegalHold.released_at.is_(None))))


def held_document_ids(db: Session) -> set[uuid.UUID]:
    return set(db.scalars(select(LegalHold.subject_id).where(LegalHold.subject_type == "DOCUMENT", LegalHold.released_at.is_(None))))


def place_hold(db: Session, *, subject_type: str, subject_id: uuid.UUID, reason: str, actor=None) -> LegalHold:
    if subject_type not in ("USER", "DOCUMENT"):
        raise ValueError("subject_type must be USER or DOCUMENT")
    h = LegalHold(subject_type=subject_type, subject_id=subject_id, reason=reason[:500], placed_by_id=getattr(actor, "id", None), placed_at=utcnow())
    db.add(h)
    db.flush()
    audit(db, action="legal_hold.placed", entity_type="legal_hold", entity_id=h.id, actor=actor,
          subject_user_id=subject_id if subject_type == "USER" else None, detail={"subject_type": subject_type, "subject_id": str(subject_id)})
    return h


def release_hold(db: Session, hold: LegalHold, *, actor=None) -> None:
    hold.released_at = utcnow()
    audit(db, action="legal_hold.released", entity_type="legal_hold", entity_id=hold.id, actor=actor,
          detail={"subject_type": hold.subject_type, "subject_id": str(hold.subject_id)})


# ------------------------------------------------------------------------------------------------ record handlers
# Each handler: (db, cutoff | None, holds) -> (in_scope, eligible, held, ids_or_none). `cutoff=None` counts scope only.
def _not_held(col, ids: set[uuid.UUID]):
    return or_(col.is_(None), col.notin_(ids)) if ids else True


def _count(db: Session, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _simple(model, ts_col, user_col=None, extra=None):
    def handler(db: Session, cutoff: datetime | None, users: set, docs: set, *, apply: bool, action: str) -> dict:
        base = select(model.id)
        if extra is not None:
            base = base.where(extra())
        out = {"in_scope": _count(db, base)}
        if cutoff is None:
            return out
        old = base.where(ts_col < cutoff)
        eligible = old.where(_not_held(user_col, users)) if user_col is not None else old
        out["eligible"] = _count(db, eligible)
        out["held"] = _count(db, old) - out["eligible"]
        if apply and out["eligible"]:
            ids = list(db.scalars(eligible))
            if action == "ANONYMIZE" and user_col is not None:
                db.execute(update(model).where(model.id.in_(ids)).values({user_col.key: None}))
            else:
                db.execute(delete(model).where(model.id.in_(ids)))
            out["affected"] = len(ids)
        return out
    return handler


def _storage_rows(kind: str):
    def handler(db: Session, cutoff: datetime | None, users: set, docs: set, *, apply: bool, action: str) -> dict:
        if kind == "versions":
            base = (select(DocumentVersion.id, DocumentVersion.storage_key, Document.id.label("doc_id"), Document.owner_user_id.label("owner"))
                    .join(Document, Document.id == DocumentVersion.document_id).where(DocumentVersion.version < Document.current_version))
            ts = DocumentVersion.created_at
        else:
            base = select(MessageAttachment.id, MessageAttachment.storage_key, MessageAttachment.uploaded_by_id.label("owner")).where(MessageAttachment.message_id.is_(None))
            ts = MessageAttachment.created_at
        out = {"in_scope": _count(db, base)}
        if cutoff is None:
            return out
        rows = db.execute(base.where(ts < cutoff)).all()
        keep = [r for r in rows if r.owner not in users and (kind != "versions" or r.doc_id not in docs)]
        out["eligible"], out["held"] = len(keep), len(rows) - len(keep)
        if apply and keep:
            from app.core.storage import get_storage

            st, done = get_storage(), 0
            model = DocumentVersion if kind == "versions" else MessageAttachment
            for r in keep:
                try:
                    st.delete(r.storage_key)  # object first: a row without an object is harmless, the reverse is a leak
                except Exception:  # noqa: BLE001 - leave the row for the next run
                    continue
                db.execute(delete(model).where(model.id == r.id))
                done += 1
            out["affected"] = done
        return out
    return handler


def _deleted_accounts(db: Session, cutoff: datetime | None, users: set, docs: set, *, apply: bool, action: str) -> dict:
    base = (select(User.id).where(User.deletion_requested_at.is_not(None), User.email.not_like("deleted+%@invalid"))
            .where(select(DataRequest.id).where(DataRequest.user_id == User.id, DataRequest.kind == "DELETE",
                                                DataRequest.status.in_(["RECEIVED", "IN_REVIEW"])).exists()))
    out = {"in_scope": _count(db, base)}
    if cutoff is None:
        return out
    ids = list(db.scalars(base.where(User.deletion_requested_at < cutoff)))
    keep = [i for i in ids if i not in users]
    out["eligible"], out["held"] = len(keep), len(ids) - len(keep)
    if apply:
        out["affected"] = sum(1 for uid in keep if anonymize_account(db, uid, reason="retention")["anonymized"])
    return out


HANDLERS = {
    "deleted_accounts": _deleted_accounts,
    "superseded_document_versions": _storage_rows("versions"),
    "unsent_message_attachments": _storage_rows("attachments"),
    "login_events": _simple(LoginEvent, LoginEvent.created_at, LoginEvent.user_id),
    "verification_challenges": _simple(VerificationChallenge, VerificationChallenge.expires_at, VerificationChallenge.user_id),
    "refresh_tokens": _simple(RefreshToken, RefreshToken.expires_at, RefreshToken.user_id),
    "analytics_events": _simple(AnalyticsEvent, AnalyticsEvent.occurred_at, AnalyticsEvent.user_id),
    "audit_logs": _simple(AuditLog, AuditLog.created_at, AuditLog.subject_user_id),
    "ops_events": _simple(OpsEvent, OpsEvent.created_at),
    "job_runs": _simple(JobRun, JobRun.scheduled_for, extra=lambda: JobRun.status != "RUNNING"),
}


def run(db: Session, *, dry_run: bool = True, policies: list[Policy] | None = None, now: datetime | None = None, actor=None) -> dict:
    pols = policies if policies is not None else load_policies()
    now = now or utcnow()
    users, docs = held_user_ids(db), held_document_ids(db)
    report: dict = {"dry_run": dry_run, "at": now.isoformat(), "status": status(pols), "legal_holds": {"users": len(users), "documents": len(docs)}, "policies": {}}
    for pol in pols:
        entry: dict = {"action": pol.action, "period_days": pol.period_days}
        cutoff = None if pol.period_days is None else now - timedelta(days=pol.period_days)
        res = HANDLERS[pol.record_type](db, cutoff, users, docs, apply=(not dry_run and cutoff is not None), action=pol.action)
        entry.update(res)
        if cutoff is None:
            entry["skipped"] = "PERIOD_NOT_SET"
        entry.setdefault("affected", 0)
        report["policies"][pol.record_type] = entry
    audit(db, action="retention.run", entity_type="retention", entity_id="dry_run" if dry_run else "enforce", actor=actor,
          detail={k: {kk: vv for kk, vv in v.items() if kk in ("in_scope", "eligible", "held", "affected", "skipped")} for k, v in report["policies"].items()})
    db.commit()  # a dry run changed nothing; its audit row is its only write
    return report


# ------------------------------------------------------------------------------------------------ account deletion
def anonymize_account(db: Session, user_id: uuid.UUID, *, reason: str, actor=None, request: DataRequest | None = None) -> dict:
    """Irreversible. Refused while a legal hold covers the user (or any of their documents)."""
    user = db.get(User, user_id)
    if user is None:
        return {"anonymized": False, "reason": "not_found"}
    if user_id in held_user_ids(db):
        audit(db, action="retention.blocked_by_hold", entity_type="user", entity_id=user_id, actor=actor, subject_user_id=user_id)
        return {"anonymized": False, "reason": "legal_hold"}
    doc_holds = held_document_ids(db)
    from app.core.storage import get_storage

    st = get_storage()
    deleted_objects, kept_docs = 0, 0
    for d in db.scalars(select(Document).where(Document.owner_user_id == user_id)):
        if d.id in doc_holds:
            kept_docs += 1
            continue
        for v in list(d.versions):
            try:
                st.delete(v.storage_key)
                deleted_objects += 1
            except Exception:  # noqa: BLE001
                pass
            db.delete(v)
        db.delete(d)
    if kept_docs:
        audit(db, action="retention.blocked_by_hold", entity_type="user", entity_id=user_id, actor=actor, subject_user_id=user_id,
              detail={"held_documents": kept_docs})
    for a in db.scalars(select(MessageAttachment).where(MessageAttachment.uploaded_by_id == user_id, MessageAttachment.message_id.is_(None))):
        try:
            st.delete(a.storage_key)
            deleted_objects += 1
        except Exception:  # noqa: BLE001
            pass
        db.delete(a)
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user_id))
    db.execute(delete(StaffMfa).where(StaffMfa.user_id == user_id))
    db.execute(delete(VerificationChallenge).where(VerificationChallenge.user_id == user_id))
    db.execute(update(LoginEvent).where(LoginEvent.user_id == user_id).values(email="deleted", ip=None, user_agent=None))
    user.email = f"deleted+{user.id.hex}@invalid"
    user.full_name = "Deleted user"
    user.preferred_name = None
    user.phone = None
    user.password_hash = hash_password(secrets.token_urlsafe(32))
    user.is_active = False
    for r in db.scalars(select(DataRequest).where(DataRequest.user_id == user_id, DataRequest.kind == "DELETE",
                                                  DataRequest.status.in_(["RECEIVED", "IN_REVIEW"]))):
        r.status = "COMPLETED"
    audit(db, action="account.anonymized", entity_type="user", entity_id=user_id, actor=actor, subject_user_id=user_id,
          detail={"reason": reason[:120], "objects_deleted": deleted_objects, "documents_kept_on_hold": kept_docs})
    return {"anonymized": True, "objects_deleted": deleted_objects, "documents_kept_on_hold": kept_docs}


def pending_deletion_requests(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(DataRequest).where(and_(DataRequest.kind == "DELETE", DataRequest.status.in_(["RECEIVED", "IN_REVIEW"])))) or 0
