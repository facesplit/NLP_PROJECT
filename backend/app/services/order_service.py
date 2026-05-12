from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import NotificationType, OrderSource, OrderStatus, Role
from app.core.errors import (
    CONFLICT,
    NOT_FOUND,
    SUB_INVALID_STATE_TRANSITION,
    SUB_VARIANT_NOT_READY,
    VALIDATION_ERROR,
    AppError,
)
from app.models import Order, User
from app.repositories import (
    ai_generation_repo,
    flower_repo,
    order_repo,
    point_repo,
    portfolio_repo,
)
from app.schemas.order import OrderCreateIn
from app.services import inventory_service, notification_service

VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {
        OrderStatus.ACCEPTED,
        OrderStatus.DECLINED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.ACCEPTED: {
        OrderStatus.IN_PROGRESS,
        OrderStatus.CANCELLED_BY_FLORIST,
    },
    OrderStatus.IN_PROGRESS: {
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.CANCELLED_BY_FLORIST,
    },
    OrderStatus.READY_FOR_PICKUP: {
        OrderStatus.COMPLETED,
        OrderStatus.REJECTED_BY_CLIENT,
    },
    OrderStatus.COMPLETED: set(),
    OrderStatus.DECLINED: set(),
    OrderStatus.CANCELLED: set(),
    OrderStatus.CANCELLED_BY_FLORIST: set(),
    OrderStatus.REJECTED_BY_CLIENT: set(),
}


def _assert_transition(order: Order, next_status: OrderStatus) -> None:
    allowed = VALID_TRANSITIONS.get(order.status, set())
    if next_status not in allowed:
        raise AppError(
            code=CONFLICT,
            message="Недопустимый переход статуса.",
            status=409,
            details={
                "subcode": SUB_INVALID_STATE_TRANSITION,
                "from": order.status.value,
                "to": next_status.value,
            },
        )


async def _ensure_florist_owns_order(
    session: AsyncSession, order: Order, florist: User
) -> None:
    point = await point_repo.get_by_id(session, order.point_id)
    if point is None or point.owner_id != florist.id:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)


