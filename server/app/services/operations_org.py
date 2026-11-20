"""The Hangyul Operations organisation — the one team that serves every student (V34, owner requirement / real-service check).

Historically an ``AGENCY`` organisation (see docs/ARCHITECTURE.md "Why the code says agency"); its members are
``AGENCY_ADMIN``. Resolution order:

1. the organisation with slug ``hangyul-operations`` (what ``python -m app.services.first_admin`` creates);
2. otherwise, when exactly one non-demo partner ``AGENCY`` organisation exists, that one (a database set up before V34).

Nothing else is guessed: with several candidate organisations and no canonical slug, ``None`` is returned and callers
fall back to their previous behaviour.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization
from app.models.enums import OrgType

OPERATIONS_SLUG = "hangyul-operations"
OPERATIONS_NAME = "Hangyul Univ Operations"


def operations_org(db: Session) -> Organization | None:
    org = db.scalar(select(Organization).where(Organization.slug == OPERATIONS_SLUG))
    if org is not None:
        return org
    rows = db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY, Organization.is_partner.is_(True),
                                                 Organization.is_demo.is_(False)).limit(2)).all()
    return rows[0] if len(rows) == 1 else None


def ensure_operations_org(db: Session) -> Organization:
    org = operations_org(db)
    if org is None:
        org = Organization(type=OrgType.AGENCY, name=OPERATIONS_NAME, slug=OPERATIONS_SLUG, country_code="KR", is_partner=True,
                           is_demo=False, languages=["ko", "en"], timezone="Asia/Seoul", sla_first_response_hours=24)
        db.add(org)
        db.flush()
    return org
