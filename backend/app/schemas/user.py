from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Role
from app.schemas._email import EmailField


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailField
    role: Role
    display_name: str
    phone: str | None = None
    is_active: bool
    created_at: datetime


class UpdateMeIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


class AdminCreateUserIn(BaseModel):
    email: EmailField
    password: str = Field(min_length=8, max_length=128)
    role: Role
    display_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    is_active: bool = True


class AdminUpdateUserIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None
    role: Role | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
