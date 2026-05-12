from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import require_role
from app.core.enums import Role
from app.models import User
from app.schemas.portfolio import (
    PortfolioBouquetOut,
    PortfolioCreateIn,
    PortfolioUpdateIn,
)
from app.services import portfolio_service

public_router = APIRouter(prefix="/api/points", tags=["portfolio"])
me_router = APIRouter(prefix="/api/me/points", tags=["portfolio"])


@public_router.get("/{point_id}/portfolio", response_model=list[PortfolioBouquetOut])
async def list_public(
    point_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> list[PortfolioBouquetOut]:
    bouquets = await portfolio_service.list_public(session, point_id)
    return [PortfolioBouquetOut.model_validate(b) for b in bouquets]


@me_router.get("/{point_id}/portfolio", response_model=list[PortfolioBouquetOut])
async def list_me(
    point_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> list[PortfolioBouquetOut]:
    bouquets = await portfolio_service.list_for_point(session, me, point_id)
    return [PortfolioBouquetOut.model_validate(b) for b in bouquets]


@me_router.post("/{point_id}/portfolio", response_model=PortfolioBouquetOut)
async def create_bouquet(
    point_id: UUID,
    payload: PortfolioCreateIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> PortfolioBouquetOut:
    bq = await portfolio_service.create(session, me, point_id, payload)
    return PortfolioBouquetOut.model_validate(bq)


@me_router.patch("/{point_id}/portfolio/{bouquet_id}", response_model=PortfolioBouquetOut)
async def update_bouquet(
    point_id: UUID,
    bouquet_id: UUID,
    payload: PortfolioUpdateIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> PortfolioBouquetOut:
    bq = await portfolio_service.update(session, me, point_id, bouquet_id, payload)
    return PortfolioBouquetOut.model_validate(bq)


@me_router.delete("/{point_id}/portfolio/{bouquet_id}")
async def delete_bouquet(
    point_id: UUID,
    bouquet_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await portfolio_service.soft_delete(session, me, point_id, bouquet_id)
    return {"ok": True}
