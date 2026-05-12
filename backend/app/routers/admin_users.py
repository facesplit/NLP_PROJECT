from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import require_role
from app.core.enums import Role
from app.models import User
from app.schemas.user import AdminCreateUserIn, AdminUpdateUserIn, UserOut
from app.services import user_service

router = APIRouter(prefix="/api/admin/users", tags=["admin"])


@router.get("", response_model=list[UserOut])
async def list_users(
    role: Role | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> list[UserOut]:
    users = await user_service.admin_list(session, role=role, is_active=is_active, q=q)
    return [UserOut.model_validate(u) for u in users]


@router.post("", response_model=UserOut)
async def create_user(
    payload: AdminCreateUserIn,
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    user = await user_service.admin_create(session, payload)
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    payload: AdminUpdateUserIn,
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    user = await user_service.admin_update(session, me, user_id, payload)
    return UserOut.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    hard: bool = Query(default=False, description="Permanently delete (cascade)"),
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    if hard:
        await user_service.admin_hard_delete(session, me, user_id)
    else:
        await user_service.admin_soft_delete(session, me, user_id)
    return {"ok": True}
