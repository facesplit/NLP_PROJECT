from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import OrderSource, OrderStatus


class OrderCompositionItem(BaseModel):
    flower_id: UUID
    name: str
    price_per_stem: Decimal
    quantity: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    consumer_id: UUID
    point_id: UUID
    source: OrderSource
    status: OrderStatus
    total_price: Decimal
    composition_snapshot: list[OrderCompositionItem]
    portfolio_bouquet_id: UUID | None = None
    ai_generation_id: UUID | None = None
    ai_variant_index: int | None = None
    client_message: str | None = None
    budget: Decimal | None = None
    result_image_path: str | None = None
    decline_reason: str | None = None
    rejection_reason: str | None = None
    accepted_at: datetime | None = None
    in_progress_at: datetime | None = None
    ready_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class OrderCreateIn(BaseModel):
    point_id: UUID
    source: OrderSource
    ai_generation_id: UUID | None = None
    ai_variant_index: int | None = Field(default=None, ge=0, le=2)
    portfolio_bouquet_id: UUID | None = None
    client_message: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _validate_source_consistency(self) -> "OrderCreateIn":
        if self.source == OrderSource.AI_GENERATED:
            if self.ai_generation_id is None or self.ai_variant_index is None:
                raise ValueError("ai_generation_id и ai_variant_index обязательны для AI-заказа")
            if self.portfolio_bouquet_id is not None:
                raise ValueError("portfolio_bouquet_id недопустим для AI-заказа")
        else:
            if self.portfolio_bouquet_id is None:
                raise ValueError("portfolio_bouquet_id обязателен для заказа из портфолио")
            if self.ai_generation_id is not None or self.ai_variant_index is not None:
                raise ValueError("AI-поля недопустимы для заказа из портфолио")
        return self


class OrderReasonIn(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class OrderReadyIn(BaseModel):
    result_image_path: str = Field(min_length=1, max_length=500)
