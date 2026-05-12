"""One-shot helper: rewrite picsum image URLs in the existing demo data
to the species-correct Wikimedia URLs defined in app.services.seed_service.

Run inside the backend container:
    docker compose exec backend python -m scripts.update_seed_images
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Flower, FloristPoint, PortfolioBouquet
from app.services.seed_service import FLORA_POINTS, LILY_POINTS


def _build_lookup() -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Return (point_cover_by_name, flower_image_by_name, bouquet_image_by_name)."""
    point_covers: dict[str, str] = {}
    flower_imgs: dict[str, str] = {}
    bouquet_imgs: dict[str, str] = {}
    for group in (FLORA_POINTS, LILY_POINTS):
        for s in group:
            point_covers[s["name"]] = s["cover"]
            for f in s["flowers"]:
                flower_imgs[f["name"]] = f["img"]
            for b in s["bouquets"]:
                bouquet_imgs[b["name"]] = b["img"]
    return point_covers, flower_imgs, bouquet_imgs


async def main() -> None:
    point_covers, flower_imgs, bouquet_imgs = _build_lookup()
    async with SessionLocal() as session:
        async with session.begin():
            updated_pts = 0
            updated_fls = 0
            updated_bqs = 0

            pts = (await session.execute(select(FloristPoint))).scalars().all()
            for p in pts:
                if p.name in point_covers and p.cover_image_path != point_covers[p.name]:
                    p.cover_image_path = point_covers[p.name]
                    updated_pts += 1

            fls = (await session.execute(select(Flower))).scalars().all()
            for f in fls:
                if f.name in flower_imgs and f.image_path != flower_imgs[f.name]:
                    f.image_path = flower_imgs[f.name]
                    updated_fls += 1

            bqs = (await session.execute(select(PortfolioBouquet))).scalars().all()
            for b in bqs:
                if b.name in bouquet_imgs and b.image_path != bouquet_imgs[b.name]:
                    b.image_path = bouquet_imgs[b.name]
                    updated_bqs += 1

    print(f"updated: {updated_pts} points, {updated_fls} flowers, {updated_bqs} bouquets")


if __name__ == "__main__":
    asyncio.run(main())
