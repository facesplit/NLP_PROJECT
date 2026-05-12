"""Deterministic Stable Diffusion prompt composer.

The LLM (or a manual picker) decides which flowers and how many. The actual
positive prompt that ComfyUI sees is built here, from structured fields, so the
generator faithfully renders the chosen composition instead of paraphrasing
freeform LLM text.
"""
from __future__ import annotations

from typing import Any, Iterable, Sequence


# Maps a flower's user-facing (often Russian) name to a more SD-friendly
# English noun phrase. SDXL's CLIP encoder is mostly English-trained and largely
# ignores Cyrillic species names, which leaves IP-Adapter as the only source of
# flower-identity signal. Mapping here gives the text encoder something to bite
# on alongside the reference images.
#
# Keys MUST be lower-cased; lookup is case-insensitive on a whitespace-trimmed
# version of the name. Add entries here as new flowers ship in the catalogue.
_NAME_OVERRIDES: dict[str, str] = {
    "роза pink o'hara": "pink david austin garden rose",
    "пион sarah bernhardt": "pink double peony with rounded petals",
    "эустома белая": "white lisianthus eustoma",
    "гипсофила": "white gypsophila baby's breath",
    "эвкалипт cinerea": "silver dollar eucalyptus cinerea leaves",
    "ранункулюс": "pink ranunculus",
    # Explicit shape ("closed cup-shaped petals") prevents SDXL from rendering
    # red tulips as red peonies/roses when both species are in the bouquet.
    "тюльпан french": "red french tulip with closed cup-shaped petals",
    "роза": "garden rose",
    "пион": "peony with rounded petals",
    "тюльпан": "tulip with closed cup-shaped petals",
}


def _flower_phrase(name: str) -> str:
    key = name.strip().lower()
    if key in _NAME_OVERRIDES:
        return _NAME_OVERRIDES[key]
    # Try a partial match — "Тюльпан French Pink" should still pick up "тюльпан".
    for pattern, override in _NAME_OVERRIDES.items():
        if pattern in key:
            return override
    return name.strip()


_ARRANGEMENT_CLAUSES: dict[str, str] = {
    "handheld": "a hand-held floral bouquet, gripped in a hand wrapped with kraft paper",
    "vase": "a floral arrangement standing in a clear glass vase on a wooden table",
    "centerpiece": "a low and wide floral table centerpiece, viewed from a 3/4 angle",
}

_DEFAULT_ARRANGEMENT_CLAUSE = "a hand-held floral bouquet wrapped with kraft paper"


# SDXL framing — flowers must be the dominant subject. Earlier wide-shot framing
# ("full-body young woman holding bouquet") gave humans + background ~80% of
# pixels, leaving minority flowers (e.g. 3 red tulips against 5 peonies)
# completely absent from the render. New framing puts the bouquet at frame
# centre with shallow human/background context only.
_ARRANGEMENT_CLAUSES_SDXL: dict[str, str] = {
    "handheld": (
        "the bouquet is tightly wrapped in brown kraft paper as a florist "
        "shop hand-tied bouquet, brown kraft paper wrap clearly visible "
        "around the stems, twine bow tied around the wrap, "
        "(no glass vase:1.4), no vase, no jar, no container, "
        "isolated on pure white seamless studio background, clean white backdrop"
    ),
    "vase": (
        "the bouquet is arranged inside a transparent clear glass cylinder "
        "vase filled with water, glass vase clearly visible at the bottom of "
        "the frame, (no kraft paper:1.4), no paper wrap, "
        "isolated on pure white seamless studio background, clean white backdrop"
    ),
    "centerpiece": (
        "a low and wide floral table centerpiece in a shallow round bowl, "
        "centerpiece fills most of the frame, viewed from a 3/4 angle, "
        "isolated on pure white seamless studio background, clean white backdrop"
    ),
}

_DEFAULT_ARRANGEMENT_CLAUSE_SDXL = (
    "the bouquet is tightly wrapped in brown kraft paper as a florist "
    "hand-tied bouquet, brown kraft paper wrap clearly visible, "
    "isolated on pure white seamless studio background, clean white backdrop"
)


_COLOR_PHRASES: dict[str, str] = {
    "pink": "soft pink",
    "white": "ivory white",
    # "vivid saturated red" — SDXL boosts red saturation here so red tulips don't
    # collapse into pink/burgundy under IPAdapter cross-attention.
    "red": "vivid saturated red",
    "yellow": "warm yellow",
    "blue": "muted blue",
    "purple": "lavender purple",
    "orange": "warm orange",
    "green": "fresh green",
    "mixed": "harmonious mixed",
}


# Strong quality boilerplate for SD 1.5 photorealistic checkpoints (DreamShaper 8).
_QUALITY_BOILERPLATE = (
    "professional florist photography, soft natural studio lighting, "
    "shallow depth of field, sharp focus on the flowers, pastel background, "
    "ultra detailed, fine textures, high resolution, 8k, photorealistic"
)

# SDXL (Juggernaut-XL v9) follows prompts much better than SD 1.5 and reacts
# poorly to over-stuffed quality tags. Keep this short and natural — SDXL
# benefits more from clear scene description than from "8k ultra detailed" magic
# words. Avoid "soft pastel background" as global boilerplate: it desaturates
# the foreground and can wash out red/orange flowers.
_QUALITY_BOILERPLATE_SDXL = (
    "professional florist studio photography, even softbox lighting, "
    "fine petal textures, saturated flower colors, photorealistic, "
    "white background"
)


def _join(parts: Iterable[str]) -> str:
    return ", ".join(p for p in parts if p)


