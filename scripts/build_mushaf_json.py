#!/usr/bin/env python3
"""Convert the QPC V4 mushaf CSVs into compact per-page JSON for the frontend.

Reads:
    scripts/words.csv        id,location,surah,ayah,word,text
    scripts/page_lines.csv   page_number,line_number,line_type,is_centered,first_word_id,last_word_id,surah_number
    scripts/qpc_mapping.csv  word_id,page_number,code

Writes:
    frontend/public/mushaf/index.json
    frontend/public/mushaf/pages/<n>.json   (604 files)
    backend/app/data/words_meta.json        (word id -> [surah, ayah, word, location])

Run from the repo root:  python scripts/build_mushaf_json.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts"
OUT_DIR = ROOT / "frontend" / "public" / "mushaf"
PAGES_DIR = OUT_DIR / "pages"
BACKEND_DATA_DIR = ROOT / "backend" / "app" / "data"

SURAH_NAMES = {
    1: "الفاتحة", 2: "البقرة", 3: "آل عمران", 4: "النساء", 5: "المائدة", 6: "الأنعام",
    7: "الأعراف", 8: "الأنفال", 9: "التوبة", 10: "يونس", 11: "هود", 12: "يوسف",
    13: "الرعد", 14: "إبراهيم", 15: "الحجر", 16: "النحل", 17: "الإسراء", 18: "الكهف",
    19: "مريم", 20: "طه", 21: "الأنبياء", 22: "الحج", 23: "المؤمنون", 24: "النور",
    25: "الفرقان", 26: "الشعراء", 27: "النمل", 28: "القصص", 29: "العنكبوت", 30: "الروم",
    31: "لقمان", 32: "السجدة", 33: "الأحزاب", 34: "سبأ", 35: "فاطر", 36: "يس",
    37: "الصافات", 38: "ص", 39: "الزمر", 40: "غافر", 41: "فصلت", 42: "الشورى",
    43: "الزخرف", 44: "الدخان", 45: "الجاثية", 46: "الأحقاف", 47: "محمد", 48: "الفتح",
    49: "الحجرات", 50: "ق", 51: "الذاريات", 52: "الطور", 53: "النجم", 54: "القمر",
    55: "الرحمن", 56: "الواقعة", 57: "الحديد", 58: "المجادلة", 59: "الحشر", 60: "الممتحنة",
    61: "الصف", 62: "الجمعة", 63: "المنافقون", 64: "التغابن", 65: "الطلاق", 66: "التحريم",
    67: "الملك", 68: "القلم", 69: "الحاقة", 70: "المعارج", 71: "نوح", 72: "الجن",
    73: "المزمل", 74: "المدثر", 75: "القيامة", 76: "الإنسان", 77: "المرسلات", 78: "النبأ",
    79: "النازعات", 80: "عبس", 81: "التكوير", 82: "الانفطار", 83: "المطففين", 84: "الانشقاق",
    85: "البروج", 86: "الطارق", 87: "الأعلى", 88: "الغاشية", 89: "الفجر", 90: "البلد",
    91: "الشمس", 92: "الليل", 93: "الضحى", 94: "الشرح", 95: "التين", 96: "العلق",
    97: "القدر", 98: "البينة", 99: "الزلزلة", 100: "العاديات", 101: "القارعة", 102: "التكاثر",
    103: "العصر", 104: "الهمزة", 105: "الفيل", 106: "قريش", 107: "الماعون", 108: "الكوثر",
    109: "الكافرون", 110: "النصر", 111: "المسد", 112: "الإخلاص", 113: "الفلق", 114: "الناس",
}

# (surah, ayah) that starts each juz
JUZ_STARTS = {
    1: (1, 1), 2: (2, 142), 3: (2, 253), 4: (3, 92), 5: (4, 24), 6: (4, 148),
    7: (5, 82), 8: (6, 111), 9: (7, 88), 10: (8, 41), 11: (9, 94), 12: (11, 6),
    13: (12, 53), 14: (15, 1), 15: (17, 1), 16: (18, 75), 17: (21, 1), 18: (23, 1),
    19: (25, 21), 20: (27, 56), 21: (29, 46), 22: (33, 31), 23: (36, 28), 24: (39, 32),
    25: (41, 47), 26: (46, 1), 27: (51, 31), 28: (58, 1), 29: (67, 1), 30: (78, 1),
}


def read_words() -> dict[int, dict]:
    words: dict[int, dict] = {}
    with open(SRC / "words.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            wid = int(row["id"])
            words[wid] = {
                "s": int(row["surah"]),
                "a": int(row["ayah"]),
                "n": int(row["word"]),
                "loc": row["location"],
                "text": row["text"],
            }
    return words


def read_mapping() -> dict[int, dict]:
    mapping: dict[int, dict] = {}
    with open(SRC / "qpc_mapping.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            wid = int(row["word_id"])
            codes = [int(c) for c in row["code"].split()] if row["code"].strip() else []
            mapping[wid] = {"page": int(row["page_number"]), "codes": codes}
    return mapping


def read_lines() -> dict[int, list[dict]]:
    pages: dict[int, list[dict]] = {}
    with open(SRC / "page_lines.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            pn = int(row["page_number"])
            pages.setdefault(pn, []).append(
                {
                    "type": row["line_type"],
                    "centered": row["is_centered"] == "1",
                    "first": int(row["first_word_id"]) if row["first_word_id"] else None,
                    "last": int(row["last_word_id"]) if row["last_word_id"] else None,
                    "surah": int(row["surah_number"]) if row["surah_number"] else None,
                }
            )
    return pages


def main() -> None:
    words = read_words()
    mapping = read_mapping()
    pages = read_lines()

    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    BACKEND_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # word metadata for the backend (authoritative source for location data)
    words_meta = {
        str(wid): [w["s"], w["a"], w["n"], w["loc"]]
        for wid, w in words.items()
    }
    (BACKEND_DATA_DIR / "words_meta.json").write_text(
        json.dumps(words_meta, ensure_ascii=False), encoding="utf-8"
    )

    # surah -> first page it appears on
    surah_start_page: dict[int, int] = {}
    for wid, m in mapping.items():
        w = words.get(wid)
        if not w:
            continue
        s = w["s"]
        p = m["page"]
        if s not in surah_start_page or p < surah_start_page[s]:
            surah_start_page[s] = p

    # juz -> start page
    juz_start_page: dict[int, int] = {}
    for j, (s, a) in JUZ_STARTS.items():
        start = None
        for wid, w in words.items():
            if w["s"] == s and w["a"] == a and w["n"] == 1:
                start = mapping[wid]["page"]
                break
        juz_start_page[j] = start if start is not None else 1

    index = {
        "numPages": 604,
        "surahNames": SURAH_NAMES,
        "surahStartPage": {str(k): v for k, v in surah_start_page.items()},
        "juzStartPage": {str(k): v for k, v in juz_start_page.items()},
    }
    (OUT_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")

    for page in sorted(pages):
        doc = {"page": page, "lines": []}
        for line in pages[page]:
            entry = {"type": line["type"], "centered": line["centered"]}
            if line["type"] == "surah_name":
                entry["surah"] = line["surah"]
            elif line["type"] == "ayah":
                wlist = []
                for wid in range(line["first"], line["last"] + 1):
                    w = words.get(wid)
                    if not w:
                        continue
                    m = mapping.get(wid, {"page": page, "codes": []})
                    wlist.append(
                        {
                            "id": wid,
                            "s": w["s"],
                            "a": w["a"],
                            "n": w["n"],
                            "loc": w["loc"],
                            "text": w["text"],
                            "codes": m["codes"],
                        }
                    )
                entry["words"] = wlist
            doc["lines"].append(entry)

        # first surah present on the page (used for navigation label)
        surah = None
        for line in doc["lines"]:
            if line["type"] == "ayah" and line.get("words"):
                surah = line["words"][0]["s"]
                break
        doc["surah"] = surah

        (PAGES_DIR / f"{page}.json").write_text(
            json.dumps(doc, ensure_ascii=False), encoding="utf-8"
        )

    total_words = sum(
        1
        for page in pages
        for line in pages[page]
        if line["type"] == "ayah"
        for _ in range(line["first"] or 0, (line["last"] or 0) + 1)
    )
    print(f"Wrote {len(pages)} page files, index.json, ~{total_words} words, "
          f"{len(surah_start_page)} surahs, {len(juz_start_page)} juz.")


if __name__ == "__main__":
    main()
