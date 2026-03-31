import os
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx
from openai import OpenAI

from app.config import load_backend_env

load_backend_env()

# ── tunables ─────────────────────────────────────────────────────────────────
_DEGRADED_THRESHOLD = int(os.getenv("LLM_DEGRADED_THRESHOLD", "3"))  # failures before deprioritise
_RECOVERY_SECONDS   = float(os.getenv("LLM_RECOVERY_SECONDS",  "60")) # time until provider recovers
_RETRY_BASE_MS      = float(os.getenv("LLM_RETRY_BASE_MS",    "300")) # base backoff per retry
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Provider:
    name: str
    model: str
    client: OpenAI
    supports_extra_body: bool
    # health tracking (mutable, shared via module-level lock)
    failures: int = field(default=0, compare=False)
    last_failure_ts: float = field(default=0.0, compare=False)


_HTTP_CLIENT: Optional[httpx.Client] = None
_PROVIDERS_CACHE: Optional[List[Provider]] = None
_health_lock = threading.Lock()


def _build_http_client(proxy_url: Optional[str] = None) -> httpx.Client:
    timeout_seconds = float(os.getenv("LLM_TIMEOUT_SECONDS", "18"))
    # Shorter connect timeout to fail fast when a host is unreachable.
    connect_timeout = float(os.getenv("LLM_CONNECT_TIMEOUT_SECONDS", "5"))
    timeout = httpx.Timeout(
        timeout=timeout_seconds,
        connect=connect_timeout,
        read=timeout_seconds,
        write=min(10.0, timeout_seconds),
    )
    limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
    kwargs: dict = {"timeout": timeout, "limits": limits, "trust_env": False}
    if proxy_url:
        kwargs["proxy"] = proxy_url
    return httpx.Client(**kwargs)


def _build_providers() -> List[Provider]:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        _HTTP_CLIENT = _build_http_client()

    ms_key   = os.getenv("MS_API_KEY")
    ms_base  = os.getenv("MS_BASE_URL")
    ms_model = os.getenv("MS_MODEL", "deepseek-ai/DeepSeek-R1-distill-Qwen-7B")
    if not (ms_key and ms_base):
        return []

    return [Provider(
        name="ms",
        model=ms_model,
        client=OpenAI(api_key=ms_key, base_url=ms_base, http_client=_HTTP_CLIENT),
        supports_extra_body=True,
    )]


def _get_providers() -> List[Provider]:
    global _PROVIDERS_CACHE
    if _PROVIDERS_CACHE is None:
        _PROVIDERS_CACHE = _build_providers()
    return _PROVIDERS_CACHE


def _reset_provider_cache() -> None:
    """Force rebuild on next call (e.g. after total failure)."""
    global _PROVIDERS_CACHE
    _PROVIDERS_CACHE = None


def _record_failure(provider: Provider) -> None:
    with _health_lock:
        provider.failures += 1
        provider.last_failure_ts = time.time()


def _record_success(provider: Provider) -> None:
    with _health_lock:
        provider.failures = 0
        provider.last_failure_ts = 0.0


def _is_degraded(provider: Provider) -> bool:
    """True if provider has hit the failure threshold and hasn't recovered yet."""
    with _health_lock:
        if provider.failures < _DEGRADED_THRESHOLD:
            return False
        age = time.time() - provider.last_failure_ts
        if age > _RECOVERY_SECONDS:
            # Auto-recover
            provider.failures = 0
            provider.last_failure_ts = 0.0
            return False
        return True


def _ordered_providers() -> List[Provider]:
    """Return providers sorted: healthy first, degraded last."""
    providers = _get_providers()
    if not providers:
        return []
    healthy   = [p for p in providers if not _is_degraded(p)]
    degraded  = [p for p in providers if _is_degraded(p)]
    return healthy + degraded


def get_provider_status() -> List[Dict[str, Any]]:
    """Return health snapshot for all configured providers (for /api/status)."""
    providers = _get_providers()
    result = []
    for p in providers:
        degraded = _is_degraded(p)
        with _health_lock:
            failures = p.failures
            last_ts  = p.last_failure_ts
        result.append({
            "name": p.name,
            "model": p.model,
            "degraded": degraded,
            "failures": failures,
            "last_failure_ts": last_ts,
            "primary": providers.index(p) == 0 if providers else False,
        })
    return result


def chat_completion_with_fallback(
    messages: List[Dict[str, Any]],
    temperature: float = 0.2,
    max_tokens: Optional[int] = None,
) -> str:
    providers = _ordered_providers()
    if not providers:
        raise RuntimeError("No LLM provider configured. Set MS_* or GOOGLE_* env vars.")

    retries = max(1, int(os.getenv("LLM_PROVIDER_RETRIES", "2")))
    errors: List[str] = []

    for provider in providers:
        for attempt in range(1, retries + 1):
            kwargs: Dict[str, Any] = {
                "model": provider.model,
                "messages": messages,
                "temperature": temperature,
            }
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            # enable_thinking=False only applies to DeepSeek reasoning models.
            # Qwen2.5-Instruct and other chat models don't support this param.
            if provider.supports_extra_body and "deepseek" in provider.model.lower():
                kwargs["extra_body"] = {"enable_thinking": False}

            try:
                completion = provider.client.chat.completions.create(**kwargs)
                content = completion.choices[0].message.content or ""
                _record_success(provider)
                return content

            except Exception as exc:
                _record_failure(provider)
                err_msg = f"{provider.name}[{attempt}/{retries}]: {exc}"
                errors.append(err_msg)
                print(f"[llm] {err_msg}")

                # Backoff before retry (not before trying next provider).
                if attempt < retries:
                    backoff = (_RETRY_BASE_MS / 1000) * (2 ** (attempt - 1))
                    jitter  = random.uniform(0, backoff * 0.3)
                    time.sleep(backoff + jitter)

    # All providers exhausted — reset cache so next request gets a fresh build.
    _reset_provider_cache()
    raise RuntimeError("All LLM providers failed -> " + " | ".join(errors))
