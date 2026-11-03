"""v9 student: sponsor_links + sponsor_link_views (read-only, expiring, revocable sponsor view — REPORT §58 S3)

Revision ID: v9s1sponsor01
Revises: a8u1b2c3d4e5
Create Date: 2026-10-10

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "v9s1sponsor01"
down_revision: Union[str, Sequence[str], None] = "a8u1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sponsor_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("student_user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("label", sa.String(80), nullable=True),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("locale", sa.String(12), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], name=op.f("fk_sponsor_links_student_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sponsor_links")),
    )
    op.create_index(op.f("ix_sponsor_links_student_user_id"), "sponsor_links", ["student_user_id"])
    op.create_index(op.f("ix_sponsor_links_token_hash"), "sponsor_links", ["token_hash"], unique=True)
    op.create_table(
        "sponsor_link_views",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("link_id", sa.Uuid(), nullable=False),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locale", sa.String(12), nullable=True),
        sa.Column("user_agent", sa.String(120), nullable=True),
        sa.ForeignKeyConstraint(["link_id"], ["sponsor_links.id"], name=op.f("fk_sponsor_link_views_link_id_sponsor_links"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sponsor_link_views")),
    )
    op.create_index(op.f("ix_sponsor_link_views_link_id"), "sponsor_link_views", ["link_id"])
    op.create_index(op.f("ix_sponsor_link_views_viewed_at"), "sponsor_link_views", ["viewed_at"])


def downgrade() -> None:
    op.drop_table("sponsor_link_views")
    op.drop_table("sponsor_links")
