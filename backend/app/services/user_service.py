from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import NotificationType, Role
from app.core.errors import (
    CONFLICT,
    NOT_FOUND,
    SUB_LAST_SUPERADMIN,
    VALIDATION_ERROR,
    AppError,
)
from app.core.security import hash_password
from app.models import User
from app.repositories import refresh_token_repo, user_repo
from app.schemas.user import AdminCreateUserIn, AdminUpdateUserIn, UpdateMeIn
from app.services import notification_service


async def update_me(session: AsyncSession, me: User, patch: UpdateMeIn) -> User:
    if patch.display_name is not None:
        me.display_name = patch.display_name.strip()
    if patch.phone is not None:
        me.phone = patch.phone.strip() or None
    await session.flush()
    return me


async def admin_list(
    session: AsyncSession,
    *,
    role: Role | None,
    is_active: bool | None,
    q: str | None,
) -> list[User]:
    return await user_repo.list_users(session, role=role, is_active=is_active, q=q)


async def admin_create(session: AsyncSession, payload: AdminCreateUserIn) -> User:
    existing = await user_repo.get_by_email(session, payload.email)
    if existing is not None:
        raise AppError(code=VALIDATION_ERROR, message="Email уже занят.", status=400)
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        display_name=payload.display_name.strip(),
        phone=(payload.phone or "").strip() or None,
        is_active=payload.is_active,
    )
    session.add(user)
    await session.flush()
    return user


async def admin_update(
    session: AsyncSession,
    me: User,
    user_id: UUID,
    patch: AdminUpdateUserIn,
) -> User:
    target = await user_repo.get_by_id(session, user_id)
    if target is None:
        raise AppError(code=NOT_FOUND, message="Пользователь не найден.", status=404)

    role_changed = False
    old_role = target.role

    # Role transition rules
    if patch.role is not None and patch.role != target.role:
        if target.id == me.id and patch.role != Role.SUPERADMIN:
            raise AppError(code=CONFLICT, message="Нельзя понизить себя.", status=409)
        if target.role == Role.SUPERADMIN:
            remaining = await user_repo.count_active_superadmins(session, exclude_id=target.id)
            if remaining == 0:
                raise AppError(
                    code=CONFLICT,
                    message="Нельзя удалить последнего супер-админа.",
                    status=409,
                    details={"subcode": SUB_LAST_SUPERADMIN},
                )
        target.role = patch.role
        role_changed = True

    # is_active transition rules
    if patch.is_active is not None and patch.is_active != target.is_active:
        if not patch.is_active:
            if target.role == Role.SUPERADMIN:
                remaining = await user_repo.count_active_superadmins(session, exclude_id=target.id)
                if remaining == 0:
                    raise AppError(
                        code=CONFLICT,
                        message="Нельзя деактивировать последнего супер-админа.",
                        status=409,
                        details={"subcode": SUB_LAST_SUPERADMIN},
                    )
            if target.id == me.id:
                raise AppError(code=CONFLICT, message="Нельзя деактивировать себя.", status=409)
        target.is_active = patch.is_active

    if patch.display_name is not None:
        target.display_name = patch.display_name.strip()
    if patch.phone is not None:
        target.phone = patch.phone.strip() or None
    if patch.password:
        target.password_hash = hash_password(patch.password)

    await session.flush()

    if role_changed:
        await refresh_token_repo.revoke_all_for_user(session, target.id)
        await notification_service.notify(
            session,
            user_id=target.id,
            type_=NotificationType.ROLE_CHANGED,
            payload={
                "old_role": old_role.value,
                "new_role": target.role.value,
                "changed_by_user_id": str(me.id),
            },
        )

    return target


async def admin_soft_delete(session: AsyncSession, me: User, user_id: UUID) -> None:
    target = await user_repo.get_by_id(session, user_id)
    if target is None or not target.is_active:
        raise AppError(code=NOT_FOUND, message="Пользователь не найден.", status=404)
    if target.id == me.id:
        raise AppError(code=CONFLICT, message="Нельзя удалить себя.", status=409)
    if target.role == Role.SUPERADMIN:
        remaining = await user_repo.count_active_superadmins(session, exclude_id=target.id)
        if remaining == 0:
            raise AppError(
                code=CONFLICT,
                message="Нельзя удалить последнего супер-админа.",
                status=409,
                details={"subcode": SUB_LAST_SUPERADMIN},
            )
    target.is_active = False
    await refresh_token_repo.revoke_all_for_user(session, target.id)
    await session.flush()


async def admin_hard_delete(session: AsyncSession, me: User, user_id: UUID) -> None:
    """Permanently remove a user. DB-level FK cascades (`ondelete=CASCADE`) drop:

    - refresh_tokens, notifications, ai_generations belonging to the user
    - orders placed by the user (consumer_id) AND orders to their points (point_id)
    - florist_points owned by the user, which in turn cascade to flowers and
      portfolio_bouquets on those points

    `ai_config.updated_by` is `ondelete=SET NULL`, so the config row survives
    with a null editor stamp.

    Same guards as soft-delete: cannot delete self, cannot remove the last
    superadmin (this would lock everyone out of admin endpoints).
    """
    target = await user_repo.get_by_id(session, user_id)
    if target is None:
        raise AppError(code=NOT_FOUND, message="Пользователь не найден.", status=404)
    if target.id == me.id:
        raise AppError(code=CONFLICT, message="Нельзя удалить себя.", status=409)
    if target.role == Role.SUPERADMIN:
        remaining = await user_repo.count_active_superadmins(session, exclude_id=target.id)
        if remaining == 0:
            raise AppError(
                code=CONFLICT,
                message="Нельзя удалить последнего супер-админа.",
                status=409,
                details={"subcode": SUB_LAST_SUPERADMIN},
            )
    await session.delete(target)
    await session.flush()
