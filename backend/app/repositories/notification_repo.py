from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification


async def list_for_user(session: AsyncSession, user_id: UUID, *, limit: int = 100) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def unread_count(session: AsyncSession, user_id: UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
    )
    return int((await session.execute(stmt)).scalar_one())


async def mark_one_read(session: AsyncSession, notif_id: UUID, user_id: UUID) -> None:
    await session.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == user_id)
        .values(is_read=True)
    )


async def mark_all_read(session: AsyncSession, user_id: UUID) -> None:
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
