from __future__ import annotations

import asyncio
from decimal import Decimal
from typing import Any

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.enums import Role
from app.core.security import hash_password
from app.models import Flower, FloristPoint, PortfolioBouquet, User


# ---------------------------------------------------------------------------
# Wikimedia-hosted reference photos.
#
# Every flower below points to a real, species-correct photograph on Wikimedia
# Commons (CC-BY-SA / public-domain). Point covers and portfolio bouquets reuse
# the same photo bank so that the demo dataset shows real floristry instead of
# random stock images.
#
# URL pattern: thumbnails are auto-rescaled by the Wikimedia server when we
# request a specific width; staying <= 1200 px is well within the source
# resolution for every entry below.
# ---------------------------------------------------------------------------

_WM = "https://upload.wikimedia.org/wikipedia/commons"


def _w(path: str, width: int = 0) -> str:
    """Build a Wikimedia Commons original-image URL.

    ``path`` is the segment after ``/commons/``, e.g. ``"2/2a/Rosa_chinensis.jpg"``.
    The ``width`` argument is accepted for backwards compatibility but is
    ignored: Wikimedia rate-limits the thumbnail server (HTTP 429/400 on
    arbitrary widths), while the original-image URL is always served.
    Originals are typically 1-3 MB; the frontend rescales on render.
    """
    _ = width
    return f"{_WM}/{path}"


# Flower photos by stable key (see seeds below). Keep keys alphabetical-ish for
# ease of editing.
FLOWER_PHOTOS: dict[str, str] = {
    # Roses (3 cultivars; pages with strong cultivar photos):
    "rose-pink-ohara": _w("2/2a/Rosa_chinensis.jpg", 800),
    "rose-quicksand":  _w("5/5e/Rosa_Peace_1945.jpg", 800),
    "rose-mondial":    _w("d/d8/Rosa_alba_resized.JPG", 800),

    # Peony (Sarah Bernhardt cultivar = Paeonia lactiflora hybrid)
    "peony-sb": _w("b/be/Lactiflora1b.UME.jpg", 800),

    # Eustoma / Lisianthus (same species, two SKUs in the seed set)
    "eustoma":    _w("7/7e/Lisianthus_2025.jpg", 800),
    "lisianthus": _w("7/7e/Lisianthus_2025.jpg", 800),

    # Filler greens
    "gypsophila": _w("0/09/Gypsophila_repens_-_close-up_%28aka%29.jpg", 800),
    "eucalyptus": _w("3/32/Eucalyptus_cinerea_habit.jpg", 800),
    "asparagus":  _w("e/e8/Asparagus_setaceus_Leaves_2760px.jpg", 800),
    "pittosporum": _w("3/3e/Pittosporum_Tobira_JPG0.jpg", 800),

    # Showy heads
    "ranunculus":   _w("2/23/Persian_Buttercup_01.jpg", 800),
    "tulip-french": _w("e/e2/Tulip_Tulipa_clusiana_%27Lady_Jane%27_Rock_Ledge_Flower_2000px.jpg", 800),
    "hortensia":    _w("2/21/%28Natural%29_Hydrangea_macrophylla%2C_Iwafune%2C_Isumi%2C_Chiba%2C_Japan_2.jpg", 800),
    "calla":        _w("a/ab/Zantedeschia_-_Calla_Lilly2.jpg", 800),
    "anemone":      _w("c/c9/Anemone-coronaria-2016-Zachi-Evenor.jpg", 800),
    "chrysanthemum": _w("b/b5/Chrysanthemum_nangkingense.jpg", 800),
    "cymbidium":    _w("b/be/Cymbidium_iridioides-1-bsi-yercaud-salem-India.jpg", 800),
    "skimmia":      _w("6/63/Skimmia_reevesiana1.jpg", 800),
    "matthiola":    _w("d/d6/Matthiola_incana6.jpg", 800),
    "iris-blue":    _w("f/f8/Iris_sanguinea_cultivar%2C_Wakehurst_Place%2C_UK_-_Diliff.jpg", 800),
    "gerbera-orange": _w("3/3b/Unidentified_Gerbera.jpg", 800),
}


