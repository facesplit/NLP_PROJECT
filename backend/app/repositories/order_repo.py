from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderStatus
from app.models import FloristPoint, Order


async def get_by_id(session: AsyncSession, order_id: UUID) -> Order | None:
    return await session.get(Order, order_id)


async def list_for_consumer(
    session: AsyncSession, consumer_id: UUID, *, status: OrderStatus | None = None
) -> list[Order]:
    stmt = select(Order).where(Order.consumer_id == consumer_id).order_by(Order.created_at.desc())
    if status is not None:
        stmt = stmt.where(Order.status == status)
    return list((await session.execute(stmt)).scalars())


async def list_for_florist(
    session: AsyncSession, owner_id: UUID, *, status: OrderStatus | None = None
) -> list[Order]:
    stmt = (
        select(Order)
        .join(FloristPoint, FloristPoint.id == Order.point_id)
        .where(FloristPoint.owner_id == owner_id)
        .order_by(Order.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(Order.status == status)
    return list((await session.execute(stmt)).scalars())
