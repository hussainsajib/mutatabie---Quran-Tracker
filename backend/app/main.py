"""FastAPI application entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import settings
from .mushaf import load_words_meta
from .rate_limit import limiter
from .routers import auth, marks, preferences

# Locate the built frontend. In a repo checkout the backend lives at
# <repo>/backend/app (dist at <repo>/frontend/dist); in the Docker image the
# backend is copied flat into /app (dist at /app/frontend/dist).
_HERE = Path(__file__).resolve().parent
DIST = _HERE.parent.parent / "frontend" / "dist"
if not DIST.exists():
    DIST = _HERE.parent / "frontend" / "dist"


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_secret_key()
    load_words_meta()
    yield
    from .database import engine

    await engine.dispose()


app = FastAPI(
    title="Quran Tracker",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if not settings.is_production else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS (mainly for a separately-hosted frontend during development).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in [settings.frontend_origin] if o],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self' https://storage.googleapis.com; "
        "img-src 'self' data:; "
        "connect-src 'self' https://storage.googleapis.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    if settings.cookie_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(auth.router)
app.include_router(marks.router)
app.include_router(preferences.router)


@app.get("/api/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}


# --- Static frontend serving (production only; Vite serves in dev) ---
# /fonts serves only the small Amiri UI fonts; the QPC page fonts and the
# mushaf JSON data are served from GCS (see VITE_ASSETS_URL in the frontend).
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    app.mount("/fonts", StaticFiles(directory=DIST / "fonts"), name="fonts")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (DIST / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(DIST.resolve()):
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
