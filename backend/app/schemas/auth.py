from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas._email import EmailField
from app.schemas.user import UserOut


class RegisterIn(BaseModel):
    email: EmailField
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


class LoginIn(BaseModel):
    email: EmailField
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
