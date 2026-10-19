import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listMarks } from "../api/marks";
import { loadIndex } from "../mushaf/loader";
import type { MistakeType, Word } from "../mushaf/types";
import { Toolbar } from "../components/Toolbar";
import { MushafPage } from "../components/MushafPage";
import { MarkModal } from "../components/MarkModal";

export function Mushaf() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPage = Math.min(
    604,
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
  );
  const [page, setPage] = useState(initialPage);
  const [fontScale, setFontScale] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("theme") === "dark" ? "dark" : "light",
  );
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);

  const indexQuery = useQuery({ queryKey: ["index"], queryFn: loadIndex });
  const marksQuery = useQuery({ queryKey: ["marks"], queryFn: listMarks });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  function goto(p: number) {
    const clamped = Math.min(604, Math.max(1, p));
    setPage(clamped);
    setSearchParams({ page: String(clamped) }, { replace: true });
  }

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
      if (e.key === "ArrowLeft") goto(page + 1);
      if (e.key === "ArrowRight") goto(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedWord]);

  const marks = marksQuery.data ?? [];
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
    <div className="app-shell">
      {indexQuery.data ? (
        <Toolbar
          page={page}
          index={indexQuery.data}
          fontScale={fontScale}
          theme={theme}
          marksCount={marks.length}
          user={user!}
          onPageChange={goto}
          onFontScaleChange={setFontScale}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          onLogout={logout}
        />
      ) : null}

      <main className="mushaf-main">
        {indexQuery.isLoading ? (
          <div className="mushaf-loading">Loading mushaf…</div>
        ) : indexQuery.error ? (
          <div className="mushaf-error">Could not load the mushaf data.</div>
        ) : (
          <MushafPage
            page={page}
            fontScale={fontScale}
            marksByWord={marksByWord}
            onWordClick={setSelectedWord}
          />
        )}
      </main>

      <footer className="mushaf-footer">
        Tap any word to mark a hifdh or tajweed mistake. Your marks are private to you.
      </footer>

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
