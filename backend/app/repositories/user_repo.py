from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Role
from app.models import User


async def get_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(func.lower(User.email) == email.lower())
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_users(
    session: AsyncSession,
    *,
    role: Role | None = None,
    is_active: bool | None = None,
    q: str | None = None,
) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.email).like(like),
                func.lower(User.display_name).like(like),
            )
        )
    return list((await session.execute(stmt)).scalars())


async def count_active_superadmins(session: AsyncSession, *, exclude_id: UUID | None = None) -> int:
    stmt = select(func.count()).select_from(User).where(
        User.role == Role.SUPERADMIN, User.is_active.is_(True)
    )
    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)
    return int((await session.execute(stmt)).scalar_one())
