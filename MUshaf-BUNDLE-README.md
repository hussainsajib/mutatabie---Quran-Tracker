# QPC V4 Mushaf Rendering Bundle

A self-contained, dependency-free bundle for rendering the printed **Madinah
Mushaf** from the **QPC V4 Tajweed** page fonts — the 604 per-page woff2 fonts
that the King Fahd Complex for the Printing of the Holy Quran ships with its
QCF v4 Uthmani calligraphy system.

This folder contains **everything required to render the full 604-page mushaf**
in a browser: the fonts, the word→glyph mapping, the page layout, and a working
demo. It ships as a self-contained package, stripped of all QCF word-group font
data (the `QCF4_Hafs_NN` fonts are **not** included).

> **One deliberate exception:** the basmallah line on surah-opening pages is a
> single glyph (`U+F8DD`) that only exists in the QCF fonts, not in the QPC page
> fonts. To keep the printed calligraphy intact without shipping all 47 QCF
> fonts, this bundle includes exactly one of them — `QCF4_Hafs_01_W.woff2`
> (~0.9 MB) — used solely for that glyph. Everything else is QPC V4.

## Contents

```
qpc-v4-mushaf-bundle/
├── README.md                  this file
├── LICENSE-NOTICE.md          font/data provenance and copyright notes
├── index.html                 self-contained renderer (open in a browser)
├── data/
│   ├── words.csv              83,668 rows — every word of the Quran
│   ├── page_lines.csv         8,624 rows  — the 604-page typesetting layout
│   ├── qpc_mapping.csv        83,668 rows — word → QPC glyph codepoints
│   └── embedded.js            base64 copies of the three CSVs, so the demo
│                              also works when opened directly from disk
│                              (file://) where fetch() is blocked
└── fonts/
    ├── qpcv4/p1.woff2 … p604.woff2   604 page fonts (48.5 MB total)
    ├── surah-name-v4.woff2           surah header calligraphy
    └── QCF4_Hafs_01_W.woff2          basmallah glyph only (see note above)
```

Total size ≈ 54 MB.

## Quick start

You can open `index.html` **directly from disk** — double-click it — because the
three CSVs are also embedded in `data/embedded.js` and used automatically when
the page can't fetch them. It also works over HTTP (any static file server,
no build step, no libraries, no database):

```bash
cd qpc-v4-mushaf-bundle
python -m http.server 8000
# open http://localhost:8000/
```

Then browse by page, surah, or juz. The rendered text is the real printed
calligraphy — the page font draws every glyph, not a Unicode approximation.

## The three data files

### `data/words.csv` — the words

```csv
id,location,surah,ayah,word,text
1,1:1:1,1,1,1,بِسۡمِ
2,1:1:2,1,1,2,ٱللَّهِ
```

| Column | Meaning |
|---|---|
| `id` | global word id, 1–83,668, in mushaf reading order |
| `location` | `surah:ayah:word` key (same as the following three columns) |
| `surah`, `ayah`, `word` | the three parts of the location |
| `text` | the Unicode Arabic text of the word (with tajweed marks) |

A word whose `text` is Arabic-Indic digits (e.g. `١`) is an **ayah-number
ornament**, not a word — it sits between words on the line.

### `data/page_lines.csv` — the typesetter

```csv
page_number,line_number,line_type,is_centered,first_word_id,last_word_id,surah_number
1,1,surah_name,1,,,1
1,2,ayah,1,1,5,
2,1,surah_name,1,,,2
2,2,basmallah,1,,,
2,3,ayah,1,37,44,
```

