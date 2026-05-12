"""Bump existing ai_config row to SDXL-friendly sampler/image defaults.

Revision ID: 20260429_0006
Revises: 20260429_0005
Create Date: 2026-04-29

Why this migration exists: revisions 0004/0005 added max_references and
pipeline_version (default 'sdxl') but left the sampler/size columns alone, so
deployments that pre-existed the SDXL switch were rendering SDXL on SD 1.5
defaults (steps=20, cfg=7.0, 512x768) — SDXL needs ~32 steps, cfg≈6.0 and
≥832x1024 for the model to perform at the level we expect.

This migration ONLY touches rows where pipeline_version='sdxl' AND the params
still match a recognised SD 1.5 default set, so any custom values a superadmin
already chose stay untouched.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260429_0006"
down_revision = "20260429_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Match the historical SD 1.5 default footprint: pre-0004 (steps=20, cfg=7,
    # 512x768, sampler=euler) AND the v0.5 footprint (steps=28, cfg=6.5,
    # 512x640, dpmpp_2m). Either is safe to bump because it's a known default.
    op.execute(
        sa.text(
            """
            UPDATE ai_config
               SET sampler_steps = 32,
                   sampler_cfg   = 6.00,
                   sampler_name  = 'dpmpp_2m',
                   image_width   = 832,
                   image_height  = 1024
             WHERE pipeline_version = 'sdxl'
               AND (
                    (sampler_steps = 20 AND sampler_cfg = 7.00 AND sampler_name = 'euler'
                     AND image_width = 512 AND image_height = 768)
                 OR (sampler_steps = 28 AND sampler_cfg = 6.50 AND sampler_name = 'dpmpp_2m'
                     AND image_width = 512 AND image_height = 640)
               )
            """
        )
    )


def downgrade() -> None:
    # Revert the bumped row back to the pre-SDXL footprint we used during the
    # SD 1.5 era (steps=28 / cfg=6.5 / 512x640 / dpmpp_2m).
    op.execute(
        sa.text(
            """
            UPDATE ai_config
               SET sampler_steps = 28,
                   sampler_cfg   = 6.50,
                   sampler_name  = 'dpmpp_2m',
                   image_width   = 512,
                   image_height  = 640
             WHERE pipeline_version = 'sdxl'
               AND sampler_steps = 32
               AND sampler_cfg   = 6.00
               AND sampler_name  = 'dpmpp_2m'
               AND image_width   = 832
               AND image_height  = 1024
            """
        )
    )
