"""Shared slowapi rate limiter."""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

# In production (Cloud Run) uvicorn runs with --proxy-headers so
# get_remote_address reflects the real client IP from X-Forwarded-For.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=not settings.debug,
    default_limits=["200/minute"],
)
