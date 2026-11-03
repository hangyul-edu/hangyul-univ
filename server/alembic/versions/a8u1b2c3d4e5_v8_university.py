"""v8 university: application_admin_checks (administrative check flag) and export_presets (saved export configuration)

Revision ID: a8u1b2c3d4e5
Revises: f6b7c8d9e0a1
Create Date: 2026-10-09

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "a8u1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "f6b7c8d9e0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _base():
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def _fk(col, table, name_table, ondelete="CASCADE"):
    return sa.ForeignKeyConstraint([col], [f"{table}.id"], name=op.f(f"fk_{name_table}_{col}_{table}"), ondelete=ondelete)


def upgrade() -> None:
    t = "application_admin_checks"
    op.create_table(
        t, *_base(),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("checked_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        _fk("application_id", "applications", t), _fk("checked_by_user_id", "users", t, "SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{t}")),
        sa.UniqueConstraint("application_id", name=op.f(f"uq_{t}_application_id")),
    )
    op.create_index(op.f(f"ix_{t}_application_id"), t, ["application_id"])
    op.create_index(op.f(f"ix_{t}_checked_by_user_id"), t, ["checked_by_user_id"])
    t = "export_presets"
    op.create_table(
        t, *_base(),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("base", sa.String(length=40), nullable=False),
        sa.Column("columns", sa.JSON(), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("schedule", sa.String(length=24), nullable=False),
        _fk("university_id", "universities", t), _fk("organization_id", "organizations", t), _fk("created_by_user_id", "users", t, "SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{t}")),
    )
    for c in ("university_id", "organization_id", "created_by_user_id"):
        op.create_index(op.f(f"ix_{t}_{c}"), t, [c])


def downgrade() -> None:
    op.drop_table("export_presets")
    op.drop_table("application_admin_checks")
