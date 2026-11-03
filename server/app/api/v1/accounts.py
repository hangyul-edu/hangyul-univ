"""V22 account management — one permission per tenant, so this is a roster, not an IAM product (REPORT §246 A5, §247 U2/U5).

Agency: `GET /agency/team/accounts` (name · email · status · last login) and `POST /agency/team/invite`.
Hangyul: `GET /agency/hq/university-accounts`, `POST …/invite`, `POST …/{user_id}/disable|enable|reassign`.

An invitation creates the user with an unusable random password and e-mails a one-time code (purpose INVITE); the
person sets their own password through `POST /auth/reset-password`. No password is ever generated for a person.
"""
from __future__ import annotations

import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import iso, parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul
from app.core.security import hash_password
from app.models import Organization, OrganizationMember, University, User
from app.models.enums import OrgType, Role
from app.services import verification
from app.services.access import forbidden
from app.services.identity import IdentityError, normalize_email

agency_router = APIRouter(prefix="/agency/team", tags=["agency"])
hq_router = APIRouter(prefix="/agency/hq/university-accounts", tags=["hq"])


def _require_hangyul(p: Principal = Depends(require_agency_or_hangyul)) -> Principal:
    if not p.is_hangyul:
        raise forbidden()
    return p


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


class InviteIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    full_name: str = Field(min_length=1, max_length=200)
    locale: str = "ko"


def _account(m: OrganizationMember, u: User) -> dict:
    return {"user_id": str(u.id), "full_name": u.full_name, "email": u.email, "active": bool(m.is_active and u.is_active),
            "last_login_at": iso(u.last_login_at), "email_verified": u.email_verified_at is not None, "invited_at": iso(m.created_at),
            "role": "AGENCY_ADMIN" if m.organization.type == OrgType.AGENCY else "UNIVERSITY_ADMIN"}


def _invite(db: Session, request: Request, *, org: Organization, role: Role, body: InviteIn, actor: Principal) -> dict:
    try:
        email = normalize_email(body.email)
    except IdentityError as exc:
        raise HTTPException(400, {"code": exc.code, "message": str(exc)})
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, password_hash=hash_password(secrets.token_urlsafe(32)), full_name=body.full_name.strip(), locale=body.locale)
        db.add(user)
        db.flush()
    elif any(r.role == Role.STUDENT for r in user.roles):
        raise HTTPException(409, {"code": "EMAIL_IS_STUDENT", "message": "This email belongs to a student account."})
    member = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == org.id, OrganizationMember.user_id == user.id))
    if member is None:
        member = OrganizationMember(organization_id=org.id, user_id=user.id, role=role, title="Administrator", is_active=True)
        db.add(member)
        db.flush()
    else:
        member.role, member.is_active = role, True
    out = {"account": {**_account(member, user), "role": role.value}, "organization": {"id": str(org.id), "name": org.name}}
    try:
        ch = verification.issue(db, purpose="INVITE", target=email, locale=body.locale, ip=_ip(request), user_id=user.id)
        out["invite"] = {"challenge_id": ch["challenge_id"], "delivery": ch["delivery"], "expires_in": ch["expires_in"]}
    except HTTPException as exc:
        if exc.status_code != 502:
            raise
        out["invite"] = {"challenge_id": None, "delivery": "failed"}
    audit(db, action="accounts.invite", entity_type="organization_member", entity_id=member.id, actor=actor, subject_user_id=user.id,
          detail={"organization_id": str(org.id), "role": role.value})
    return out


# ------------------------------------------------------------------------------------------------- agency
@agency_router.get("/accounts")
def agency_accounts(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.is_agency:
        raise forbidden()
    rows = db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id)
                      .where(OrganizationMember.organization_id == p.org_id).order_by(User.full_name)).all()
    return {"organization": {"id": str(p.org_id), "name": p.active.org_name}, "role": "AGENCY_ADMIN", "accounts": [_account(m, u) for m, u in rows]}


