"""V22 — verified identity, consent evidence, abuse-control events (REPORT §244–245, §253).

* `users.email_verified_at` / `users.phone_verified_at`: set only by a consumed one-time code; cleared by a change.
* `consent_records`: locale, document version, policy effective date, hashed IP, user agent, capture source —
  so a record proves *which text, in which language, from where*, never merely `granted=true`.
* `verification_challenges`: the OTP lifecycle (HMAC of the code, never the code).
* `auth_security_events`: throttles, CAPTCHA escalations and OTP limit hits, with hashed identifiers.

Revision ID: v22identity0001
Revises: v21paymeth001
"""

import sqlalchemy as sa

from alembic import op

revision = "v22identity0001"
down_revision = "v21paymeth001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True)))
    for col in (
        sa.Column("locale", sa.String(16)),
        sa.Column("document_version", sa.String(32)),
        sa.Column("policy_effective_on", sa.Date()),
        sa.Column("ip_hash", sa.String(64)),
        sa.Column("user_agent", sa.String(300)),
        sa.Column("source", sa.String(32)),
    ):
        op.add_column("consent_records", col)
    op.create_table(
        "verification_challenges",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("purpose", sa.String(40), nullable=False, index=True),
        sa.Column("channel", sa.String(8), nullable=False),
        sa.Column("target", sa.String(255), nullable=False, index=True),
        sa.Column("target_hash", sa.String(64), nullable=False, index=True),
        sa.Column("code_hash", sa.String(128), nullable=False),
        sa.Column("locale", sa.String(16), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("send_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("invalidated_at", sa.DateTime(timezone=True)),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("request_ip_hash", sa.String(64)),
        sa.Column("signup_session_hash", sa.String(64)),
        sa.Column("provider", sa.String(24)),
        sa.Column("provider_message_id", sa.String(64), index=True),
        sa.Column("delivery_status", sa.String(16), nullable=False, server_default="QUEUED"),
        sa.Column("delivery_error_code", sa.String(32)),
        sa.Column("delivery_updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "auth_security_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(40), nullable=False, index=True),
        sa.Column("email_hash", sa.String(64), index=True),
        sa.Column("target_hash", sa.String(64)),
        sa.Column("ip_hash", sa.String(64), index=True),
        sa.Column("client", sa.String(32)),
        sa.Column("detail", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("auth_security_events")
    op.drop_table("verification_challenges")
    for c in ("source", "user_agent", "ip_hash", "policy_effective_on", "document_version", "locale"):
        op.drop_column("consent_records", c)
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "email_verified_at")
