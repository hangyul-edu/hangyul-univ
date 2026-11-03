"""V28: scholarship names as published — native, official English, Korean display (REPORT §374, UX_AUDIT MK-4)."""

import sqlalchemy as sa

from alembic import op

revision = "v28sch0001"
down_revision = "v27adm0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scholarships", sa.Column("name_native", sa.String(300), nullable=True))
    op.add_column("scholarships", sa.Column("name_official_en", sa.String(300), nullable=True))
    op.add_column("scholarships", sa.Column("name_display_ko", sa.String(300), nullable=True))
    op.add_column("scholarships", sa.Column("display_is_description", sa.Boolean(), nullable=True))


def downgrade() -> None:
    for c in ("display_is_description", "name_display_ko", "name_official_en", "name_native"):
        op.drop_column("scholarships", c)
