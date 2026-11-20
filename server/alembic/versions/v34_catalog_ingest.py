"""V34 — one authoritative catalogue: ingestion ledger, staged records, link checks, catalogue identity columns, indexes.

Additive and non-destructive. Two columns are relaxed to NULL (``universities.city`` and ``programs.field``) so a
fact no official source states can stay unknown instead of being defaulted; no value is rewritten.

Name search: when the ``pg_trgm`` extension can be created (or already exists) the name columns get trigram GIN
indexes, which serve the ``ILIKE '%term%'`` searches the directory and catalogue run; otherwise they get btree indexes
on ``lower(name)`` (prefix/equality ranking). The downgrade drops only what this revision created.
"""

import sqlalchemy as sa

from alembic import op

revision = "v34catalog0001"
down_revision = "v33billing0001"
branch_labels = None
depends_on = None

#: (index name, table, column) — trigram GIN when available, else btree on lower(column).
NAME_INDEXES = (
    ("ix_institutions_name_ko_search", "institutions", "name_ko"),
    ("ix_institutions_name_en_search", "institutions", "name_en"),
    ("ix_universities_name_ko_search", "universities", "name_ko"),
    ("ix_universities_name_en_search", "universities", "name_en"),
    ("ix_programs_name_en_search", "programs", "name_en"),
    ("ix_programs_name_ko_search", "programs", "name_ko"),
)


