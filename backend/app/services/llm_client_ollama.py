from __future__ import annotations

import json
import re
from typing import Any

from openai import AsyncOpenAI

from app.services.llm_client import LLMError

_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}", re.MULTILINE)


class OllamaLLMClient:
    """LLM client for local Ollama.

    Ollama does not reliably honour response_format=json_object on llama3.1:8b,
    so we inject a JSON-only instruction into the system prompt and extract JSON
    via regex when the raw parse fails.
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_sec: int,
        system_prompt: str,
        temperature: float,
    ) -> None:
        self._client = AsyncOpenAI(
            base_url=base_url, api_key=api_key or "none", timeout=timeout_sec
        )
        self._model = model
        self._system_prompt = (
            system_prompt.rstrip()
            + "\n\nYou MUST respond with valid JSON only. No explanation, no markdown, no commentary."
        )
        self._temperature = temperature

    async def select_composition(
        self,
        *,
        prompt: str,
        preferred_colors: list[str],
        budget: float | int,
        available_flowers: list[dict[str, Any]],
        budget_lower_pct: float,
        budget_upper_pct: float,
    ) -> dict[str, Any]:
        budget_f = float(budget)
        user_payload: dict[str, Any] = {
            "client_request": prompt,
            "preferred_colors": preferred_colors,
            "budget_kzt": budget_f,
            "budget_min_kzt": round(budget_f * budget_lower_pct, 2),
            "budget_max_kzt": round(budget_f * budget_upper_pct, 2),
            "available_flowers": available_flowers,
        }
        messages: list[dict[str, str]] = [
            {"role": "system", "content": self._system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ]
        try:
            completion = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=self._temperature,
                stream=False,
            )
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"LLM call failed: {exc}") from exc

        text = (completion.choices[0].message.content or "").strip()

        # First attempt: direct parse.
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Second attempt: extract the first {...} block (handles markdown fences).
        match = _JSON_BLOCK_RE.search(text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        raise LLMError(f"LLM returned non-JSON: {text[:200]}")
