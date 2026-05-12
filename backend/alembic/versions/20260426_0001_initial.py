"""initial schema

Revision ID: 20260426_0001
Revises:
Create Date: 2026-04-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260426_0001"
down_revision = None
branch_labels = None
depends_on = None


def _enum(name: str, *values: str) -> postgresql.ENUM:
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    role = postgresql.ENUM("superadmin", "floristadmin", "consumer", name="role")
    role.create(op.get_bind(), checkfirst=True)

    order_source = postgresql.ENUM("ai_generated", "portfolio", name="order_source")
    order_source.create(op.get_bind(), checkfirst=True)

    order_status = postgresql.ENUM(
        "pending",
        "accepted",
        "declined",
        "in_progress",
        "ready_for_pickup",
        "completed",
        "rejected_by_client",
        "cancelled",
        "cancelled_by_florist",
        name="order_status",
    )
    order_status.create(op.get_bind(), checkfirst=True)

    notification_type = postgresql.ENUM(
        "order_created",
        "order_accepted",
        "order_declined",
        "order_in_progress",
        "order_ready",
        "order_completed",
        "order_rejected_by_client",
        "order_cancelled",
        "order_cancelled_by_florist",
        "role_changed",
        name="notification_type",
    )
    notification_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", _enum("role", "superadmin", "floristadmin", "consumer"), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("ip", postgresql.INET, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    op.create_table(
        "florist_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("cover_image_path", sa.String(500), nullable=True),
        sa.Column("rating", sa.Numeric(2, 1), nullable=False, server_default="4.5"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_florist_points_owner_id", "florist_points", ["owner_id"])

    op.create_table(
        "flowers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("point_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("florist_points.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("image_path", sa.String(500), nullable=False),
        sa.Column("price_per_stem", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="0"),
        sa.Column("color_tags", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_flowers_point_id", "flowers", ["point_id"])

    op.create_table(
        "portfolio_bouquets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("point_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("florist_points.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("image_path", sa.String(500), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("color_tags", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("composition", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_portfolio_bouquets_point_id", "portfolio_bouquets", ["point_id"])

    op.create_table(
        "ai_generations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("consumer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("point_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("florist_points.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("color_tags", postgresql.JSONB, nullable=False),
        sa.Column("budget", sa.Numeric(10, 2), nullable=False),
        sa.Column("variants", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_generations_consumer_id", "ai_generations", ["consumer_id"])
    op.create_index("ix_ai_generations_point_id", "ai_generations", ["point_id"])

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("consumer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("point_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("florist_points.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "source",
            _enum("order_source", "ai_generated", "portfolio"),
            nullable=False,
        ),
        sa.Column(
            "status",
            _enum(
                "order_status",
                "pending", "accepted", "declined", "in_progress", "ready_for_pickup",
                "completed", "rejected_by_client", "cancelled", "cancelled_by_florist",
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("composition_snapshot", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("portfolio_bouquet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolio_bouquets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ai_generation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_generations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ai_variant_index", sa.Integer, nullable=True),
        sa.Column("client_message", sa.Text, nullable=True),
        sa.Column("budget", sa.Numeric(10, 2), nullable=True),
        sa.Column("result_image_path", sa.String(500), nullable=True),
        sa.Column("decline_reason", sa.Text, nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("in_progress_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "(source = 'portfolio' AND portfolio_bouquet_id IS NOT NULL "
            "AND ai_generation_id IS NULL) "
            "OR (source = 'ai_generated' AND ai_generation_id IS NOT NULL "
            "AND portfolio_bouquet_id IS NULL)",
            name="ck_orders_orders_source_consistency",
        ),
    )
    op.create_index("ix_orders_consumer_id", "orders", ["consumer_id"])
    op.create_index("ix_orders_point_id", "orders", ["point_id"])
    op.create_index("ix_orders_status", "orders", ["status"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type",
            _enum(
                "notification_type",
                "order_created", "order_accepted", "order_declined", "order_in_progress",
                "order_ready", "order_completed", "order_rejected_by_client",
                "order_cancelled", "order_cancelled_by_florist", "role_changed",
            ),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("orders")
    op.drop_table("ai_generations")
    op.drop_table("portfolio_bouquets")
    op.drop_table("flowers")
    op.drop_table("florist_points")
    op.drop_table("refresh_tokens")
    op.drop_table("users")

    for enum_name in ("notification_type", "order_status", "order_source", "role"):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
