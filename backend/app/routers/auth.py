"""Authentication router: email/password and Google OAuth."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..deps import ACCESS_COOKIE, CSRF_COOKIE, get_current_user, require_csrf
from ..models import RefreshToken, User
from ..rate_limit import limiter
from ..schemas import AuthResponse, LoginRequest, Preferences, SignupRequest, UserOut
from ..security import (
    create_access_token,
    decode_access_token,
    generate_csrf_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
OAUTH_STATE_COOKIE = "oauth_state"
GOOGLE_SCOPES = ["openid", "email", "profile"]
_REFRESH_COOKIE_PATH = "/api/auth"


def _oauth_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        email_verified=user.email_verified,
        has_google=user.google_sub is not None,
        preferences=Preferences(
            mushaf=user.mushaf,
            theme=user.theme,
            font_scale=user.font_scale,
        ),
    )


def _set_auth_cookies(response: Response, access: str, refresh: str, csrf: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=_REFRESH_COOKIE_PATH,
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=_REFRESH_COOKIE_PATH)
    response.delete_cookie(OAUTH_STATE_COOKIE, path=_REFRESH_COOKIE_PATH)
    # The CSRF cookie is intentionally kept: it is a non-secret double-submit
    # token, and keeping it lets a fresh login/signup proceed without an extra
    # round-trip. It is rotated on the next successful login.


async def _issue_tokens(db: AsyncSession, response: Response, user: User) -> UserOut:
    """Create access+refresh tokens, persist the refresh token hash, set cookies."""
    access = create_access_token(user.id)
    refresh_raw, refresh_hash = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()
    _set_auth_cookies(response, access, refresh_raw, generate_csrf_token())
    return _user_out(user)


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    res = await db.execute(select(User).where(User.email == email.lower()))
    return res.scalar_one_or_none()


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    await require_csrf(request)
    email = body.email.lower()
    if await _get_user_by_email(db, email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(user=await _issue_tokens(db, response, user))


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    await require_csrf(request)
    user = await _get_user_by_email(db, body.email.lower())
    if user is None or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return AuthResponse(user=await _issue_tokens(db, response, user))


@router.post("/refresh", response_model=AuthResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    await require_csrf(request)
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=401, detail="No refresh token")

    token_hash = hash_token(raw)
    res = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    token_record = res.scalar_one_or_none()
    if (
        token_record is None
        or token_record.revoked_at is not None
        or token_record.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    user = await db.get(User, token_record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate: revoke the old token, issue a fresh one.
    token_record.revoked_at = datetime.now(timezone.utc)
    return AuthResponse(user=await _issue_tokens(db, response, user))


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    await require_csrf(request)
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        token_hash = hash_token(raw)
        res = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        token_record = res.scalar_one_or_none()
        if token_record and token_record.revoked_at is None:
            token_record.revoked_at = datetime.now(timezone.utc)
            await db.commit()
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return _user_out(current_user)


@router.get("/csrf")
async def csrf_bootstrap(request: Request, response: Response) -> dict:
    """Ensure a CSRF cookie exists so the SPA can echo it on first write."""
    if not request.cookies.get(CSRF_COOKIE):
        response.set_cookie(
            CSRF_COOKIE,
            generate_csrf_token(),
            max_age=settings.refresh_token_expire_days * 86400,
            httponly=False,
            secure=settings.cookie_secure,
            samesite="lax",
            path="/",
        )
    return {"ok": True}


@router.get("/google/login")
@limiter.limit("10/minute")
async def google_login(request: Request, response: Response) -> RedirectResponse:
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    flow = _oauth_flow()
    # Bind a random state + nonce, signed into an httpOnly cookie for the callback.
    state, nonce = uuid.uuid4().hex, uuid.uuid4().hex
    flow_state = jwt.encode(
        {"state": state, "nonce": nonce, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        settings.secret_key,
        algorithm="HS256",
    )
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        flow_state,
        max_age=600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=_REFRESH_COOKIE_PATH,
    )
    auth_url, _ = flow.authorization_url(
        state=state,
        nonce=nonce,
        access_type="offline",
        prompt="consent",
    )
    return RedirectResponse(auth_url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=google_denied")

    if not code or not state:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=invalid_oauth")

    flow_state_raw = request.cookies.get(OAUTH_STATE_COOKIE)
    if not flow_state_raw:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=missing_state")
    try:
        flow_state = jwt.decode(flow_state_raw, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=bad_state")

    if not _constant_time_eq(flow_state.get("state", ""), state):
        return RedirectResponse(f"{settings.frontend_origin}/login?error=state_mismatch")

    flow = _oauth_flow()
    try:
        flow.fetch_token(code=code)
    except Exception:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=token_exchange_failed")

    id_token_raw = flow.credentials.id_token
    if not id_token_raw:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=no_id_token")

    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_raw, google_requests.Request(), audience=settings.google_client_id
        )
    except Exception:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=id_token_invalid")

    # Reject replayed/forged nonce (binds the token to our own login request).
    if not _constant_time_eq(flow_state.get("nonce", ""), claims.get("nonce", "")):
        return RedirectResponse(f"{settings.frontend_origin}/login?error=nonce_mismatch")

    google_sub = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not google_sub or not email:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=missing_claims")

    # Upsert: link by google_sub first, then by email.
    res = await db.execute(select(User).where(User.google_sub == google_sub))
    user = res.scalar_one_or_none()
    if user is None:
        user = await _get_user_by_email(db, email)
    if user is None:
        user = User(
            email=email,
            email_verified=bool(claims.get("email_verified")),
            display_name=claims.get("name"),
            google_sub=google_sub,
            hashed_password=None,
        )
        db.add(user)
    else:
        if user.google_sub is None:
            user.google_sub = google_sub
        user.email_verified = user.email_verified or bool(claims.get("email_verified"))
        if not user.display_name and claims.get("name"):
            user.display_name = claims.get("name")
    await db.commit()
    await db.refresh(user)

    await _issue_tokens(db, response, user)
    response.delete_cookie(OAUTH_STATE_COOKIE, path=_REFRESH_COOKIE_PATH)
    return RedirectResponse(settings.frontend_origin)


def _constant_time_eq(a: str, b: str) -> bool:
    import hmac

    return hmac.compare_digest(a.encode(), b.encode())
