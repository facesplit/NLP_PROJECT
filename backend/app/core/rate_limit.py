from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.errors import RATE_LIMITED

limiter = Limiter(key_func=get_remote_address)


def install_rate_limit(app: FastAPI) -> None:
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def handler(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": RATE_LIMITED,
                    "message": "Слишком много запросов. Попробуйте позже.",
                    "details": {"retry_after_seconds": int(getattr(exc, "retry_after", 60))},
                }
            },
        )
