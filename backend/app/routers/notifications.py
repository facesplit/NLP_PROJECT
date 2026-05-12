from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import sse
from app.core.db import SessionLocal, get_session
from app.core.deps import get_current_user
from app.core.errors import UNAUTHORIZED, AppError
from app.core.security import decode_token
from app.models import User
from app.repositories import notification_repo, user_repo
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    limit: int = Query(default=100, le=200),
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationOut]:
    rows = await notification_repo.list_for_user(session, me.id, limit=limit)
    return [NotificationOut.model_validate(r) for r in rows]


@router.get("/unread-count")
async def unread_count(
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    return {"unread": await notification_repo.unread_count(session, me.id)}


@router.post("/{notif_id}/read")
async def mark_one(
    notif_id: UUID,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await notification_repo.mark_one_read(session, notif_id, me.id)
    return {"ok": True}


@router.post("/read-all")
async def mark_all(
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await notification_repo.mark_all_read(session, me.id)
    return {"ok": True}


@router.get("/stream")
async def stream(
    request: Request,
    token: str | None = Query(default=None),
) -> StreamingResponse:
    if not token:
        raise AppError(code=UNAUTHORIZED, message="Нужен токен для подключения.", status=401)
    try:
        payload = decode_token(token)
    except Exception as exc:  # noqa: BLE001
        raise AppError(code=UNAUTHORIZED, message="Недействительный токен.", status=401) from exc
    if payload.get("type") != "access":
        raise AppError(code=UNAUTHORIZED, message="Неверный тип токена.", status=401)

    async with SessionLocal() as session:
        user = await user_repo.get_by_id(session, UUID(str(payload["sub"])))
        if user is None or not user.is_active:
            raise AppError(code=UNAUTHORIZED, message="Аккаунт неактивен.", status=401)

    user_id = UUID(str(payload["sub"]))
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        sse.event_stream(user_id),
        media_type="text/event-stream",
        headers=headers,
    )
