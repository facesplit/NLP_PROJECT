from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    name: str
    address: str
    description: str | None = None
    cover_image_path: str | None = None
    rating: Decimal
    is_active: bool
    created_at: datetime


class PointPublicOut(PointOut):
    portfolio_count: int = 0
    flower_count: int = 0


class PointCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    cover_image_path: str | None = Field(default=None, max_length=500)


class PointUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    cover_image_path: str | None = Field(default=None, max_length=500)
