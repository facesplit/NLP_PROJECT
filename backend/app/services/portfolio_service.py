from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NOT_FOUND, VALIDATION_ERROR, AppError
from app.models import PortfolioBouquet, User
from app.repositories import flower_repo, point_repo, portfolio_repo
from app.schemas.portfolio import PortfolioCreateIn, PortfolioUpdateIn


async def _ensure_owner_point(session: AsyncSession, owner: User, point_id: UUID) -> None:
    point = await point_repo.get_active_with_owner_check(session, point_id, owner.id)
    if point is None or not point.is_active:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)


async def list_public(session: AsyncSession, point_id: UUID) -> list[PortfolioBouquet]:
    point = await point_repo.get_by_id(session, point_id)
    if point is None or not point.is_active:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)
    return await portfolio_repo.list_for_point(session, point_id)


async def list_for_point(session: AsyncSession, owner: User, point_id: UUID) -> list[PortfolioBouquet]:
    await _ensure_owner_point(session, owner, point_id)
    return await portfolio_repo.list_for_point(session, point_id)


async def _validate_composition(
    session: AsyncSession, point_id: UUID, composition: list[dict]
) -> None:
    flower_ids = [c["flower_id"] for c in composition]
    flowers = []
    for fid in flower_ids:
        f = await flower_repo.get_for_point(session, point_id, fid)
        if f is None or not f.is_active:
            raise AppError(
                code=VALIDATION_ERROR,
                message="Цветок не принадлежит этой точке.",
                status=400,
            )
        flowers.append(f)


async def create(
    session: AsyncSession, owner: User, point_id: UUID, data: PortfolioCreateIn
) -> PortfolioBouquet:
    await _ensure_owner_point(session, owner, point_id)
    composition = [
        {"flower_id": str(c.flower_id), "quantity": c.quantity}
        for c in data.composition
    ]
    await _validate_composition(
        session,
        point_id,
        [{"flower_id": UUID(c["flower_id"]), "quantity": c["quantity"]} for c in composition],
    )
    bq = PortfolioBouquet(
        point_id=point_id,
        name=data.name.strip(),
        description=data.description.strip(),
        image_path=data.image_path,
        price=data.price,
        color_tags=[t.value for t in data.color_tags],
        composition=composition,
    )
    session.add(bq)
    await session.flush()
    return bq


async def update(
    session: AsyncSession,
    owner: User,
    point_id: UUID,
    bouquet_id: UUID,
    patch: PortfolioUpdateIn,
) -> PortfolioBouquet:
    await _ensure_owner_point(session, owner, point_id)
    bq = await portfolio_repo.get_for_point(session, point_id, bouquet_id)
    if bq is None or not bq.is_active:
        raise AppError(code=NOT_FOUND, message="Букет не найден.", status=404)
    if patch.name is not None:
        bq.name = patch.name.strip()
    if patch.description is not None:
        bq.description = patch.description.strip()
    if patch.image_path is not None:
        bq.image_path = patch.image_path
    if patch.price is not None:
        bq.price = patch.price
    if patch.color_tags is not None:
        bq.color_tags = [t.value for t in patch.color_tags]
    if patch.composition is not None:
        await _validate_composition(
            session, point_id, [{"flower_id": c.flower_id, "quantity": c.quantity} for c in patch.composition]
        )
        bq.composition = [
            {"flower_id": str(c.flower_id), "quantity": c.quantity}
            for c in patch.composition
        ]
    await session.flush()
    return bq


async def soft_delete(
    session: AsyncSession, owner: User, point_id: UUID, bouquet_id: UUID
) -> None:
    await _ensure_owner_point(session, owner, point_id)
    bq = await portfolio_repo.get_for_point(session, point_id, bouquet_id)
    if bq is None or not bq.is_active:
        raise AppError(code=NOT_FOUND, message="Букет не найден.", status=404)
    bq.is_active = False
    await session.flush()
