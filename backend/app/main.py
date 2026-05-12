from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.rate_limit import install_rate_limit
from app.routers import (
    admin_ai_config,
    admin_users,
    ai,
    auth,
    flowers,
    notifications,
    orders,
    points,
    portfolio,
    uploads,
)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Bouquet AI Platform", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_rate_limit(app)
    app.add_middleware(SlowAPIMiddleware)
    install_error_handlers(app)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(admin_users.router)
    app.include_router(admin_ai_config.router)
    app.include_router(points.public_router)
    app.include_router(points.me_router)
    app.include_router(flowers.public_router)
    app.include_router(flowers.me_router)
    app.include_router(portfolio.public_router)
    app.include_router(portfolio.me_router)
    app.include_router(ai.router)
    app.include_router(orders.router)
    app.include_router(notifications.router)
    app.include_router(uploads.router)

    media_dir = Path(settings.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / "ai_mock").mkdir(parents=True, exist_ok=True)
    (media_dir / "uploads").mkdir(parents=True, exist_ok=True)
    app.mount(settings.media_base_url, StaticFiles(directory=str(media_dir)), name="media")

    return app


app = create_app()
