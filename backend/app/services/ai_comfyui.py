from __future__ import annotations

import asyncio
import copy
import json
import logging
import random
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import AIGeneration
from app.repositories import ai_generation_repo, flower_repo, point_repo
from app.schemas.ai import AIGenerateIn, AIGenerateResponse
from app.services import ai_config_service, ai_validation
from app.services.comfyui_client import ComfyUIClient, ComfyUIError
from app.services.llm_client import LLMClient, LLMError
from app.services.llm_client_ollama import OllamaLLMClient
from app.services.sd_prompt import compose_positive_prompt

logger = logging.getLogger(__name__)


WORKFLOWS_DIR = Path(__file__).parent / "comfyui_workflows"
WORKFLOW_PATHS: dict[str, Path] = {
    "sd15": WORKFLOWS_DIR / "ipadapter_bouquet.json",
    "sdxl": WORKFLOWS_DIR / "ipadapter_bouquet_sdxl.json",
}

# One composite preview image per request, matching the pipeline described in
# the paper (Abstract, §3.5, §5.1).
TARGET_VARIANTS = 1
# Backwards-compatible alias for tests/scripts that still import WORKFLOW_PATH.
WORKFLOW_PATH = WORKFLOW_PATHS["sd15"]
SAVE_NODE_ID = "80"


def _workflow_path_for(pipeline_version: str) -> Path:
    try:
        return WORKFLOW_PATHS[pipeline_version]
    except KeyError as exc:
        raise ValueError(
            f"unknown pipeline_version {pipeline_version!r}; "
            f"expected one of {list(WORKFLOW_PATHS)}"
        ) from exc


def _load_workflow_template(pipeline_version: str = "sd15") -> dict[str, Any]:
    return json.loads(_workflow_path_for(pipeline_version).read_text(encoding="utf-8"))


MAX_REFERENCES_HARD_LIMIT = 10
LOAD_IMAGE_BASE_ID = 10
IMAGE_BATCH_BASE_ID = 20
IPADAPTER_NODE_ID = "30"


