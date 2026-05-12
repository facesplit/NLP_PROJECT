"""ai_config.pipeline_version

Revision ID: 20260429_0005
Revises: 20260429_0004
Create Date: 2026-04-29
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260429_0005"
down_revision = "20260429_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_config",
        sa.Column(
            "pipeline_version",
            sa.String(length=8),
            nullable=False,
            server_default=sa.text("'sdxl'"),
        ),
    )
    # Drop the server_default — runtime resets/patches own the value going forward.
    op.alter_column("ai_config", "pipeline_version", server_default=None)


def downgrade() -> None:
    op.drop_column("ai_config", "pipeline_version")
