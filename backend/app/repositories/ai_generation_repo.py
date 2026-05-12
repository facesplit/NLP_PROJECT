from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIGeneration


async def get_for_consumer(
    session: AsyncSession, generation_id: UUID, consumer_id: UUID
) -> AIGeneration | None:
    stmt = select(AIGeneration).where(
        AIGeneration.id == generation_id, AIGeneration.consumer_id == consumer_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_by_id(session: AsyncSession, generation_id: UUID) -> AIGeneration | None:
    return await session.get(AIGeneration, generation_id)


async def update_variants_and_status(
    session: AsyncSession,
    *,
    generation_id: UUID,
    variants: list[dict[str, Any]],
    status: str,
    error_message: str | None = None,
) -> None:
    await session.execute(
        update(AIGeneration)
        .where(AIGeneration.id == generation_id)
        .values(variants=variants, status=status, error_message=error_message)
    )
    await session.flush()
