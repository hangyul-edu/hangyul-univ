"""v6 writing: suggestion decisions (student accepts / declines a reviewer suggestion) and authorship attestations

Revision ID: f6b7c8d9e0a1
Revises: e6a1b2c3d4f5
Create Date: 2026-10-01

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "f6b7c8d9e0a1"
down_revision: Union[str, Sequence[str], None] = "e6a1b2c3d4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "essay_suggestion_decisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("comment_id", sa.Uuid(), nullable=False),
        sa.Column("essay_id", sa.Uuid(), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("decided_by_id", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("version_created", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["comment_id"], ["essay_comments.id"], name=op.f("fk_essay_suggestion_decisions_comment_id_essay_comments"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["essay_id"], ["essays.id"], name=op.f("fk_essay_suggestion_decisions_essay_id_essays"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by_id"], ["users.id"], name=op.f("fk_essay_suggestion_decisions_decided_by_id_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_essay_suggestion_decisions")),
        sa.UniqueConstraint("comment_id", name=op.f("uq_essay_suggestion_decisions_comment_id")),
    )
    op.create_index(op.f("ix_essay_suggestion_decisions_comment_id"), "essay_suggestion_decisions", ["comment_id"], unique=False)
    op.create_index(op.f("ix_essay_suggestion_decisions_essay_id"), "essay_suggestion_decisions", ["essay_id"], unique=False)
    op.create_index(op.f("ix_essay_suggestion_decisions_decided_by_id"), "essay_suggestion_decisions", ["decided_by_id"], unique=False)
    op.create_table(
        "essay_attestations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("essay_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("statement_code", sa.String(length=40), nullable=False),
        sa.Column("statement_text", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=True),
        sa.Column("body_sha256", sa.String(length=64), nullable=False),
        sa.Column("attested_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["essay_id"], ["essays.id"], name=op.f("fk_essay_attestations_essay_id_essays"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_essay_attestations_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_essay_attestations")),
        sa.UniqueConstraint("essay_id", "version", name=op.f("uq_essay_attestations_essay_id")),
    )
    op.create_index(op.f("ix_essay_attestations_essay_id"), "essay_attestations", ["essay_id"], unique=False)
    op.create_index(op.f("ix_essay_attestations_user_id"), "essay_attestations", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("essay_attestations")
    op.drop_table("essay_suggestion_decisions")
