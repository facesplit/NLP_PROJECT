"""Default values for the ai_config single-row table.

This module is imported by both the alembic migration (which seeds row id=1)
and the runtime reset endpoint. Keeping defaults here prevents drift.
"""
from __future__ import annotations

from decimal import Decimal


DEFAULT_SYSTEM_PROMPT = """\
Ты — флорист-консультант. На вход получаешь: запрос клиента (с указанием типа \
композиции и описанием стиля/контейнера), желаемые цветовые акценты, бюджет в \
тенге, и список доступных цветов на складе. Твоя задача — предложить ОДИН \
лучший букет под этот запрос. Это полноценный пышный букет, а НЕ набор из \
нескольких одиночных цветков.

Жёсткие правила:
1. Используй только flower_id из переданного склада. Никогда не выдумывай.
2. quantity каждого цветка — положительное целое и не превышает stock из склада.
3. Сумма (price_per_stem × quantity) обязательно в диапазоне \
[budget_min_kzt, budget_max_kzt] из user-сообщения. Перепроверь арифметику \
перед ответом — это критично.
4. В букете 3-6 УНИКАЛЬНЫХ цветов.
5. ВАЖНО (визуальная масса): суммарное количество стеблей в букете НЕ МЕНЬШЕ \
12. Это полноценный пышный букет, а не три отдельных цветка в обёртке.
6. ВАЖНО (якорь): хотя бы у одного цветка quantity >= 5 — это "якорный" \
цветок, формирующий объём букета. Идеально: 1-2 якорных цветка по 5-15 \
стеблей плюс 2-3 акцентных по 3-6 стеблей плюс зелень/наполнитель.
7. Учитывай arrangement_type: handheld — компактный букет в руке; vase — \
высокая композиция в вазе (длинные стебли, объём); centerpiece — низкая \
широкая композиция (больше зелени, меньше высоких цветов).
8. reference_flower_ids — выбери от 1 до 3 ID цветов с самой большой долей в \
бюджете букета; их фотографии IP-Adapter возьмёт как стилистические референсы.
9. style_modifiers — короткие английские прилагательные/фразы (1-3 элемента), \
описывающие общий стиль и настроение букета (например: "lush and romantic", \
"bold and modern", "rustic wildflower meadow").
10. explanation — на русском, 1-2 предложения, какое настроение и почему.

Ответ строго в JSON по схеме:

{
  "composition": [{"flower_id": "uuid", "quantity": 7}, ...],
  "style_modifiers": ["lush and romantic", "soft pastel mood"],
  "reference_flower_ids": ["uuid", "uuid"],
  "explanation": "..."
}
"""

DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, watermark, text, deformed, ugly, cartoon, "
    "illustration, drawing, painting, mutated hands, extra fingers, "
    "plastic flowers, wilted, dried, hdr, jpeg artifacts, frame, border, "
    "person dominating frame, distant bouquet, tiny flowers, "
    "washed out colors, desaturated petals, "
    "garden, outdoor, foliage, grass, dirt, soil, trees, tree branches, "
    "park, forest, field, meadow, sky, landscape, "
    "single flower in grass, lone flower, wildflower scene, "
    "bushy background, leafy background, cluttered background, "
    "wood table, wooden surface, restaurant interior, dining table"
)

ALLOWED_SAMPLERS = ("euler", "euler_ancestral", "dpmpp_2m", "dpmpp_sde", "ddim", "lcm")

ALLOWED_PIPELINE_VERSIONS = ("sd15", "sdxl")


# SDXL is significantly better at multi-subject composition, fine flower
# structures (gypsophila, baby's breath) and hand anatomy. SD 1.5 is kept as a
# reversible fallback in case the SDXL pipeline misbehaves on a given workload.
DEFAULTS: dict = {
    "system_prompt": DEFAULT_SYSTEM_PROMPT,
    "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
    "sampler_steps": 32,
    "sampler_cfg": Decimal("7.00"),
    "sampler_name": "dpmpp_2m",
    "image_width": 832,
    "image_height": 1024,
    "budget_lower_pct": Decimal("0.600"),
    "budget_upper_pct": Decimal("1.400"),
    "llm_temperature": Decimal("0.70"),
    "llm_max_retries": 6,
    "max_references": 10,
    "pipeline_version": "sdxl",
}
