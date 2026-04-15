"""Singleton LiteLLM wrapper for all LLM calls in the system."""

import asyncio
import logging
import re

import litellm
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from core.config import get_settings
from core.exceptions import LLMCallError

logger = logging.getLogger(__name__)


def strip_llm_json_payload(raw: str | None) -> str:
    """Normalize model output to a JSON object/array string (handles fences and chatter).

    Gemini and other models often wrap JSON in ```json blocks or add a short preamble.
    """
    text = (raw or "").strip()
    if not text:
        return text
    m = re.match(
        r"^```(?:json)?\s*\r?\n?(.*?)\r?\n?```\s*$",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if m:
        text = m.group(1).strip()
    obj_start = text.find("{")
    obj_end = text.rfind("}")
    if obj_start >= 0 and obj_end > obj_start:
        return text[obj_start : obj_end + 1]
    arr_start = text.find("[")
    arr_end = text.rfind("]")
    if arr_start >= 0 and arr_end > arr_start:
        return text[arr_start : arr_end + 1]
    return text


def _api_key_for_model(model: str, settings) -> str | None:
    """LiteLLM uses provider-specific credentials; map env vars by model id."""
    m = model.lower()
    if m.startswith("gemini/") or "/gemini" in m or m.startswith("vertex_ai/") or m.startswith(
        "google/"
    ):
        key = (settings.GEMINI_API_KEY or settings.ANTHROPIC_API_KEY or "").strip()
        return key or None
    if "claude" in m or m.startswith("anthropic/"):
        key = (settings.ANTHROPIC_API_KEY or "").strip()
        return key or None
    key = (settings.ANTHROPIC_API_KEY or settings.GEMINI_API_KEY or "").strip()
    return key or None

_RETRYABLE_ERRORS = (
    litellm.exceptions.RateLimitError,
    litellm.exceptions.ServiceUnavailableError,
    litellm.exceptions.APIConnectionError,
    litellm.exceptions.Timeout,
)


class LLMClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.LITELLM_MODEL
        self.default_max_tokens = 2000
        self.default_temperature = 0.1

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_format: str = "text",
        max_tokens: int | None = None,
    ) -> str:
        if response_format == "json":
            system_prompt = (
                system_prompt.rstrip()
                + "\n\nRespond ONLY with valid JSON. No explanation, no markdown, no backticks."
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        settings = get_settings()
        max_tok = max_tokens or self.default_max_tokens
        if response_format == "json":
            max_tok = max(max_tok, 8192)

        kwargs: dict = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tok,
            "temperature": self.default_temperature,
        }
        ak = _api_key_for_model(self.model, settings)
        if ak:
            kwargs["api_key"] = ak

        try:
            timeout = settings.LLM_REQUEST_TIMEOUT_SECONDS
            response = await asyncio.wait_for(litellm.acompletion(**kwargs), timeout=timeout)
            msg = response.choices[0].message
            content = msg.content
            if content is None or (isinstance(content, str) and not content.strip()):
                logger.error("LLM returned empty message content (model=%s)", self.model)
                raise LLMCallError("LLM returned empty message content")
            return content.strip()
        except TimeoutError:
            logger.error("LLM call timed out after %ss (model=%s)", timeout, self.model)
            raise LLMCallError(
                f"LLM request timed out after {timeout:.0f}s. "
                "Raise LLM_REQUEST_TIMEOUT_SECONDS or check network / provider status."
            ) from None
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            raise LLMCallError(f"LLM call failed: {e}") from e

    async def complete_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 3,
    ) -> str:
        @retry(
            stop=stop_after_attempt(max_retries),
            wait=wait_exponential(multiplier=1, min=2, max=30),
            retry=retry_if_exception_type(_RETRYABLE_ERRORS),
            reraise=True,
        )
        async def _call() -> str:
            return await self.complete(system_prompt, user_prompt)

        try:
            return await _call()
        except _RETRYABLE_ERRORS as e:
            logger.error("LLM call failed after %d retries: %s", max_retries, e)
            raise LLMCallError(f"LLM call failed after {max_retries} retries: {e}") from e


llm_client = LLMClient()