# Three different cover images for the three points.
POINT_COVERS: dict[str, str] = {
    "florashop-1": _w("2/24/A_Parisian_Flower_Market.jpg", 1200),
    "florashop-2": _w("b/bb/Rose_hydrangea_calla_wedding_bouquet.jpg", 1200),
    "lilyatelier": _w("b/be/Cymbidium_iridioides-1-bsi-yercaud-salem-India.jpg", 1200),
}


# Each portfolio bouquet gets a flower photo whose color/composition matches
# the bouquet's color tags.
BOUQUET_PHOTOS: dict[str, str] = {
    "bq-garden-morning": _w("b/bb/Rose_hydrangea_calla_wedding_bouquet.jpg", 800),
    "bq-milk-peony":     _w("b/be/Lactiflora1b.UME.jpg", 800),
    "bq-yellow-ray":     _w("2/23/Persian_Buttercup_01.jpg", 800),
    "bq-velvet-eve":     _w("c/c9/Anemone-coronaria-2016-Zachi-Evenor.jpg", 800),
    "bq-blue-haze":      _w("2/21/%28Natural%29_Hydrangea_macrophylla%2C_Iwafune%2C_Isumi%2C_Chiba%2C_Japan_2.jpg", 800),
    "bq-pink-powder":    _w("2/2a/Rosa_chinensis.jpg", 800),
    "bq-aurora":         _w("f/f8/Iris_sanguinea_cultivar%2C_Wakehurst_Place%2C_UK_-_Diliff.jpg", 800),
    "bq-amber":          _w("3/3b/Unidentified_Gerbera.jpg", 800),
    "bq-lilac-whisper":  _w("d/d6/Matthiola_incana6.jpg", 800),
    "bq-winter-ice":     _w("d/d8/Rosa_alba_resized.JPG", 800),
}


