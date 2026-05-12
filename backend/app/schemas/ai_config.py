from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AIConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    system_prompt: str
    negative_prompt: str
    sampler_steps: int
    sampler_cfg: Decimal
    sampler_name: str
    image_width: int
    image_height: int
    budget_lower_pct: Decimal
    budget_upper_pct: Decimal
    llm_temperature: Decimal
    llm_max_retries: int
    max_references: int
    pipeline_version: str
    updated_at: datetime
    updated_by: UUID | None = None


class AIConfigPatchIn(BaseModel):
    """Partial update — every field is optional."""

    system_prompt: str | None = None
    negative_prompt: str | None = None
    sampler_steps: int | None = None
    sampler_cfg: Decimal | None = None
    sampler_name: str | None = None
    image_width: int | None = None
    image_height: int | None = None
    budget_lower_pct: Decimal | None = None
    budget_upper_pct: Decimal | None = None
    llm_temperature: Decimal | None = None
    llm_max_retries: int | None = None
    max_references: int | None = None
    pipeline_version: str | None = None
