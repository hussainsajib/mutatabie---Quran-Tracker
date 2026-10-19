# License & provenance notice

This bundle assembles third-party font files and derived metadata. It is
provided for research and interoperability. **You are responsible for checking
the licenses that apply in your jurisdiction before redistributing or
commercialising any part of this bundle.**

## Fonts

The fonts in this bundle originate from the **QCF (Quran Calligraphic Font)**
releases published by the **King Fahd Complex for the Printing of the Holy
Quran (KFQPC)** — see <https://qurancomplex.gov.sa>. The files are the exact
woff2 files distributed with those releases:

| File(s) | Description |
|---|---|
| `fonts/qpcv4/p1.woff2` … `p604.woff2` | QPC V4 Tajweed page fonts (one per mushaf page) |
| `fonts/qpcv2/p1.woff2` … `p604.woff2` | QPC V2 (1421H) page fonts |
| `fonts/qpcv1/p1.woff2` … `p604.woff2` | QPC V1 (1405H) page fonts |
| `fonts/surah-name-v4.woff2` | QPC surah header font (used for all editions) |
| `fonts/QCF4_Hafs_01_W.woff2` | QCF v4 Hafs word-group font (included only for the basmallah glyph) |

The V4 fonts ship with the `qpc-v4-mushaf-bundle`; the V1/V2 page fonts are
retrieved from quran.com's public font CDN (`fonts.quran.com`).

The QPC fonts are copyright works of KFQPC. Their terms of use may restrict
redistribution, modification, or commercial use. Verify the current license on
the KFQPC site before publishing this bundle publicly.

## Metadata

The CSV files under `data/` are generated artifacts:

- `words.csv` and `page_lines.csv` are derived from the mushaf reference data of
  the QUL project (see the Attribution section of `README.md`).
- `qpc_mapping.csv` is generated from the fonts by `build_qpc_mapping.py`
  (word text + font glyph advances only — no external text source).

The mapping data (`word_id → QPC codepoints`) is an original mechanical
derivation of public, factual glyph-to-word assignments; treat it as you would
any other derived data of this kind.

The embedded surah-name list and juz boundaries in `index.html` are standard,
public-domain Islamic reference data.

## No warranty

This bundle is provided "as is", without warranty of any kind, express or
implied, including but not limited to the warranties of merchantability,
fitness for a particular purpose, or non-infringement. In no event shall the
authors be liable for any claim, damages, or other liability arising from the
use of this bundle.