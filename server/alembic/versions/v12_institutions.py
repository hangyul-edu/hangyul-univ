"""V12 — the Korean institution directory, separate from the application catalogue.

Revision ID: v12inst0001
Revises: v9a1agencyops
"""

import sqlalchemy as sa

from alembic import op

revision = "v12inst0001"
down_revision = "v9a1agencyops"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "institutions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("academyinfo_id", sa.String(length=16), nullable=False),
        sa.Column("name_ko", sa.String(length=200), nullable=False),
        sa.Column("name_en", sa.String(length=200), nullable=True),
        sa.Column("registry_name_ko", sa.String(length=200), nullable=True),
        sa.Column("institution_type", sa.String(length=24), nullable=False),
        sa.Column("establishment", sa.String(length=16), nullable=False),
        sa.Column("establishment_source", sa.String(length=24), nullable=True),
        sa.Column("region", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("withdrawn_at", sa.Date(), nullable=True),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("major_count", sa.Integer(), nullable=True),
        sa.Column("ieqas_certified", sa.Boolean(), nullable=False),
        sa.Column("ieqas_excellent", sa.Boolean(), nullable=False),
        sa.Column("ieqas_language_programme", sa.Boolean(), nullable=False),
        sa.Column("ieqas_checked_on", sa.Date(), nullable=True),
        sa.Column("last_verified", sa.Date(), nullable=True),
        sa.Column("other_campuses", sa.JSON(), nullable=True),
        sa.Column("sources", sa.JSON(), nullable=True),
        sa.Column("catalog_university_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["catalog_university_id"], ["universities.id"], name=op.f("fk_institutions_catalog_university_id_universities"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_institutions")),
    )
    op.create_index(op.f("ix_institutions_slug"), "institutions", ["slug"], unique=True)
    op.create_index(op.f("ix_institutions_academyinfo_id"), "institutions", ["academyinfo_id"], unique=True)
    op.create_index(op.f("ix_institutions_name_ko"), "institutions", ["name_ko"])
    op.create_index(op.f("ix_institutions_name_en"), "institutions", ["name_en"])
    op.create_index(op.f("ix_institutions_institution_type"), "institutions", ["institution_type"])
    op.create_index(op.f("ix_institutions_establishment"), "institutions", ["establishment"])
    op.create_index(op.f("ix_institutions_region"), "institutions", ["region"])
    op.create_index(op.f("ix_institutions_status"), "institutions", ["status"])
    op.create_index(op.f("ix_institutions_ieqas_certified"), "institutions", ["ieqas_certified"])
    op.create_index(op.f("ix_institutions_catalog_university_id"), "institutions", ["catalog_university_id"])


def downgrade() -> None:
    op.drop_table("institutions")