FLORA_POINTS: list[dict[str, Any]] = [
    {
        "name": "Сад на Достык",
        "address": "Алматы, пр. Достык 89, ТЦ Спутник",
        "description": "Камерная мастерская в центре. Сезонные цветы каждый день из утренней поставки.",
        "cover": POINT_COVERS["florashop-1"],
        "rating": Decimal("4.9"),
        "flowers": [
            {"name": "Роза Pink O'Hara", "img": FLOWER_PHOTOS["rose-pink-ohara"], "price": 1100, "qty": 32, "colors": ["pink"], "desc": "Душистая садовая роза с шёлковыми лепестками."},
            {"name": "Пион Sarah Bernhardt", "img": FLOWER_PHOTOS["peony-sb"], "price": 1900, "qty": 18, "colors": ["pink", "white"], "desc": "Классический розовый пион, аромат — ваниль и роза."},
            {"name": "Эустома белая", "img": FLOWER_PHOTOS["eustoma"], "price": 850, "qty": 24, "colors": ["white"]},
            {"name": "Гипсофила", "img": FLOWER_PHOTOS["gypsophila"], "price": 420, "qty": 60, "colors": ["white"], "desc": "Лёгкое облако для объёма и воздуха."},
            {"name": "Ранункулюс", "img": FLOWER_PHOTOS["ranunculus"], "price": 980, "qty": 28, "colors": ["yellow", "white"]},
            {"name": "Эвкалипт Cinerea", "img": FLOWER_PHOTOS["eucalyptus"], "price": 540, "qty": 45, "colors": ["green"], "desc": "Серебристая зелень — идеальный спутник."},
            {"name": "Тюльпан French", "img": FLOWER_PHOTOS["tulip-french"], "price": 760, "qty": 35, "colors": ["red", "yellow"]},
        ],
        "bouquets": [
            {"name": "Утро в саду", "img": BOUQUET_PHOTOS["bq-garden-morning"], "desc": "Нежная пастельная композиция для тёплого момента.", "price": 16500, "colors": ["pink", "white"], "comp": [(0, 7), (1, 3), (5, 4)]},
            {"name": "Молочный пион", "img": BOUQUET_PHOTOS["bq-milk-peony"], "desc": "Моно-букет из пионов с гипсофилой.", "price": 14200, "colors": ["white"], "comp": [(1, 5), (3, 1)]},
            {"name": "Жёлтый луч", "img": BOUQUET_PHOTOS["bq-yellow-ray"], "desc": "Солнечный микс для подарка.", "price": 9800, "colors": ["yellow", "white"], "comp": [(4, 9), (2, 4), (5, 3)]},
        ],
    },
    {
        "name": "Студия Достык-2",
        "address": "Алматы, мкр. Самал-2, дом 78",
        "description": "Камерная студия с премиальными розами и авторскими букетами под заказ.",
        "cover": POINT_COVERS["florashop-2"],
        "rating": Decimal("4.7"),
        "flowers": [
            {"name": "Роза Quicksand", "img": FLOWER_PHOTOS["rose-quicksand"], "price": 1250, "qty": 40, "colors": ["pink"]},
            {"name": "Гортензия", "img": FLOWER_PHOTOS["hortensia"], "price": 2100, "qty": 12, "colors": ["blue", "white"]},
            {"name": "Лизиантус", "img": FLOWER_PHOTOS["lisianthus"], "price": 920, "qty": 26, "colors": ["purple", "white"]},
            {"name": "Каллы", "img": FLOWER_PHOTOS["calla"], "price": 1340, "qty": 18, "colors": ["white"]},
            {"name": "Анемоны", "img": FLOWER_PHOTOS["anemone"], "price": 1100, "qty": 22, "colors": ["red", "purple"]},
            {"name": "Питтоспорум", "img": FLOWER_PHOTOS["pittosporum"], "price": 380, "qty": 50, "colors": ["green"]},
        ],
        "bouquets": [
            {"name": "Бархатный вечер", "img": BOUQUET_PHOTOS["bq-velvet-eve"], "desc": "Глубокие винные тона с фиолетовыми акцентами.", "price": 19800, "colors": ["red", "purple"], "comp": [(4, 8), (2, 5), (5, 4)]},
            {"name": "Голубая дымка", "img": BOUQUET_PHOTOS["bq-blue-haze"], "desc": "Гортензия и каллы — северная элегантность.", "price": 22400, "colors": ["blue", "white"], "comp": [(1, 3), (3, 4)]},
            {"name": "Розовая пудра", "img": BOUQUET_PHOTOS["bq-pink-powder"], "desc": "Воздушный розовый монобукет.", "price": 13500, "colors": ["pink"], "comp": [(0, 11), (5, 3)]},
        ],
    },
]

LILY_POINTS: list[dict[str, Any]] = [
    {
        "name": "Lily Atelier",
        "address": "Астана, пр. Туран 37, БЦ Экспо",
        "description": "Бутиковая флористика. Премиум-цветы, авторские композиции, подарочная упаковка.",
        "cover": POINT_COVERS["lilyatelier"],
        "rating": Decimal("4.8"),
        "flowers": [
            {"name": "Роза Mondial", "img": FLOWER_PHOTOS["rose-mondial"], "price": 980, "qty": 50, "colors": ["white"]},
            {"name": "Хризантема Pina Colada", "img": FLOWER_PHOTOS["chrysanthemum"], "price": 740, "qty": 30, "colors": ["white", "yellow"]},
            {"name": "Орхидея Cymbidium", "img": FLOWER_PHOTOS["cymbidium"], "price": 2400, "qty": 8, "colors": ["green", "purple"]},
            {"name": "Скиммия", "img": FLOWER_PHOTOS["skimmia"], "price": 620, "qty": 22, "colors": ["red", "green"]},
            {"name": "Маттиола", "img": FLOWER_PHOTOS["matthiola"], "price": 880, "qty": 28, "colors": ["purple", "white"]},
            {"name": "Аспарагус", "img": FLOWER_PHOTOS["asparagus"], "price": 320, "qty": 60, "colors": ["green"]},
            {"name": "Ирис голубой", "img": FLOWER_PHOTOS["iris-blue"], "price": 580, "qty": 24, "colors": ["blue"]},
            {"name": "Гербера оранж", "img": FLOWER_PHOTOS["gerbera-orange"], "price": 480, "qty": 40, "colors": ["orange"]},
        ],
        "bouquets": [
            {"name": "Северное сияние", "img": BOUQUET_PHOTOS["bq-aurora"], "desc": "Голубой ирис, белые розы и аспарагус.", "price": 17200, "colors": ["blue", "white"], "comp": [(6, 7), (0, 5), (5, 6)]},
            {"name": "Тёплый янтарь", "img": BOUQUET_PHOTOS["bq-amber"], "desc": "Оранж и зелень для дерзкого подарка.", "price": 11800, "colors": ["orange", "green"], "comp": [(7, 11), (5, 5), (3, 4)]},
            {"name": "Лиловый шёпот", "img": BOUQUET_PHOTOS["bq-lilac-whisper"], "desc": "Маттиола, орхидея и хризантема.", "price": 24500, "colors": ["purple", "white"], "comp": [(4, 6), (2, 2), (1, 5)]},
            {"name": "Зимний лёд", "img": BOUQUET_PHOTOS["bq-winter-ice"], "desc": "Чистый белый монобукет.", "price": 19500, "colors": ["white"], "comp": [(0, 15), (5, 4)]},
        ],
    },
]


