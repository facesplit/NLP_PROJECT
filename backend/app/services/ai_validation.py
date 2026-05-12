from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID


class ValidationError(Exception):
    pass


def _to_uuid(s: Any) -> UUID:
    try:
        return UUID(str(s))
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"invalid uuid: {s!r}") from exc


def validate_manual_composition(
    raw: list[dict[str, Any]] | list[Any],
    *,
    stock: dict[UUID, dict[str, Any]],
    budget: Decimal,
    budget_lower_pct: Decimal,
    budget_upper_pct: Decimal,
    max_references: int = 10,
) -> dict[str, Any]:
    """Validate a user-submitted manual composition.

    Mirrors the LLM validator's stock/budget rules but accepts no sd_prompt or
    references — those are derived deterministically downstream.

    All flowers the user picked become IPAdapter references (capped at
    max_references), so every selected flower has a chance to appear in the
    rendered image. When truncation is needed (composition larger than cap),
    we keep the largest-subtotal flowers — they dominate the bouquet visually.
    """
    if not isinstance(raw, list) or not raw:
        raise ValidationError("composition must be a non-empty list")

    seen: set[UUID] = set()
    items: list[dict[str, Any]] = []
    total = Decimal("0")
    for ci, c in enumerate(raw):
        if hasattr(c, "model_dump"):
            c = c.model_dump()
        if not isinstance(c, dict):
            raise ValidationError(f"composition item {ci} is not an object")
        fid = _to_uuid(c.get("flower_id"))
        if fid not in stock:
            raise ValidationError(f"unknown flower {fid}")
        if fid in seen:
            raise ValidationError(f"duplicate flower {fid}")
        qty = c.get("quantity")
        if not isinstance(qty, int) or qty < 1:
            raise ValidationError("quantity must be positive int")
        info = stock[fid]
        if qty > info["stock"]:
            raise ValidationError(
                f"quantity {qty} for {info['name']} exceeds stock {info['stock']}"
            )
        seen.add(fid)
        subtotal = Decimal(info["price_per_stem"]) * qty
        total += subtotal
        items.append(
            {
                "flower_id": fid,
                "name": info["name"],
                "price_per_stem": Decimal(info["price_per_stem"]),
                "quantity": qty,
                "subtotal": subtotal,
            }
        )

    if not (1 <= len(seen) <= 10):
        raise ValidationError(f"manual flowers count must be 1..10 (got {len(seen)})")

    # Manual mode: the user picked the composition themselves, so the budget
    # slider is informational only — we deliberately do NOT enforce bounds here.
    _ = budget, budget_lower_pct, budget_upper_pct

    if max_references < 1:
        raise ValidationError(f"max_references must be >= 1 (got {max_references})")

    # Pass ALL selected flowers through as IPAdapter references so each one has
    # visual influence on the render. Sort by subtotal desc so when the cap
    # truncates, the visually-dominant flowers survive.
    refs = sorted(items, key=lambda x: x["subtotal"], reverse=True)[:max_references]
    return {
        "composition": items,
        "total_price": total,
        "reference_flower_ids": [x["flower_id"] for x in refs],
    }