@agency_router.post("/invite", status_code=201)
def agency_invite(body: InviteIn, request: Request, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.is_agency:
        raise forbidden()
    org = db.get(Organization, p.org_id)
    out = _invite(db, request, org=org, role=Role.AGENCY_ADMIN, body=body, actor=p)
    db.commit()
    return out


# ------------------------------------------------------------------------------------------------- Hangyul: university accounts
def _university_org(db: Session, university: University) -> Organization:
    org = db.scalar(select(Organization).where(Organization.type == OrgType.UNIVERSITY, Organization.university_id == university.id))
    if org is None:
        slug = re.sub(r"[^a-z0-9]+", "-", f"univ-{university.slug}".lower()).strip("-")[:120]
        org = Organization(type=OrgType.UNIVERSITY, name=university.name_en, slug=slug, university_id=university.id, country_code="KR")
        db.add(org)
        db.flush()
    return org


@hq_router.get("")
def university_accounts(p: Principal = Depends(_require_hangyul), db: Session = Depends(get_db)):
    rows = db.execute(
        select(OrganizationMember, User, Organization, University)
        .join(User, User.id == OrganizationMember.user_id)
        .join(Organization, Organization.id == OrganizationMember.organization_id)
        .outerjoin(University, University.id == Organization.university_id)
        .where(Organization.type == OrgType.UNIVERSITY)
        .order_by(Organization.name, User.full_name)
    ).all()
    return {"accounts": [{**_account(m, u), "organization": {"id": str(o.id), "name": o.name},
                          "university": {"id": str(uni.id), "slug": uni.slug, "name_en": uni.name_en, "name_ko": uni.name_ko} if uni else None}
                         for m, u, o, uni in rows]}


class UniversityInviteIn(InviteIn):
    university_id: str


@hq_router.post("/invite", status_code=201)
def university_invite(body: UniversityInviteIn, request: Request, p: Principal = Depends(_require_hangyul), db: Session = Depends(get_db)):
    uni = db.get(University, parse_uuid(body.university_id))
    if uni is None:
        raise HTTPException(404, "Unknown university")
    org = _university_org(db, uni)
    out = _invite(db, request, org=org, role=Role.UNIVERSITY_ADMIN, body=body, actor=p)
    out["university"] = {"id": str(uni.id), "slug": uni.slug, "name_en": uni.name_en}
    db.commit()
    return out


def _uni_member(db: Session, user_id: str) -> tuple[OrganizationMember, User, Organization]:
    # The active membership first: after a reassignment the user also has an inactive row at the old university.
    row = db.execute(select(OrganizationMember, User, Organization).join(User, User.id == OrganizationMember.user_id)
                     .join(Organization, Organization.id == OrganizationMember.organization_id)
                     .where(OrganizationMember.user_id == parse_uuid(user_id), Organization.type == OrgType.UNIVERSITY)
                     .order_by(OrganizationMember.is_active.desc(), OrganizationMember.updated_at.desc())).first()
    if row is None:
        raise HTTPException(404, "Not found")
    return row


@hq_router.post("/{user_id}/disable")
def university_disable(user_id: str, p: Principal = Depends(_require_hangyul), db: Session = Depends(get_db)):
    m, u, o = _uni_member(db, user_id)
    # Disable means "no university console at all": every university membership this person holds goes inactive.
    for other in db.scalars(select(OrganizationMember).join(Organization, Organization.id == OrganizationMember.organization_id)
                            .where(OrganizationMember.user_id == u.id, Organization.type == OrgType.UNIVERSITY)):
        other.is_active = False
    m.is_active = False
    audit(db, action="accounts.disable", entity_type="organization_member", entity_id=m.id, actor=p, subject_user_id=u.id, detail={"organization_id": str(o.id)})
    db.commit()
    return _account(m, u)


@hq_router.post("/{user_id}/enable")
def university_enable(user_id: str, p: Principal = Depends(_require_hangyul), db: Session = Depends(get_db)):
    m, u, o = _uni_member(db, user_id)
    m.is_active = True
    audit(db, action="accounts.enable", entity_type="organization_member", entity_id=m.id, actor=p, subject_user_id=u.id, detail={"organization_id": str(o.id)})
    db.commit()
    return _account(m, u)


class ReassignIn(BaseModel):
    university_id: str


@hq_router.post("/{user_id}/reassign")
def university_reassign(user_id: str, body: ReassignIn, p: Principal = Depends(_require_hangyul), db: Session = Depends(get_db)):
    """Move an administrator to another university: the old membership is deactivated, a new one created. Both audited."""
    m, u, old_org = _uni_member(db, user_id)
    uni = db.get(University, parse_uuid(body.university_id))
    if uni is None:
        raise HTTPException(404, "Unknown university")
    new_org = _university_org(db, uni)
    if new_org.id == old_org.id:
        return _account(m, u)
    m.is_active = False
    nm = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == new_org.id, OrganizationMember.user_id == u.id))
    if nm is None:
        nm = OrganizationMember(organization_id=new_org.id, user_id=u.id, role=Role.UNIVERSITY_ADMIN, title="Administrator", is_active=True)
        db.add(nm)
    else:
        nm.is_active, nm.role = True, Role.UNIVERSITY_ADMIN
    audit(db, action="accounts.reassign", entity_type="organization_member", entity_id=m.id, actor=p, subject_user_id=u.id,
          detail={"from_organization_id": str(old_org.id), "to_organization_id": str(new_org.id), "university_id": str(uni.id)})
    db.flush()
    db.commit()
    return {**_account(nm, u), "organization": {"id": str(new_org.id), "name": new_org.name}}


routers = (agency_router, hq_router)

