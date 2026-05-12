from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import get_settings

# bcrypt has a hard 72-byte password limit; we truncate UTF-8 bytes to stay safe.
_BCRYPT_MAX_BYTES = 72


def _prep(plain: str) -> bytes:
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prep(plain), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prep(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, subject: str, role: str) -> str:
    s = get_settings()
    payload = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(minutes=s.access_token_ttl_min)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_refresh_token(*, subject: str) -> tuple[str, str]:
    """Returns (jwt_string_for_cookie, raw_jti_to_hash_in_db)."""
    s = get_settings()
    raw = secrets.token_urlsafe(48)
    payload = {
        "sub": subject,
        "type": "refresh",
        "jti": raw,
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(days=s.refresh_token_ttl_days)).timestamp()),
    }
    token = jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)
    return token, raw


def hash_token(raw: str) -> str:
    return sha256(raw.encode()).hexdigest()


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
