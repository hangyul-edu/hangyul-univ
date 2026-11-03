"""V29 staff MFA endpoints (see `app/services/mfa.py` for the policy).

    POST /auth/mfa/verify             mfa_pending token + TOTP or recovery code → the session the login withheld
    GET  /auth/mfa/status             access token or mfa_enroll token
    POST /auth/mfa/enroll             access token or mfa_enroll token → secret + otpauth:// URI (once)
    POST /auth/mfa/activate           first code → factor on, 10 recovery codes (once); with an enrol token, the session
    POST /auth/mfa/recovery-codes     current code → a fresh set of recovery codes
    POST /hq/accounts/{id}/mfa/reset  Hangyul super admin, step-up required
"""
import uuid

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, get_principal
from app.core.security import decode_access_token
from app.models import User
from app.models.enums import Role
from app.services import mfa

router = APIRouter(prefix="/auth/mfa", tags=["auth"])
hq_router = APIRouter(prefix="/hq/accounts", tags=["hq"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


class Actor:
    """Who is calling an MFA endpoint: a normal session, or a login that is waiting for enrolment."""

    def __init__(self, user: User, client: str, org_id: uuid.UUID | None, via_enrollment: bool):
        self.user, self.client, self.org_id, self.via_enrollment = user, client, org_id, via_enrollment


def mfa_actor(request: Request, db: Session = Depends(get_db), authorization: str | None = Header(default=None)) -> Actor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    raw = authorization.split(" ", 1)[1]
    try:
        decode_access_token(raw)
    except jwt.PyJWTError:
        data = mfa.decode_token(raw, mfa.TYP_ENROLL)
        user = db.get(User, uuid.UUID(data["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
        return Actor(user, data.get("client") or "agency", uuid.UUID(data["org"]) if data.get("org") else None, True)
    p = get_principal(request, db, authorization)
    return Actor(p.user, p.client, p.org_id, False)


class VerifyIn(BaseModel):
    mfa_token: str = Field(min_length=10, max_length=4096)
    client: str = "agency"
    code: str | None = Field(default=None, max_length=12)
    recovery_code: str | None = Field(default=None, max_length=32)


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=12)


def _session(db: Session, request: Request, response: Response, user: User, client: str, org_id) -> dict:
    from app.api.v1.auth import default_org_for_client, issue_tokens, session_payload  # local: auth imports this module

    # Membership is re-checked at the moment tokens are minted, not trusted from the challenge.
    org_id = default_org_for_client(db, user, client, org_id)
    tokens = issue_tokens(db, response, request, user, client, org_id)
    tokens.pop("_rt")
    return {**tokens, **session_payload(db, user, client, org_id)}


@router.post("/verify")
def verify(body: VerifyIn, request: Request, response: Response, db: Session = Depends(get_db)):
    data = mfa.decode_token(body.mfa_token, mfa.TYP_PENDING)
    if data.get("client") != body.client:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "MFA_TOKEN_EXPIRED", "message": "Sign in again."})
    user = db.get(User, uuid.UUID(data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "MFA_TOKEN_EXPIRED", "message": "Sign in again."})
    if not (body.code or body.recovery_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "MFA_CODE_INVALID", "message": "Enter a code."})
    mfa.check(db, user, code=body.code, recovery_code=body.recovery_code, ip=_ip(request), purpose="login")
    from app.models import LoginEvent
    from app.models.base import utcnow

    db.add(LoginEvent(user_id=user.id, email=user.email, success=True, reason="mfa_verified", client=body.client, ip=_ip(request),
                      user_agent=(request.headers.get("user-agent") or "")[:300], created_at=utcnow()))
    user.last_login_at = utcnow()
    out = _session(db, request, response, user, body.client, uuid.UUID(data["org"]) if data.get("org") else None)
    db.commit()
    return out


@router.get("/status")
def mfa_status(a: Actor = Depends(mfa_actor), db: Session = Depends(get_db)):
    return mfa.status_for(db, a.user)


@router.post("/enroll")
def enroll(request: Request, a: Actor = Depends(mfa_actor), db: Session = Depends(get_db)):
    return mfa.begin_enrollment(db, a.user, ip=_ip(request))


@router.post("/activate")
def activate(body: CodeIn, request: Request, response: Response, a: Actor = Depends(mfa_actor), db: Session = Depends(get_db)):
    codes = mfa.activate(db, a.user, body.code, ip=_ip(request))
    tokens = _session(db, request, response, a.user, a.client, a.org_id) if a.via_enrollment else None
    db.commit()
    return {"enabled": True, "recovery_codes": codes, "tokens": tokens}


@router.post("/recovery-codes")
def recovery_codes(body: CodeIn, request: Request, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    codes = mfa.regenerate_recovery_codes(db, p.user, body.code, ip=_ip(request))
    db.commit()
    return {"recovery_codes": codes}


class ResetIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


@hq_router.post("/{user_id}/mfa/reset")
def reset_mfa(user_id: uuid.UUID, body: ResetIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db),
              x_mfa_code: str | None = Header(default=None)):
    """Lost authenticator: a Hangyul **super admin** removes the factor; the user enrols again at next sign-in."""
    if not p.has(Role.HANGYUL_SUPER_ADMIN):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    mfa.step_up(db, p, x_mfa_code, action="mfa_reset")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if target.id == p.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "MFA_RESET_SELF", "message": "Another super admin must reset your factor."})
    had = mfa.reset(db, target.id, actor=p, reason=body.reason)
    db.commit()
    return {"reset": True, "had_factor": had}


@hq_router.get("/{user_id}/mfa")
def get_mfa(user_id: uuid.UUID, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    audit(db, action="mfa.status_viewed", entity_type="user", entity_id=target.id, actor=p, subject_user_id=target.id)
    db.commit()
    return mfa.status_for(db, target)
