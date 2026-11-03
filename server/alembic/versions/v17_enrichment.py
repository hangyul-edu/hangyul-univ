"""V17 — verified institution enrichment, and the refund path.

Two additions, both of which exist so a claim can be traced to a source (REPORT §150, §152):

``institutions.enrichment`` — one JSON document per institution holding the facts a public page needs that
the 대학알리미 registry does not carry: founding year, mission/philosophy, logo and hero media with their
licences, the official YouTube channel, student count. Every value inside carries its own ``source`` and
``verified_at``; nothing is stored that cannot say where it came from. A column rather than a table because
it is a *cache of external facts* with one owner and no relations — a normalised schema here would be five
tables that are only ever read together.

``orders``/``payments`` refund columns — the technical half of the refund path. The legal policy is
deliberately **not** encoded (REPORT §152): these record what was refunded, when, by whom and against which
provider reference, and the question of how much a student is owed stays with a person until one is approved.

Revision ID: v17enrich0001
Revises: v15plans0001
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "v17enrich0001"
down_revision = "v15plans0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("institutions", sa.Column("enrichment", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.add_column("orders", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("refund_amount_minor", sa.BigInteger(), nullable=True))
    op.add_column("orders", sa.Column("refund_reason", sa.String(length=200), nullable=True))
    op.add_column("payments", sa.Column("refunded_amount_minor", sa.BigInteger(), nullable=True))
    op.add_column("payments", sa.Column("refund_ref", sa.String(length=120), nullable=True))
    op.add_column("payments", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for col in ("refunded_at", "refund_ref", "refunded_amount_minor"):
        op.drop_column("payments", col)
    for col in ("refund_reason", "refund_amount_minor", "refunded_at"):
        op.drop_column("orders", col)
    op.drop_column("institutions", "enrichment")
