from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user, require_role
from app.core.enums import OrderStatus, Role
from app.models import User
from app.schemas.order import (
    OrderCreateIn,
    OrderOut,
    OrderReadyIn,
    OrderReasonIn,
)
from app.services import order_service

router = APIRouter(prefix="/api", tags=["orders"])


@router.post("/orders", response_model=OrderOut)
async def create_order(
    payload: OrderCreateIn,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.create(session, me, payload)
    return OrderOut.model_validate(order)


@router.get("/me/orders", response_model=list[OrderOut])
async def list_my_orders(
    status: OrderStatus | None = Query(default=None),
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[OrderOut]:
    orders = await order_service.list_for_user(session, me, status)
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: UUID,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.get_for_user(session, me, order_id)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/accept", response_model=OrderOut)
async def accept(
    order_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.accept(session, me, order_id)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/decline", response_model=OrderOut)
async def decline(
    order_id: UUID,
    payload: OrderReasonIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.decline(session, me, order_id, payload.reason)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/start", response_model=OrderOut)
async def start(
    order_id: UUID,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.start(session, me, order_id)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/ready", response_model=OrderOut)
async def ready(
    order_id: UUID,
    payload: OrderReadyIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.ready(session, me, order_id, payload.result_image_path)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/complete", response_model=OrderOut)
async def complete(
    order_id: UUID,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.complete(session, me, order_id)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/reject-result", response_model=OrderOut)
async def reject_result(
    order_id: UUID,
    payload: OrderReasonIn,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.reject_result(session, me, order_id, payload.reason)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
async def cancel_by_consumer(
    order_id: UUID,
    me: User = Depends(require_role(Role.CONSUMER)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.cancel_by_consumer(session, me, order_id)
    return OrderOut.model_validate(order)


@router.post("/orders/{order_id}/cancel-by-florist", response_model=OrderOut)
async def cancel_by_florist(
    order_id: UUID,
    payload: OrderReasonIn,
    me: User = Depends(require_role(Role.FLORISTADMIN)),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    order = await order_service.cancel_by_florist(session, me, order_id, payload.reason)
    return OrderOut.model_validate(order)
