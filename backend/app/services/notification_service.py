from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import sse
from app.core.enums import NotificationType
from app.models import Notification


async def notify(
    session: AsyncSession,
    *,
    user_id: UUID,
    type_: NotificationType,
    payload: dict[str, Any],
) -> Notification:
    note = Notification(user_id=user_id, type=type_, payload=payload)
    session.add(note)
    await session.flush()
    sse.publish(
        user_id,
        {
            "id": str(note.id),
            "user_id": str(note.user_id),
            "type": note.type.value,
            "payload": payload,
            "is_read": False,
            "created_at": note.created_at.isoformat() if note.created_at else None,
        },
    )
    return note
