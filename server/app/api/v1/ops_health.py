"""V29 HQ operations: `GET /hq/ops/health` (failures, worker jobs, scan backlog), retention status/dry-run, legal holds and
execution of DELETE data requests. Hangyul staff only; the writes need a super admin and an MFA step-up."""
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import Principal, get_principal
from app.models import DataRequest
from app.models.enums import Role
from app.models.v29_security import LegalHold
from app.services import mfa, monitoring, retention

router = APIRouter(tags=["hq"])


@router.get("/hq/ops/health")
def ops_health(hours: int = Query(24, ge=1, le=24 * 30), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(404, "Not found")
    return monitoring.health_summary(db, hours=hours)


# ------------------------------------------------------------------------------------------------ V29 retention


def _hangyul(p: Principal) -> None:
    if not p.is_hangyul:
        raise HTTPException(404, "Not found")


def _super(p: Principal) -> None:
    if not p.has(Role.HANGYUL_SUPER_ADMIN):
        raise HTTPException(404, "Not found")


@router.get("/hq/retention/status")
def retention_status(p: Principal = Depends(get_principal)):
    _hangyul(p)
    return retention.status()


@router.post("/hq/retention/dry-run")
def retention_dry_run(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _hangyul(p)
    return retention.run(db, dry_run=True, actor=p)


class HoldIn(BaseModel):
    subject_type: str = Field(pattern="^(USER|DOCUMENT)$")
    subject_id: uuid.UUID
    reason: str = Field(min_length=3, max_length=500)


@router.post("/hq/legal-holds", status_code=201)
def place_hold(body: HoldIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db), x_mfa_code: str | None = Header(default=None)):
    _super(p)
    mfa.step_up(db, p, x_mfa_code, action="legal_hold")
    h = retention.place_hold(db, subject_type=body.subject_type, subject_id=body.subject_id, reason=body.reason, actor=p)
    db.commit()
    return {"id": str(h.id), "subject_type": h.subject_type, "subject_id": str(h.subject_id)}


@router.post("/hq/legal-holds/{hold_id}/release")
def release_hold(hold_id: uuid.UUID, p: Principal = Depends(get_principal), db: Session = Depends(get_db), x_mfa_code: str | None = Header(default=None)):
    _super(p)
    mfa.step_up(db, p, x_mfa_code, action="legal_hold_release")
    h = db.get(LegalHold, hold_id)
    if h is None or h.released_at is not None:
        raise HTTPException(404, "Not found")
    retention.release_hold(db, h, actor=p)
    db.commit()
    return {"released": True}


@router.post("/hq/data-requests/{request_id}/complete-deletion")
def complete_deletion(request_id: uuid.UUID, p: Principal = Depends(get_principal), db: Session = Depends(get_db), x_mfa_code: str | None = Header(default=None)):
    """Carry out an approved DELETE data request now (anonymise the account, delete its files). Refused under a legal hold."""
    _super(p)
    mfa.step_up(db, p, x_mfa_code, action="account_deletion")
    r = db.get(DataRequest, request_id)
    if r is None or r.kind != "DELETE" or r.status not in ("RECEIVED", "IN_REVIEW"):
        raise HTTPException(404, "Not found")
    out = retention.anonymize_account(db, r.user_id, reason="data_request", actor=p, request=r)
    if not out["anonymized"]:
        db.commit()
        raise HTTPException(409, {"code": "LEGAL_HOLD" if out.get("reason") == "legal_hold" else "NOT_DELETABLE", "message": "This account cannot be deleted now."})
    db.commit()
    return out
