"""ai_config.max_references

Revision ID: 20260429_0004
Revises: 20260427_0003
Create Date: 2026-04-29
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260429_0004"
down_revision = "20260427_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_config",
        sa.Column(
            "max_references",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("10"),
        ),
    )
    # Drop the server_default — runtime resets/patches own the value going forward.
    op.alter_column("ai_config", "max_references", server_default=None)


def downgrade() -> None:
    op.drop_column("ai_config", "max_references")
