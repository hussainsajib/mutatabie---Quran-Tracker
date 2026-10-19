"""Marks router: per-user, per-word mistake tracking."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user, require_csrf
from ..models import MistakeMark, User
from ..mushaf import get_word_meta
from ..schemas import MarkOut, MarksSummary, MarkUpsertRequest

router = APIRouter(
    prefix="/api/marks",
    tags=["marks"],
    dependencies=[Depends(get_current_user)],
)


def _derive_location(word_id: int) -> tuple[int, int, int, str]:
    meta = get_word_meta(word_id)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"word_id {word_id} is not a valid Quranic word",
        )
    return meta


@router.get("", response_model=list[MarkOut])
async def list_marks(
    surah: int | None = Query(default=None, ge=1, le=114),
    mistake_type: str | None = Query(default=None, pattern="^(hifdh|tajweed)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MistakeMark]:
    stmt = select(MistakeMark).where(MistakeMark.user_id == current_user.id)
    if surah is not None:
        stmt = stmt.where(MistakeMark.surah == surah)
    if mistake_type is not None:
        stmt = stmt.where(MistakeMark.mistake_type == mistake_type)
    stmt = stmt.order_by(MistakeMark.updated_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/summary", response_model=MarksSummary)
async def marks_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarksSummary:
    base = select(func.count(MistakeMark.id)).where(MistakeMark.user_id == current_user.id)
    total = await db.scalar(base)
    hifdh = await db.scalar(
        base.where(MistakeMark.mistake_type == "hifdh")
    )
    tajweed = await db.scalar(
        base.where(MistakeMark.mistake_type == "tajweed")
    )
    marked_words = await db.scalar(
        select(func.count(func.distinct(MistakeMark.word_id))).where(
            MistakeMark.user_id == current_user.id
        )
    )
    return MarksSummary(
        total=total or 0,
        hifdh=hifdh or 0,
        tajweed=tajweed or 0,
        marked_words=marked_words or 0,
    )


@router.put("/{word_id}", response_model=MarkOut, dependencies=[Depends(require_csrf)])
async def upsert_mark(
    word_id: int,
    body: MarkUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MistakeMark:
    surah, ayah, word_number, location = _derive_location(word_id)

    res = await db.execute(
        select(MistakeMark).where(
            MistakeMark.user_id == current_user.id,
            MistakeMark.word_id == word_id,
            MistakeMark.mistake_type == body.mistake_type,
        )
    )
    mark = res.scalar_one_or_none()

    if mark is None:
        mark = MistakeMark(
            user_id=current_user.id,
            word_id=word_id,
            location=location,
            surah=surah,
            ayah=ayah,
            word_number=word_number,
            mistake_type=body.mistake_type,
            note=body.note,
            repeat_count=1,
        )
        db.add(mark)
    else:
        mark.repeat_count += 1
        mark.note = body.note

    await db.commit()
    await db.refresh(mark)
    return mark


@router.delete("/{word_id}", response_model=dict, dependencies=[Depends(require_csrf)])
async def delete_mark(
    word_id: int,
    mistake_type: str | None = Query(default=None, pattern="^(hifdh|tajweed)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = delete(MistakeMark).where(
        MistakeMark.user_id == current_user.id,
        MistakeMark.word_id == word_id,
    )
    if mistake_type is not None:
        stmt = stmt.where(MistakeMark.mistake_type == mistake_type)
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Mark not found")
    return {"message": "Mark deleted"}
