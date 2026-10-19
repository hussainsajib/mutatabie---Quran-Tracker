# ─────────────────────────────────────────────────────────────────────────────
# Single-image build for Google Cloud Run: React SPA + FastAPI served together.
# ─────────────────────────────────────────────────────────────────────────────

# ---- Stage 1: build the React frontend -------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend ----------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 8080

# --proxy-headers / --forwarded-allow-ips make request.client reflect the real
# client IP behind the Cloud Run load balancer (used for rate limiting).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080 --proxy-headers --forwarded-allow-ips='*'"]
