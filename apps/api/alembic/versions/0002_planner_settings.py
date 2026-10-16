"""new_cards_per_day and keys_in_progress settings

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # review_logs.card_id has no FK (lesson-source logs may reference unknown cards).
    with op.batch_alter_table("settings") as batch:
        batch.add_column(
            sa.Column("new_cards_per_day", sa.Integer(), nullable=False, server_default="10")
        )
        batch.add_column(
            sa.Column("keys_in_progress", sa.Integer(), nullable=False, server_default="4")
        )


def downgrade() -> None:
    with op.batch_alter_table("settings") as batch:
        batch.drop_column("keys_in_progress")
        batch.drop_column("new_cards_per_day")
