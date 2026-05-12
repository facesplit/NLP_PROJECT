from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# Top-level codes
UNAUTHORIZED = "UNAUTHORIZED"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"
VALIDATION_ERROR = "VALIDATION_ERROR"
CONFLICT = "CONFLICT"
RATE_LIMITED = "RATE_LIMITED"
INTERNAL = "INTERNAL"

# Sub-codes (delivered through details.subcode)
SUB_OUT_OF_STOCK = "OUT_OF_STOCK"
SUB_INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
SUB_LAST_SUPERADMIN = "LAST_SUPERADMIN"
SUB_VARIANT_NOT_READY = "VARIANT_NOT_READY"


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.details = details or {}
        super().__init__(message)


def _payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_err_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content=_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        cleaned: list[dict[str, Any]] = []
        for err in exc.errors():
            entry = {
                "loc": [str(p) for p in err.get("loc", [])],
                "msg": err.get("msg", ""),
                "type": err.get("type", ""),
            }
            cleaned.append(entry)
        return JSONResponse(
            status_code=422,
            content=_payload(
                VALIDATION_ERROR,
                "Некорректные данные запроса.",
                {"errors": cleaned},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: UNAUTHORIZED,
            403: FORBIDDEN,
            404: NOT_FOUND,
            409: CONFLICT,
            422: VALIDATION_ERROR,
            429: RATE_LIMITED,
        }.get(exc.status_code, INTERNAL)
        message = exc.detail if isinstance(exc.detail, str) else "Ошибка."
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(code, message),
        )

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_payload(INTERNAL, "Внутренняя ошибка сервера."),
        )
