from __future__ import annotations

from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIConfig

CONFIG_ID = 1


async def get(session: AsyncSession) -> AIConfig | None:
    return await session.get(AIConfig, CONFIG_ID)


async def update_fields(session: AsyncSession, *, fields: dict[str, Any]) -> None:
    if not fields:
        return
    await session.execute(
        update(AIConfig).where(AIConfig.id == CONFIG_ID).values(**fields)
    )
    await session.flush()
