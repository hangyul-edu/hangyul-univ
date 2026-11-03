"""Request principal: who is calling, in which tenant, with which role. Authorization is enforced server-side."""
import uuid
from dataclasses import dataclass, field

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_access_token
from app.models import Organization, OrganizationMember, User, UserRole
from app.models.enums import AGENCY_ROLES, HANGYUL_ROLES, UNIVERSITY_ROLES, OrgType, Role, canonical_role


@dataclass
class Membership:
    org_id: uuid.UUID
    org_type: OrgType
    org_name: str
    role: Role
    university_id: uuid.UUID | None


@dataclass
class Principal:
    user: User
    global_roles: set[Role]
    memberships: list[Membership]
    active: Membership | None = None
    client: str = "student"
    ip: str | None = None
    _cache: dict = field(default_factory=dict)

    @property
    def id(self) -> uuid.UUID:
        return self.user.id

    @property
    def role(self) -> Role | None:
        if self.active:
            return self.active.role
        return next(iter(sorted(self.global_roles)), None)

    @property
    def roles(self) -> set[Role]:
        r = set(self.global_roles)
        if self.active:
            r.add(self.active.role)
        return r

    @property
    def is_student(self) -> bool:
        return Role.STUDENT in self.global_roles and self.active is None

    @property
    def is_hangyul(self) -> bool:
        return bool(self.roles & HANGYUL_ROLES)

    @property
    def is_agency(self) -> bool:
        return self.active is not None and self.active.org_type == OrgType.AGENCY

    @property
    def is_agency_admin(self) -> bool:
        """V22: the one agency permission. Every active member of an AGENCY organisation holds it."""
        return self.is_agency

    @property
    def is_university(self) -> bool:
        return self.active is not None and self.active.org_type == OrgType.UNIVERSITY

    @property
    def is_university_admin(self) -> bool:
        """V22: the one university permission. Every active member of a UNIVERSITY organisation holds it."""
        return self.is_university

    @property
    def is_tenant_admin(self) -> bool:
        return self.is_agency or self.is_university

    @property
    def org_id(self) -> uuid.UUID | None:
        return self.active.org_id if self.active else None

    @property
    def university_id(self) -> uuid.UUID | None:
        return self.active.university_id if self.is_university else None

    def has(self, *roles: Role) -> bool:
        return bool(self.roles & set(roles))

    def require(self, *roles: Role) -> None:
        if not self.has(*roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action.")


def load_principal(db: Session, user: User, org_id: uuid.UUID | None, client: str) -> Principal:
    global_roles = {r.role for r in db.scalars(select(UserRole).where(UserRole.user_id == user.id))}
    rows = db.execute(
        select(OrganizationMember, Organization)
        .join(Organization, Organization.id == OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == user.id, OrganizationMember.is_active.is_(True))
    ).all()
    # V22: a membership row may still carry a legacy title; the principal only ever sees the canonical permission.
    memberships = [
        Membership(org.id, org.type, org.name, canonical_role(m.role), org.university_id) for m, org in rows
    ]
    active = None
    if org_id:
        active = next((m for m in memberships if m.org_id == org_id), None)
    return Principal(user=user, global_roles=global_roles, memberships=memberships, active=active, client=client)


def get_principal(
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        data = decode_access_token(authorization.split(" ", 1)[1])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired", headers={"WWW-Authenticate": "Bearer"})
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token", headers={"WWW-Authenticate": "Bearer"})
    user = db.get(User, uuid.UUID(data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    org_id = uuid.UUID(data["org"]) if data.get("org") else None
    p = load_principal(db, user, org_id, data.get("client", "student"))
    if org_id and p.active is None:
        # Membership was revoked after the token was issued.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Organization access revoked")
    p.ip = request.client.host if request.client else None
    return p


def require_student(p: Principal = Depends(get_principal)) -> Principal:
    if Role.STUDENT not in p.global_roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Student account required.")
    return p


def require_agency_or_hangyul(p: Principal = Depends(get_principal)) -> Principal:
    if not (p.is_agency or p.is_hangyul):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Agency console access required.")
    return p


def require_university(p: Principal = Depends(get_principal)) -> Principal:
    if not (p.is_university or p.is_hangyul):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "University console access required.")
    return p


def require_staff(p: Principal = Depends(get_principal)) -> Principal:
    if not (p.is_agency or p.is_university or p.is_hangyul):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff access required.")
    return p


CLIENT_ALLOWED_ROLES: dict[str, set[Role]] = {
    "student": {Role.STUDENT},
    "agency": AGENCY_ROLES | HANGYUL_ROLES,
    "university": UNIVERSITY_ROLES | HANGYUL_ROLES,
    "marketing": {Role.STUDENT},
}
