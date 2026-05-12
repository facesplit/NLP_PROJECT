from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.deps import get_current_user
from app.models import User
from app.schemas.upload import UploadOut
from app.services import upload_service

router = APIRouter(prefix="/api", tags=["uploads"])


@router.post("/uploads", response_model=UploadOut)
async def upload(
    file: UploadFile = File(...),
    me: User = Depends(get_current_user),
) -> UploadOut:
    path = await upload_service.save_image(file, subdir="uploads")
    return UploadOut(path=path)
