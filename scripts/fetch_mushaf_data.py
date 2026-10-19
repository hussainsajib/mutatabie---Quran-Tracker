#!/usr/bin/env python3
"""Fetch V1/V2 glyph mappings + V1 layout from the quran.com public API.

The Madani mushafs (KFGQPC V1 1405H, V2 1421H, V4 1441H) share the same word
segmentation (83,668 word ids) but differ in per-page fonts and glyph
codepoints. V2 and V4 also share the exact page/line layout; V1 differs in a
handful of page boundaries.

This script pulls per-word `code_v1`/`code_v2` and `v1_page`/`line_v1`/
`v2_page`/`line_v2` and writes:

    scripts/qpc_mapping_v1.csv   word_id,page_number,code  (V1 glyphs)
    scripts/qpc_mapping_v2.csv   word_id,page_number,code  (V2 glyphs)
    scripts/page_lines_v1.csv    V1 layout (surah_name/basmallah/ayah lines)

It joins on `location` (surah:ayah:word) so ids match the contiguous 1..83668
scheme in words.csv. One-time, network-only; the CSVs are committed.
"""
from __future__ import annotations

import csv
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts"

FIELDS = (
    "code_v1,code_v2,v1_page,v2_page,line_v1,line_v2,"
    "char_type_name,position,location"
)
URL = (
    "https://api.quran.com/api/v4/verses/by_chapter/{chapter}"
    "?words=true&per_page=1000&word_fields=" + FIELDS
)

PAGES_WITH_8_LINES = {1, 2}  # pages 1-2 hold 8 lines, the rest 15

# quran.com combines "بَعْدَ مَا" into a single token, while words.csv (Tanzil
# / QUL) splits it into "بَعْدَ" + "مَا". This happens in exactly three ayaat.
# key: verse_key -> the API position of the combined word (its glyph code has
# two glyphs that must be split across words.csv positions P and P+1).
COMBINED_SPLITS = {"2:181": 3, "8:6": 4, "13:37": 8}


def fetch_json(url: str, retries: int = 4) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"Accept": "application/json", "User-Agent": "quran-tracker/1.0"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"failed after {retries} attempts: {url!r}") from last


