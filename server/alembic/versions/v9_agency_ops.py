"""v9 agency: team member expertise/availability/capacity, agency load weights + legal identity, assignment sub-agent,
template language groups, meeting records (REPORT §59 A4, A5, A8, A12)

Revision ID: v9a1agencyops
Revises: v9s1sponsor01
Create Date: 2026-10-10

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "v9a1agencyops"
down_revision: Union[str, Sequence[str], None] = "v9s1sponsor01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("organization_members") as b:
        b.add_column(sa.Column("countries", sa.JSON(), nullable=True))
        b.add_column(sa.Column("university_ids", sa.JSON(), nullable=True))
        b.add_column(sa.Column("degrees", sa.JSON(), nullable=True))
        b.add_column(sa.Column("majors", sa.JSON(), nullable=True))
        b.add_column(sa.Column("capacity_points", sa.Integer(), nullable=True))
        b.add_column(sa.Column("on_leave_until", sa.Date(), nullable=True))
        b.add_column(sa.Column("leave_note", sa.String(200), nullable=True))
        b.add_column(sa.Column("left_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("left_reason", sa.String(300), nullable=True))
    with op.batch_alter_table("organizations") as b:
        b.add_column(sa.Column("load_weights", sa.JSON(), nullable=True))
        b.add_column(sa.Column("legal_name", sa.String(200), nullable=True))
        b.add_column(sa.Column("registration_status", sa.String(24), nullable=False, server_default="NOT_RECORDED"))
        b.add_column(sa.Column("registration_number", sa.String(80), nullable=True))
        b.add_column(sa.Column("registration_authority", sa.String(160), nullable=True))
        b.add_column(sa.Column("registration_checked_on", sa.Date(), nullable=True))
    op.add_column("agency_assignments", sa.Column("sub_agent_name", sa.String(200), nullable=True))
    op.add_column("message_templates", sa.Column("group_key", sa.String(64), nullable=True))
    op.create_index(op.f("ix_message_templates_group_key"), "message_templates", ["group_key"])
    with op.batch_alter_table("appointments") as b:
        b.add_column(sa.Column("decisions", sa.JSON(), nullable=True))
        b.add_column(sa.Column("follow_up_task_ids", sa.JSON(), nullable=True))
        b.add_column(sa.Column("next_appointment_id", sa.Uuid(), nullable=True))
        b.add_column(sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("closed_by_user_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("appointments") as b:
        for c in ("closed_by_user_id", "closed_at", "next_appointment_id", "follow_up_task_ids", "decisions"):
            b.drop_column(c)
    op.drop_index(op.f("ix_message_templates_group_key"), table_name="message_templates")
    op.drop_column("message_templates", "group_key")
    op.drop_column("agency_assignments", "sub_agent_name")
    with op.batch_alter_table("organizations") as b:
        for c in ("registration_checked_on", "registration_authority", "registration_number", "registration_status", "legal_name", "load_weights"):
            b.drop_column(c)
    with op.batch_alter_table("organization_members") as b:
        for c in ("left_reason", "left_at", "leave_note", "on_leave_until", "capacity_points", "majors", "degrees", "university_ids", "countries"):
            b.drop_column(c)
