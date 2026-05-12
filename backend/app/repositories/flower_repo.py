from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Flower


async def list_for_point(session: AsyncSession, point_id: UUID, *, only_active: bool = True) -> list[Flower]:
    stmt = select(Flower).where(Flower.point_id == point_id)
    if only_active:
        stmt = stmt.where(Flower.is_active.is_(True))
    stmt = stmt.order_by(Flower.created_at.desc())
    return list((await session.execute(stmt)).scalars())


async def get_by_id(session: AsyncSession, flower_id: UUID) -> Flower | None:
    return await session.get(Flower, flower_id)


async def get_for_point(
    session: AsyncSession, point_id: UUID, flower_id: UUID
) -> Flower | None:
    stmt = select(Flower).where(Flower.id == flower_id, Flower.point_id == point_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_many_for_update(
    session: AsyncSession, flower_ids: Iterable[UUID]
) -> list[Flower]:
    ids = list(flower_ids)
    if not ids:
        return []
    stmt = (
        select(Flower)
        .where(Flower.id.in_(ids))
        .with_for_update()
        .order_by(Flower.id)
    )
    return list((await session.execute(stmt)).scalars())
