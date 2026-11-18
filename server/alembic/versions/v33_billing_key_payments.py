"""V33 — billing-key-only payments: opaque customer keys, hosted registrations, charge attempts, webhook ledger.

Owner decision: every real purchase is registered → billing key → one server-side charge. Products stay
one-time purchases; nothing here models a schedule, a renewal or a subscription.

Additive. Existing `student_payment_methods` rows were written by the retired key-in route and hold no
reusable credential (`reusable = false`, no ciphertext), so they stay as history and can never be charged.
"""

import sqlalchemy as sa

from alembic import op

revision = "v33billing0001"
down_revision = "v29sec0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_customers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_payment_customers_user_id"),
        sa.UniqueConstraint("customer_key", name="uq_payment_customers_customer_key"),
    )

    op.add_column("student_payment_methods", sa.Column("kind", sa.String(24), nullable=False, server_default="FOREIGN_CARD"))
    op.add_column("student_payment_methods", sa.Column("billing_key_fingerprint", sa.String(64)))
    op.create_index("ix_student_payment_methods_billing_key_fingerprint", "student_payment_methods", ["billing_key_fingerprint"])

    op.create_table(
        "payment_method_registrations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("provider_mid", sa.String(48)),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id", ondelete="SET NULL"), index=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING", index=True),
        sa.Column("failure_code", sa.String(64)),
        sa.Column("payment_method_id", sa.Uuid(), sa.ForeignKey("student_payment_methods.id", ondelete="SET NULL"), index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.add_column("orders", sa.Column("payment_state", sa.String(32), nullable=False, server_default="PENDING"))
    op.create_index("ix_orders_payment_state", "orders", ["payment_state"])
    op.add_column("orders", sa.Column("payment_method_id", sa.Uuid(), sa.ForeignKey("student_payment_methods.id", ondelete="SET NULL")))
    op.create_index("ix_orders_payment_method_id", "orders", ["payment_method_id"])
    # Existing rows: the fine-grained state is the coarse one they already have.
    op.execute("UPDATE orders SET payment_state = status")

    op.add_column("payments", sa.Column("provider_mid", sa.String(48)))
    op.add_column("payments", sa.Column("provider_order_id", sa.String(64)))
    op.create_index("ix_payments_provider_order_id", "payments", ["provider_order_id"])
    op.add_column("payments", sa.Column("attempt", sa.Integer()))
    op.add_column("payments", sa.Column("payment_method_id", sa.Uuid(), sa.ForeignKey("student_payment_methods.id", ondelete="SET NULL")))
    op.create_index("ix_payments_payment_method_id", "payments", ["payment_method_id"])
    op.add_column("payments", sa.Column("failure_code", sa.String(64)))

    op.create_table(
        "payment_webhook_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("dedupe_key", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(48), nullable=False, index=True),
        sa.Column("provider_order_id", sa.String(64), index=True),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("signature_valid", sa.Boolean()),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("dedupe_key", name="uq_payment_webhook_events_dedupe_key"),
    )


def downgrade() -> None:
    op.drop_table("payment_webhook_events")
    op.drop_column("payments", "failure_code")
    op.drop_index("ix_payments_payment_method_id", table_name="payments")
    op.drop_column("payments", "payment_method_id")
    op.drop_column("payments", "attempt")
    op.drop_index("ix_payments_provider_order_id", table_name="payments")
    op.drop_column("payments", "provider_order_id")
    op.drop_column("payments", "provider_mid")
    op.drop_index("ix_orders_payment_method_id", table_name="orders")
    op.drop_column("orders", "payment_method_id")
    op.drop_index("ix_orders_payment_state", table_name="orders")
    op.drop_column("orders", "payment_state")
    op.drop_table("payment_method_registrations")
    op.drop_index("ix_student_payment_methods_billing_key_fingerprint", table_name="student_payment_methods")
    op.drop_column("student_payment_methods", "billing_key_fingerprint")
    op.drop_column("student_payment_methods", "kind")
    op.drop_table("payment_customers")
