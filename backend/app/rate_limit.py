from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable

from flask import current_app, jsonify, request

from .queue import get_redis


def _client_ip() -> str:
    # With ProxyFix enabled, request.remote_addr should already reflect the real client.
    # Still prefer X-Forwarded-For if present (defense-in-depth for misconfig).
    xff = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    return xff or (request.remote_addr or "unknown")


@dataclass(frozen=True)
class RateLimit:
    key: str
    limit: int
    window_s: int


def _fixed_window_key(rl: RateLimit, *, ip: str, now: float) -> str:
    bucket = int(now // rl.window_s)
    return f"rl:{rl.key}:{ip}:{bucket}"


def check_rate_limit(rl: RateLimit) -> bool:
    """
    Return True if request is allowed; False if it should be rejected (429).
    Uses Redis fixed-window counter; falls back to in-process memory if Redis is unavailable.
    """
    ip = _client_ip()
    now = time.time()
    redis_key = _fixed_window_key(rl, ip=ip, now=now)

    try:
        r = get_redis()
        # Atomic-ish fixed-window increment
        n = int(r.incr(redis_key))
        if n == 1:
            r.expire(redis_key, rl.window_s + 5)
        return n <= rl.limit
    except Exception:  # noqa: BLE001
        # Fallback: in-memory fixed window (per-process)
        store = current_app.extensions.setdefault("_rate_limit_mem", {})  # type: ignore[assignment]
        # store: dict[str, tuple[bucket:int, count:int]]
        bucket = int(now // rl.window_s)
        b, c = store.get(redis_key, (bucket, 0))
        if b != bucket:
            c = 0
        c += 1
        store[redis_key] = (bucket, c)
        return c <= rl.limit


def rate_limited(rl: RateLimit | Callable[[], RateLimit]):
    def decorator(fn):
        def wrapped(*args, **kwargs):
            resolved = rl() if callable(rl) else rl
            if not check_rate_limit(resolved):
                return jsonify({"message": "Too many requests. Please slow down."}), 429
            return fn(*args, **kwargs)

        wrapped.__name__ = getattr(fn, "__name__", "wrapped")
        return wrapped

    return decorator


