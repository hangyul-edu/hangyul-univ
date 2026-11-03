"""V29: service-contract versioning — order snapshots, service engagements, paid add-on lifecycle (REPORT §390).

Backfill, stated here because it is the migration behaviour the brief asks to be explicit about:

* every existing PAID plan order is stamped with catalogue ``2026-10-19.v15`` and a snapshot of the plan **as it was
  sold then** (read from ``shared/plan-catalog/2026-10-19.v15.json``), and gets a ``ServiceEngagement`` holding the
  V15 entitlements. A V28 buyer keeps the V28 contract; nothing here moves anyone to V29.
* add-ons in the retired ``APPROVED`` state (V15–V28 granted them on approval, without payment) become ``ACTIVE``
  with ``catalog_version = 'legacy-unpaid'`` so they stay visible as what they were.

Moving demo/test data to the V29 contract is a separate, explicit step: ``python -m scripts.v29_migrate_contracts``.
"""

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

import sqlalchemy as sa

from alembic import op

revision = "v29svc0001"
down_revision = "v28sch0001"
branch_labels = None
depends_on = None

LEGACY = "2026-10-19.v15"


def _legacy_plans() -> dict:
    p = Path(__file__).resolve().parents[3] / "shared" / "plan-catalog" / f"{LEGACY}.json"
    return {pl["code"]: pl for pl in json.loads(p.read_text())["plans"]}


def upgrade() -> None:
    op.add_column("orders", sa.Column("kind", sa.String(16), nullable=False, server_default="PLAN"))
    op.create_index("ix_orders_kind", "orders", ["kind"])
    op.add_column("orders", sa.Column("catalog_version", sa.String(32), nullable=True))
    op.add_column("orders", sa.Column("plan_snapshot", sa.JSON(), nullable=True))
    op.add_column("orders", sa.Column("purchase_terms_version", sa.String(32), nullable=True))

    op.alter_column("service_add_ons", "entitlement_key", existing_type=sa.String(48), nullable=True)
    for name, col in (
        ("catalog_version", sa.String(32)), ("unit_amount_minor", sa.BigInteger()), ("scope", sa.Text()),
        ("subject_type", sa.String(24)), ("subject_id", sa.Uuid()), ("paid_at", sa.DateTime(timezone=True)),
        ("activated_at", sa.DateTime(timezone=True)), ("completed_at", sa.DateTime(timezone=True)),
    ):
        op.add_column("service_add_ons", sa.Column(name, col, nullable=True))
    op.add_column("service_add_ons", sa.Column("case_id", sa.Uuid(), sa.ForeignKey("service_cases.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_service_add_ons_case_id", "service_add_ons", ["case_id"])

    op.create_table(
        "service_engagements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("product_code", sa.String(48), nullable=False),
        sa.Column("catalog_version", sa.String(32), nullable=False),
        sa.Column("entitlements", sa.JSON(), nullable=False),
        sa.Column("plan_snapshot", sa.JSON(), nullable=False),
        sa.Column("purchase_terms_version", sa.String(32), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, index=True),
        sa.Column("service_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("support_window_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("service_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("arrival_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pre_arrival_starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settlement_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dedicated_owner_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("superseded_by_id", sa.Uuid(), nullable=True),
        sa.Column("migrated_from_version", sa.String(32), nullable=True),
        sa.Column("milestones", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ---- backfill (see the module docstring)
    bind = op.get_bind()
    legacy = _legacy_plans()
    now = datetime.now(UTC)
    rows = bind.execute(sa.text(
        "SELECT o.id, o.user_id, o.amount_minor, o.currency, o.paid_at, p.code FROM orders o "
        "JOIN service_products p ON p.id = o.product_id WHERE o.status = 'PAID' ORDER BY o.user_id, p.sort_order, o.paid_at"
    )).all()
    latest: dict = {}
    for oid, uid, amount, currency, paid_at, code in rows:
        plan = legacy.get(code)
        if plan is None:
            continue
        snap = {"catalog_version": LEGACY, "code": code, "name_ko": plan["name_ko"], "name_en": plan["name_en"],
                "amount_minor": amount, "currency": currency, "entitlements": plan["entitlements"]}
        bind.execute(sa.text("UPDATE orders SET catalog_version = :v, plan_snapshot = :s WHERE id = :id"),
                     {"v": LEGACY, "s": json.dumps(snap), "id": oid})
        eid = uuid.uuid4()
        bind.execute(sa.text(
            "INSERT INTO service_engagements (id, user_id, order_id, product_code, catalog_version, entitlements, plan_snapshot, "
            "status, service_started_at, created_at, updated_at) VALUES (:id, :u, :o, :c, :v, :e, :s, 'ACTIVE', :st, :now, :now)"),
            {"id": eid, "u": uid, "o": oid, "c": code, "v": LEGACY, "e": json.dumps(plan["entitlements"]), "s": json.dumps(snap),
             "st": paid_at, "now": now})
        prev = latest.get(uid)
        if prev is not None:  # a higher plan bought later supersedes the lower one
            bind.execute(sa.text("UPDATE service_engagements SET status = 'SUPERSEDED', superseded_by_id = :n WHERE id = :p"),
                         {"n": eid, "p": prev})
        latest[uid] = eid
    bind.execute(sa.text(
        "UPDATE service_add_ons SET status = 'ACTIVE', catalog_version = 'legacy-unpaid', activated_at = decided_at "
        "WHERE status = 'APPROVED'"))


def downgrade() -> None:
    op.execute("UPDATE service_add_ons SET status = 'APPROVED' WHERE status IN ('ACTIVE', 'COMPLETED')")
    op.execute("UPDATE service_add_ons SET status = 'OFFERED' WHERE status = 'AWAITING_PAYMENT'")
    op.drop_table("service_engagements")
    op.drop_index("ix_service_add_ons_case_id", "service_add_ons")
    for c in ("case_id", "completed_at", "activated_at", "paid_at", "subject_id", "subject_type", "scope", "unit_amount_minor",
              "catalog_version"):
        op.drop_column("service_add_ons", c)
    op.drop_index("ix_orders_kind", "orders")
    for c in ("purchase_terms_version", "plan_snapshot", "catalog_version", "kind"):
        op.drop_column("orders", c)
