# Quran Tracker

A secure, self-hostable web app for **marking hifdh and tajweed mistakes word-by-word
on the printed Madinah Mushaf**. Every mark is private to the signed-in user.

Built with **FastAPI + React + PostgreSQL**, shipped as a single **Docker** image
ready for **Google Cloud Run**.

---

## Features

- **Authentic mushaf rendering** — real printed calligraphy via the QPC
  per-page fonts (604 pages, exact line breaks, no Unicode approximation).
- **Three mushaf editions** — Madinah V1 (1405H), V2 (1421H), and V4 Tajweed
  (1441H), selectable per user from Settings. Marks are keyed to the word, so
  they carry across editions automatically.
- **Word-level marking** — tap any word to record a **hifdh** or **tajweed**
  mistake, with an optional note and an automatic **repeat counter**.
- **Private by design** — every mark is scoped to its owner; other users can
  never see your data.
- **Email/password + Google sign-in** — with optional account linking by email.
- **Secure from the start** — Argon2id password hashing, short-lived access +
  rotating refresh tokens (httpOnly cookies), CSRF protection, rate limiting,
  strict security headers, server-side validation, and per-user row ownership.

## Architecture

```
Browser (React SPA, Vite)
        │  same-origin (single Cloud Run service)
        ▼
FastAPI ── /api/*           auth + marks (async SQLAlchemy, Alembic migrations)
        └─ /mushaf, /fonts, /*  static mushaf data + built React bundle
              │
              ▼
         PostgreSQL (Neon in production, docker-compose locally)
```

