from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm_client_ollama import OllamaLLMClient
from app.services.llm_client import LLMError


def _make_client() -> OllamaLLMClient:
    return OllamaLLMClient(
        base_url="http://ollama:11434/v1",
        api_key="none",
        model="llama3.1:8b",
        timeout_sec=30,
        system_prompt="You are a florist assistant.",
        temperature=0.3,
    )


def _mock_completion(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    completion = MagicMock()
    completion.choices = [choice]
    return completion


VALID_PAYLOAD = {
    "variants": [
        {
            "composition": [{"flower_id": "abc", "quantity": 5}],
            "style_modifiers": ["fresh"],
            "reference_flower_ids": ["abc"],
            "explanation": "Nice bouquet",
        }
    ]
}


@pytest.mark.asyncio
async def test_select_composition_clean_json():
    """OllamaLLMClient parses a clean JSON response."""
    client = _make_client()
    with patch.object(
        client._client.chat.completions,
        "create",
        new=AsyncMock(return_value=_mock_completion(json.dumps(VALID_PAYLOAD))),
    ):
        result = await client.select_composition(
            prompt="Birthday bouquet",
            preferred_colors=["pink"],
            budget=5000,
            available_flowers=[{"flower_id": "abc", "name": "Rose", "price_per_stem_kzt": 500, "stock": 20, "color_tags": ["pink"], "description": ""}],
            budget_lower_pct=0.8,
            budget_upper_pct=1.1,
        )
    assert result == VALID_PAYLOAD


@pytest.mark.asyncio
async def test_select_composition_json_in_prose():
    """OllamaLLMClient extracts JSON from prose via regex fallback."""
    client = _make_client()
    prose = f"Sure! Here is your bouquet:\n```json\n{json.dumps(VALID_PAYLOAD)}\n```\nHope you enjoy it."
    with patch.object(
        client._client.chat.completions,
        "create",
        new=AsyncMock(return_value=_mock_completion(prose)),
    ):
        result = await client.select_composition(
            prompt="Test",
            preferred_colors=[],
            budget=1000,
            available_flowers=[],
            budget_lower_pct=0.8,
            budget_upper_pct=1.1,
        )
    assert result == VALID_PAYLOAD


@pytest.mark.asyncio
async def test_select_composition_no_json_raises():
    """OllamaLLMClient raises LLMError when no JSON can be extracted."""
    client = _make_client()
    with patch.object(
        client._client.chat.completions,
        "create",
        new=AsyncMock(return_value=_mock_completion("I cannot help with that.")),
    ):
        with pytest.raises(LLMError, match="non-JSON"):
            await client.select_composition(
                prompt="Test",
                preferred_colors=[],
                budget=1000,
                available_flowers=[],
                budget_lower_pct=0.8,
                budget_upper_pct=1.1,
            )


@pytest.mark.asyncio
async def test_select_composition_api_error_raises():
    """OllamaLLMClient wraps network errors in LLMError."""
    client = _make_client()
    with patch.object(
        client._client.chat.completions,
        "create",
        new=AsyncMock(side_effect=Exception("connection refused")),
    ):
        with pytest.raises(LLMError, match="LLM call failed"):
            await client.select_composition(
                prompt="Test",
                preferred_colors=[],
                budget=1000,
                available_flowers=[],
                budget_lower_pct=0.8,
                budget_upper_pct=1.1,
            )
