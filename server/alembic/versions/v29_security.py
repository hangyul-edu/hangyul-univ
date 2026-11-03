"""V29 Phase E: production security & infrastructure — staff MFA, worker run ledger, ops events, legal holds.

Purely additive (four new tables plus their indexes); the downgrade drops exactly what the upgrade creates.
"""

import sqlalchemy as sa

from alembic import op

revision = "v29sec0001"
down_revision = "v29svc0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "staff_mfa",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("secret_ciphertext", sa.Text(), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_step", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_staff_mfa_user_id"),
    )
    op.create_table(
        "mfa_recovery_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mfa_recovery_codes_user_id", "mfa_recovery_codes", ["user_id"])
    op.create_table(
        "job_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("worker_id", sa.String(120), nullable=True),
        sa.UniqueConstraint("name", "scheduled_for", name="uq_job_runs_name_window"),
    )
    op.create_index("ix_job_runs_status_started", "job_runs", ["status", "started_at"])
    op.create_table(
        "ops_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("severity", sa.String(12), nullable=False),
        sa.Column("source", sa.String(200), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("alerted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ops_events_kind", "ops_events", ["kind"])
    op.create_index("ix_ops_events_created_at", "ops_events", ["created_at"])
    op.create_table(
        "legal_holds",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("subject_type", sa.String(16), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("placed_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_legal_holds_subject_id", "legal_holds", ["subject_id"])


def downgrade() -> None:
    op.drop_index("ix_legal_holds_subject_id", table_name="legal_holds")
    op.drop_table("legal_holds")
    op.drop_index("ix_ops_events_created_at", table_name="ops_events")
    op.drop_index("ix_ops_events_kind", table_name="ops_events")
    op.drop_table("ops_events")
    op.drop_index("ix_job_runs_status_started", table_name="job_runs")
    op.drop_table("job_runs")
    op.drop_index("ix_mfa_recovery_codes_user_id", table_name="mfa_recovery_codes")
    op.drop_table("mfa_recovery_codes")
    op.drop_table("staff_mfa")
