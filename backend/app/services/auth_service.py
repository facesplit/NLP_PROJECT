from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import (
    CONFLICT,
    UNAUTHORIZED,
    VALIDATION_ERROR,
    AppError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import RefreshToken, User
from app.repositories import refresh_token_repo, user_repo
from app.schemas.auth import RegisterIn


async def register_consumer(session: AsyncSession, data: RegisterIn) -> User:
    existing = await user_repo.get_by_email(session, data.email)
    if existing is not None:
        raise AppError(
            code=VALIDATION_ERROR,
            message="Пользователь с таким email уже существует.",
            status=400,
        )
    from app.core.enums import Role

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=Role.CONSUMER,
        display_name=data.display_name.strip(),
        phone=(data.phone or "").strip() or None,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    user = await user_repo.get_by_email(session, email)
    if user is None or not verify_password(password, user.password_hash):
        raise AppError(code=UNAUTHORIZED, message="Неверный email или пароль.", status=401)
    if not user.is_active:
        raise AppError(code=UNAUTHORIZED, message="Аккаунт заблокирован.", status=401)
    return user


async def issue_tokens(
    session: AsyncSession,
    user: User,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[str, str]:
    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    access = create_access_token(subject=str(user.id), role=role_value)
    refresh_jwt, raw_jti = create_refresh_token(subject=str(user.id))
    settings = get_settings()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_jti),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.refresh_token_ttl_days),
        user_agent=(user_agent or "")[:500] or None,
        ip=ip,
    )
    session.add(rt)
    await session.flush()
    return access, refresh_jwt


async def rotate_refresh(
    session: AsyncSession,
    refresh_token: str,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[User, str, str]:
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise AppError(code=UNAUTHORIZED, message="Недействительный refresh.", status=401) from exc
    if payload.get("type") != "refresh":
        raise AppError(code=UNAUTHORIZED, message="Неверный тип токена.", status=401)
    raw_jti = payload.get("jti")
    if not raw_jti:
        raise AppError(code=UNAUTHORIZED, message="Недействительный refresh.", status=401)
    rt = await refresh_token_repo.get_active_by_hash(session, hash_token(raw_jti))
    if rt is None:
        raise AppError(code=UNAUTHORIZED, message="Сессия уже завершена.", status=401)
    if rt.expires_at < datetime.now(timezone.utc):
        raise AppError(code=UNAUTHORIZED, message="Сессия истекла.", status=401)
    user = await user_repo.get_by_id(session, UUID(str(payload["sub"])))
    if user is None or not user.is_active:
        raise AppError(code=UNAUTHORIZED, message="Аккаунт неактивен.", status=401)
    # Rotate: revoke old, issue new
    await refresh_token_repo.revoke_by_hash(session, hash_token(raw_jti))
    access, new_refresh = await issue_tokens(session, user, user_agent=user_agent, ip=ip)
    return user, access, new_refresh


async def logout(session: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    try:
        payload = decode_token(refresh_token)
    except Exception:  # noqa: BLE001
        return
    raw_jti = payload.get("jti")
    if not raw_jti:
        return
    await refresh_token_repo.revoke_by_hash(session, hash_token(raw_jti))


async def update_password(session: AsyncSession, user: User, new_password: str) -> None:
    if len(new_password) < 8:
        raise AppError(code=CONFLICT, message="Пароль слишком короткий.", status=400)
    user.password_hash = hash_password(new_password)
    await session.flush()
