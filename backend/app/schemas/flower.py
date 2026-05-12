from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import ColorTag


class FlowerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    point_id: UUID
    name: str
    image_path: str
    price_per_stem: Decimal
    quantity: int
    color_tags: list[ColorTag]
    description: str | None = None
    is_active: bool
    created_at: datetime


class FlowerCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    image_path: str = Field(min_length=1, max_length=500)
    price_per_stem: Decimal = Field(ge=0)
    quantity: int = Field(ge=0)
    color_tags: list[ColorTag] = Field(min_length=1)
    description: str | None = Field(default=None, max_length=2000)


class FlowerUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    image_path: str | None = Field(default=None, min_length=1, max_length=500)
    price_per_stem: Decimal | None = Field(default=None, ge=0)
    quantity: int | None = Field(default=None, ge=0)
    color_tags: list[ColorTag] | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, max_length=2000)
