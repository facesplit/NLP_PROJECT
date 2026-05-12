from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PortfolioBouquet


async def list_for_point(
    session: AsyncSession, point_id: UUID, *, only_active: bool = True
) -> list[PortfolioBouquet]:
    stmt = select(PortfolioBouquet).where(PortfolioBouquet.point_id == point_id)
    if only_active:
        stmt = stmt.where(PortfolioBouquet.is_active.is_(True))
    stmt = stmt.order_by(PortfolioBouquet.created_at.desc())
    return list((await session.execute(stmt)).scalars())


async def get_by_id(session: AsyncSession, bouquet_id: UUID) -> PortfolioBouquet | None:
    return await session.get(PortfolioBouquet, bouquet_id)


async def get_for_point(
    session: AsyncSession, point_id: UUID, bouquet_id: UUID
) -> PortfolioBouquet | None:
    stmt = select(PortfolioBouquet).where(
        PortfolioBouquet.id == bouquet_id, PortfolioBouquet.point_id == point_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()
