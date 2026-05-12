"""Download every Wikimedia seed image into the media volume and rewrite DB
rows to use the local path instead of the remote URL.

Why: AI generation downloads the per-flower reference image at request time
to upload it into ComfyUI for IPAdapter. Wikimedia rate-limits cold remote
fetches (HTTP 429) which intermittently breaks generation. Pre-downloading
once into the media volume removes the dependency on Wikimedia at request
time.

Run inside the backend container:
    docker compose exec backend python -m scripts.download_seed_images
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Flower, FloristPoint, PortfolioBouquet
from app.services.seed_service import (
    BOUQUET_PHOTOS,
    FLOWER_PHOTOS,
    POINT_COVERS,
)


SEED_SUBDIR = "seed_assets"
USER_AGENT = "BouquetAI/1.0 (https://github.com/example/bouquet; contact@bouquet.local)"


def _filename_for(key: str, url: str) -> str:
    """Derive a stable on-disk filename from the dict key and the URL extension."""
    decoded = unquote(urlparse(url).path)
    ext = Path(decoded).suffix.lower() or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"
    safe_key = key.replace("/", "_").replace(" ", "_")
    return f"{safe_key}{ext}"


async def _download_all(urls_by_key: dict[str, str], dest: Path) -> dict[str, str]:
    """Download each URL with a short polite delay between requests.

    Returns a mapping ``{key: local_relative_path}`` where the relative path
    is rooted at ``MEDIA_DIR`` (so ``image_path`` columns store
    ``"seed_assets/<file>"``).
    """
    dest.mkdir(parents=True, exist_ok=True)
    out: dict[str, str] = {}
    async with httpx.AsyncClient(
        timeout=30.0,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        for key, url in urls_by_key.items():
            local_name = _filename_for(key, url)
            local_path = dest / local_name
            relative = f"{SEED_SUBDIR}/{local_name}"
            if local_path.exists() and local_path.stat().st_size > 0:
                out[key] = relative
                print(f"  ✓ cached  {key} → {relative} ({local_path.stat().st_size} B)")
                continue
            for attempt in range(1, 5):
                try:
                    r = await client.get(url)
                    if r.status_code == 200 and r.content:
                        local_path.write_bytes(r.content)
                        out[key] = relative
                        print(f"  ✓ downloaded {key} → {relative} ({len(r.content)} B)")
                        break
                    print(f"  ! {key}: HTTP {r.status_code} on attempt {attempt}")
                except httpx.HTTPError as exc:
                    print(f"  ! {key}: {exc} on attempt {attempt}")
                await asyncio.sleep(2.0 * attempt)  # back off
            else:
                print(f"  ✗ {key}: gave up after 4 attempts ({url})")
            await asyncio.sleep(1.5)  # polite between successful requests
    return out


async def _rewrite_db(
    flower_paths: dict[str, str],
    point_paths: dict[str, str],
    bouquet_paths: dict[str, str],
) -> None:
    """Update flower/point/bouquet rows to point at the locally cached paths.

    Matches by name (the canonical lookup is via the dicts in seed_service).
    """
    # Build name → local-path lookups via the seed config so we know which
    # row maps to which key in the *_PHOTOS dicts.
    from app.services.seed_service import FLORA_POINTS, LILY_POINTS

    flower_name_to_url = {}
    point_name_to_url = {}
    bouquet_name_to_url = {}
    for grp in (FLORA_POINTS, LILY_POINTS):
        for s in grp:
            point_name_to_url[s["name"]] = s["cover"]
            for f in s["flowers"]:
                flower_name_to_url[f["name"]] = f["img"]
            for b in s["bouquets"]:
                bouquet_name_to_url[b["name"]] = b["img"]

    # Reverse the *_PHOTOS dicts: url → key.
    url_to_flower_key = {v: k for k, v in FLOWER_PHOTOS.items()}
    url_to_point_key = {v: k for k, v in POINT_COVERS.items()}
    url_to_bouquet_key = {v: k for k, v in BOUQUET_PHOTOS.items()}

    async with SessionLocal() as session:
        async with session.begin():
            up_p = up_f = up_b = 0
            for p in (await session.execute(select(FloristPoint))).scalars():
                url = point_name_to_url.get(p.name)
                if not url:
                    continue
                key = url_to_point_key.get(url)
                local = point_paths.get(key) if key else None
                if local and p.cover_image_path != local:
                    p.cover_image_path = local
                    up_p += 1
            for f in (await session.execute(select(Flower))).scalars():
                url = flower_name_to_url.get(f.name)
                if not url:
                    continue
                key = url_to_flower_key.get(url)
                local = flower_paths.get(key) if key else None
                if local and f.image_path != local:
                    f.image_path = local
                    up_f += 1
            for b in (await session.execute(select(PortfolioBouquet))).scalars():
                url = bouquet_name_to_url.get(b.name)
                if not url:
                    continue
                key = url_to_bouquet_key.get(url)
                local = bouquet_paths.get(key) if key else None
                if local and b.image_path != local:
                    b.image_path = local
                    up_b += 1

    print(f"\nDB rewrite: {up_p} points, {up_f} flowers, {up_b} bouquets")


async def main() -> None:
    settings = get_settings()
    dest = Path(settings.media_dir) / SEED_SUBDIR
    print(f"[1/2] Downloading into {dest}")
    print("\n  flowers:")
    flower_paths = await _download_all(FLOWER_PHOTOS, dest)
    print("\n  point covers:")
    point_paths = await _download_all(POINT_COVERS, dest)
    print("\n  portfolio bouquets:")
    bouquet_paths = await _download_all(BOUQUET_PHOTOS, dest)

    print("\n[2/2] Rewriting DB rows to local paths")
    await _rewrite_db(flower_paths, point_paths, bouquet_paths)


if __name__ == "__main__":
    asyncio.run(main())
