"""V9 university workstream demo data (idempotent; also applied to the live dev DB by scripts/v9_university_data.py).

* Match snapshots: the rules engine's own output (services/matching.compute_matches — the same call as
  POST /student/matches/snapshot) for every demo student profile, persisted for Pusan National's programs only. They feed
  the program-rule impact preview ("currently matching prospective students"). Nothing is invented: tiers come from the
  engine and the students' profiles as seeded.
* Reviewer hand-over: Pusan National's faculty reviewer holds the two oldest open applications awaiting a decision, so a
  reviewer leaving (team → deactivate → reassign) is demonstrable. Only when that reviewer holds nothing yet.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, MatchSnapshot, Organization, OrganizationMember, Program, StudentProfile, University, User
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S

UNI = "pusan-national-university"


def apply(db: Session) -> dict:
    from app.api.v1.student import compute_matches
    from app.services.matching import ENGINE_VERSION

    uid = db.scalar(select(University.id).where(University.slug == UNI))
    if not uid:
        return {"snapshots": 0, "assigned": 0}
    programs = set(db.scalars(select(Program.id).where(Program.university_id == uid)).all())
    have = set(db.execute(select(MatchSnapshot.user_id, MatchSnapshot.program_id).where(MatchSnapshot.program_id.in_(programs))).all())
    now = utcnow()
    added = 0
    for prof in db.scalars(select(StudentProfile).where(StudentProfile.is_demo.is_(True))).all():
        if not prof.nationality:
            continue
        for m in compute_matches(db, prof, now.date()):
            pid = uuid.UUID(m["program_id"])
            if pid not in programs or (prof.user_id, pid) in have:
                continue
            db.add(MatchSnapshot(user_id=prof.user_id, program_id=pid, engine_version=ENGINE_VERSION, eligible=m["eligible"], tier=m["tier"],
                                 score=m["score"], reasons=m["reasons"], created_at=now))
            added += 1
    org = db.scalar(select(Organization.id).where(Organization.university_id == uid))
    reviewer = db.scalar(select(OrganizationMember.user_id).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org, User.email.like("reviewer@%"),
                                                                 OrganizationMember.is_active.is_(True)))
    assigned = 0
    if reviewer and not db.scalar(select(Application.id).where(Application.university_id == uid, Application.university_reviewer_id == reviewer)):
        for a in db.scalars(select(Application).where(Application.university_id == uid, Application.university_reviewer_id.is_(None),
                                                      Application.status.in_([S.SUBMITTED, S.UNIVERSITY_REVIEW, S.INTERVIEW, S.WAITLISTED]))
                            .order_by(Application.submitted_at).limit(2)).all():
            a.university_reviewer_id = reviewer
            assigned += 1
    db.flush()
    return {"snapshots": added, "assigned": assigned}


def seed(db: Session, ctx: dict[str, Any]) -> None:
    # Objects created earlier in this seed session may still hold plain strings for enum columns; reload them first.
    db.flush()
    db.expire_all()
    apply(db)
