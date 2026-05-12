from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import require_role
from app.core.enums import Role
from app.core.errors import VALIDATION_ERROR, AppError
from app.models import User
from app.schemas.ai_config import AIConfigOut, AIConfigPatchIn
from app.services import ai_config_service
from app.services.ai_config_service import ConfigValidationError

router = APIRouter(prefix="/api/admin/ai-config", tags=["admin"])


@router.get("", response_model=AIConfigOut)
async def get_config(
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AIConfigOut:
    cfg = await ai_config_service.load(session)
    return AIConfigOut.model_validate(cfg)


@router.patch("", response_model=AIConfigOut)
async def patch_config(
    payload: AIConfigPatchIn,
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AIConfigOut:
    patch = payload.model_dump(exclude_unset=True)
    try:
        cfg = await ai_config_service.apply_patch(session, user=me, patch=patch)
    except ConfigValidationError as exc:
        raise AppError(
            code=VALIDATION_ERROR,
            message="Некорректные значения конфигурации.",
            status=400,
            details={"field": exc.field, "reason": exc.reason},
        ) from exc
    return AIConfigOut.model_validate(cfg)


@router.post("/reset", response_model=AIConfigOut)
async def reset_config(
    me: User = Depends(require_role(Role.SUPERADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AIConfigOut:
    cfg = await ai_config_service.reset_to_defaults(session, user=me)
    return AIConfigOut.model_validate(cfg)