def _trgm_available(bind) -> bool:
    if bind.dialect.name != "postgresql":
        return False
    if bind.execute(sa.text("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")).scalar():
        return True
    if not bind.execute(sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'")).scalar():
        return False
    # Creating an extension needs privileges a managed database may not grant; try inside a savepoint.
    sp = bind.begin_nested()
    try:
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        sp.commit()
        return True
    except Exception:  # noqa: BLE001 - fall back to btree indexes
        sp.rollback()
        return False


def upgrade() -> None:
    bind = op.get_bind()

    # ---------------------------------------------------------------- ledger tables
    op.create_table(
        "catalog_ingestion_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("trigger", sa.String(24), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="RUNNING"),
        sa.Column("full", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer()),
        *[sa.Column(c, sa.Integer(), nullable=False, server_default="0") for c in (
            "institution_count", "university_count", "programme_count", "intake_count", "created_count", "changed_count",
            "unchanged_count", "retired_count", "source_failures", "parser_failures", "conflicts", "stale_records")],
        sa.Column("error", sa.Text()),
        sa.Column("summary", sa.JSON()),
        sa.Column("worker_id", sa.String(120)),
    )
    op.create_index("ix_catalog_ingestion_runs_status_started", "catalog_ingestion_runs", ["status", "started_at"])

    op.create_table(
        "catalog_source_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("catalog_ingestion_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_key", sa.String(80), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("status", sa.String(16), nullable=False, server_default="RUNNING"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        *[sa.Column(c, sa.Integer(), nullable=False, server_default="0") for c in (
            "records_fetched", "records_valid", "records_rejected", "changed", "unchanged")],
        sa.Column("error", sa.Text()),
        sa.Column("detail", sa.JSON()),
    )
    op.create_index("ix_catalog_source_results_run_id", "catalog_source_results", ["run_id"])

    op.create_table(
        "catalog_staged_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("catalog_ingestion_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_key", sa.String(80), nullable=False),
        sa.Column("entity_kind", sa.String(24), nullable=False),
        sa.Column("entity_key", sa.String(300), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("source_url", sa.String(1000)),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(16), nullable=False, server_default="STAGED"),
        sa.Column("change", sa.String(12)),
        sa.Column("problem", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_catalog_staged_records_run_id", "catalog_staged_records", ["run_id"])
    op.create_index("ix_catalog_staged_records_entity", "catalog_staged_records", ["entity_kind", "entity_key", "created_at"])

    op.create_table(
        "catalog_link_checks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("guide_id", sa.Uuid(), sa.ForeignKey("admission_guides.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(24), nullable=False, server_default="UNCHECKED"),
        sa.Column("http_status", sa.Integer()),
        sa.Column("last_checked_at", sa.DateTime(timezone=True)),
        sa.Column("last_ok_at", sa.DateTime(timezone=True)),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fingerprint", sa.String(300)),
        sa.Column("changed_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(300)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("institution_id", "kind", "url", name="uq_catalog_link_checks_inst_kind_url"),
    )
    op.create_index("ix_catalog_link_checks_institution_id", "catalog_link_checks", ["institution_id"])
    op.create_index("ix_catalog_link_checks_guide_id", "catalog_link_checks", ["guide_id"])
    op.create_index("ix_catalog_link_checks_status", "catalog_link_checks", ["status"])

    op.create_table(
        "catalog_state",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.JSON()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ---------------------------------------------------------------- catalogue identity columns
    op.add_column("universities", sa.Column("name_en_recorded", sa.Boolean()))
    op.add_column("universities", sa.Column("institution_kind", sa.String(24)))
    op.alter_column("universities", "city", existing_type=sa.String(60), nullable=True)
    op.create_index("ix_universities_institution_kind", "universities", ["institution_kind"])
    op.create_index("ix_universities_institution_type", "universities", ["institution_type"])

    op.add_column("programs", sa.Column("name_en_recorded", sa.Boolean()))
    op.add_column("programs", sa.Column("catalog_key", sa.String(300)))
    op.add_column("programs", sa.Column("origin", sa.String(24)))
    op.add_column("programs", sa.Column("college_ko", sa.String(200)))
    op.add_column("programs", sa.Column("campus_name", sa.String(120)))
    op.add_column("programs", sa.Column("source_page", sa.String(60)))
    op.add_column("programs", sa.Column("evidence", sa.Text()))
    op.alter_column("programs", "field", existing_type=sa.String(80), nullable=True)
    op.create_unique_constraint("uq_programs_catalog_key", "programs", ["catalog_key"])
    op.create_index("ix_programs_instruction_language", "programs", ["instruction_language"])
    # The search's base predicate is "active programmes of a university"; the deadline sort reads open intakes.
    op.create_index("ix_programs_university_active", "programs", ["university_id", "is_active"])
    op.create_index("ix_program_intakes_open_deadline", "program_intakes", ["program_id", "is_open", "application_deadline"])
    # The directory's scholarship signal and `has_scholarship` read verified schemes per institution.
    op.create_index("ix_scholarships_institution_status", "scholarships", ["institution_id", "verification_status"])

    trgm = _trgm_available(bind)
    for name, table, column in NAME_INDEXES:
        if trgm:
            op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} USING gin ({column} gin_trgm_ops)")
        else:
            op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} (lower({column}))")


def downgrade() -> None:
    for name, _table, _column in NAME_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
    op.drop_index("ix_scholarships_institution_status", table_name="scholarships")
    op.drop_index("ix_program_intakes_open_deadline", table_name="program_intakes")
    op.drop_index("ix_programs_university_active", table_name="programs")
    op.drop_index("ix_programs_instruction_language", table_name="programs")
    op.drop_constraint("uq_programs_catalog_key", "programs", type_="unique")
    # `programs.field` / `universities.city` stay nullable: re-imposing NOT NULL would fail on (or require
    # inventing values for) rows the catalogue importer wrote with an unknown field or city.
    for c in ("evidence", "source_page", "campus_name", "college_ko", "origin", "catalog_key", "name_en_recorded"):
        op.drop_column("programs", c)
    op.drop_index("ix_universities_institution_type", table_name="universities")
    op.drop_index("ix_universities_institution_kind", table_name="universities")
    op.drop_column("universities", "institution_kind")
    op.drop_column("universities", "name_en_recorded")
    op.drop_table("catalog_state")
    op.drop_table("catalog_link_checks")
    op.drop_table("catalog_staged_records")
    op.drop_table("catalog_source_results")
    op.drop_index("ix_catalog_ingestion_runs_status_started", table_name="catalog_ingestion_runs")
    op.drop_table("catalog_ingestion_runs")
