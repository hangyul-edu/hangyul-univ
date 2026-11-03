"""V21 — stored foreign-card payment methods.

One table. A student's card, reduced to what a payment processor may legally echo back and what Hangyul
may legally keep: a masked number Toss produced, its issuer and acquirer codes, and a random
server-side ``customer_key``. **No PAN, no CVC, no card password, no identity number** — those are
received transiently by the registration endpoint, forwarded to Toss, and never written anywhere
(REPORT §236, brief §29).

``billing_key_ciphertext`` is an AES-256-GCM envelope (``app/core/crypto.py``) bound to ``user_id``, so
a row moved between students fails to open rather than charging the wrong person. It is nullable
because the merchant configuration the owner supplied performs a 키인 one-time charge and issues no
reusable credential (REPORT §229.2); ``reusable`` is the honest flag the UI reads, and the column is
here so that contracting a billing-key route later is a data change rather than a migration.

Revision ID: v21paymeth001
Revises: v17enrich0001
"""

import sqlalchemy as sa

from alembic import op

revision = "v21paymeth001"
down_revision = "v17enrich0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_payment_methods",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("provider", sa.String(24), nullable=False, server_default="TOSS"),
        sa.Column("provider_mid", sa.String(48)),
        sa.Column("customer_key", sa.String(64), nullable=False, index=True),
        sa.Column("billing_key_ciphertext", sa.Text()),
        sa.Column("billing_key_version", sa.Integer()),
        sa.Column("reusable", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("card_brand", sa.String(32)),
        sa.Column("issuer_code", sa.String(8)),
        sa.Column("acquirer_code", sa.String(8)),
        sa.Column("masked_number", sa.String(32)),
        sa.Column("last4", sa.String(4)),
        sa.Column("card_type", sa.String(24)),
        sa.Column("owner_type", sa.String(24)),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE", index=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("student_payment_methods")
