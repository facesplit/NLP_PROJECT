from __future__ import annotations

import os
import random
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import AIGeneration, Flower
from app.repositories import flower_repo, point_repo
from app.schemas.ai import AIGenerateIn, AIGenerateResponse, AIVariant

EXPLAIN_TEMPLATES = [
    "Эта композиция строится вокруг {anchor}. {flow} Букет получается {mood} — отличный выбор под ваш запрос «{prompt_short}».",
    "Сделали ставку на {anchor} — задаёт настроение. {flow} В рамках бюджета — выкладываемся {mood}.",
    "Букет начинается с {anchor}, его поддерживают {flow}. Ощущение — {mood}. Подходит к описанию «{prompt_short}».",
]
MOODS = [
    "нежным и воздушным",
    "тёплым и уютным",
    "графичным и стильным",
    "сезонным и свежим",
    "праздничным и ярким",
    "спокойным и пастельным",
]


def _list_mock_assets() -> list[str]:
    """Returns relative paths under MEDIA_DIR/ai_mock/ for available bouquet PNGs."""
    settings = get_settings()
    root = Path(settings.media_dir) / "ai_mock"
    if not root.exists():
        return []
    files = [p.name for p in root.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}]
    files.sort()
    return [f"ai_mock/{name}" for name in files]


class MockAIGenerator:
    async def generate(
        self,
        session: AsyncSession,
        *,
        consumer_id: UUID,
        data: AIGenerateIn,
    ) -> AIGenerateResponse:
        point = await point_repo.get_by_id(session, data.point_id)
        if point is None or not point.is_active:
            return AIGenerateResponse(error_message="Точка не найдена или неактивна.")

        all_flowers = await flower_repo.list_for_point(session, data.point_id, only_active=True)
        in_stock = [f for f in all_flowers if f.quantity > 0]
        if len(in_stock) < 3:
            return AIGenerateResponse(
                error_message="На этой точке сейчас недостаточно цветов под ваш запрос."
            )

        wanted = {t.value for t in data.color_tags}
        candidates = [f for f in in_stock if any(c in wanted for c in f.color_tags)]
        if len(candidates) < 3:
            candidates = in_stock

        seed_value = int.from_bytes(os.urandom(4), "big")
        rnd = random.Random(seed_value)
        budget = Decimal(data.budget)

        assets = _list_mock_assets()

        variants: list[AIVariant] = [
            _build_variant(rnd, 0, candidates, budget, data.prompt, data.color_tags, assets)
        ]

        gen = AIGeneration(
            consumer_id=consumer_id,
            point_id=data.point_id,
            prompt=data.prompt,
            color_tags=[t.value for t in data.color_tags],
            budget=budget,
            variants=[v.model_dump(mode="json") for v in variants],
            status="ready",
        )
        session.add(gen)
        await session.flush()

        return AIGenerateResponse(generation_id=gen.id, variants=variants)


def _build_variant(
    rnd: random.Random,
    index: int,
    available: list[Flower],
    budget: Decimal,
    prompt: str,
    preferred_colors,
    assets: list[str],
) -> AIVariant:
    target_count = rnd.randint(3, min(6, len(available)))
    pool = rnd.sample(available, target_count)

    items = []
    for f in pool:
        items.append(
            {
                "flower_id": str(f.id),
                "name": f.name,
                "price_per_stem": Decimal(f.price_per_stem),
                "quantity": 1,
                "stock": int(f.quantity),
            }
        )

    lo = budget * Decimal("0.85")
    hi = budget * Decimal("1.10")
    total = sum((it["price_per_stem"] for it in items), start=Decimal("0"))

    safety = 200
    while total < lo and safety > 0:
        safety -= 1
        idx = rnd.randrange(len(items))
        if items[idx]["quantity"] + 1 > items[idx]["stock"]:
            continue
        items[idx]["quantity"] += 1
        total += items[idx]["price_per_stem"]
        if total > hi:
            items[idx]["quantity"] -= 1
            total -= items[idx]["price_per_stem"]
            break

    composition = []
    for it in items:
        composition.append(
            {
                "flower_id": UUID(it["flower_id"]),
                "name": it["name"],
                "quantity": it["quantity"],
                "price_per_stem": Decimal(it["price_per_stem"]),
                "subtotal": Decimal(it["price_per_stem"]) * it["quantity"],
            }
        )

    if assets:
        image_path = rnd.choice(assets)
    else:
        seed_value = preferred_colors[0].value if preferred_colors else "mixed"
        image_path = (
            f"https://picsum.photos/seed/ai-bouquet-{seed_value}-{index}-{rnd.randint(0, 99999)}/720/720"
        )

    sorted_items = sorted(composition, key=lambda c: c["subtotal"], reverse=True)
    anchor = sorted_items[0]["name"].lower() if sorted_items else "сезонных цветов"
    others = ", ".join(c["name"].lower() for c in sorted_items[1:4])
    flow = f"Поддержка из {others}." if others else ""
    prompt_short = prompt[:50] + ("…" if len(prompt) > 50 else "")
    explanation = (
        rnd.choice(EXPLAIN_TEMPLATES)
        .replace("{anchor}", anchor)
        .replace("{flow}", flow)
        .replace("{mood}", rnd.choice(MOODS))
        .replace("{prompt_short}", prompt_short)
    )

    return AIVariant(
        index=index,
        status="ready",
        image_path=image_path,
        composition=composition,
        total_price=total,
        explanation=explanation,
    )
