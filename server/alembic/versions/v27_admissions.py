"""V27 — verified admission rules: language rules, admission guides, guide-sourced requirements, structured scholarships.

Revision ID: v27adm0001
Revises: v22roles0001
"""

import sqlalchemy as sa

from alembic import op

revision = "v27adm0001"
down_revision = "v22roles0001"
branch_labels = None
depends_on = None


def _sourced() -> list[sa.Column]:
    return [
        sa.Column("source_id", sa.Uuid(), sa.ForeignKey("sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("verification_status", sa.String(24), nullable=False, server_default="DEMO"),
    ]


def _base() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "admission_language_rules", *_base(), *_sourced(),
        sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("degree_level", sa.String(16), nullable=False, index=True),
        sa.Column("track", sa.String(12), nullable=False),
        sa.Column("group_key", sa.String(8), nullable=False),
        sa.Column("test", sa.String(24), nullable=False),
        sa.Column("min_value", sa.Float(), nullable=True),
        sa.Column("min_text", sa.String(80), nullable=True),
        sa.Column("stage", sa.String(16), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("source_name", sa.String(300), nullable=True),
    )
    op.create_table(
        "admission_guides", *_base(), *_sourced(),
        sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("university_id", sa.Uuid(), sa.ForeignKey("universities.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("intake_year", sa.Integer(), nullable=False),
        sa.Column("term", sa.String(8), nullable=False),
        sa.Column("degree_level", sa.String(16), nullable=False, index=True),
        sa.Column("applicant_type", sa.String(16), nullable=False),
        sa.Column("track", sa.String(12), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, index=True),
        sa.Column("title", sa.String(300), nullable=True),
        sa.Column("source_document", sa.String(300), nullable=True),
        sa.Column("source_page_url", sa.String(1000), nullable=True),
        sa.Column("publication_date", sa.Date(), nullable=True),
        sa.Column("application_opens", sa.Date(), nullable=True),
        sa.Column("application_closes", sa.Date(), nullable=True),
        sa.Column("document_deadline", sa.Date(), nullable=True),
        sa.Column("submission_channel", sa.Text(), nullable=True),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("notes", sa.JSON(), nullable=True),
        sa.Column("conflicts", sa.JSON(), nullable=True),
        sa.Column("language_rules", sa.JSON(), nullable=True),
    )
    with op.batch_alter_table("document_requirements") as b:
        b.add_column(sa.Column("guide_id", sa.Uuid(), sa.ForeignKey("admission_guides.id", ondelete="CASCADE"), nullable=True))
        b.add_column(sa.Column("name_ko", sa.String(300), nullable=True))
        b.add_column(sa.Column("condition", sa.Text(), nullable=True))
        b.add_column(sa.Column("applies_to", sa.JSON(), nullable=True))
        b.add_column(sa.Column("original_or_copy", sa.String(8), nullable=True))
        b.add_column(sa.Column("submission_method", sa.String(12), nullable=True))
        b.add_column(sa.Column("notarization_required", sa.Boolean(), nullable=False, server_default=sa.false()))
        b.add_column(sa.Column("legalization_rule", sa.String(32), nullable=True))
        b.add_column(sa.Column("source_page", sa.String(60), nullable=True))
        b.add_column(sa.Column("evidence", sa.Text(), nullable=True))
    op.create_index("ix_document_requirements_guide_id", "document_requirements", ["guide_id"])
    with op.batch_alter_table("scholarships") as b:
        b.add_column(sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True))
        for name, typ in (("name_en", sa.String(300)), ("category", sa.String(16)), ("stage", sa.String(10)),
                          ("international_only", sa.Boolean()), ("topik_min", sa.Integer()), ("english_min", sa.JSON()),
                          ("gpa_requirement", sa.String(300)), ("gpa_min_percent", sa.Float()), ("dormitory_support", sa.Boolean()),
                          ("living_allowance", sa.String(300)), ("duration", sa.String(300)), ("renewal", sa.String(500)),
                          ("application_period", sa.String(300)), ("department_restriction", sa.String(300)),
                          ("nationality_restriction", sa.String(300)), ("evidence", sa.Text()), ("source_name", sa.String(300))):
            b.add_column(sa.Column(name, typ, nullable=True))
    op.create_index("ix_scholarships_institution_id", "scholarships", ["institution_id"])


def downgrade() -> None:
    op.drop_index("ix_scholarships_institution_id", "scholarships")
    with op.batch_alter_table("scholarships") as b:
        for name in ("institution_id", "name_en", "category", "stage", "international_only", "topik_min", "english_min",
                     "gpa_requirement", "gpa_min_percent", "dormitory_support", "living_allowance", "duration", "renewal",
                     "application_period", "department_restriction", "nationality_restriction", "evidence", "source_name"):
            b.drop_column(name)
    op.drop_index("ix_document_requirements_guide_id", "document_requirements")
    with op.batch_alter_table("document_requirements") as b:
        for name in ("guide_id", "name_ko", "condition", "applies_to", "original_or_copy", "submission_method",
                     "notarization_required", "legalization_rule", "source_page", "evidence"):
            b.drop_column(name)
    op.drop_table("admission_guides")
    op.drop_table("admission_language_rules")
