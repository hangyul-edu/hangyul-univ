"""V22 — one operational permission per tenant type (REPORT §246–247, §257–258).

Data migration only: `organization_members.role` is a VARCHAR, so the four agency roles and the three non-admin
university roles become `AGENCY_ADMIN` / `UNIVERSITY_ADMIN` **in place**, scoped by the organisation's type so a
Hangyul staff membership is never touched. Nothing is deleted; `audit_logs` keep whatever role name they recorded
at the time, which is the correct historical fact.

The downgrade cannot know which legacy title a row had — it restores every agency member to `AGENCY_COUNSELOR`
and every non-admin university member stays `UNIVERSITY_ADMIN`, and says so.

Revision ID: v22roles0001
Revises: v22identity0001
"""

from alembic import op

revision = "v22roles0001"
down_revision = "v22identity0001"
branch_labels = None
depends_on = None

AGENCY_LEGACY = ("AGENCY_OWNER", "AGENCY_MANAGER", "AGENCY_COUNSELOR", "AGENCY_DOCUMENT_REVIEWER")
UNIVERSITY_LEGACY = ("UNIVERSITY_ADMISSIONS", "UNIVERSITY_REVIEWER", "UNIVERSITY_ANALYST")


def upgrade() -> None:
    op.execute(
        "UPDATE organization_members m SET role = 'AGENCY_ADMIN' FROM organizations o "
        "WHERE o.id = m.organization_id AND o.type = 'AGENCY' AND m.role IN ('AGENCY_OWNER','AGENCY_MANAGER','AGENCY_COUNSELOR','AGENCY_DOCUMENT_REVIEWER')"
    )
    op.execute(
        "UPDATE organization_members m SET role = 'UNIVERSITY_ADMIN' FROM organizations o "
        "WHERE o.id = m.organization_id AND o.type = 'UNIVERSITY' AND m.role IN ('UNIVERSITY_ADMISSIONS','UNIVERSITY_REVIEWER','UNIVERSITY_ANALYST')"
    )
    # Global roles table never held tenant roles, but a defensive pass costs nothing.
    op.execute("UPDATE user_roles SET role = 'AGENCY_ADMIN' WHERE role IN ('AGENCY_OWNER','AGENCY_MANAGER','AGENCY_COUNSELOR','AGENCY_DOCUMENT_REVIEWER')")
    op.execute("UPDATE user_roles SET role = 'UNIVERSITY_ADMIN' WHERE role IN ('UNIVERSITY_ADMISSIONS','UNIVERSITY_REVIEWER','UNIVERSITY_ANALYST')")


def downgrade() -> None:
    op.execute(
        "UPDATE organization_members m SET role = 'AGENCY_COUNSELOR' FROM organizations o "
        "WHERE o.id = m.organization_id AND o.type = 'AGENCY' AND m.role = 'AGENCY_ADMIN'"
    )