def load_words() -> tuple[dict[str, int], dict[int, str]]:
    loc_to_id: dict[str, int] = {}
    id_to_loc: dict[int, str] = {}
    with open(SRC / "words.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            loc_to_id[row["location"]] = int(row["id"])
            id_to_loc[int(row["id"])] = row["location"]
    return loc_to_id, id_to_loc


def to_codes(text: str) -> str:
    """'ﭑ' -> '64336'; 'ﭑ ﭒ' -> '64336 64337' (whitespace between glyphs is
    dropped; codepoints are space-separated to match qpc_mapping.csv)."""
    return " ".join(str(ord(ch)) for ch in text if not ch.isspace())


def load_v4_centered_ayah_lines() -> set[tuple[int, int]]:
    """(first_word_id, last_word_id) of V4 ayah lines that are centered."""
    out: set[tuple[int, int]] = set()
    with open(SRC / "page_lines.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["line_type"] == "ayah" and row["is_centered"] == "1":
                out.add((int(row["first_word_id"]), int(row["last_word_id"])))
    return out


def prev_line(page: int, line: int) -> tuple[int, int]:
    """The (page, line) immediately before the given one, wrapping pages."""
    if line > 1:
        return (page, line - 1)
    prev_page = page - 1
    last = 8 if prev_page in PAGES_WITH_8_LINES else 15
    return (prev_page, last)


def reconstruct_page_lines(
    words: dict[int, dict], edition: str
) -> list[dict]:
    """Group words into lines for one edition and add surah_name/basmallah.

    `words` maps contiguous word id -> dict with the edition's page/line.
    Returns rows sorted by (page_number, line_number).
    """
    page_key = "v1_page" if edition == "v1" else "v2_page"
    line_key = "line_v1" if edition == "v1" else "line_v2"

    # ayah lines: (page, line) -> [word ids in order]
    lines: dict[tuple[int, int], list[int]] = {}
    for wid in sorted(words):
        w = words[wid]
        pg = w[page_key]
        ln = w[line_key]
        lines.setdefault((pg, ln), []).append(wid)

    rows: dict[tuple[int, int], dict] = {}
    for (pg, ln), wids in lines.items():
        rows[(pg, ln)] = {
            "page": pg, "line": ln, "type": "ayah",
            "centered": 0, "first": wids[0], "last": wids[-1], "surah": None,
        }

    # surah_name / basmallah lines
    v4_centered = load_v4_centered_ayah_lines()
    for surah in range(1, 115):
        first_loc = f"{surah}:1:1"
        # first word id
        fid = None
        for wid, w in words.items():
            if w["location"] == first_loc:
                fid = wid
                break
        if fid is None:
            print(f"  !! first word of surah {surah} not found", file=sys.stderr)
            continue
        pg, ln = words[fid][page_key], words[fid][line_key]
        has_basmallah = surah not in (1, 9)
        if has_basmallah:
            b_pg, b_ln = prev_line(pg, ln)
            s_pg, s_ln = prev_line(b_pg, b_ln)
            rows[(b_pg, b_ln)] = {
                "page": b_pg, "line": b_ln, "type": "basmallah",
                "centered": 1, "first": None, "last": None, "surah": None,
            }
        else:
            s_pg, s_ln = prev_line(pg, ln)
        rows[(s_pg, s_ln)] = {
            "page": s_pg, "line": s_ln, "type": "surah_name",
            "centered": 1, "first": None, "last": None, "surah": surah,
        }

    # centered ayah lines: pages 1-2 always centered; otherwise carry over the
    # V4 centered short-lines by (first,last) word range.
    for key, row in rows.items():
        if row["type"] != "ayah":
            continue
        if row["page"] in PAGES_WITH_8_LINES:
            row["centered"] = 1
        elif (row["first"], row["last"]) in v4_centered:
            row["centered"] = 1

    ordered = sorted(rows.values(), key=lambda r: (r["page"], r["line"]))
    return ordered


def write_mapping(path: Path, rows: list[tuple[int, int, str]]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["word_id", "page_number", "code"])
        for wid, page, code in rows:
            writer.writerow([wid, page, code])


def write_page_lines(path: Path, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["page_number", "line_number", "line_type", "is_centered",
             "first_word_id", "last_word_id", "surah_number"]
        )
        for r in rows:
            writer.writerow([
                r["page"], r["line"], r["type"],
                1 if r["centered"] else 0,
                r["first"] if r["first"] is not None else "",
                r["last"] if r["last"] is not None else "",
                r["surah"] if r["surah"] is not None else "",
            ])


def main() -> None:
    loc_to_id, _ = load_words()

    # word id -> per-edition metadata
    words: dict[int, dict] = {}
    missing_locs: list[str] = []

    def glyphs(text: str) -> list[str]:
        return [c for c in text if not c.isspace()]

    def put(verse_key: str, position: int, w: dict, g1: list[str], g2: list[str]) -> None:
        loc = f"{verse_key}:{position}"
        wid = loc_to_id.get(loc)
        if wid is None:
            missing_locs.append(loc)
            return
        words[wid] = {
            "location": loc,
            "code_v1": " ".join(str(ord(c)) for c in g1),
            "code_v2": " ".join(str(ord(c)) for c in g2),
            "v1_page": w.get("v1_page"),
            "v2_page": w.get("v2_page"),
            "line_v1": w.get("line_v1"),
            "line_v2": w.get("line_v2"),
        }

    for chapter in range(1, 115):
        data = fetch_json(URL.format(chapter=chapter))
        for verse in data.get("verses", []):
            vk = verse.get("verse_key", "")
            for w in verse.get("words", []):
                pos = w.get("position")
                g1 = glyphs(w.get("code_v1", ""))
                g2 = glyphs(w.get("code_v2", ""))
                if vk in COMBINED_SPLITS:
                    combined = COMBINED_SPLITS[vk]
                    if pos == combined:
                        # split the two glyphs across words.csv positions P and P+1
                        put(vk, pos, w, g1[:1], g2[:1])
                        put(vk, pos + 1, w, g1[1:2], g2[1:2])
                    elif pos > combined:
                        put(vk, pos + 1, w, g1, g2)  # shift subsequent words +1
                    else:
                        put(vk, pos, w, g1, g2)
                else:
                    put(vk, pos, w, g1, g2)
        print(f"chapter {chapter:>3} done")

    # --- fix: quran.com occasionally assigns an ayah-end marker (the trailing
    # digit) to an EARLIER line than its words (e.g. 84:21:7 on line 13 while
    # its words sit on line 14). The marker always follows its words, so if it
    # appears before them, move it onto the last word's line. Legitimate
    # "next line" markers are left untouched.
    from collections import defaultdict
    by_verse: dict[str, list[int]] = defaultdict(list)
    for wid in sorted(words):
        verse_key = words[wid]["location"].rsplit(":", 1)[0]
        by_verse[verse_key].append(wid)

    def precedes(ep: int, el: int, pp: int, pl: int) -> bool:
        return ep < pp or (ep == pp and el < pl)

    for wids in by_verse.values():
        if len(wids) < 2:
            continue
        end_wid, prev_wid = wids[-1], wids[-2]
        for page_key, line_key in (("v1_page", "line_v1"), ("v2_page", "line_v2")):
            ep, el = words[end_wid][page_key], words[end_wid][line_key]
            pp, pl = words[prev_wid][page_key], words[prev_wid][line_key]
            if precedes(ep, el, pp, pl):
                words[end_wid][page_key] = pp
                words[end_wid][line_key] = pl

    # --- glyph mappings ---
    rows_v1 = sorted(
        ((wid, words[wid]["v1_page"], words[wid]["code_v1"]) for wid in words),
        key=lambda r: r[0],
    )
    rows_v2 = sorted(
        ((wid, words[wid]["v2_page"], words[wid]["code_v2"]) for wid in words),
        key=lambda r: r[0],
    )
    write_mapping(SRC / "qpc_mapping_v1.csv", rows_v1)
    write_mapping(SRC / "qpc_mapping_v2.csv", rows_v2)

    # --- V1 + V2 layout ---
    v1_lines = reconstruct_page_lines(words, "v1")
    write_page_lines(SRC / "page_lines_v1.csv", v1_lines)
    v2_lines = reconstruct_page_lines(words, "v2")
    write_page_lines(SRC / "page_lines_v2.csv", v2_lines)

    # --- validation: compare reconstructed V2 to existing V4 layout ---
    existing: dict[tuple[int, int], list] = {}
    with open(SRC / "page_lines.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            existing[(int(row["page_number"]), int(row["line_number"]))] = [
                row["line_type"], row["is_centered"],
                int(row["first_word_id"]) if row["first_word_id"] else None,
                int(row["last_word_id"]) if row["last_word_id"] else None,
                int(row["surah_number"]) if row["surah_number"] else None,
            ]
    diffs = []
    v2_keys = {(r["page"], r["line"]) for r in v2_lines}
    for key in sorted(existing.keys() | v2_keys):
        got = next((r for r in v2_lines if (r["page"], r["line"]) == key), None)
        exp = existing.get(key)
        got_norm = None
        if got:
            got_norm = [
                got["type"], "1" if got["centered"] else "0",
                got["first"], got["last"], got["surah"],
            ]
        if got_norm != exp:
            diffs.append((key, exp, got_norm))

    missing_ids = sorted(set(loc_to_id.values()) - set(words))

    print("\n--- verification ---")
    print(f"words.csv ids:            {len(loc_to_id)}")
    print(f"fetched words:            {len(words)}")
    print(f"missing word ids:         {len(missing_ids)}")
    for wid in missing_ids[:20]:
        print(f"   id {wid} = {loc_to_id and [k for k,v in loc_to_id.items() if v==wid]}")
    print(f"v1 mapping rows:          {len(rows_v1)}")
    print(f"v2 mapping rows:          {len(rows_v2)}")
    print(f"v1 layout lines:          {len(v1_lines)}")
    print(f"v2 layout lines:          {len(v2_lines)}")
    print(f"v2 vs existing v4 diffs:  {len(diffs)}")
    for d in diffs[:40]:
        print("   ", d)

    if len(words) != len(loc_to_id):
        print("  !! fetched word count != words.csv count", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
