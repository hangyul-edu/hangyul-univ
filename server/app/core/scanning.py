"""V29 upload → scan → review workflow for document versions and message attachments.

    upload ─► stored privately, scan_status=PENDING ─► scan
                 CLEAN / SKIPPED(dev)  → document NEEDS_REVIEW (reviewable, downloadable)
                 INFECTED              → bytes deleted from storage, version kept as a blocked record, document
                                         NEEDS_CORRECTION, audited + MALWARE_DETECTED ops event; never served
                 ERROR (scanner down)  → document PROCESSING; the worker's `scan_retry` job rescans it

Downloads go through `ensure_servable()`: INFECTED → 410 `FILE_BLOCKED`, PENDING/ERROR → 423 `FILE_SCAN_PENDING`.
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.storage import CLEAN, ERROR, INFECTED, PENDING, SERVABLE_SCAN_STATES, SKIPPED, get_storage, scan_bytes
from app.models import Document, DocumentVersion, MessageAttachment
from app.models.enums import DocumentStatus

BLOCKED_REASON = "This file failed the security scan and was removed. Upload a clean copy."


def ensure_servable(scan_status: str | None) -> None:
    if scan_status == INFECTED:
        raise HTTPException(410, {"code": "FILE_BLOCKED", "message": "This file failed the security scan and cannot be opened."})
    if scan_status not in SERVABLE_SCAN_STATES:
        raise HTTPException(423, {"code": "FILE_SCAN_PENDING", "message": "This file is still being checked. Try again in a few minutes."})


def _quarantine(db: Session, *, key: str, entity_type: str, entity_id, subject_user_id, signature: str | None, actor=None) -> None:
    try:
        get_storage().delete(key)
    except Exception:  # noqa: BLE001 - the version is blocked either way; a stale object is reported, not served
        from app.services import monitoring

        monitoring.record("STORAGE_ERROR", "scan.quarantine", "could not delete an infected object", detail={"entity": entity_type})
    audit(db, action="document.malware_blocked" if entity_type == "document" else "attachment.malware_blocked", entity_type=entity_type,
          entity_id=entity_id, actor=actor, subject_user_id=subject_user_id, detail={"signature": (signature or "unknown")[:120]})
    from app.services import monitoring

    monitoring.record("MALWARE_DETECTED", f"upload.{entity_type}", f"malware signature {(signature or 'unknown')[:80]} blocked",
                      detail={"entity": entity_type, "id": str(entity_id), "signature": (signature or "unknown")[:120]}, severity="warning")


def settle_document_version(db: Session, doc: Document, v: DocumentVersion, status: str, signature: str | None, *, actor=None,
                            from_upload: bool = False) -> None:
    v.scan_status = status
    is_current = doc.current_version == v.version
    if status in (CLEAN, SKIPPED):
        if is_current and (from_upload or doc.status == DocumentStatus.PROCESSING):
            doc.status = DocumentStatus.NEEDS_REVIEW
            doc.rejection_reason = None
    elif status == INFECTED:
        _quarantine(db, key=v.storage_key, entity_type="document", entity_id=doc.id, subject_user_id=doc.owner_user_id, signature=signature, actor=actor)
        if is_current:
            doc.status = DocumentStatus.NEEDS_CORRECTION
            doc.rejection_reason = BLOCKED_REASON
    else:  # ERROR / PENDING
        if is_current and from_upload:
            doc.status = DocumentStatus.PROCESSING
            doc.rejection_reason = None


def settle_attachment(db: Session, a: MessageAttachment, status: str, signature: str | None, *, actor=None, subject_user_id=None) -> None:
    a.scan_status = status
    if status == INFECTED:
        _quarantine(db, key=a.storage_key, entity_type="attachment", entity_id=a.id, subject_user_id=subject_user_id, signature=signature, actor=actor)


def rescan_pending(db: Session, *, limit: int = 100) -> dict:
    """Worker job: rescan PENDING/ERROR versions and attachments. Idempotent — a settled row is never rescanned."""
    counts = {CLEAN: 0, SKIPPED: 0, INFECTED: 0, ERROR: 0, "missing": 0}
    storage = get_storage()
    rows = db.execute(select(DocumentVersion, Document).join(Document, Document.id == DocumentVersion.document_id)
                      .where(DocumentVersion.scan_status.in_([PENDING, ERROR])).order_by(DocumentVersion.created_at).limit(limit)).all()
    for v, doc in rows:
        try:
            data = storage.get(v.storage_key)
        except Exception:  # noqa: BLE001
            counts["missing"] += 1
            continue
        status, sig = scan_bytes(data)
        settle_document_version(db, doc, v, status, sig)
        counts[status] = counts.get(status, 0) + 1
    for a in db.scalars(select(MessageAttachment).where(MessageAttachment.scan_status.in_([PENDING, ERROR])).limit(limit)):
        try:
            data = storage.get(a.storage_key)
        except Exception:  # noqa: BLE001
            counts["missing"] += 1
            continue
        status, sig = scan_bytes(data)
        settle_attachment(db, a, status, sig)
        counts[status] = counts.get(status, 0) + 1
    db.commit()
    return counts
