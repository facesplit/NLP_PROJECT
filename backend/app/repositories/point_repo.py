from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Flower, FloristPoint, PortfolioBouquet


async def list_public(session: AsyncSession, *, q: str | None = None) -> list[FloristPoint]:
    stmt = select(FloristPoint).where(FloristPoint.is_active.is_(True)).order_by(FloristPoint.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(FloristPoint.name).like(like),
                func.lower(FloristPoint.address).like(like),
            )
        )
    return list((await session.execute(stmt)).scalars())


async def list_for_owner(session: AsyncSession, owner_id: UUID) -> list[FloristPoint]:
    stmt = (
        select(FloristPoint)
        .where(FloristPoint.owner_id == owner_id)
        .order_by(FloristPoint.created_at.desc())
    )
    return list((await session.execute(stmt)).scalars())


async def get_by_id(session: AsyncSession, point_id: UUID) -> FloristPoint | None:
    return await session.get(FloristPoint, point_id)


async def get_active_with_owner_check(
    session: AsyncSession, point_id: UUID, owner_id: UUID
) -> FloristPoint | None:
    stmt = select(FloristPoint).where(
        FloristPoint.id == point_id, FloristPoint.owner_id == owner_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def counts_for_point(session: AsyncSession, point_id: UUID) -> tuple[int, int]:
    """Returns (flower_count, portfolio_count) of active rows."""
    f_stmt = select(func.count()).select_from(Flower).where(
        Flower.point_id == point_id, Flower.is_active.is_(True)
    )
    p_stmt = select(func.count()).select_from(PortfolioBouquet).where(
        PortfolioBouquet.point_id == point_id, PortfolioBouquet.is_active.is_(True)
    )
    flower_count = int((await session.execute(f_stmt)).scalar_one())
    portfolio_count = int((await session.execute(p_stmt)).scalar_one())
    return flower_count, portfolio_count