def compose_positive_prompt(
    *,
    composition: Sequence[dict[str, Any]],
    arrangement_type: str | None,
    container_style: str | None,
    color_tags: Sequence[str],
    style_text: str | None,
    pipeline_version: str = "sdxl",
) -> str:
    """Build the SD positive prompt for a bouquet render.

    Args:
        composition: list of {"name": str, "quantity": int, ...} — ordered by
            descending visual prominence (largest budget share first).
        arrangement_type: one of "handheld" | "vase" | "centerpiece" or None.
        container_style: free-form description of the container/style from the wizard.
        color_tags: list of palette color tag strings (e.g. ["pink", "white"]).
        style_text: free-form mood/style description from the user.
        pipeline_version: "sd15" or "sdxl" — switches between SD 1.5-tuned (heavy
            quality tags, explicit hand mention) and SDXL-tuned (natural language,
            no hand mention to avoid finger artifacts) prompt shapes.

    Returns:
        A single comma-joined SD prompt string capped at 600 chars.
    """
    is_sdxl = pipeline_version == "sdxl"

    if is_sdxl:
        arrangement = _ARRANGEMENT_CLAUSES_SDXL.get(
            arrangement_type or "", _DEFAULT_ARRANGEMENT_CLAUSE_SDXL
        )
        boilerplate = _QUALITY_BOILERPLATE_SDXL
    else:
        arrangement = _ARRANGEMENT_CLAUSES.get(
            arrangement_type or "", _DEFAULT_ARRANGEMENT_CLAUSE
        )
        boilerplate = _QUALITY_BOILERPLATE

    # SDXL CLIP gives early tokens stronger attention. For SDXL we LEAD with
    # the minority flowers (those with the smallest subtotal) so the model
    # commits to rendering them before the dominant species saturates the
    # canvas. Caller passes composition sorted by subtotal DESC; we reverse
    # for SDXL only. Quantities still tell the model which species is
    # numerically dominant — that's what carries the per-species visual mass.
    ordered = list(reversed(list(composition))) if is_sdxl else list(composition)

    # Per-flower abundance phrasing helps SDXL render the right visual mass
    # for each species. SDXL ignores raw counts past ~7 (the model can't
    # actually paint exactly 23 stems), so we trade exact count for explicit
    # density words at the high end. Counts <=10 we keep numeric — SDXL can
    # roughly approximate small counts.
    def _abundance(qty: int, name: str) -> str:
        if qty <= 3:
            return f"{qty} stems of {name}"
        if qty <= 10:
            return f"{qty} stems of {name}"
        if qty <= 20:
            return f"a generous bunch of {qty} stems of {name}"
        return f"a thick mass of {qty}+ stems of {name}, many many {name}"

    flower_clauses: list[str] = []
    for c in ordered:
        qty = int(c["quantity"])
        name = _flower_phrase(str(c["name"]))
        if is_sdxl:
            # Flat 1.20 emphasis on EVERY flower. Earlier we tried staggered
            # weights (1.30/1.22/1.18) — that overshot and made the first item
            # in the prompt (i.e. the minority species after reversal) too
            # dominant on the canvas, hurting the majority-of-accent case
            # (e.g. 15 red tulips vs 5 white lisianthus). Flat weighting +
            # minority-first ordering gives every species attention without
            # warping their relative visual mass.
            flower_clauses.append(f"({_abundance(qty, name)}:1.20)")
        else:
            flower_clauses.append(f"{qty} stems of {name}")
    flowers_clause = ", ".join(flower_clauses)

    # Bouquet density descriptor based on TOTAL stem count. Without this, SDXL
    # tends to render any bouquet as a small-to-medium handful regardless of
    # how many stems the user actually picked. Density words bias the model
    # toward visually fuller arrangements when the count is high.
    total_stems = sum(int(c["quantity"]) for c in composition)
    # Defaults are tuned for the validator's "min 12 stems" rule: even the
    # smallest accepted bouquet gets a "full" density word so SDXL never paints
    # a sparse 2-3-flower image.
    if total_stems <= 11:
        density = "a small intimate"
    elif total_stems <= 19:
        density = "a full lush"
    elif total_stems <= 34:
        density = "a large abundant lush"
    else:
        density = "a huge oversized abundant lush"

    palette = " and ".join(_COLOR_PHRASES.get(t, t) for t in color_tags if t)
    color_clause = f"{palette} color palette" if palette else ""

    if is_sdxl:
        # Lead with the SCENE FRAMING — "studio product shot of a bouquet on
        # pure white background" — so SDXL CLIP early-token attention locks in
        # the white backdrop and the bouquet-as-subject before any flower
        # specifics. IPAdapter at lower weight (0.55) still injects flower
        # identity per species but cannot override the framing. Flowers and
        # color palette come right after.
        opening = (
            f"professional studio product photograph of "
            f"{density} floral bouquet of {flowers_clause}, "
            f"isolated on pure white seamless studio background, white backdrop"
            if flowers_clause
            else f"professional studio product photograph of "
                 f"{density} floral bouquet, "
                 f"isolated on pure white seamless studio background, white backdrop"
        )
        parts = [
            opening,
            color_clause,
            arrangement,
            (container_style or "").strip(),
            (style_text or "").strip(),
            boilerplate,
        ]
    else:
        parts = [
            arrangement,
            f"composed of {flowers_clause}" if flowers_clause else "",
            (container_style or "").strip(),
            color_clause,
            (style_text or "").strip(),
            boilerplate,
        ]
    prompt = _join(parts)
    if len(prompt) > 600:
        prompt = prompt[:597].rstrip(", ") + "..."
    return prompt
