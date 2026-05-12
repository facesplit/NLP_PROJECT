from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import require_role
from app.core.enums import Role
from app.models import User
from app.schemas.point import (
    PointCreateIn,
    PointOut,
    PointPublicOut,
    PointUpdateIn,
)
from app.services import point_service

public_router = APIRouter(prefix="/api/points", tags=["points"])
me_router = APIRouter(prefix="/api/me/points", tags=["points"])


@public_router.get("", response_model=list[PointPublicOut])
async def list_public(
    q: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[PointPublicOut]:
    rows = await point_service.list_public_with_counts(session, q)
    return [PointPublicOut(**r) for r in rows]


@public_router.get("/{point_id}", response_model=PointPublicOut)
async def get_public(
    point_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> PointPublicOut:
    row = await point_service.get_public_with_counts(session, point_id)
    return PointPublicOut(**row)


@me_router.get("", response_model=list[PointPublicOut])
async def list_mine(
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> list[PointPublicOut]:
    rows = await point_service.list_for_owner_with_counts(session, me)
    return [PointPublicOut(**r) for r in rows]


@me_router.post("", response_model=PointOut)
async def create_point(
    payload: PointCreateIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> PointOut:
    point = await point_service.create_for_owner(session, me, payload)
    return PointOut.model_validate(point)


@me_router.patch("/{point_id}", response_model=PointOut)
async def update_point(
    point_id: UUID,
    payload: PointUpdateIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> PointOut:
    point = await point_service.update_for_owner(session, me, point_id, payload)
    return PointOut.model_validate(point)


@me_router.delete("/{point_id}")
async def delete_point(
    point_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await point_service.soft_delete_for_owner(session, me, point_id)
    return {"ok": True}