| Column | Meaning |
|---|---|
| `page_number` | 1–604 |
| `line_number` | 1-based row on the page |
| `line_type` | `surah_name` \| `basmallah` \| `ayah` |
| `is_centered` | `1` = centered line (surah-openers, headers) |
| `first_word_id` / `last_word_id` | inclusive word range, only on `ayah` lines |
| `surah_number` | only on `surah_name` lines (the header's surah) |

The printed mushaf is 15 lines per page, except pages 1–2 which have 8.

### `data/qpc_mapping.csv` — the word → glyph mapping

```csv
word_id,page_number,code
42,2,64582 64583
43,2,64584 64585
```

| Column | Meaning |
|---|---|
| `word_id` | matches `words.csv` |
| `page_number` | which page font the glyphs come from |
| `code` | **space-separated decimal codepoints** to emit for that word, in order |

A word usually maps to one codepoint. A word may map to more than one when it
carries a special mark that occupies its own glyph in the font:

```text
word 42   رَيۡبَۛ       → 64582 64583      word + trailing waqf mark ۛ
word 393  ۞ إِنَّ      → 64616 64617      leading rub-el-hizb + word
word 23707 يسجدونۤ۩   → 64716 64717 64718 word + ۤ mark + sajdah ۩
```

This file was derived mechanically from the fonts themselves (see "Rebuilding
the mapping" below) and is already committed — you normally never need to
regenerate it.

## The fonts

| Font(s) | Family name to use | Codepoints | Purpose |
|---|---|---|---|
| `fonts/qpcv4/pN.woff2` (604 files) | `pN` (e.g. `p2`) | `0xFC41` + n | the page's full text, one glyph per calligraphic unit, in reading order |
| `fonts/surah-name-v4.woff2` | `surah-name-v4` | `0xE000` = ornament, `0xE001..0xE072` = one glyph per surah | surah header line |
| `fonts/QCF4_Hafs_01_W.woff2` | `QCF4_Hafs_01` | `0xF8DD` | the basmallah glyph |

**The core trick of the whole system:** each QPC page font encodes its entire
page as a *linear, left-to-right (reading-order) sequence of glyphs starting at
`0xFC41`*. One glyph ≈ one calligraphic unit. There is no Arabic shaping, no
GSUB/GPOS, no ligatures — the font is pre-shaped. That is why the mapping can be
derived mechanically (section "Rebuilding the mapping").

```text
Glyph stream of page 2:  0xFC41 0xFC42 0xFC43 … 0xFC6C
                          word1  word2  word3      word44
```

## Rendering rules

To render page *P*:

1. **Declare fonts.** Always declare `@font-face` for `pP` pointing at
   `fonts/qpcv4/pP.woff2`. If the page has a `surah_name` line, also declare
   `surah-name-v4`; if it has a `basmallah` line, also declare `QCF4_Hafs_01`.
   Example:

   ```css
   @font-face { font-family: 'p2';    src: url('fonts/qpcv4/p2.woff2') format('woff2'); }
   @font-face { font-family: 'surah-name-v4'; src: url('fonts/surah-name-v4.woff2') format('woff2'); }
   @font-face { font-family: 'QCF4_Hafs_01'; src: url('fonts/QCF4_Hafs_01_W.woff2') format('woff2'); }
   ```

2. **Build the DOM** inside an RTL container (`dir="rtl"`), one flex `<p>` per
   `page_lines` row, ordered by `line_number`:

   - **`surah_name`** → two inline glyphs in `surah-name-v4`:
     `&#57344;` (0xE000 ornament) + `&#(57344 + surah_number);` (the surah's name glyph).

   - **`basmallah`** → one glyph in `QCF4_Hafs_01`: `&#63709;` (0xF8DD).
     No word ids — it is decorative, drawn directly by the template.

   - **`ayah`** → for each word id in `first_word_id..last_word_id`, look up its
     codes in `qpc_mapping.csv` and emit one `<span>` per word with *every*
     codepoint as an entity **inside the same span**, styled with
     `font-family:'pP'`:

     ```html
     <span class="quran-word" style="font-family:'p2'">&#64582;&#64583;</span>
     ```

     If a word has no QPC code (should not happen with this data), fall back to
     the word's Unicode `text` in a system Arabic font. Words whose `text` is
     digits (`/^\p{Nd}+$/u`) are ayah-number ornaments — mark them so you can
     style them as in-line numbers.

3. **Fit and justify.** The QPC fonts have no kashida, so CSS justification can
   only stretch the spaces between words. Measure each non-centered line's
   natural width; use `justify-content: space-between` only while the per-gap
   stretch stays under ~1 em; otherwise flush the line to the reading edge
   (`flex-end`) — short last lines in the real mushaf are not stretched.
   Measure the page's widest line and scale the page's `font-size` so the whole
   page fits the container width with no wrapping or horizontal scrollbar.
   Re-run the fit after each font finishes loading (`document.fonts.load`),
   because `font-display: swap` paints with fallback metrics first.

## Rebuilding the mapping (only if you change the fonts)

The committed `qpc_mapping.csv` is authoritative. If you ever replace the fonts
with a new QPC V4 release, you can regenerate it with Python 3 + `fonttools`
(dev-only; not needed to render):

```bash
pip install fonttools brotli
python scripts/build_qpc_mapping.py
```
The generator walks each page font's glyphs (codepoints ≥ 0xFC41, sorted, with
advances) and pairs them with the page's words in order. The rules:

1. Each word claims the next glyph in the stream.
2. If the word's text starts with `۞` (rub-el-hizb) or `۩` (sajdah), one glyph is
   consumed *before* the word's glyph.
3. After the word's glyph, keep consuming glyphs whose font **advance < 200** —
   these are the tiny waqf/recitation marks (ۖۗۘۙۚۛۜۤۥۦ) inserted between words.
   A histogram of advances shows the marks sit at ~0 and real letters start well
   above, so 200 is safely in the gap.
4. If the word's text ends with `۩`, consume one more glyph (the sajdah mark has
   a large advance, so rule 3 cannot catch it).
5. Any glyphs left at the end of a page are appended to the last word (this
   catches the handful of full-width word splits).

Stats this data is based on: 83,668 words; 6,236 ayah-number markers; 199 words
with a leading ۞/۩; 15 with a trailing ۩; 4,514 words carrying more than one QPC
codepoint.

## Gotchas

- **The basmallah is not in the QPC fonts.** `U+F8DD` exists only in the QCF
  fonts (`QCF4_QBSML`'s slot there is blank; the `QCF4_Hafs_NN` fonts all share
  the real glyph). This bundle ships one QCF font purely for that glyph.
- **No kashida.** Only spaces stretch. Cap the gap (~1 em) and flush short lines
  to the reading edge, or pages look machine-spaced.
- **`font-display: swap` lies about metrics.** Refit once every page font reports
  ready, or mid-page lines look short until the real font paints.
- **RTL + flexbox order.** Words are stored left-to-right in the CSVs; the
  `dir="rtl"` container flips them. Do not reverse the arrays yourself or you
  double-flip.
- **Keep the page narrower than its container.** Sub-pixel glyph advances
  otherwise cause a horizontal scrollbar; the fit code subtracts a few pixels.

## Attribution

This bundle reuses fonts, data, and code from several upstream sources. Please
attribute all of them if you redistribute or build on this work:

| Source | What was used | License / terms |
|---|---|---|
| **QUL — Quranic Universal Library** ([TarteelAI/quranic-universal-library](https://github.com/TarteelAI/quranic-universal-library), [qul.tarteel.ai](https://qul.tarteel.ai)) | the Madinah Mushaf **QPC V4 Tajweed page fonts** (`p1…p604`, `surah-name-v4`) and the underlying mushaf reference data | MIT (code); see project for data terms |
| **QCF v4 — Quran Calligraphic Font v4** ([King Fahd Complex for the Printing of the Holy Quran, KFQPC](https://qurancomplex.gov.sa)) | the `QCF4_Hafs_01_W.woff2` word-group font, included only for the basmallah glyph `U+F8DD` | copyright KFQPC; verify current terms before redistribution |

See `LICENSE-NOTICE.md` for detailed copyright and redistribution notes.

## Provenance

This package was assembled on 2026-08-19. See `LICENSE-NOTICE.md` for
copyright and redistribution notes for the fonts and data.