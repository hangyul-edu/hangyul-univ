"""Organisation single sign-on (OIDC now, SAML interface only). Issues the same session tokens as password sign-in.

Flow (web): the console calls ``GET /sso/lookup?email=`` → shows "Continue with your university account" →
``GET /sso/start`` (browser navigation, same origin through the /api proxy) → IdP → ``GET /sso/callback`` validates
state, nonce, PKCE and the ID token, maps the user to the organisation, sets the refresh cookie and redirects back to
the console, which restores the session with its normal ``/auth/refresh`` call.
"""
from __future__ import annotations

import os
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.auth import default_org_for_client, issue_tokens
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, get_principal
from app.core.security import hash_password
from app.core.sso import SSOError, pkce_pair, provider_for
from app.models import LoginEvent, Organization, OrganizationMember, OrgSSOConfig, SSOLoginState, User
from app.models.base import utcnow
from app.models.enums import OrgType, Role

router = APIRouter(prefix="/sso", tags=["sso"])
STATE_TTL = timedelta(minutes=10)
CONSOLE_FOR = {OrgType.UNIVERSITY: "university", OrgType.AGENCY: "agency"}


def callback_url(request: Request) -> str:
    """The redirect URI registered at the IdP. Production sets HG_SSO_CALLBACK_URL to the console's public
    ``https://<console>/api/v1/sso/callback`` so the refresh cookie lands on the console's own origin."""
    return os.environ.get("HG_SSO_CALLBACK_URL") or str(request.url_for("sso_callback"))


def _domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower().strip()


def config_for_email(db: Session, email: str) -> OrgSSOConfig | None:
    d = _domain(email)
    for c in db.scalars(select(OrgSSOConfig).where(OrgSSOConfig.enabled.is_(True))).all():
        if d in [x.lower() for x in (c.allowed_domains or [])]:
            return c
    return None


@router.get("/lookup")
def lookup(email: str = Query(min_length=3, max_length=320), db: Session = Depends(get_db)):
    """Does this email's organisation use SSO? Reveals only the organisation name and protocol."""
    c = config_for_email(db, email)
    if not c:
        return {"sso": False}
    org = db.get(Organization, c.organization_id)
    return {"sso": True, "protocol": c.protocol, "organization": org.name if org else None, "enforced": c.enforce,
            "available": c.protocol == "OIDC", "start_url": f"/api/v1/sso/start?config_id={c.id}"}


@router.get("/start")
def start(request: Request, config_id: str, client: str = "university", db: Session = Depends(get_db)):
    c = db.get(OrgSSOConfig, _uuid(config_id))
    if not c or not c.enabled:
        raise HTTPException(404, "Single sign-on is not set up for this organisation.")
    verifier, challenge = pkce_pair()
    state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    redirect_uri = callback_url(request)
    try:
        url = provider_for(c).authorization_url(redirect_uri=redirect_uri, state=state, nonce=nonce, code_challenge=challenge)
    except SSOError as exc:
        raise HTTPException(400, str(exc)) from exc
    db.add(SSOLoginState(config_id=c.id, state=state, nonce=nonce, code_verifier=verifier, client=client, redirect_uri=redirect_uri, created_at=utcnow()))
    db.commit()
    return RedirectResponse(url, status_code=302)


@router.get("/callback", name="sso_callback")
def callback(request: Request, response: Response, code: str | None = None, state: str | None = None, error: str | None = None,
             db: Session = Depends(get_db)):
    st = db.scalar(select(SSOLoginState).where(SSOLoginState.state == (state or "")))
    if not st or st.used_at is not None or utcnow() - st.created_at > STATE_TTL:
        raise HTTPException(400, "This sign-in link has expired. Please start again.")
    st.used_at = utcnow()
    c = db.get(OrgSSOConfig, st.config_id)
    if error or not code:
        st.error = error or "missing_code"
        db.commit()
        raise HTTPException(400, "Sign-in was cancelled or refused by your organisation.")
    try:
        ident = provider_for(c).complete(code=code, redirect_uri=st.redirect_uri, code_verifier=st.code_verifier, nonce=st.nonce)
    except SSOError as exc:
        st.error = str(exc)
        db.commit()
        raise HTTPException(401, str(exc)) from exc
    if _domain(ident.email) not in [d.lower() for d in (c.allowed_domains or [])] or not ident.email_verified:
        st.error = "domain_not_allowed"
        db.commit()
        raise HTTPException(403, "This account is not allowed to sign in to this organisation.")
    user = _jit_user(db, c, ident.email, ident.name)
    org_id = default_org_for_client(db, user, st.client, c.organization_id)
    user.last_login_at = utcnow()
    redirect = RedirectResponse("/?sso=1", status_code=302)
    issue_tokens(db, redirect, request, user, st.client, org_id)
    db.add(LoginEvent(user_id=user.id, email=user.email, success=True, reason="sso", client=st.client,
                      ip=request.client.host if request.client else None, user_agent=(request.headers.get("user-agent") or "")[:300], created_at=utcnow()))
    audit(db, action="auth.sso_login", entity_type="organization", entity_id=c.organization_id, subject_user_id=user.id, detail={"protocol": c.protocol})
    db.commit()
    return redirect