def validate_llm_variant(
    variant: dict[str, Any],
    *,
    stock: dict[UUID, dict[str, Any]],
    budget: Decimal,
    budget_lower_pct: Decimal,
    budget_upper_pct: Decimal,
) -> dict[str, Any]:
    """Validate a single LLM-produced variant against the point's stock and budget.

    Returns an enriched variant where each composition item has name/price_per_stem/subtotal
    filled in and total_price is computed by us, not trusted from the LLM.
    """

    if not isinstance(variant, dict):
        raise ValidationError("variant is not a JSON object")

    composition = variant.get("composition")
    if not isinstance(composition, list) or not composition:
        raise ValidationError("composition must be a non-empty list")

    seen: set[UUID] = set()
    items: list[dict[str, Any]] = []
    total = Decimal("0")
    for ci, c in enumerate(composition):
        if not isinstance(c, dict):
            raise ValidationError(f"composition item {ci} is not an object")
        fid = _to_uuid(c.get("flower_id"))
        if fid not in stock:
            raise ValidationError(f"unknown flower {fid}")
        qty = c.get("quantity")
        if not isinstance(qty, int) or qty < 1:
            raise ValidationError("quantity must be positive int")
        info = stock[fid]
        if qty > info["stock"]:
            raise ValidationError(
                f"quantity {qty} for {info['name']} exceeds stock {info['stock']}"
            )
        seen.add(fid)
        subtotal = Decimal(info["price_per_stem"]) * qty
        total += subtotal
        items.append(
            {
                "flower_id": fid,
                "name": info["name"],
                "price_per_stem": Decimal(info["price_per_stem"]),
                "quantity": qty,
                "subtotal": subtotal,
            }
        )

    if not (3 <= len(seen) <= 6):
        raise ValidationError(f"unique flowers count must be 3..6 (got {len(seen)})")

    total_stems = sum(int(it["quantity"]) for it in items)
    if total_stems < 12:
        raise ValidationError(
            f"total stems must be >= 12 for a real bouquet (got {total_stems})"
        )

    if not any(int(it["quantity"]) >= 5 for it in items):
        raise ValidationError(
            "at least one anchor flower must have quantity >= 5"
        )

    lo = budget * budget_lower_pct
    hi = budget * budget_upper_pct
    if total < lo or total > hi:
        raise ValidationError(f"total {total} outside budget bounds [{lo}, {hi}]")

    # sd_prompt is optional and IGNORED — we build the SD prompt deterministically
    # downstream (services.sd_prompt). Older LLM payloads may still emit it; that's fine.

    ref_ids_raw = variant.get("reference_flower_ids")
    if not isinstance(ref_ids_raw, list) or not (1 <= len(ref_ids_raw) <= 3):
        raise ValidationError("reference_flower_ids must have 1..3 items")
    ref_ids = [_to_uuid(x) for x in ref_ids_raw]
    for rid in ref_ids:
        if rid not in seen:
            raise ValidationError(f"reference {rid} not in composition")

    explanation = variant.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        raise ValidationError("explanation must be non-empty string")

    style_raw = variant.get("style_modifiers")
    style_modifiers: list[str] = []
    if isinstance(style_raw, list):
        for s in style_raw:
            if isinstance(s, str) and s.strip():
                style_modifiers.append(s.strip())
        style_modifiers = style_modifiers[:3]

    return {
        "composition": items,
        "total_price": total,
        "reference_flower_ids": ref_ids,
        "explanation": explanation,
        "style_modifiers": style_modifiers,
    }


def validate_llm_variants(
    payload: dict[str, Any],
    *,
    stock: dict[UUID, dict[str, Any]],
    budget: Decimal,
    budget_lower_pct: Decimal,
    budget_upper_pct: Decimal,
    max_variants: int = 3,
) -> list[dict[str, Any]]:
    """Validate a multi-variant LLM payload of the shape ``{"variants": [...]}``.

    Backwards-compatible: accepts either the new shape or a single-variant
    payload of the shape ``{"composition": [...], ...}``. Returns a list of
    validated variants, capped at ``max_variants``. Raises ``ValidationError``
    if zero variants pass validation; if some fail and at least one passes,
    only the passing ones are returned (so a partial LLM hallucination still
    yields a usable response).
    """
    if not isinstance(payload, dict):
        raise ValidationError("payload is not a JSON object")

    # Single-variant fallback. Local LLMs (e.g. Qwen) sometimes hallucinate a
    # `"variants": null` or `"variants": []` key alongside a valid top-level
    # `composition`. Prefer composition whenever it is a non-empty list — that
    # matches the legacy single-variant schema and is what the current default
    # system_prompt asks for.
    raw_composition = payload.get("composition")
    if isinstance(raw_composition, list) and raw_composition:
        return [
            validate_llm_variant(
                payload,
                stock=stock,
                budget=budget,
                budget_lower_pct=budget_lower_pct,
                budget_upper_pct=budget_upper_pct,
            )
        ]

    raw_variants = payload.get("variants")
    if not isinstance(raw_variants, list) or not raw_variants:
        raise ValidationError("variants must be a non-empty list")

    validated: list[dict[str, Any]] = []
    errors: list[str] = []
    for i, v in enumerate(raw_variants[:max_variants]):
        try:
            validated.append(
                validate_llm_variant(
                    v,
                    stock=stock,
                    budget=budget,
                    budget_lower_pct=budget_lower_pct,
                    budget_upper_pct=budget_upper_pct,
                )
            )
        except ValidationError as exc:
            errors.append(f"variant {i}: {exc}")

    if not validated:
        raise ValidationError("; ".join(errors) if errors else "no valid variants")
    return validated
