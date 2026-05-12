from __future__ import annotations

from pydantic import BaseModel


class UploadOut(BaseModel):
    path: str