async def _payload_for(session: AsyncSession, order: Order, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    point = await point_repo.get_by_id(session, order.point_id)
    payload = {
        "order_id": str(order.id),
        "point_id": str(order.point_id),
        "point_name": point.name if point else "",
        "status": order.status.value,
        "total_price": str(order.total_price),
    }
    if extra:
        payload.update(extra)
    return payload


async def get_for_user(session: AsyncSession, user: User, order_id: UUID) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    if user.role == Role.CONSUMER and order.consumer_id != user.id:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    if user.role == Role.FLORISTADMIN:
        point = await point_repo.get_by_id(session, order.point_id)
        if point is None or point.owner_id != user.id:
            raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    return order


async def list_for_user(
    session: AsyncSession, user: User, status: OrderStatus | None
) -> list[Order]:
    if user.role == Role.CONSUMER:
        return await order_repo.list_for_consumer(session, user.id, status=status)
    if user.role == Role.FLORISTADMIN:
        return await order_repo.list_for_florist(session, user.id, status=status)
    # superadmin sees all (not strictly needed but harmless)
    consumer_list = await order_repo.list_for_consumer(session, user.id, status=status)
    return consumer_list


async def create(
    session: AsyncSession, consumer: User, data: OrderCreateIn
) -> Order:
    point = await point_repo.get_by_id(session, data.point_id)
    if point is None or not point.is_active:
        raise AppError(code=NOT_FOUND, message="Точка не найдена.", status=404)

    composition_snapshot: list[dict[str, Any]] = []
    total_price: Decimal
    budget: Decimal | None = None

    if data.source == OrderSource.AI_GENERATED:
        gen = await ai_generation_repo.get_for_consumer(
            session, data.ai_generation_id, consumer.id
        )
        if gen is None or gen.point_id != point.id:
            raise AppError(code=NOT_FOUND, message="Генерация не найдена.", status=404)
        try:
            variant = gen.variants[data.ai_variant_index]
        except (IndexError, TypeError) as exc:
            raise AppError(code=VALIDATION_ERROR, message="Вариант не найден.", status=400) from exc

        if isinstance(variant, dict) and variant.get("status") not in (None, "ready"):
            raise AppError(
                code=CONFLICT,
                message="Этот вариант ещё не готов.",
                status=409,
                details={
                    "subcode": SUB_VARIANT_NOT_READY,
                    "current_status": variant.get("status"),
                },
            )

        composition_snapshot = [
            {
                "flower_id": str(c["flower_id"]),
                "name": c["name"],
                "price_per_stem": str(c["price_per_stem"]),
                "quantity": int(c["quantity"]),
            }
            for c in variant["composition"]
        ]
        total_price = Decimal(str(variant["total_price"]))
        budget = gen.budget
    else:
        bq = await portfolio_repo.get_by_id(session, data.portfolio_bouquet_id)
        if bq is None or not bq.is_active or bq.point_id != point.id:
            raise AppError(code=NOT_FOUND, message="Букет не найден.", status=404)
        snapshot = []
        for c in bq.composition:
            flower = await flower_repo.get_by_id(session, UUID(str(c["flower_id"])))
            snapshot.append(
                {
                    "flower_id": str(c["flower_id"]),
                    "name": flower.name if flower else "Цветок",
                    "price_per_stem": str(flower.price_per_stem) if flower else "0",
                    "quantity": int(c["quantity"]),
                }
            )
        composition_snapshot = snapshot
        total_price = Decimal(bq.price)

    order = Order(
        consumer_id=consumer.id,
        point_id=point.id,
        source=data.source,
        status=OrderStatus.PENDING,
        total_price=total_price,
        composition_snapshot=composition_snapshot,
        portfolio_bouquet_id=data.portfolio_bouquet_id,
        ai_generation_id=data.ai_generation_id,
        ai_variant_index=data.ai_variant_index,
        client_message=(data.client_message or "").strip() or None,
        budget=budget,
    )
    session.add(order)
    await session.flush()

    await notification_service.notify(
        session,
        user_id=point.owner_id,
        type_=NotificationType.ORDER_CREATED,
        payload=await _payload_for(session, order),
    )
    return order


async def accept(session: AsyncSession, florist: User, order_id: UUID) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    await _ensure_florist_owns_order(session, order, florist)
    _assert_transition(order, OrderStatus.ACCEPTED)
    await inventory_service.reserve_stock(session, order.composition_snapshot)
    order.status = OrderStatus.ACCEPTED
    order.accepted_at = datetime.now(timezone.utc)
    await session.flush()
    await notification_service.notify(
        session,
        user_id=order.consumer_id,
        type_=NotificationType.ORDER_ACCEPTED,
        payload=await _payload_for(session, order),
    )
    return order


async def decline(
    session: AsyncSession, florist: User, order_id: UUID, reason: str
) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    await _ensure_florist_owns_order(session, order, florist)
    _assert_transition(order, OrderStatus.DECLINED)
    order.status = OrderStatus.DECLINED
    order.decline_reason = reason.strip()
    await session.flush()
    await notification_service.notify(
        session,
        user_id=order.consumer_id,
        type_=NotificationType.ORDER_DECLINED,
        payload=await _payload_for(session, order, {"reason": order.decline_reason}),
    )
    return order


async def start(session: AsyncSession, florist: User, order_id: UUID) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    await _ensure_florist_owns_order(session, order, florist)
    _assert_transition(order, OrderStatus.IN_PROGRESS)
    order.status = OrderStatus.IN_PROGRESS
    order.in_progress_at = datetime.now(timezone.utc)
    await session.flush()
    await notification_service.notify(
        session,
        user_id=order.consumer_id,
        type_=NotificationType.ORDER_IN_PROGRESS,
        payload=await _payload_for(session, order),
    )
    return order


async def ready(
    session: AsyncSession, florist: User, order_id: UUID, image_path: str
) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    await _ensure_florist_owns_order(session, order, florist)
    _assert_transition(order, OrderStatus.READY_FOR_PICKUP)
    order.status = OrderStatus.READY_FOR_PICKUP
    order.ready_at = datetime.now(timezone.utc)
    order.result_image_path = image_path
    await session.flush()
    await notification_service.notify(
        session,
        user_id=order.consumer_id,
        type_=NotificationType.ORDER_READY,
        payload=await _payload_for(session, order),
    )
    return order


async def complete(session: AsyncSession, consumer: User, order_id: UUID) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None or order.consumer_id != consumer.id:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    _assert_transition(order, OrderStatus.COMPLETED)
    order.status = OrderStatus.COMPLETED
    order.completed_at = datetime.now(timezone.utc)
    await session.flush()
    point = await point_repo.get_by_id(session, order.point_id)
    if point is not None:
        await notification_service.notify(
            session,
            user_id=point.owner_id,
            type_=NotificationType.ORDER_COMPLETED,
            payload=await _payload_for(session, order),
        )
    return order


async def reject_result(
    session: AsyncSession, consumer: User, order_id: UUID, reason: str
) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None or order.consumer_id != consumer.id:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    _assert_transition(order, OrderStatus.REJECTED_BY_CLIENT)
    order.status = OrderStatus.REJECTED_BY_CLIENT
    order.rejection_reason = reason.strip()
    await session.flush()
    point = await point_repo.get_by_id(session, order.point_id)
    if point is not None:
        await notification_service.notify(
            session,
            user_id=point.owner_id,
            type_=NotificationType.ORDER_REJECTED_BY_CLIENT,
            payload=await _payload_for(session, order, {"reason": order.rejection_reason}),
        )
    return order


async def cancel_by_consumer(
    session: AsyncSession, consumer: User, order_id: UUID
) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None or order.consumer_id != consumer.id:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    _assert_transition(order, OrderStatus.CANCELLED)
    order.status = OrderStatus.CANCELLED
    await session.flush()
    point = await point_repo.get_by_id(session, order.point_id)
    if point is not None:
        await notification_service.notify(
            session,
            user_id=point.owner_id,
            type_=NotificationType.ORDER_CANCELLED,
            payload=await _payload_for(session, order),
        )
    return order


async def cancel_by_florist(
    session: AsyncSession, florist: User, order_id: UUID, reason: str
) -> Order:
    order = await order_repo.get_by_id(session, order_id)
    if order is None:
        raise AppError(code=NOT_FOUND, message="Заказ не найден.", status=404)
    await _ensure_florist_owns_order(session, order, florist)
    _assert_transition(order, OrderStatus.CANCELLED_BY_FLORIST)
    was_stock_held = order.status in (OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS)
    order.status = OrderStatus.CANCELLED_BY_FLORIST
    order.decline_reason = reason.strip()
    if was_stock_held:
        await inventory_service.restore_stock(session, order.composition_snapshot)
    await session.flush()
    await notification_service.notify(
        session,
        user_id=order.consumer_id,
        type_=NotificationType.ORDER_CANCELLED_BY_FLORIST,
        payload=await _payload_for(session, order, {"reason": order.decline_reason}),
    )
    return order
