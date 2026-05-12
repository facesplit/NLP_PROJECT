from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class ImageRef:
    filename: str
    subfolder: str
    type: str


class ComfyUIError(Exception):
    pass


class ComfyUIClient:
    def __init__(
        self,
        *,
        base_url: str,
        poll_interval_sec: float = 1.5,
        timeout_sec: int = 300,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._poll = poll_interval_sec
        self._timeout = timeout_sec

    async def upload_image(self, data: bytes, *, filename: str) -> str:
        async with httpx.AsyncClient(timeout=30) as http:
            files = {"image": (filename, data, "image/png")}
            r = await http.post(
                f"{self._base}/upload/image", files=files, data={"overwrite": "true"}
            )
            r.raise_for_status()
            payload = r.json()
            name = payload.get("name")
            if not name:
                raise ComfyUIError(f"upload_image: unexpected response {payload!r}")
            return str(name)

    async def submit(self, workflow: dict[str, Any], *, client_id: str) -> str:
        async with httpx.AsyncClient(timeout=30) as http:
            body = {"prompt": workflow, "client_id": client_id}
            r = await http.post(f"{self._base}/prompt", json=body)
            r.raise_for_status()
            payload = r.json()
            pid = payload.get("prompt_id")
            if not pid:
                raise ComfyUIError(f"submit: no prompt_id in {payload!r}")
            return str(pid)

    async def wait_for_result(self, prompt_id: str, *, save_node_id: str) -> list[ImageRef]:
        deadline = time.monotonic() + self._timeout
        async with httpx.AsyncClient(timeout=30) as http:
            while True:
                r = await http.get(f"{self._base}/history/{prompt_id}")
                r.raise_for_status()
                hist = r.json() or {}
                entry = hist.get(prompt_id)
                if entry and "outputs" in entry:
                    node = entry["outputs"].get(save_node_id) or {}
                    images = node.get("images") or []
                    if images:
                        return [
                            ImageRef(
                                filename=str(im["filename"]),
                                subfolder=str(im.get("subfolder", "")),
                                type=str(im.get("type", "output")),
                            )
                            for im in images
                        ]
                if time.monotonic() > deadline:
                    raise ComfyUIError(f"timeout waiting for prompt {prompt_id}")
                await asyncio.sleep(self._poll)

    async def download(self, ref: ImageRef) -> bytes:
        async with httpx.AsyncClient(timeout=60) as http:
            params = {"filename": ref.filename, "subfolder": ref.subfolder, "type": ref.type}
            r = await http.get(f"{self._base}/view", params=params)
            r.raise_for_status()
            return r.content
