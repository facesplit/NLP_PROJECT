from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIConfig, User
from app.repositories import ai_config_repo
from app.services.ai_config_defaults import (
    ALLOWED_PIPELINE_VERSIONS,
    ALLOWED_SAMPLERS,
    DEFAULTS,
)


class ConfigValidationError(Exception):
    def __init__(self, field: str, reason: str) -> None:
        self.field = field
        self.reason = reason
        super().__init__(f"{field}: {reason}")


def _check_int(field: str, value: Any, *, lo: int, hi: int) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ConfigValidationError(field, f"must be int, got {type(value).__name__}")
    if value < lo or value > hi:
        raise ConfigValidationError(field, f"must be in [{lo}, {hi}] (got {value})")
    return value


def _check_decimal(field: str, value: Any, *, lo: Decimal, hi: Decimal) -> Decimal:
    if isinstance(value, (int, float)):
        value = Decimal(str(value))
    if not isinstance(value, Decimal):
        raise ConfigValidationError(field, f"must be number, got {type(value).__name__}")
    if value < lo or value > hi:
        raise ConfigValidationError(field, f"must be in [{lo}, {hi}] (got {value})")
    return value


def validate_patch(patch: dict[str, Any]) -> dict[str, Any]:
    """Validate a partial config update and return the cleaned dict.

    Each call validates only the fields present in `patch`. Cross-field constraint
    (lower < upper) is checked only when both fields are present in the same patch.
    """
    out: dict[str, Any] = {}

    if "sampler_steps" in patch:
        out["sampler_steps"] = _check_int("sampler_steps", patch["sampler_steps"], lo=1, hi=150)
    if "sampler_cfg" in patch:
        out["sampler_cfg"] = _check_decimal(
            "sampler_cfg", patch["sampler_cfg"], lo=Decimal("1.0"), hi=Decimal("30.0")
        )
    if "sampler_name" in patch:
        name = patch["sampler_name"]
        if not isinstance(name, str) or name not in ALLOWED_SAMPLERS:
            raise ConfigValidationError(
                "sampler_name", f"must be one of {list(ALLOWED_SAMPLERS)} (got {name!r})"
            )
        out["sampler_name"] = name

    for f in ("image_width", "image_height"):
        if f in patch:
            v = _check_int(f, patch[f], lo=128, hi=2048)
            if v % 8 != 0:
                raise ConfigValidationError(f, f"must be multiple of 8 (got {v})")
            out[f] = v

    if "budget_lower_pct" in patch:
        out["budget_lower_pct"] = _check_decimal(
            "budget_lower_pct", patch["budget_lower_pct"], lo=Decimal("0.1"), hi=Decimal("5.0")
        )
    if "budget_upper_pct" in patch:
        out["budget_upper_pct"] = _check_decimal(
            "budget_upper_pct", patch["budget_upper_pct"], lo=Decimal("0.1"), hi=Decimal("5.0")
        )
    if "budget_lower_pct" in out and "budget_upper_pct" in out:
        if out["budget_lower_pct"] >= out["budget_upper_pct"]:
            raise ConfigValidationError(
                "budget_lower_pct",
                f"must be strictly less than budget_upper_pct ({out['budget_lower_pct']} >= {out['budget_upper_pct']})",
            )

    if "llm_temperature" in patch:
        out["llm_temperature"] = _check_decimal(
            "llm_temperature", patch["llm_temperature"], lo=Decimal("0.0"), hi=Decimal("2.0")
        )
    if "llm_max_retries" in patch:
        out["llm_max_retries"] = _check_int(
            "llm_max_retries", patch["llm_max_retries"], lo=1, hi=20
        )
    if "max_references" in patch:
        # ComfyUI workflow caps the IPAdapter ImageBatch chain at 10. Manual mode also caps
        # composition at 10, so 1..10 is the sane operating range.
        out["max_references"] = _check_int(
            "max_references", patch["max_references"], lo=1, hi=10
        )
    if "pipeline_version" in patch:
        v = patch["pipeline_version"]
        if not isinstance(v, str) or v not in ALLOWED_PIPELINE_VERSIONS:
            raise ConfigValidationError(
                "pipeline_version",
                f"must be one of {list(ALLOWED_PIPELINE_VERSIONS)} (got {v!r})",
            )
        out["pipeline_version"] = v

    if "system_prompt" in patch:
        v = patch["system_prompt"]
        if not isinstance(v, str) or not v.strip():
            raise ConfigValidationError("system_prompt", "must be non-empty string")
        if len(v) > 8000:
            raise ConfigValidationError("system_prompt", f"too long ({len(v)} > 8000)")
        out["system_prompt"] = v
    if "negative_prompt" in patch:
        v = patch["negative_prompt"]
        if not isinstance(v, str):
            raise ConfigValidationError("negative_prompt", "must be string")
        if len(v) > 2000:
            raise ConfigValidationError("negative_prompt", f"too long ({len(v)} > 2000)")
        out["negative_prompt"] = v

    return out


async def load(session: AsyncSession) -> AIConfig:
    cfg = await ai_config_repo.get(session)
    if cfg is None:
        raise RuntimeError("AI config row missing — run migrations")
    return cfg


async def apply_patch(
    session: AsyncSession, *, user: User, patch: dict[str, Any]
) -> AIConfig:
    cleaned = validate_patch(patch)
    cleaned["updated_by"] = user.id
    await ai_config_repo.update_fields(session, fields=cleaned)
    return await load(session)


async def reset_to_defaults(session: AsyncSession, *, user: User) -> AIConfig:
    fields = {**DEFAULTS, "updated_by": user.id}
    await ai_config_repo.update_fields(session, fields=fields)
    return await load(session)
