from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut
from app.schemas.user import UpdateMeIn, UserOut
from app.services import auth_service, user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=(settings.env == "prod"),
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


@router.post("/register", response_model=TokenOut)
@limiter.limit("3/minute")
async def register(
    request: Request,
    response: Response,
    payload: RegisterIn,
    session: AsyncSession = Depends(get_session),
) -> TokenOut:
    user = await auth_service.register_consumer(session, payload)
    access, refresh = await auth_service.issue_tokens(
        session,
        user,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    payload: LoginIn,
    session: AsyncSession = Depends(get_session),
) -> TokenOut:
    user = await auth_service.authenticate(session, payload.email, payload.password)
    access, refresh = await auth_service.issue_tokens(
        session,
        user,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenOut)
async def refresh_endpoint(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    session: AsyncSession = Depends(get_session),
) -> TokenOut:
    from app.core.errors import UNAUTHORIZED, AppError

    if not refresh_token:
        raise AppError(code=UNAUTHORIZED, message="Нет refresh-токена.", status=401)
    user, access, new_refresh = await auth_service.rotate_refresh(
        session,
        refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    _set_refresh_cookie(response, new_refresh)
    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await auth_service.logout(session, refresh_token)
    _clear_refresh_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UpdateMeIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    updated = await user_service.update_me(session, user, payload)
    return UserOut.model_validate(updated)