def _jit_user(db: Session, c: OrgSSOConfig, email: str, name: str | None) -> User:
    """Just-in-time provisioning: the IdP vouches for the email; membership comes from the organisation's config."""
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, full_name=name or email.split("@")[0], password_hash=hash_password(secrets.token_urlsafe(32)), is_demo=False)
        db.add(user)
        db.flush()
    if not user.is_active:
        raise HTTPException(403, "This account is disabled.")
    member = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == user.id, OrganizationMember.organization_id == c.organization_id))
    if member is None:
        db.add(OrganizationMember(organization_id=c.organization_id, user_id=user.id, role=Role(c.default_role), is_active=True))
        db.flush()
    elif not member.is_active:
        raise HTTPException(403, "Your access to this organisation has been removed.")
    return user


def _uuid(v: str):
    from app.api.common import parse_uuid

    return parse_uuid(v)


# ---------------------------------------------------------------- configuration (organisation admins, Hangyul super admins)


class SSOConfigIn(BaseModel):
    protocol: str = Field(pattern="^(OIDC|SAML)$")
    issuer: str = Field(min_length=8, max_length=500)
    client_id: str | None = Field(default=None, max_length=300)
    client_secret_ref: str | None = Field(default=None, max_length=120, pattern=r"^[A-Z][A-Z0-9_]*$")
    allowed_domains: list[str] = Field(min_length=1)
    default_role: str
    enabled: bool = False
    enforce: bool = False
    saml_metadata_url: str | None = Field(default=None, max_length=500)


def _can_manage(p: Principal) -> bool:
    return p.has(Role.UNIVERSITY_ADMIN, Role.AGENCY_ADMIN, Role.HANGYUL_SUPER_ADMIN)


def ser_config(c: OrgSSOConfig) -> dict:
    return {"id": str(c.id), "organization_id": str(c.organization_id), "protocol": c.protocol, "issuer": c.issuer, "client_id": c.client_id,
            "client_secret_ref": c.client_secret_ref, "client_secret_present": bool(c.client_secret_ref and os.environ.get(c.client_secret_ref)),
            "allowed_domains": c.allowed_domains, "default_role": c.default_role, "enabled": c.enabled, "enforce": c.enforce,
            "saml_metadata_url": c.saml_metadata_url}


@router.get("/config")
def get_config(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if not p.org_id or not _can_manage(p):
        raise HTTPException(403, "Only organisation administrators can view SSO settings.")
    c = db.scalar(select(OrgSSOConfig).where(OrgSSOConfig.organization_id == p.org_id))
    return ser_config(c) if c else None


@router.put("/config")
def put_config(body: SSOConfigIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if not p.org_id or not _can_manage(p):
        raise HTTPException(403, "Only organisation administrators can change SSO settings.")
    org = db.get(Organization, p.org_id)
    try:
        role = Role(body.default_role)
    except ValueError as exc:
        raise HTTPException(422, "Unknown role.") from exc
    allowed_prefix = {OrgType.UNIVERSITY: "UNIVERSITY_", OrgType.AGENCY: "AGENCY_", OrgType.HANGYUL: "HANGYUL_"}[org.type]
    # V22: a tenant has exactly one role, so SSO-provisioned members get it; only Hangyul's own org still chooses.
    if org.type == OrgType.AGENCY:
        role = Role.AGENCY_ADMIN
    elif org.type == OrgType.UNIVERSITY:
        role = Role.UNIVERSITY_ADMIN
    elif not role.value.startswith(allowed_prefix) or role == Role.HANGYUL_SUPER_ADMIN:
        raise HTTPException(422, "Choose a non-administrator role from your organisation for new SSO users.")
    c = db.scalar(select(OrgSSOConfig).where(OrgSSOConfig.organization_id == p.org_id)) or OrgSSOConfig(organization_id=p.org_id)
    for k, v in body.model_dump().items():
        setattr(c, k, [d.lower().strip() for d in v] if k == "allowed_domains" else (role.value if k == "default_role" else v))
    db.add(c)
    audit(db, action="sso.config_update", entity_type="organization", entity_id=p.org_id, actor=p, detail={"protocol": c.protocol, "enabled": c.enabled})
    db.commit()
    return ser_config(c)
