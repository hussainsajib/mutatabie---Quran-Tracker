import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadPage, fontsForPage, injectFontFace } from "../mushaf/loader";
import type { Line, MistakeType, MushafEdition, Word } from "../mushaf/types";
import surahHeaderFrame from "../assets/surah-header-frame.svg?raw";

const SURAH_WORD = 0xe000; // calligraphic "سُورَةُ" prefix glyph (the word "surah")
const BASMALLAH = 0xf8dd; // basmallah glyph in QCF4_Hafs_01
const MAX_DESKTOP_SCALE = 1.5; // upper bound for growing the page on wide screens
const FONT_TIMEOUT_MS = 8000; // show the page anyway if a font is this slow
const MAX_GAP = 1.0; // max per-gap stretch (em) before flushing a short line

interface Props {
  edition: MushafEdition;
  page: number;
  fontScale: number;
  marksByWord: Map<number, Set<MistakeType>>;
  onWordClick: (word: Word) => void;
}

export function MushafPage({ edition, page, fontScale, marksByWord, onWordClick }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["page", edition, page],
    queryFn: () => loadPage(edition, page),
  });

  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const baseSizeRef = useRef<number | null>(null);

  // Page fonts are glyph fonts: until one loads, the browser draws the raw
  // private-use codepoints in a fallback font. Keep the page hidden (spinner)
  // until every font it needs is ready, so only the real mushaf text shows.
  const pageKey = `${edition}:${page}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const fontsReady = readyKey === pageKey;

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const families = fontsForPage(edition, data);
    families.forEach(injectFontFace);
    const markReady = () => {
      if (!cancelled) setReadyKey(pageKey);
    };
    const timeout = window.setTimeout(markReady, FONT_TIMEOUT_MS); // don't spin forever
    Promise.all(families.map((f) => document.fonts.load(`1em '${f}'`)))
      .catch(() => undefined)
      .then(markReady);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [edition, data, pageKey]);

  const fit = useCallback(() => {
    const pageEl = pageRef.current;
    const frameEl = frameRef.current;
    if (!pageEl || !frameEl) return;

    if (baseSizeRef.current === null) {
      baseSizeRef.current = parseFloat(window.getComputedStyle(pageEl).fontSize);
    }
    const baseSize = baseSizeRef.current;

    pageEl.style.fontSize = `${baseSize * fontScale}px`;
    const natural = pageEl.offsetWidth;
    const avail = frameEl.clientWidth - 16; // pad for sub-pixel rounding
    if (natural && avail > 0) {
      const ratio = avail / natural;
      // Small screens fill the width snugly (scale up or down). Tablets and
      // desktops grow the page too, but only up to MAX_DESKTOP_SCALE so the
      // text stays readable without becoming oversized on wide monitors.
      const scale = window.matchMedia("(max-width: 640px)").matches
        ? ratio
        : Math.min(MAX_DESKTOP_SCALE, ratio);
      pageEl.style.fontSize = `${baseSize * fontScale * scale}px`;
    }

    const fontSize = parseFloat(pageEl.style.fontSize) || baseSize;
    const maxGap = MAX_GAP * fontSize;
    const pageW = pageEl.offsetWidth;
    pageEl.style.setProperty("--page-w", `${pageW}px`);

    pageEl
      .querySelectorAll<HTMLElement>(".quran-line:not(.is-centered)")
      .forEach((line) => {
        const spans = line.querySelectorAll(".quran-word");
        if (spans.length < 2) return;
        const prev = line.style.width;
        line.style.width = "max-content";
        const nat = line.offsetWidth;
        line.style.width = prev;
        const stretch = (pageW - nat) / (spans.length - 1);
        line.style.justifyContent = stretch > maxGap ? "flex-end" : "space-between";
      });
  }, [fontScale]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit, data, fontsReady]);

  // Re-fit once the page font has actually loaded (font-display: swap lies about metrics).
  useEffect(() => {
    if (!data || !fontsReady) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
    };
  }, [data, fit, fontsReady]);

  if (isLoading || (data && !fontsReady)) return <div className="mushaf-loading"><span className="spinner" role="status" aria-label="Loading page" /></div>;
  if (error || !data) return <div className="mushaf-error">Could not load this page.</div>;

  return (
    <div className="frame" ref={frameRef}>
      <div className="mushaf-fit">
        <div className="quran-page" ref={pageRef} dir="rtl">
          {data.lines.map((line, i) => (
            <LineView
              key={`${page}-${i}`}
              line={line}
              page={page}
              edition={edition}
              marksByWord={marksByWord}
              onWordClick={onWordClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LineView({
  line,
  page,
  edition,
  marksByWord,
  onWordClick,
}: {
  line: Line;
  page: number;
  edition: MushafEdition;
  marksByWord: Map<number, Set<MistakeType>>;
  onWordClick: (word: Word) => void;
}) {
  if (line.type === "surah_name") {
    const surah = line.surah ?? 0;
    return (
      <div className="surah-header">
        <div
          className="surah-header-frame"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: surahHeaderFrame }}
        />
        <span className="surah-name-v4-icon">{String.fromCodePoint(SURAH_WORD)}</span>
        <span className="surah-name-v4-icon">
          {String.fromCodePoint(SURAH_WORD + surah)}
        </span>
      </div>
    );
  }

  if (line.type === "basmallah") {
    return (
      <p className="quran-line line-basmallah">
        <span className="basmallah-glyph">{String.fromCodePoint(BASMALLAH)}</span>
      </p>
    );
  }

  return (
    <p className={`quran-line${line.centered ? " is-centered" : ""}`}>
      {line.words?.map((word) => (
        <WordSpan
          key={word.id}
          word={word}
          page={page}
          edition={edition}
          types={marksByWord.get(word.id)}
          onWordClick={onWordClick}
        />
      ))}
    </p>
  );
}

function WordSpan({
  word,
  page,
  edition,
  types,
  onWordClick,
}: {
  word: Word;
  page: number;
  edition: MushafEdition;
  types: Set<MistakeType> | undefined;
  onWordClick: (word: Word) => void;
}) {
  const isMarker = /^\p{Nd}+$/u.test(word.text);
  const cls = ["quran-word"];
  if (word.codes.length) cls.push("qcf");
  if (isMarker) cls.push("ayah-marker");
  if (types?.has("hifdh")) cls.push("marked-hifdh");
  if (types?.has("tajweed")) cls.push("marked-tajweed");

  const style = word.codes.length ? { fontFamily: `'${edition}-p${page}'` } : undefined;
  const content = word.codes.length
    ? word.codes.map((c) => String.fromCodePoint(c)).join("")
    : word.text;

  return (
    <span
      className={cls.join(" ")}
      style={style}
      data-word-id={word.id}
      title={isMarker ? undefined : word.loc}
      onClick={isMarker ? undefined : () => onWordClick(word)}
    >
      {content}
    </span>
  );
}
