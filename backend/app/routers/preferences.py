"""Preferences router: per-user reading preferences (mushaf edition, theme, font scale)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user, require_csrf
from ..models import User
from ..schemas import PreferencesUpdate, UserOut
from .auth import _user_out

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.put("", response_model=UserOut, dependencies=[Depends(require_csrf)])
async def update_preferences(
    body: PreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    if body.mushaf is not None:
        current_user.mushaf = body.mushaf
    if body.theme is not None:
        current_user.theme = body.theme
    if body.font_scale is not None:
        current_user.font_scale = body.font_scale
    await db.commit()
    await db.refresh(current_user)
    return _user_out(current_user)