def _build_workflow_for_render(
    template: dict[str, Any],
    *,
    seed: int,
    positive_prompt: str,
    filename_prefix: str,
    ref_filenames: list[str],
    sampler_steps: int,
    sampler_cfg: float,
    sampler_name: str,
    image_width: int,
    image_height: int,
    negative_prompt: str,
) -> dict[str, Any]:
    """Return a deep-copied workflow with placeholders replaced.

    Strips any pre-existing LoadImage/ImageBatch placeholder nodes from the
    template and rebuilds a fresh chain sized exactly for ``len(ref_filenames)``
    (1..MAX_REFERENCES_HARD_LIMIT). With N refs we emit:

    * N LoadImage nodes at ids ``LOAD_IMAGE_BASE_ID .. LOAD_IMAGE_BASE_ID+N-1``.
    * N-1 ImageBatch nodes at ids ``IMAGE_BATCH_BASE_ID .. IMAGE_BATCH_BASE_ID+N-2``,
      chained pairwise: batch[k] = (batch[k-1] or LoadImage[base], LoadImage[base+k+1]).
    * IPAdapterAdvanced.image points to LoadImage[base] (N=1) or the last
      ImageBatch (N>=2).

    The IPAdapter node keeps its template settings (weight, weight_type,
    combine_embeds=concat, etc.) so identity of each reference is preserved
    across attention layers.
    """

    n = len(ref_filenames)
    if not (1 <= n <= MAX_REFERENCES_HARD_LIMIT):
        raise ValueError(
            f"ref_filenames must have 1..{MAX_REFERENCES_HARD_LIMIT} entries, got {n}"
        )

    wf = copy.deepcopy(template)

    if "60" in wf:
        wf["60"]["inputs"]["seed"] = seed
        wf["60"]["inputs"]["steps"] = sampler_steps
        wf["60"]["inputs"]["cfg"] = sampler_cfg
        wf["60"]["inputs"]["sampler_name"] = sampler_name
    if "40" in wf:
        wf["40"]["inputs"]["text"] = positive_prompt
    if "41" in wf:
        wf["41"]["inputs"]["text"] = negative_prompt
    if "50" in wf:
        wf["50"]["inputs"]["width"] = image_width
        wf["50"]["inputs"]["height"] = image_height
    if "80" in wf:
        wf["80"]["inputs"]["filename_prefix"] = filename_prefix

    # Strip any LoadImage/ImageBatch placeholders from the template — we own
    # this region of the graph and rebuild it deterministically below.
    for k in list(wf.keys()):
        if not k.isdigit():
            continue
        kid = int(k)
        in_load_range = LOAD_IMAGE_BASE_ID <= kid < LOAD_IMAGE_BASE_ID + MAX_REFERENCES_HARD_LIMIT
        in_batch_range = (
            IMAGE_BATCH_BASE_ID <= kid < IMAGE_BATCH_BASE_ID + (MAX_REFERENCES_HARD_LIMIT - 1)
        )
        if in_load_range or in_batch_range:
            wf.pop(k)

    # LoadImage nodes — one per reference.
    for i, fname in enumerate(ref_filenames):
        wf[str(LOAD_IMAGE_BASE_ID + i)] = {
            "class_type": "LoadImage",
            "inputs": {"image": fname},
        }

    # ImageBatch chain when we have >= 2 references.
    # batch[0] = (load[0], load[1])
    # batch[k] = (batch[k-1], load[k+1])  for k in 1..N-2
    for k in range(n - 1):
        batch_id = str(IMAGE_BATCH_BASE_ID + k)
        if k == 0:
            image1_ref: list[Any] = [str(LOAD_IMAGE_BASE_ID), 0]
        else:
            image1_ref = [str(IMAGE_BATCH_BASE_ID + k - 1), 0]
        image2_ref = [str(LOAD_IMAGE_BASE_ID + k + 1), 0]
        wf[batch_id] = {
            "class_type": "ImageBatch",
            "inputs": {"image1": image1_ref, "image2": image2_ref},
        }

    if IPADAPTER_NODE_ID in wf:
        if n == 1:
            wf[IPADAPTER_NODE_ID]["inputs"]["image"] = [str(LOAD_IMAGE_BASE_ID), 0]
        else:
            last_batch_id = str(IMAGE_BATCH_BASE_ID + n - 2)
            wf[IPADAPTER_NODE_ID]["inputs"]["image"] = [last_batch_id, 0]

    return wf


def _initial_variant_record(
    idx: int,
    validated: dict[str, Any],
    *,
    sd_prompt: str,
    explanation: str,
) -> dict[str, Any]:
    return {
        "index": idx,
        "status": "pending",
        "composition": [
            {
                "flower_id": str(c["flower_id"]),
                "name": c["name"],
                "quantity": int(c["quantity"]),
                "price_per_stem": str(c["price_per_stem"]),
                "subtotal": str(c["subtotal"]),
            }
            for c in validated["composition"]
        ],
        "total_price": str(validated["total_price"]),
        "explanation": explanation,
        "sd_prompt": sd_prompt,
        "reference_flower_ids": [str(x) for x in validated["reference_flower_ids"]],
        "image_path": None,
        "comfy_prompt_id": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "error": None,
    }


def _build_llm_user_prompt(data: AIGenerateIn) -> str:
    """Compose the user-facing message we send to the LLM, including wizard hints."""
    parts: list[str] = [data.prompt.strip()]
    if data.arrangement_type:
        parts.append(f"[arrangement_type: {data.arrangement_type}]")
    if data.container_style:
        parts.append(f"[container/style: {data.container_style.strip()}]")
    return "\n".join(p for p in parts if p)


