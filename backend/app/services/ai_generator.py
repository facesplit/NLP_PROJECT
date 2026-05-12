from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai import AIGenerateIn, AIGenerateResponse


class AIGenerator(Protocol):
    async def generate(
        self,
        session: AsyncSession,
        *,
        consumer_id: UUID,
        data: AIGenerateIn,
    ) -> AIGenerateResponse: ...


def get_generator() -> AIGenerator:
    from app.core.config import get_settings
    from app.services.ai_comfyui import AIComfyUIGenerator
    from app.services.ai_mock import MockAIGenerator

    settings = get_settings()
    if settings.ai_provider in ("comfyui", "ollama"):
        return AIComfyUIGenerator()
    return MockAIGenerator()
