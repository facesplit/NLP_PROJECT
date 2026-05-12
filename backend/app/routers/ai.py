from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status as http_status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import require_role
from app.core.enums import Role
from app.core.errors import NOT_FOUND, AppError
from app.models import User
from app.repositories import ai_generation_repo
from app.schemas.ai import (
    AIGenerateAccepted,
    AIGenerateIn,
    AIGenerationOut,
    AIGenerationStatusOut,
    AIVariant,
)
from app.services.ai_generator import get_generator

router = APIRouter(prefix="/api", tags=["ai"])


@router.post(
    "/ai/generate-bouquet",
    response_model=AIGenerateAccepted,
    status_code=http_status.HTTP_202_ACCEPTED,
)
async def generate(
    payload: AIGenerateIn,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    gen = get_generator()
    response = await gen.generate(session, consumer_id=me.id, data=payload)

    if response.generation_id is None:
        raise AppError(code=NOT_FOUND, message=response.error_message or "Не удалось", status=400)

    row = await ai_generation_repo.get_by_id(session, response.generation_id)
    status_str = row.status if row else "ready"
    body = AIGenerateAccepted(generation_id=response.generation_id, status=status_str)
    return JSONResponse(
        status_code=http_status.HTTP_202_ACCEPTED, content=body.model_dump(mode="json")
    )


@router.get("/me/ai-generations/{generation_id}", response_model=AIGenerationOut)
async def get_generation(
    generation_id: UUID,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> AIGenerationOut:
    gen = await ai_generation_repo.get_for_consumer(session, generation_id, me.id)
    if gen is None:
        raise AppError(code=NOT_FOUND, message="Генерация не найдена.", status=404)
    return AIGenerationOut.model_validate(gen)


@router.get("/me/ai-generations/{generation_id}/status", response_model=AIGenerationStatusOut)
async def get_generation_status(
    generation_id: UUID,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> AIGenerationStatusOut:
    gen = await ai_generation_repo.get_for_consumer(session, generation_id, me.id)
    if gen is None:
        raise AppError(code=NOT_FOUND, message="Генерация не найдена.", status=404)
    variants = [AIVariant.model_validate(v) for v in (gen.variants or [])]
    return AIGenerationStatusOut(
        generation_id=gen.id,
        status=gen.status,
        variants=variants,
        error_message=gen.error_message,
    )
