"""initial schema

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cards",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("template_id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("variant", sa.String(), nullable=True),
        sa.Column("fsrs_state", sa.JSON(none_as_null=True), nullable=True),
        sa.Column("due", sa.DateTime(timezone=True), nullable=True),
        sa.Column("introduced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("suspended", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_cards_due", "cards", ["due"])
    op.create_table(
        "review_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("card_id", sa.String(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rating", sa.String(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("content_version", sa.String(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
    )
    op.create_index("ix_review_logs_card_id", "review_logs", ["card_id"])
    op.create_table(
        "lesson_progress",
        sa.Column("lesson_id", sa.String(), primary_key=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("daily_minutes", sa.Integer(), nullable=False),
        sa.Column("new_card_ratio", sa.Float(), nullable=False),
        sa.Column("desired_retention", sa.Float(), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("day_rollover_hour", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_table("lesson_progress")
    op.drop_index("ix_review_logs_card_id", table_name="review_logs")
    op.drop_table("review_logs")
    op.drop_index("ix_cards_due", table_name="cards")
    op.drop_table("cards")
