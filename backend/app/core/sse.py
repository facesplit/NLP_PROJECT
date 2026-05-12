from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

_subscribers: dict[UUID, set[asyncio.Queue[str]]] = defaultdict(set)


def subscribe(user_id: UUID) -> asyncio.Queue[str]:
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
    _subscribers[user_id].add(queue)
    return queue


def unsubscribe(user_id: UUID, queue: asyncio.Queue[str]) -> None:
    qs = _subscribers.get(user_id)
    if qs is None:
        return
    qs.discard(queue)
    if not qs:
        _subscribers.pop(user_id, None)


def publish(user_id: UUID, event_payload: dict[str, Any]) -> None:
    qs = _subscribers.get(user_id)
    if not qs:
        return
    data = json.dumps(event_payload, default=str, ensure_ascii=False)
    for queue in list(qs):
        try:
            queue.put_nowait(data)
        except asyncio.QueueFull:
            # Drop oldest to make room
            try:
                queue.get_nowait()
                queue.put_nowait(data)
            except Exception:  # noqa: BLE001
                pass


async def event_stream(user_id: UUID, heartbeat_seconds: float = 25.0) -> AsyncIterator[bytes]:
    """Yield SSE-formatted bytes for a single user's queue with heartbeats."""
    queue = subscribe(user_id)
    try:
        # Initial nudge so the connection is flushed.
        yield b": connected\n\n"
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=heartbeat_seconds)
                yield f"event: notification\ndata: {data}\n\n".encode("utf-8")
            except asyncio.TimeoutError:
                yield b": keepalive\n\n"
    finally:
        unsubscribe(user_id, queue)
