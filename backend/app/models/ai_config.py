from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AIConfig(Base):
    __tablename__ = "ai_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    negative_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    sampler_steps: Mapped[int] = mapped_column(Integer, nullable=False)
    sampler_cfg: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    sampler_name: Mapped[str] = mapped_column(String(40), nullable=False)
    image_width: Mapped[int] = mapped_column(Integer, nullable=False)
    image_height: Mapped[int] = mapped_column(Integer, nullable=False)
    budget_lower_pct: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    budget_upper_pct: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    llm_temperature: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    llm_max_retries: Mapped[int] = mapped_column(Integer, nullable=False)
    max_references: Mapped[int] = mapped_column(Integer, nullable=False)
    pipeline_version: Mapped[str] = mapped_column(String(8), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
