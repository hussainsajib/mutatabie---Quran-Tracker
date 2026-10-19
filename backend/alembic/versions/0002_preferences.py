"""add user reading preferences (mushaf, theme, font_scale)

Revision ID: 0002_preferences
Revises: 0001_initial
Create Date: 2026-10-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_preferences"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("mushaf", sa.String(length=8), nullable=False, server_default="v4"),
    )
    op.add_column(
        "users",
        sa.Column("theme", sa.String(length=8), nullable=False, server_default="light"),
    )
    op.add_column(
        "users",
        sa.Column("font_scale", sa.Float(), nullable=False, server_default="1.0"),
    )
    op.create_check_constraint("ck_user_mushaf", "users", "mushaf IN ('v1', 'v2', 'v4')")
    op.create_check_constraint("ck_user_theme", "users", "theme IN ('light', 'dark')")
    op.create_check_constraint(
        "ck_user_font_scale", "users", "font_scale >= 0.5 AND font_scale <= 2.5"
    )


def downgrade() -> None:
    op.drop_constraint("ck_user_font_scale", "users", type_="check")
    op.drop_constraint("ck_user_theme", "users", type_="check")
    op.drop_constraint("ck_user_mushaf", "users", type_="check")
    op.drop_column("users", "font_scale")
    op.drop_column("users", "theme")
    op.drop_column("users", "mushaf")
