"""Display identity ≠ audit actor (V22, REPORT §246 A3, brief §32–35).

A student is served by **the Hangyul team**, not by whichever administrator happened to answer. Every message,
comment and review keeps its real `author_user_id` — the audit trail is untouched — but when the *viewer* is the
student, any staff author is presented as one team identity. Agency and Hangyul viewers keep seeing real names.
"""
from __future__ import annotations

from app.core.deps import Principal
from app.models import User
from app.models.enums import Role

TEAM_ID = "team"
TEAM_NAME_EN = "Hangyul Univ Team"
TEAM_NAME_KO = "한귤 유니브 상담팀"


def is_staff(user: User | None) -> bool:
    if user is None:
        return False
    return not any(r.role == Role.STUDENT for r in user.roles)


def author_for(viewer: Principal, author: User | None) -> dict | None:
    """Serialise a message/comment author for `viewer`."""
    if author is None:
        return None
    if viewer.is_student and is_staff(author):
        return {"id": TEAM_ID, "full_name": TEAM_NAME_EN, "kind": "team"}
    return {"id": str(author.id), "full_name": author.full_name, "kind": "staff" if is_staff(author) else "student"}


def team_identity() -> dict:
    return {"id": TEAM_ID, "full_name": TEAM_NAME_EN, "name_ko": TEAM_NAME_KO, "kind": "team"}
