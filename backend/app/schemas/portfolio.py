from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import ColorTag


class CompositionItemIn(BaseModel):
    flower_id: UUID
    quantity: int = Field(ge=1)


class CompositionItemOut(BaseModel):
    flower_id: UUID
    quantity: int


class PortfolioBouquetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    point_id: UUID
    name: str
    description: str | None = None
    image_path: str
    price: Decimal
    color_tags: list[ColorTag]
    composition: list[CompositionItemOut]
    is_active: bool
    created_at: datetime


class PortfolioCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    image_path: str = Field(min_length=1, max_length=500)
    price: Decimal = Field(ge=0)
    color_tags: list[ColorTag] = Field(min_length=1)
    composition: list[CompositionItemIn] = Field(min_length=1)


class PortfolioUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    image_path: str | None = Field(default=None, min_length=1, max_length=500)
    price: Decimal | None = Field(default=None, ge=0)
    color_tags: list[ColorTag] | None = Field(default=None, min_length=1)
    composition: list[CompositionItemIn] | None = Field(default=None, min_length=1)
