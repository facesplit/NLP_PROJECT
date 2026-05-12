from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.enums import Role
from app.core.errors import UNAUTHORIZED, FORBIDDEN, AppError
from app.core.security import decode_token
from app.models import User


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(code=UNAUTHORIZED, message="Не авторизован.", status=401)
    token = authorization.split(None, 1)[1]
    try:
        payload = decode_token(token)
    except Exception as exc:  # noqa: BLE001
        raise AppError(code=UNAUTHORIZED, message="Недействительный токен.", status=401) from exc
    if payload.get("type") != "access":
        raise AppError(code=UNAUTHORIZED, message="Неверный тип токена.", status=401)
    try:
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError) as exc:
        raise AppError(code=UNAUTHORIZED, message="Недействительный токен.", status=401) from exc
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(code=UNAUTHORIZED, message="Аккаунт неактивен.", status=401)
    return user


def require_role(*roles: Role):
    allowed = {r.value if isinstance(r, Role) else r for r in roles}

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role.value not in allowed:
            raise AppError(code=FORBIDDEN, message="Нет доступа.", status=403)
        return user

    return _dep
