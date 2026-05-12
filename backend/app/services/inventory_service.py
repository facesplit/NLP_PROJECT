from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    CONFLICT,
    SUB_OUT_OF_STOCK,
    AppError,
)
from app.repositories import flower_repo


def _aggregate(composition: list[dict[str, Any]]) -> dict[UUID, int]:
    totals: dict[UUID, int] = {}
    for item in composition:
        fid = item["flower_id"]
        if isinstance(fid, str):
            fid = UUID(fid)
        totals[fid] = totals.get(fid, 0) + int(item["quantity"])
    return totals


async def reserve_stock(
    session: AsyncSession, composition: list[dict[str, Any]]
) -> None:
    """Acquires FOR UPDATE locks and decrements stock; raises CONFLICT on OUT_OF_STOCK."""
    totals = _aggregate(composition)
    if not totals:
        return
    flowers = await flower_repo.get_many_for_update(session, totals.keys())
    flowers_by_id = {f.id: f for f in flowers}

    shortages = []
    for fid, qty in totals.items():
        f = flowers_by_id.get(fid)
        if f is None or not f.is_active:
            shortages.append({"flower_id": str(fid), "needed": qty, "have": 0})
            continue
        if f.quantity < qty:
            shortages.append(
                {"flower_id": str(fid), "name": f.name, "needed": qty, "have": int(f.quantity)}
            )

    if shortages:
        raise AppError(
            code=CONFLICT,
            message="Недостаточно цветов на складе.",
            status=409,
            details={"subcode": SUB_OUT_OF_STOCK, "shortages": shortages},
        )

    for fid, qty in totals.items():
        f = flowers_by_id[fid]
        f.quantity -= qty
    await session.flush()


async def restore_stock(
    session: AsyncSession, composition: list[dict[str, Any]]
) -> None:
    totals = _aggregate(composition)
    if not totals:
        return
    flowers = await flower_repo.get_many_for_update(session, totals.keys())
    flowers_by_id = {f.id: f for f in flowers}
    for fid, qty in totals.items():
        f = flowers_by_id.get(fid)
        if f is None:
            continue
        f.quantity += qty
    await session.flush()


def total_price(composition: list[dict[str, Any]]) -> Decimal:
    total = Decimal("0")
    for item in composition:
        total += Decimal(str(item["price_per_stem"])) * int(item["quantity"])
    return total
