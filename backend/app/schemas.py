"""Pydantic request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

MistakeType = Literal["hifdh", "tajweed"]


# --- auth ---
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class Preferences(BaseModel):
    mushaf: Literal["v1", "v2", "v4"] = "v4"
    theme: Literal["light", "dark"] = "light"
    font_scale: float = Field(default=1.0, ge=0.5, le=2.5)


class PreferencesUpdate(BaseModel):
    mushaf: Literal["v1", "v2", "v4"] | None = None
    theme: Literal["light", "dark"] | None = None
    font_scale: float | None = Field(default=None, ge=0.5, le=2.5)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str | None
    email_verified: bool
    has_google: bool = False
    preferences: Preferences


class AuthResponse(BaseModel):
    user: UserOut


class MessageOut(BaseModel):
    message: str


# --- marks ---
class MarkUpsertRequest(BaseModel):
    mistake_type: MistakeType
    note: str | None = Field(default=None, max_length=2000)


class MarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    word_id: int
    location: str
    surah: int
    ayah: int
    word_number: int
    mistake_type: str
    note: str | None
    repeat_count: int
    created_at: datetime
    updated_at: datetime


class MarksSummary(BaseModel):
    total: int
    hifdh: int
    tajweed: int
    marked_words: int
