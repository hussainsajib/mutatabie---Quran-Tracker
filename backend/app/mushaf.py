"""Loads authoritative mushaf word metadata into memory at startup.

This lets the backend derive `location`, `surah`, `ayah`, and `word` from a
client-supplied `word_id` instead of trusting the client to send correct values.
"""
from __future__ import annotations

import json
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "words_meta.json"

# word_id (int) -> (surah, ayah, word_number, location)
WORDS_META: dict[int, tuple[int, int, int, str]] = {}


def load_words_meta() -> None:
    global WORDS_META
    if WORDS_META:
        return
    with open(_DATA_PATH, encoding="utf-8") as f:
        raw: dict[str, list] = json.load(f)
    WORDS_META = {
        int(k): (int(v[0]), int(v[1]), int(v[2]), str(v[3]))
        for k, v in raw.items()
    }


def get_word_meta(word_id: int) -> tuple[int, int, int, str] | None:
    return WORDS_META.get(word_id)
