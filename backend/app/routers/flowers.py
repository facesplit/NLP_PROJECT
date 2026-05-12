from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import require_role
from app.core.enums import Role
from app.models import User
from app.schemas.flower import FlowerCreateIn, FlowerOut, FlowerUpdateIn
from app.services import flower_service

public_router = APIRouter(prefix="/api/points", tags=["flowers"])
me_router = APIRouter(prefix="/api/me/points", tags=["flowers"])


@public_router.get("/{point_id}/flowers", response_model=list[FlowerOut])
async def list_flowers_public(
    point_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> list[FlowerOut]:
    flowers = await flower_service.list_for_point_public(session, point_id)
    return [FlowerOut.model_validate(f) for f in flowers]


@me_router.get("/{point_id}/flowers", response_model=list[FlowerOut])
async def list_flowers_me(
    point_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> list[FlowerOut]:
    flowers = await flower_service.list_for_point(session, me, point_id)
    return [FlowerOut.model_validate(f) for f in flowers]


@me_router.post("/{point_id}/flowers", response_model=FlowerOut)
async def create_flower(
    point_id: UUID,
    payload: FlowerCreateIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> FlowerOut:
    flower = await flower_service.create(session, me, point_id, payload)
    return FlowerOut.model_validate(flower)


@me_router.patch("/{point_id}/flowers/{flower_id}", response_model=FlowerOut)
async def update_flower(
    point_id: UUID,
    flower_id: UUID,
    payload: FlowerUpdateIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> FlowerOut:
    flower = await flower_service.update(session, me, point_id, flower_id, payload)
    return FlowerOut.model_validate(flower)


@me_router.delete("/{point_id}/flowers/{flower_id}")
async def delete_flower(
    point_id: UUID,
    flower_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await flower_service.soft_delete(session, me, point_id, flower_id)
    return {"ok": True}
