from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NOT_FOUND, AppError
from app.models import FloristPoint, User
from app.repositories import point_repo
from app.schemas.point import PointCreateIn, PointUpdateIn


async def list_public_with_counts(session: AsyncSession, q: str | None) -> list[dict]:
    points = await point_repo.list_public(session, q=q)
    result = []
    for p in points:
        flower_count, portfolio_count = await point_repo.counts_for_point(session, p.id)
        result.append(
            {
                "id": p.id,
                "owner_id": p.owner_id,
                "name": p.name,
                "address": p.address,
                "description": p.description,
                "cover_image_path": p.cover_image_path,
                "rating": p.rating,
                "is_active": p.is_active,
                "created_at": p.created_at,
                "flower_count": flower_count,
                "portfolio_count": portfolio_count,
            }
        )
    return result


async def get_public_with_counts(session: AsyncSession, point_id: UUID) -> dict:
    p = await point_repo.get_by_id(session, point_id)
    if p is None or not p.is_active:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)
    flower_count, portfolio_count = await point_repo.counts_for_point(session, p.id)
    return {
        "id": p.id,
        "owner_id": p.owner_id,
        "name": p.name,
        "address": p.address,
        "description": p.description,
        "cover_image_path": p.cover_image_path,
        "rating": p.rating,
        "is_active": p.is_active,
        "created_at": p.created_at,
        "flower_count": flower_count,
        "portfolio_count": portfolio_count,
    }


async def list_for_owner(session: AsyncSession, owner: User) -> list[FloristPoint]:
    return await point_repo.list_for_owner(session, owner.id)


async def list_for_owner_with_counts(session: AsyncSession, owner: User) -> list[dict]:
    points = await point_repo.list_for_owner(session, owner.id)
    result = []
    for p in points:
        flower_count, portfolio_count = await point_repo.counts_for_point(session, p.id)
        result.append(
            {
                "id": p.id,
                "owner_id": p.owner_id,
                "name": p.name,
                "address": p.address,
                "description": p.description,
                "cover_image_path": p.cover_image_path,
                "rating": p.rating,
                "is_active": p.is_active,
                "created_at": p.created_at,
                "flower_count": flower_count,
                "portfolio_count": portfolio_count,
            }
        )
    return result


async def create_for_owner(
    session: AsyncSession, owner: User, data: PointCreateIn
) -> FloristPoint:
    point = FloristPoint(
        owner_id=owner.id,
        name=data.name.strip(),
        address=data.address.strip(),
        description=(data.description or "").strip() or None,
        cover_image_path=data.cover_image_path,
    )
    session.add(point)
    await session.flush()
    return point


async def _get_owned_or_404(
    session: AsyncSession, owner: User, point_id: UUID
) -> FloristPoint:
    point = await point_repo.get_active_with_owner_check(session, point_id, owner.id)
    if point is None:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)
    return point


async def update_for_owner(
    session: AsyncSession, owner: User, point_id: UUID, patch: PointUpdateIn
) -> FloristPoint:
    point = await _get_owned_or_404(session, owner, point_id)
    if patch.name is not None:
        point.name = patch.name.strip()
    if patch.address is not None:
        point.address = patch.address.strip()
    if patch.description is not None:
        point.description = patch.description.strip() or None
    if patch.cover_image_path is not None:
        point.cover_image_path = patch.cover_image_path
    await session.flush()
    return point


async def soft_delete_for_owner(
    session: AsyncSession, owner: User, point_id: UUID
) -> None:
    point = await _get_owned_or_404(session, owner, point_id)
    point.is_active = False
    await session.flush()


async def set_cover(
    session: AsyncSession, owner: User, point_id: UUID, image_path: str
) -> FloristPoint:
    point = await _get_owned_or_404(session, owner, point_id)
    point.cover_image_path = image_path
    await session.flush()
    return point
