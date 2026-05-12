from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NOT_FOUND, AppError
from app.models import Flower, User
from app.repositories import flower_repo, point_repo
from app.schemas.flower import FlowerCreateIn, FlowerUpdateIn


async def _ensure_owner_point(session: AsyncSession, owner: User, point_id: UUID) -> None:
    point = await point_repo.get_active_with_owner_check(session, point_id, owner.id)
    if point is None or not point.is_active:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)


async def list_for_point(session: AsyncSession, owner: User, point_id: UUID) -> list[Flower]:
    await _ensure_owner_point(session, owner, point_id)
    return await flower_repo.list_for_point(session, point_id)


async def list_for_point_public(session: AsyncSession, point_id: UUID) -> list[Flower]:
    point = await point_repo.get_by_id(session, point_id)
    if point is None or not point.is_active:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)
    return await flower_repo.list_for_point(session, point_id)


async def create(
    session: AsyncSession, owner: User, point_id: UUID, data: FlowerCreateIn
) -> Flower:
    await _ensure_owner_point(session, owner, point_id)
    flower = Flower(
        point_id=point_id,
        name=data.name.strip(),
        image_path=data.image_path,
        price_per_stem=data.price_per_stem,
        quantity=data.quantity,
        color_tags=[t.value for t in data.color_tags],
        description=(data.description or "").strip() or None,
    )
    session.add(flower)
    await session.flush()
    return flower


async def update(
    session: AsyncSession,
    owner: User,
    point_id: UUID,
    flower_id: UUID,
    patch: FlowerUpdateIn,
) -> Flower:
    await _ensure_owner_point(session, owner, point_id)
    flower = await flower_repo.get_for_point(session, point_id, flower_id)
    if flower is None or not flower.is_active:
        raise AppError(code=NOT_FOUND, message="Цветок не найден.", status=404)
    if patch.name is not None:
        flower.name = patch.name.strip()
    if patch.image_path is not None:
        flower.image_path = patch.image_path
    if patch.price_per_stem is not None:
        flower.price_per_stem = patch.price_per_stem
    if patch.quantity is not None:
        flower.quantity = patch.quantity
    if patch.color_tags is not None:
        flower.color_tags = [t.value for t in patch.color_tags]
    if patch.description is not None:
        flower.description = patch.description.strip() or None
    await session.flush()
    return flower


async def soft_delete(
    session: AsyncSession, owner: User, point_id: UUID, flower_id: UUID
) -> None:
    await _ensure_owner_point(session, owner, point_id)
    flower = await flower_repo.get_for_point(session, point_id, flower_id)
    if flower is None or not flower.is_active:
        raise AppError(code=NOT_FOUND, message="Цветок не найден.", status=404)
    flower.is_active = False
    await session.flush()
