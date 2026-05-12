from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import OrderSource, OrderStatus
from app.models.base import Base


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "(source = 'portfolio' AND portfolio_bouquet_id IS NOT NULL "
            "AND ai_generation_id IS NULL) "
            "OR (source = 'ai_generated' AND ai_generation_id IS NOT NULL "
            "AND portfolio_bouquet_id IS NULL)",
            name="orders_source_consistency",
        ),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    consumer_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    point_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("florist_points.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source: Mapped[OrderSource] = mapped_column(
        PgEnum(
            OrderSource,
            name="order_source",
            values_callable=lambda e: [v.value for v in e],
        ),
        nullable=False,
    )
    status: Mapped[OrderStatus] = mapped_column(
        PgEnum(
            OrderStatus,
            name="order_status",
            values_callable=lambda e: [v.value for v in e],
        ),
        default=OrderStatus.PENDING,
        nullable=False,
        index=True,
    )
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    composition_snapshot: Mapped[list[Any]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    portfolio_bouquet_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("portfolio_bouquets.id", ondelete="SET NULL"),
        nullable=True,
    )
    ai_generation_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("ai_generations.id", ondelete="SET NULL"),
        nullable=True,
    )
    ai_variant_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    client_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    budget: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    result_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decline_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    in_progress_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