async def _build_for_owner(session, owner_id, seeds: list[dict[str, Any]]) -> None:
    for s in seeds:
        point = FloristPoint(
            owner_id=owner_id,
            name=s["name"],
            address=s["address"],
            description=s["description"],
            cover_image_path=s["cover"],
            rating=s["rating"],
        )
        session.add(point)
        await session.flush()

        flowers: list[Flower] = []
        for f in s["flowers"]:
            fl = Flower(
                point_id=point.id,
                name=f["name"],
                image_path=f["img"],
                price_per_stem=Decimal(f["price"]),
                quantity=f["qty"],
                color_tags=list(f["colors"]),
                description=f.get("desc"),
            )
            session.add(fl)
            flowers.append(fl)
        await session.flush()

        for b in s["bouquets"]:
            comp = [
                {"flower_id": str(flowers[idx].id), "quantity": qty}
                for idx, qty in b["comp"]
            ]
            session.add(
                PortfolioBouquet(
                    point_id=point.id,
                    name=b["name"],
                    description=b["desc"],
                    image_path=b["img"],
                    price=Decimal(b["price"]),
                    color_tags=list(b["colors"]),
                    composition=comp,
                )
            )


async def _ensure_user(session, *, email: str, password: str, role: Role, display_name: str, phone: str | None = None) -> User:
    existing = (
        await session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        role=role,
        display_name=display_name,
        phone=phone,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def seed() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        async with session.begin():
            superadmin = await _ensure_user(
                session,
                email=settings.superadmin_email,
                password=settings.superadmin_password,
                role=Role.SUPERADMIN,
                display_name="Айгерим Орынбаева",
                phone="+7 707 000 00 01",
            )

            existing_points = (await session.execute(select(FloristPoint).limit(1))).first()
            if existing_points is not None:
                # Demo data already in place; only ensure superadmin exists
                return

            flora = await _ensure_user(
                session,
                email="flora@bouquet.local",
                password="flora12345",
                role=Role.FLORISTADMIN,
                display_name="Флора Мастерская",
                phone="+7 705 222 11 33",
            )
            lily = await _ensure_user(
                session,
                email="lily@bouquet.local",
                password="lily12345",
                role=Role.FLORISTADMIN,
                display_name="Лилия Студия",
                phone="+7 701 555 80 80",
            )
            await _ensure_user(
                session,
                email="client@bouquet.local",
                password="client12345",
                role=Role.CONSUMER,
                display_name="Жанна Айдарова",
                phone="+7 700 123 45 67",
            )

            await _build_for_owner(session, flora.id, FLORA_POINTS)
            await _build_for_owner(session, lily.id, LILY_POINTS)
            # superadmin is referenced just to silence unused warning; it's already persisted
            _ = superadmin


def main() -> None:  # entrypoint for `python -m app.cli.seed`
    asyncio.run(seed())


if __name__ == "__main__":
    main()