The mushaf itself is data-driven: `scripts/build_mushaf_json.py` converts the
three CSVs from
[`hussainsajib/qpc-v4-mushaf-bundle`](https://github.com/hussainsajib/qpc-v4-mushaf-bundle)
(`words.csv`, `page_lines.csv`, `qpc_mapping.csv`) into 604 per-page JSON files
loaded on demand by the frontend, plus a `words_meta.json` the backend uses to
validate word ids server-side.

## Project layout

```
backend/
  app/
    main.py            app factory, security headers, static serving
    config.py          pydantic-settings config (env vars)
    database.py        async engine + session
    models.py          User, RefreshToken, MistakeMark
    schemas.py         request/response models
    security.py        argon2, JWT, token hashing, CSRF
    deps.py            current-user + CSRF dependencies
    mushaf.py          in-memory word metadata
    routers/           auth.py, marks.py
    data/words_meta.json   (generated)
  alembic/             migrations
frontend/
  src/                 React + TypeScript
  public/fonts/        604 QPC page fonts + surah-name + basmallah fonts
  public/mushaf/       index.json + 604 page JSONs (generated)
scripts/build_mushaf_json.py   data preprocessing
deploy/cloudbuild.yaml         Cloud Build CI/CD example
Dockerfile             multi-stage build (React -> FastAPI)
docker-compose.yml     local Postgres + app
```

## Quick start (Docker)

```bash
# 1. create the local env file (gitignored) and set a database password
cp .env.example .env
#    then edit .env: set POSTGRES_PASSWORD (and POSTGRES_PASSWORD_ENCODED if
#    the password has special chars like @). Generate one with:
#    python -c "import secrets; print(secrets.token_hex(24))"

# 2. start the stack
docker compose up --build
```

Then open http://localhost:8080 — the full app (API + frontend) runs in one
container, with a local Postgres in another. On first start Alembic migrates
the database automatically.

> **Note:** Google sign-in is disabled until you set `GOOGLE_CLIENT_ID` /
> `GOOGLE_CLIENT_SECRET` (see below). Email/password sign-up works out of the box.

## Local development (hot reload)

```bash
# 1. database — needs the repo-root .env (copy from .env.example, set POSTGRES_PASSWORD)
cp .env.example .env
docker compose up -d db

# 2. backend (from the backend/ directory)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env          # then edit DATABASE_URL to point at localhost with the SAME password (URL-encoded)
alembic upgrade head
uvicorn app.main:app --reload --port 5100

# 3. frontend (separate terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173, /api proxied to :5100
```

The Vite dev server proxies `/api` to the backend, so cookies stay same-origin.

## Configuration

All settings come from environment variables (see `.env.example`):

| Variable | Description |
| --- | --- |
| `SECRET_KEY` | Long random string; signs JWTs. **Required in production.** |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` |
| `ENVIRONMENT` | `development` / `production` |
| `COOKIE_SECURE` | `true` behind HTTPS (Cloud Run), `false` locally |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | token lifetimes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials |
| `GOOGLE_REDIRECT_URI` | `https://<your-url>/api/auth/google/callback` |
| `FRONTEND_ORIGIN` | public URL of the app (CORS + OAuth redirect target) |

Generate a production secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

## Setting up Google sign-in

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → APIs &
   Services → Credentials → **Create credentials → OAuth client ID**.
2. Application type **Web application**.
3. Authorized redirect URI: `https://<your-cloud-run-url>/api/auth/google/callback`
   (locally: `http://localhost:5100/api/auth/google/callback`).
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Setting up Neon (Postgres)

1. Create a project at [neon.tech](https://neon.tech) and copy the connection
   string.
2. It looks like `postgresql://user:password@host/db?sslmode=require`. For
   SQLAlchemy async, use the `asyncpg` driver and replace `sslmode=require`
   with `ssl=require` (asyncpg doesn't understand `sslmode`):
   `postgresql+asyncpg://user:password@host/db?ssl=require`.

## Deploying to Google Cloud Run

The image runs `alembic upgrade head` then starts Uvicorn on port 8080.

```bash
# 0. create an Artifact Registry repo (once)
gcloud artifacts repositories create quran --repository-format=docker \
  --location=us-central1

# 1. build & push
gcloud builds submit --config deploy/cloudbuild.yaml \
  --substitutions=_FRONTEND_ORIGIN=https://YOUR-SERVICE-URL.a.run.app,_GOOGLE_CLIENT_ID=...,_GOOGLE_CLIENT_SECRET=...

# 2. store secrets in Secret Manager (once)
gcloud secrets create quran-secret-key --data-file=- <<< "$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
gcloud secrets create quran-database-url --data-file=- <<< "postgresql+asyncpg://..."

# 3. deploy
gcloud run deploy quran-tracker \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/quran/quran-tracker:latest \
  --region us-central1 --platform managed --allow-unauthenticated \
  --set-secrets=SECRET_KEY=quran-secret-key:latest,DATABASE_URL=quran-database-url:latest \
  --set-env-vars=ENVIRONMENT=production,COOKIE_SECURE=true,FRONTEND_ORIGIN=https://YOUR-SERVICE-URL.a.run.app,GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,GOOGLE_REDIRECT_URI=https://YOUR-SERVICE-URL.a.run.app/api/auth/google/callback
```

Make the app **public** by allowing unauthenticated requests (it's a public
registration app — authentication is handled by the app itself, not Cloud Run IAM).
Optionally put it behind **Cloud Load Balancing + Cloud Armor** for WAF and
DDoS protection.

## Security model

- **Passwords** hashed with **Argon2id** (memory-hard).
- **Tokens**: short-lived JWT access token + opaque rotating refresh token,
  both in **httpOnly, SameSite=Lax, Secure** cookies. Refresh tokens are stored
  as SHA-256 hashes and revoked on logout/rotation.
- **CSRF**: double-submit token (`csrf_token` cookie echoed in `X-CSRF-Token`
  header) enforced on all state-changing requests, on top of SameSite=Lax.
- **Google OAuth**: Authorization Code flow with a signed `state`+`nonce` bound
  to the login request; the ID token is verified (signature, audience, nonce).
- **Rate limiting** on auth endpoints (slowapi), keyed by client IP.
- **Headers**: CSP, HSTS (prod), `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- **Data isolation**: every mark query filters by `user_id`; word ids are
  validated against the authoritative mushaf data server-side.
- **Validation**: Pydantic for all inputs; DB check constraints for enums/ranges.
- **Secrets**: via environment variables / Secret Manager — never committed.

## API (summary)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | — | create account (email/password) |
| `POST` | `/api/auth/login` | — | sign in |
| `POST` | `/api/auth/logout` | ✓ | revoke refresh token |
| `POST` | `/api/auth/refresh` | cookie | rotate refresh token |
| `GET`  | `/api/auth/me` | ✓ | current user |
| `GET`  | `/api/auth/google/login` | — | start Google OAuth |
| `GET`  | `/api/auth/google/callback` | — | finish Google OAuth |
| `GET`  | `/api/marks` | ✓ | list my marks |
| `GET`  | `/api/marks/summary` | ✓ | counts by type |
| `PUT`  | `/api/marks/{word_id}` | ✓ | record a mistake (upsert, +1 repeat) |
| `DELETE` | `/api/marks/{word_id}` | ✓ | remove a mark |
| `PUT`  | `/api/preferences` | ✓ | update mushaf edition / theme / font scale |
| `GET`  | `/api/health` | — | liveness |

## Attribution

The V4 mushaf fonts and word→glyph mapping are derived from
[`hussainsajib/qpc-v4-mushaf-bundle`](https://github.com/hussainsajib/qpc-v4-mushaf-bundle),
which in turn reuses the **QPC V4 Tajweed page fonts** (QUL / TarteelAI) and the
King Fahd Complex's **QCF v4** font (for the basmallah glyph only). The V1/V2
page fonts and glyph mappings are sourced from
[quran.com](https://quran.com) (fonts.quran.com CDN and the public API v4), which
distribute the corresponding King Fahd Complex QCF fonts. See
`LICENSE-NOTICE.md` for copyright and redistribution terms before redistributing.

## Regenerating the mushaf data

The mushaf data ships as committed CSVs and per-edition page JSONs. To rebuild
or add an edition:

```bash
# 1. (re)download the V1/V2 glyph mappings + layouts from the quran.com API
python scripts/fetch_mushaf_data.py

# 2. (re)download the V1/V2 page fonts from the quran.com CDN
python scripts/fetch_mushaf_fonts.py

# 3. regenerate per-edition page JSON + words_meta.json from the CSVs
python scripts/build_mushaf_json.py
```

`build_mushaf_json.py` reads `scripts/words.csv` (shared), `page_lines*.csv`,
and `qpc_mapping*.csv` (per edition) and writes
`frontend/public/mushaf/{v1,v2,v4}/**` plus
`backend/app/data/words_meta.json` (shared). V4 keeps the original
`page_lines.csv` / `qpc_mapping.csv` files; V1 and V2 use the `_v1` / `_v2`
variants.
