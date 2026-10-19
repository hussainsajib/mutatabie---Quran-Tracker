import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listMarks } from "../api/marks";
import { loadIndex } from "../mushaf/loader";
import { formatSessionRange } from "../marks/sessions";
import type { MistakeType, Word } from "../mushaf/types";
import { Toolbar } from "../components/Toolbar";
import { MushafPage } from "../components/MushafPage";
import { MarkModal } from "../components/MarkModal";

const LAST_PAGE_KEY = "quran-tracker:last-page";

// The eight tajweed color categories of the KFGQPC V4 (1441H) mushaf:
// four grades of red (madd lengths) + ghunnah, idgham/silent, tafkhim, qalqalah.
const TAJWEED_LEGEND = [
  { cls: "swatch-red-darkest", label: "Madd 6 · مد لازم" },
  { cls: "swatch-red-dark", label: "Madd 4–5 · مد متصل/منفصل" },
  { cls: "swatch-red", label: "Madd 2–6 · مد عارض/لين" },
  { cls: "swatch-red-light", label: "Madd 2 · مد طبيعي" },
  { cls: "swatch-green", label: "Ghunnah 2 · غنة" },
  { cls: "swatch-gray", label: "Idgham/Silent · إدغام بلا غنة" },
  { cls: "swatch-dark-blue", label: "Tafkhim · تفخيم" },
  { cls: "swatch-light-blue", label: "Qalqalah · قلقلة" },
] as const;

function parsePage(value: string | null): number | null {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 604 ? n : null;
}

function parseEpoch(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function Mushaf() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(() => {
    const fromUrl = parsePage(searchParams.get("page"));
    if (fromUrl) return fromUrl;
    return parsePage(sessionStorage.getItem(LAST_PAGE_KEY)) ?? 1;
  });
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const edition = user?.preferences?.mushaf ?? "v4";
  const fontScale = user?.preferences?.font_scale ?? 1;

  const indexQuery = useQuery({
    queryKey: ["index", edition],
    queryFn: () => loadIndex(edition),
  });
  const marksQuery = useQuery({ queryKey: ["marks"], queryFn: listMarks });

  const sessionFrom = parseEpoch(searchParams.get("session_from"));
  const sessionTo = parseEpoch(searchParams.get("session_to"));
  const sessionActive = sessionFrom !== null && sessionTo !== null;

  function goto(p: number) {
    const clamped = Math.min(604, Math.max(1, p));
    setPage(clamped);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(clamped));
        return next;
      },
      { replace: true },
    );
  }

  function clearSession() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("session_from");
        next.delete("session_to");
        return next;
      },
      { replace: true },
    );
  }

  // Swipe navigation: left → right turns to the next page, right → left to the previous.
  function onTouchStart(e: ReactTouchEvent<HTMLElement>) {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: ReactTouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Require a deliberate horizontal gesture before changing pages.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    goto(dx > 0 ? page + 1 : page - 1);
  }

  // Remember the last page so it survives navigating away (e.g. to Settings).
  useEffect(() => {
    sessionStorage.setItem(LAST_PAGE_KEY, String(page));
  }, [page]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        selectedWord
      ) {
        return;
      }
      if (e.key === "ArrowLeft") goto(page - 1);
      if (e.key === "ArrowRight") goto(page + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedWord]);

  const marks = useMemo(() => {
    const all = marksQuery.data ?? [];
    if (sessionFrom === null || sessionTo === null) return all;
    return all.filter((m) => {
      const t = new Date(m.updated_at).getTime();
      return t >= sessionFrom && t <= sessionTo;
    });
  }, [marksQuery.data, sessionFrom, sessionTo]);
  const marksByWord = useMemo(() => {
    const map = new Map<number, Set<MistakeType>>();
    for (const mark of marks) {
      let set = map.get(mark.word_id);
      if (!set) {
        set = new Set();
        map.set(mark.word_id, set);
      }
      set.add(mark.mistake_type);
    }
    return map;
  }, [marks]);

  const selectedMarks = selectedWord
    ? marks.filter((m) => m.word_id === selectedWord.id)
    : [];

  return (
    <div className={`app-shell${edition === "v4" ? " has-legend" : ""}`}>
      {indexQuery.data && user ? (
        <Toolbar
          page={page}
          index={indexQuery.data}
          user={user}
          onPageChange={goto}
          onLogout={logout}
        />
      ) : null}

      <main className="mushaf-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {sessionActive && (
          <div className="session-banner">
            <span className="session-banner-text">
              Viewing session · {formatSessionRange(sessionFrom!, sessionTo!)} ·{" "}
              {marks.length} mark{marks.length === 1 ? "" : "s"}
            </span>
            <button className="session-banner-clear" onClick={clearSession}>
              Show all marks
            </button>
          </div>
        )}
        {indexQuery.isLoading ? (
          <div className="mushaf-loading">Loading mushaf…</div>
        ) : indexQuery.error ? (
          <div className="mushaf-error">Could not load the mushaf data.</div>
        ) : (
          <MushafPage
            edition={edition}
            page={page}
            fontScale={fontScale}
            marksByWord={marksByWord}
            onWordClick={setSelectedWord}
          />
        )}
      </main>

      {edition === "v4" && (
        <footer className="tajweed-legend" aria-label="Tajweed color legend">
          {TAJWEED_LEGEND.map((item) => (
            <span className="legend-item" key={item.cls}>
              <span className={`legend-swatch ${item.cls}`} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </footer>
      )}

      {selectedWord && (
        <MarkModal
          word={selectedWord}
          marks={selectedMarks}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
