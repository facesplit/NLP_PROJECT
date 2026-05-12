"""ai_config table

Revision ID: 20260427_0003
Revises: 20260427_0002
Create Date: 2026-04-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

from app.services.ai_config_defaults import DEFAULTS

revision = "20260427_0003"
down_revision = "20260427_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("negative_prompt", sa.Text(), nullable=False),
        sa.Column("sampler_steps", sa.Integer(), nullable=False),
        sa.Column("sampler_cfg", sa.Numeric(4, 2), nullable=False),
        sa.Column("sampler_name", sa.String(40), nullable=False),
        sa.Column("image_width", sa.Integer(), nullable=False),
        sa.Column("image_height", sa.Integer(), nullable=False),
        sa.Column("budget_lower_pct", sa.Numeric(4, 3), nullable=False),
        sa.Column("budget_upper_pct", sa.Numeric(4, 3), nullable=False),
        sa.Column("llm_temperature", sa.Numeric(3, 2), nullable=False),
        sa.Column("llm_max_retries", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.bulk_insert(
        sa.table(
            "ai_config",
            sa.column("id", sa.Integer),
            sa.column("system_prompt", sa.Text),
            sa.column("negative_prompt", sa.Text),
            sa.column("sampler_steps", sa.Integer),
            sa.column("sampler_cfg", sa.Numeric),
            sa.column("sampler_name", sa.String),
            sa.column("image_width", sa.Integer),
            sa.column("image_height", sa.Integer),
            sa.column("budget_lower_pct", sa.Numeric),
            sa.column("budget_upper_pct", sa.Numeric),
            sa.column("llm_temperature", sa.Numeric),
            sa.column("llm_max_retries", sa.Integer),
        ),
        [{"id": 1, **DEFAULTS}],
    )


def downgrade() -> None:
    op.drop_table("ai_config")
