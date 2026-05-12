from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import magic
from fastapi import UploadFile

from app.core.config import get_settings
from app.core.errors import VALIDATION_ERROR, AppError

ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_BYTES = 5 * 1024 * 1024


async def save_image(file: UploadFile, *, subdir: str = "uploads") -> str:
    """Saves an UploadFile to MEDIA_DIR/<subdir>/<uuid>.<ext>; returns the relative path."""
    settings = get_settings()
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise AppError(
            code=VALIDATION_ERROR,
            message="Файл слишком большой (максимум 5 МБ).",
            status=400,
        )
    detected = magic.from_buffer(contents[:4096], mime=True)
    if detected not in ALLOWED_MIME:
        raise AppError(
            code=VALIDATION_ERROR,
            message="Поддерживаются только JPG, PNG и WebP.",
            status=400,
            details={"detected_mime": detected},
        )

    ext = ALLOWED_MIME[detected]
    target_dir = Path(settings.media_dir) / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid4().hex}{ext}"
    target_path = target_dir / name
    target_path.write_bytes(contents)
    # Use forward slashes on disk to match URL paths
    return f"{subdir}/{name}".replace(os.sep, "/")
