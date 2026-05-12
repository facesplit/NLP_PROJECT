from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import ColorTag


GenerationMode = Literal["ai", "manual"]
ArrangementType = Literal["handheld", "vase", "centerpiece"]


class AIManualCompositionItem(BaseModel):
    flower_id: UUID
    quantity: int = Field(ge=1, le=200)


class AIGenerateIn(BaseModel):
    point_id: UUID
    prompt: str = Field(min_length=1, max_length=1000)
    color_tags: list[ColorTag] = Field(min_length=1)
    budget: Decimal = Field(gt=0)
    # Wizard fields (optional, all backwards-compatible)
    arrangement_type: ArrangementType | None = None
    container_style: str | None = Field(default=None, max_length=400)
    # Manual mode: client picks composition directly, LLM is bypassed
    mode: GenerationMode = "ai"
    composition: list[AIManualCompositionItem] | None = None


class AICompositionItem(BaseModel):
    flower_id: UUID
    name: str
    quantity: int
    price_per_stem: Decimal
    subtotal: Decimal


VariantStatus = Literal["pending", "ready", "failed"]
GenerationStatus = Literal["pending", "ready", "failed"]


class AIVariant(BaseModel):
    index: int
    status: VariantStatus = "ready"
    image_path: str | None = None
    composition: list[AICompositionItem]
    total_price: Decimal
    explanation: str
    error: str | None = None


class AIGenerationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    consumer_id: UUID
    point_id: UUID
    prompt: str
    color_tags: list[ColorTag]
    budget: Decimal
    variants: list[AIVariant]
    status: GenerationStatus = "ready"
    error_message: str | None = None
    created_at: datetime


class AIGenerateAccepted(BaseModel):
    """Response of POST /api/ai/generate-bouquet — server accepted, work continues async."""

    generation_id: UUID
    status: GenerationStatus


class AIGenerationStatusOut(BaseModel):
    generation_id: UUID
    status: GenerationStatus
    variants: list[AIVariant]
    error_message: str | None = None


# Kept for back-compat with existing AIGenerator Protocol callers in tests.
class AIGenerateResponse(BaseModel):
    generation_id: UUID | None = None
    variants: list[AIVariant] = Field(default_factory=list)
    error_message: str | None = None
