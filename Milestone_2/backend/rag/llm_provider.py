# ══════════════════════════════════════════════════════════════════════
# LLM Provider — provider-agnostic OpenAI-compatible wrapper
# Swap via ACTIVE_LLM_PROVIDER env var. No consumer code changes.
# Existing processor/views.py is untouched — it calls OpenRouter directly.
# ══════════════════════════════════════════════════════════════════════
import os
import json
import time
import requests
from typing import Iterator, Optional
from dotenv import load_dotenv

load_dotenv(override=True)

PROVIDERS = {
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "key_env":  "OPENROUTER_API_KEY",
        "default_model": "openai/gpt-3.5-turbo",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "key_env":  "OPENAI_API_KEY",
        "default_model": "gpt-3.5-turbo",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env":  "GROQ_API_KEY",
        "default_model": "mixtral-8x7b-32768",
    },
    "together": {
        "base_url": "https://api.together.xyz/v1",
        "key_env":  "TOGETHER_API_KEY",
        "default_model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    },
}

FALLBACK_CHAIN = ["openrouter", "groq", "together"]
ACTIVE_PROVIDER = os.getenv("ACTIVE_LLM_PROVIDER", "openrouter")
MAX_TOKENS      = int(os.getenv("MAX_TOKENS_PER_AUDIT", "1500"))


class LLMProvider:
    """Provider-agnostic wrapper for OpenAI-compatible chat APIs."""

    def __init__(self, provider: Optional[str] = None):
        self.provider = provider or ACTIVE_PROVIDER

    def _is_placeholder(self, key: str) -> bool:
        if not key or len(key) < 10: return True
        placeholders = ["...", "sk-...", "gsk_...", "your-", "placeholder"]
        return any(p in key.lower() for p in placeholders)

    def _get_credentials(self, provider: str):
        cfg = PROVIDERS.get(provider, PROVIDERS["openrouter"])
        api_key = os.getenv(cfg["key_env"], "")
        if self._is_placeholder(api_key):
            return cfg["base_url"] + "/chat/completions", None, cfg["default_model"]
        return cfg["base_url"] + "/chat/completions", api_key, cfg["default_model"]

    def _build_headers(self, api_key: str, provider: str) -> dict:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "http://localhost"
            headers["X-Title"]      = "AI Quality Auditor"
        return headers

    def complete(self, messages: list, temperature: float = 0.3) -> str:
        """Non-streaming completion with fallback chain."""
        chain = [self.provider] + [p for p in FALLBACK_CHAIN if p != self.provider]
        errors = []
        for provider in chain:
            try:
                url, key, model = self._get_credentials(provider)
                if not key:
                    errors.append(f"{provider}: skipped (no valid API key found in .env)")
                    continue
                payload = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": MAX_TOKENS,
                    "response_format": {"type": "json_object"},
                }
                resp = requests.post(url, headers=self._build_headers(key, provider),
                                     data=json.dumps(payload), timeout=60)
                if resp.status_code in (429, 500, 502, 503):
                    errors.append(f"{provider}: {resp.status_code} server error")
                    time.sleep(0.5)
                    continue
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                masked_key = (key[:12] + "...") if key else "None"
                errors.append(f"{provider} (key: {masked_key}): {str(e)}")
                continue
        raise RuntimeError(f"All LLM providers failed:\n- " + "\n- ".join(errors))

    def stream(self, messages: list, temperature: float = 0.3) -> Iterator[str]:
        """Streaming completion — yields text chunks. Falls back to non-stream on failure."""
        url, key, model = self._get_credentials(self.provider)
        if not key:
            # Fallback: return complete response token-by-token
            result = self.complete(messages, temperature)
            for word in result.split(" "):
                yield word + " "
            return
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": MAX_TOKENS,
            "stream": True,
        }
        try:
            with requests.post(
                url,
                headers=self._build_headers(key, self.provider),
                data=json.dumps(payload),
                timeout=90,
                stream=True,
            ) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode("utf-8")
                    if line.startswith("data: "):
                        line = line[6:]
                    if line == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                        delta = chunk["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError):
                        continue
        except Exception as e:
            yield f"\n[Stream error: {e}]"


# Module-level singleton
_provider = LLMProvider()


def llm_complete(messages: list, temperature: float = 0.3) -> str:
    return _provider.complete(messages, temperature)


def llm_stream(messages: list, temperature: float = 0.3) -> Iterator[str]:
    return _provider.stream(messages, temperature)
