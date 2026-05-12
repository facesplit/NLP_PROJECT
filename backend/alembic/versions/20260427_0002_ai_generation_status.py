"""ai_generation status

Revision ID: 20260427_0002
Revises: 20260426_0001
Create Date: 2026-04-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260427_0002"
down_revision = "20260426_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_generations",
        sa.Column("status", sa.String(20), nullable=False, server_default="ready"),
    )
    op.add_column(
        "ai_generations",
        sa.Column("error_message", sa.Text, nullable=True),
    )
    op.create_index("ix_ai_generations_status", "ai_generations", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ai_generations_status", table_name="ai_generations")
    op.drop_column("ai_generations", "error_message")
    op.drop_column("ai_generations", "status")
