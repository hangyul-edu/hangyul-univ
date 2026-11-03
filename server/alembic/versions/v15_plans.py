"""V15 — the three retail plans: structured entitlements, add-ons, staff recommendations.

Replaces three ad-hoc scope columns on ``service_products`` with one machine-readable entitlement set
(REPORT §117), adds ``service_add_ons`` for the business plan's 추가 유료 서비스 (§6-2), and makes a staff
institution recommendation countable so "최대 N곳 추천" can be enforced rather than asserted.

Revision ID: v15plans0001
Revises: v12inst0001
"""

import sqlalchemy as sa

from alembic import op

revision = "v15plans0001"
down_revision = "v12inst0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("service_products", sa.Column("name_ko", sa.String(length=120), nullable=True))
    op.add_column("service_products", sa.Column("entitlements", sa.JSON(), nullable=True))
    op.add_column("service_products", sa.Column("is_recommended", sa.Boolean(), nullable=False, server_default=sa.false()))
    # The columns these replace. `max_applications` in particular meant "applications the student may create",
    # which is not the plan's 지원 학교 최대 N곳 (applications Hangyul manages) — two promises in one column.
    op.drop_column("service_products", "includes_agency_assignment")
    op.drop_column("service_products", "includes_essay_review")
    op.drop_column("service_products", "max_applications")

    op.create_table(
        "service_add_ons",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=48), nullable=False),
        sa.Column("entitlement_key", sa.String(length=48), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="OFFERED"),
        sa.Column("amount_minor", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("offered_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_service_add_ons_user_id_users")),
        sa.ForeignKeyConstraint(["offered_by_user_id"], ["users.id"], name=op.f("fk_service_add_ons_offered_by_user_id_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name=op.f("fk_service_add_ons_order_id_orders"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_service_add_ons")),
    )
    op.create_index(op.f("ix_service_add_ons_entitlement_key"), "service_add_ons", ["entitlement_key"])
    op.create_index(op.f("ix_service_add_ons_status"), "service_add_ons", ["status"])
    op.create_index(op.f("ix_service_add_ons_user_id"), "service_add_ons", ["user_id"])

    # Who put this institution on the shortlist. The plan sells "적합한 대학 최대 N곳 추천"; counting it needs
    # Hangyul's own recommendations to be distinguishable from the student's saves.
    op.add_column("saved_universities", sa.Column("source", sa.String(length=16), nullable=False, server_default="STUDENT"))
    op.add_column("saved_universities", sa.Column("recommended_by_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(op.f("fk_saved_universities_recommended_by_user_id_users"), "saved_universities",
                          "users", ["recommended_by_user_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint(op.f("fk_saved_universities_recommended_by_user_id_users"), "saved_universities", type_="foreignkey")
    op.drop_column("saved_universities", "recommended_by_user_id")
    op.drop_column("saved_universities", "source")
    op.drop_table("service_add_ons")
    op.add_column("service_products", sa.Column("max_applications", sa.Integer(), nullable=True))
    op.add_column("service_products", sa.Column("includes_essay_review", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("service_products", sa.Column("includes_agency_assignment", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.drop_column("service_products", "is_recommended")
    op.drop_column("service_products", "entitlements")
    op.drop_column("service_products", "name_ko")