def _heuristic_fallback_composition(
    *,
    stock: dict[Any, dict[str, Any]],
    preferred_color_tags: list[str],
    budget: float,
    budget_lower_pct: float,
    budget_upper_pct: float,
) -> dict[str, Any] | None:
    """Greedy composer used when the LLM exhausts its retry budget.

    Picks 3-5 in-stock flowers, biasing toward preferred colors, and assigns
    quantities to land inside the budget window with a healthy stem total
    (>= 12 stems where stock allows). Returns the same shape as a single
    LLM-emitted variant so the validator can accept it untouched.
    """
    items = []
    pref = set(preferred_color_tags or [])
    for fid, info in stock.items():
        score = 0
        tags = set(info.get("color_tags") or [])
        if pref & tags:
            score += 10
        if info.get("stock", 0) >= 5:
            score += 2
        items.append((score, float(info["price_per_stem"]), fid, info))
    items.sort(key=lambda r: (-r[0], r[1]))
    if len(items) < 3:
        return None

    target_min = budget * budget_lower_pct
    target_max = budget * budget_upper_pct

    picked: list[dict[str, Any]] = []
    total = 0.0
    # Anchor flower: largest preferred-color stem we can afford a bunch of.
    for _, price, fid, info in items:
        max_qty = min(int(info["stock"]), max(5, int((budget * 0.5) // price)))
        if max_qty >= 5:
            qty = max(5, min(max_qty, 8))
            picked.append({"flower_id": str(fid), "quantity": qty})
            total += price * qty
            break
    # Two to three more flowers, each 3-6 stems, until we cross target_min.
    for _, price, fid, info in items:
        if any(p["flower_id"] == str(fid) for p in picked):
            continue
        if len(picked) >= 5:
            break
        if total >= target_max:
            break
        remaining = max(0.0, target_min - total)
        qty = min(int(info["stock"]), max(3, min(6, int(remaining // price) or 3)))
        if qty <= 0 or total + price * qty > target_max:
            continue
        picked.append({"flower_id": str(fid), "quantity": qty})
        total += price * qty

    if len(picked) < 3 or not (target_min <= total <= target_max):
        return None

    refs = [p["flower_id"] for p in picked[: min(2, len(picked))]]
    return {
        "composition": picked,
        "style_modifiers": ["lush florist studio bouquet", "natural soft lighting"],
        "reference_flower_ids": refs,
        "explanation": "Букет собран автоматически из доступных цветов под ваш бюджет.",
    }


def _make_llm_client(
    settings,
    *,
    system_prompt: str,
    temperature: float,
) -> LLMClient | OllamaLLMClient:
    kwargs = dict(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        timeout_sec=settings.llm_timeout_sec,
        system_prompt=system_prompt,
        temperature=temperature,
    )
    if settings.ai_provider == "ollama":
        return OllamaLLMClient(**kwargs)
    return LLMClient(**kwargs)


def _compute_global_status(variants: list[dict[str, Any]]) -> str:
    if any(v["status"] == "pending" for v in variants):
        return "pending"
    if any(v["status"] == "ready" for v in variants):
        return "ready"
    return "failed"


class AIComfyUIGenerator:
    """Orchestrator that satisfies the AIGenerator Protocol but operates asynchronously."""

    async def generate(
        self,
        session: AsyncSession,
        *,
        consumer_id: UUID,
        data: AIGenerateIn,
    ) -> AIGenerateResponse:
        settings = get_settings()
        point = await point_repo.get_by_id(session, data.point_id)
        if point is None or not point.is_active:
            return AIGenerateResponse(error_message="Точка не найдена или неактивна.")

        all_flowers = await flower_repo.list_for_point(session, data.point_id, only_active=True)
        in_stock = [f for f in all_flowers if f.quantity > 0]
        if len(in_stock) < 3:
            return AIGenerateResponse(
                error_message="На этой точке сейчас недостаточно цветов под ваш запрос."
            )

        stock = {
            f.id: {
                "name": f.name,
                "price_per_stem": Decimal(f.price_per_stem),
                "stock": int(f.quantity),
                "image_path": f.image_path,
                "color_tags": list(f.color_tags),
                "description": f.description or "",
            }
            for f in in_stock
        }

        cfg = await ai_config_service.load(session)

        validated_list: list[dict[str, Any]] = []
        last_error: str | None = None

        if data.mode == "manual":
            if not data.composition:
                gen = AIGeneration(
                    consumer_id=consumer_id,
                    point_id=data.point_id,
                    prompt=data.prompt,
                    color_tags=[t.value for t in data.color_tags],
                    budget=Decimal(data.budget),
                    variants=[],
                    status="failed",
                    error_message="Композиция не указана.",
                )
                session.add(gen)
                await session.flush()
                return AIGenerateResponse(generation_id=gen.id, variants=[])
            try:
                manual = ai_validation.validate_manual_composition(
                    [c.model_dump() for c in data.composition],
                    stock=stock,
                    budget=Decimal(data.budget),
                    budget_lower_pct=cfg.budget_lower_pct,
                    budget_upper_pct=cfg.budget_upper_pct,
                    max_references=int(cfg.max_references),
                )
            except ai_validation.ValidationError as exc:
                gen = AIGeneration(
                    consumer_id=consumer_id,
                    point_id=data.point_id,
                    prompt=data.prompt,
                    color_tags=[t.value for t in data.color_tags],
                    budget=Decimal(data.budget),
                    variants=[],
                    status="failed",
                    error_message=f"Композиция отклонена: {exc}",
                )
                session.add(gen)
                await session.flush()
                return AIGenerateResponse(generation_id=gen.id, variants=[])
            manual["explanation"] = "Букет собран вручную из выбранных вами цветов."
            manual["style_modifiers"] = []
            validated_list = [manual]
        else:
            llm = _make_llm_client(
                settings,
                system_prompt=cfg.system_prompt,
                temperature=float(cfg.llm_temperature),
            )

            available_flowers = [
                {
                    "flower_id": str(fid),
                    "name": info["name"],
                    "color_tags": info["color_tags"],
                    "description": info["description"],
                    "price_per_stem_kzt": float(info["price_per_stem"]),
                    "stock": info["stock"],
                }
                for fid, info in stock.items()
            ]

            llm_user_prompt = _build_llm_user_prompt(data)
            for attempt in range(cfg.llm_max_retries):
                try:
                    payload = await llm.select_composition(
                        prompt=llm_user_prompt,
                        preferred_colors=[t.value for t in data.color_tags],
                        budget=float(data.budget),
                        available_flowers=available_flowers,
                        budget_lower_pct=float(cfg.budget_lower_pct),
                        budget_upper_pct=float(cfg.budget_upper_pct),
                    )
                except LLMError as exc:
                    last_error = str(exc)
                    logger.warning("LLM call failed (attempt %d): %s", attempt + 1, exc)
                    continue
                logger.warning(
                    "LLM payload (attempt %d) keys=%s: %s",
                    attempt + 1,
                    list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__,
                    str(payload)[:600],
                )
                try:
                    validated_list = ai_validation.validate_llm_variants(
                        payload,
                        stock=stock,
                        budget=Decimal(data.budget),
                        budget_lower_pct=cfg.budget_lower_pct,
                        budget_upper_pct=cfg.budget_upper_pct,
                    )
                    if validated_list:
                        break
                except ai_validation.ValidationError as exc:
                    last_error = str(exc)
                    logger.warning("LLM validation failed (attempt %d): %s", attempt + 1, exc)

            if not validated_list:
                # Local LLMs occasionally echo the input, hallucinate, or
                # disconnect. Rather than failing the user, fall back to a
                # deterministic greedy composition built from stock that
                # respects budget and rules. The validator runs on this
                # heuristic output too, so the same invariants hold.
                fallback = _heuristic_fallback_composition(
                    stock=stock,
                    preferred_color_tags=[t.value for t in data.color_tags],
                    budget=float(data.budget),
                    budget_lower_pct=float(cfg.budget_lower_pct),
                    budget_upper_pct=float(cfg.budget_upper_pct),
                )
                if fallback is not None:
                    try:
                        validated_list = ai_validation.validate_llm_variants(
                            fallback,
                            stock=stock,
                            budget=Decimal(data.budget),
                            budget_lower_pct=cfg.budget_lower_pct,
                            budget_upper_pct=cfg.budget_upper_pct,
                        )
                        logger.warning(
                            "LLM exhausted retries; using heuristic fallback composition"
                        )
                    except ai_validation.ValidationError as exc:
                        logger.warning("Heuristic fallback rejected by validator: %s", exc)

            if not validated_list:
                gen = AIGeneration(
                    consumer_id=consumer_id,
                    point_id=data.point_id,
                    prompt=data.prompt,
                    color_tags=[t.value for t in data.color_tags],
                    budget=Decimal(data.budget),
                    variants=[],
                    status="failed",
                    error_message=(
                        f"AI временно недоступен ({last_error})"
                        if last_error
                        else "AI временно недоступен"
                    ),
                )
                session.add(gen)
                await session.flush()
                return AIGenerateResponse(generation_id=gen.id, variants=[])

        # Manual mode injects "Manual composition" as a placeholder prompt — that
        # placeholder must NOT leak into the SD prompt (CLIP would tokenize it
        # like real style guidance and bias the image). Drop it; LLM-mode keeps
        # whatever the user wrote in `data.prompt`.
        user_prompt_text = data.prompt.strip()
        if data.mode == "manual" and user_prompt_text.lower() == "manual composition":
            user_prompt_text = ""

        # One preview image per request: take the first validated composition
        # (LLM mode may return several, manual mode always returns exactly one).
        slots = [validated_list[0]]

        # Build one SD prompt + initial DB record per slot. Each slot gets its
        # own background render task so they progress in parallel.
        initial_variants: list[dict[str, Any]] = []
        render_args: list[dict[str, Any]] = []
        for idx, validated in enumerate(slots):
            composition_for_prompt = sorted(
                validated["composition"], key=lambda c: c["subtotal"], reverse=True
            )
            style_modifiers = validated.get("style_modifiers") or []
            style_text = " ".join(
                filter(None, [user_prompt_text, *style_modifiers])
            )
            sd_prompt = compose_positive_prompt(
                composition=composition_for_prompt,
                arrangement_type=data.arrangement_type,
                container_style=data.container_style,
                color_tags=[t.value for t in data.color_tags],
                style_text=style_text,
                pipeline_version=str(cfg.pipeline_version),
            )
            initial_variants.append(
                _initial_variant_record(
                    idx, validated, sd_prompt=sd_prompt, explanation=validated["explanation"]
                )
            )
            render_args.append(
                {
                    "idx": idx,
                    "sd_prompt": sd_prompt,
                    "reference_flower_ids": validated["reference_flower_ids"],
                }
            )

        gen = AIGeneration(
            consumer_id=consumer_id,
            point_id=data.point_id,
            prompt=data.prompt,
            color_tags=[t.value for t in data.color_tags],
            budget=Decimal(data.budget),
            variants=initial_variants,
            status="pending",
        )
        session.add(gen)
        await session.flush()

        gen_id = gen.id

        # Snapshot config values so the background renders use the same settings the
        # request was validated against, even if a superadmin patches the config mid-flight.
        render_cfg = {
            "sampler_steps": int(cfg.sampler_steps),
            "sampler_cfg": float(cfg.sampler_cfg),
            "sampler_name": str(cfg.sampler_name),
            "image_width": int(cfg.image_width),
            "image_height": int(cfg.image_height),
            "negative_prompt": str(cfg.negative_prompt),
            "pipeline_version": str(cfg.pipeline_version),
        }

        # One background render task per variant — they run concurrently.
        for args in render_args:
            asyncio.create_task(
                _render_variant_with_own_session(
                    generation_id=gen_id,
                    stock=stock,
                    render_cfg=render_cfg,
                    **args,
                )
            )

        return AIGenerateResponse(generation_id=gen_id, variants=[])


async def _render_variant_with_own_session(
    *,
    generation_id: UUID,
    idx: int,
    sd_prompt: str,
    reference_flower_ids: list[UUID],
    stock: dict[UUID, dict[str, Any]],
    render_cfg: dict[str, Any],
) -> None:
    settings = get_settings()
    started = time.monotonic()
    error: str | None = None
    image_path: str | None = None
    comfy_prompt_id: str | None = None

    try:
        comfy = ComfyUIClient(
            base_url=settings.comfyui_base_url,
            poll_interval_sec=settings.comfyui_poll_interval_sec,
            timeout_sec=settings.comfyui_timeout_sec,
        )

        media_dir = Path(settings.media_dir)
        ref_filenames: list[str] = []
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
            for rid in reference_flower_ids:
                src = stock[rid]["image_path"]
                if isinstance(src, str) and src.startswith(("http://", "https://")):
                    r = await http.get(src)
                    r.raise_for_status()
                    raw = r.content
                else:
                    raw = (media_dir / src).read_bytes()
                server_name = await comfy.upload_image(
                    raw, filename=f"ref_{generation_id}_{idx}_{rid}.png"
                )
                ref_filenames.append(server_name)

        template = _load_workflow_template(render_cfg["pipeline_version"])
        seed = random.randint(0, 2**31 - 1)
        wf = _build_workflow_for_render(
            template,
            seed=seed,
            positive_prompt=sd_prompt,
            filename_prefix=f"boquet/{generation_id}_{idx}",
            ref_filenames=ref_filenames,
            sampler_steps=render_cfg["sampler_steps"],
            sampler_cfg=render_cfg["sampler_cfg"],
            sampler_name=render_cfg["sampler_name"],
            image_width=render_cfg["image_width"],
            image_height=render_cfg["image_height"],
            negative_prompt=render_cfg["negative_prompt"],
        )

        comfy_prompt_id = await comfy.submit(wf, client_id=str(uuid4()))
        refs = await comfy.wait_for_result(comfy_prompt_id, save_node_id=SAVE_NODE_ID)
        if not refs:
            raise ComfyUIError("ComfyUI history returned no images")

        png_bytes = await comfy.download(refs[0])
        out_dir = media_dir / "ai_generated"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{generation_id}_{idx}.png"
        out_path.write_bytes(png_bytes)
        image_path = f"ai_generated/{out_path.name}"

    except (LLMError, ComfyUIError, httpx.HTTPError, OSError) as exc:
        logger.exception("Render failed for variant %d of %s", idx, generation_id)
        error = str(exc) or exc.__class__.__name__
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected render failure for variant %d of %s", idx, generation_id)
        error = f"Internal: {exc}"

    elapsed = time.monotonic() - started
    logger.info(
        "Variant %d of %s finished in %.1fs (error=%s)",
        idx,
        generation_id,
        elapsed,
        error,
    )

    async with SessionLocal() as session:
        async with session.begin():
            gen = await ai_generation_repo.get_by_id(session, generation_id)
            if gen is None:
                return
            variants = list(gen.variants or [])
            if idx >= len(variants):
                return
            v = dict(variants[idx])
            v["status"] = "ready" if error is None else "failed"
            v["image_path"] = image_path
            v["comfy_prompt_id"] = comfy_prompt_id
            v["finished_at"] = datetime.now(timezone.utc).isoformat()
            v["error"] = error
            variants[idx] = v
            new_status = _compute_global_status(variants)
            await ai_generation_repo.update_variants_and_status(
                session,
                generation_id=generation_id,
                variants=variants,
                status=new_status,
                error_message=gen.error_message,
            )
