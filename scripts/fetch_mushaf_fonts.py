#!/usr/bin/env python3
"""Download the V1 (1405H) and V2 (1421H) QCF page fonts from quran.com.

The existing repo already ships the V4 (tajweed) page fonts under
frontend/public/fonts/qpcv4/. This fetches the equivalent per-page fonts for V1
and V2:

    https://fonts.quran.com/quran/hafs/v1/woff2/pN.woff2  -> fonts/qpcv1/pN.woff2
    https://fonts.quran.com/quran/hafs/v2/woff2/pN.woff2  -> fonts/qpcv2/pN.woff2

604 pages each. One-time, network-only.
"""
from __future__ import annotations

import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "frontend" / "public" / "fonts"
EDITION_DIRS = {"v1": "qpcv1", "v2": "qpcv2"}
PAGES = 604
WORKERS = 16


def fetch_one(edition: str, page: int) -> tuple[int, int]:
    url = f"https://fonts.quran.com/quran/hafs/{edition}/woff2/p{page}.woff2"
    dest = FONTS / EDITION_DIRS[edition] / f"p{page}.woff2"
    if dest.exists() and dest.stat().st_size > 0:
        return (page, 0)  # already present
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "quran-tracker/1.0"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
            dest.write_bytes(data)
            return (page, len(data))
        except Exception:
            if attempt == 3:
                return (page, -1)
    return (page, -1)


def main() -> None:
    for edition in ("v1", "v2"):
        out_dir = FONTS / EDITION_DIRS[edition]
        out_dir.mkdir(parents=True, exist_ok=True)
        ok = 0
        failed: list[int] = []
        total = 0
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            futures = {ex.submit(fetch_one, edition, p): p for p in range(1, PAGES + 1)}
            for fut in as_completed(futures):
                page, size = fut.result()
                if size < 0:
                    failed.append(page)
                else:
                    ok += 1
                    total += size
        print(f"{edition}: {ok}/{PAGES} downloaded, {total / 1_000_000:.1f} MB total")
        if failed:
            print(f"  failed pages: {failed}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
