import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { updatePreferences, DEFAULT_PREFERENCES } from "../api/auth";
import { listMarks } from "../api/marks";
import { loadIndex } from "../mushaf/loader";
import { SURAH_NAMES_EN } from "../mushaf/surahs";
import {
  formatSessionRange,
  groupMarksIntoSessions,
  type Session,
} from "../marks/sessions";
import type { MushafEdition, MushafIndex } from "../mushaf/types";

const MUSHAF_OPTIONS: { value: MushafEdition; label: string; desc: string }[] = [
  {
    value: "v4",
    label: "Madinah V4 · 1441H",
    desc: "Tajweed (color-coded) print. Default.",
  },
  {
    value: "v2",
    label: "Madinah V2 · 1421H",
    desc: "Modern King Fahd print.",
  },
  {
    value: "v1",
    label: "Madinah V1 · 1405H",
    desc: "Classic 1405H print.",
  },
];

function pageForMark(surah: number, ayah: number, index: MushafIndex): number {
  return (
    index.ayahStartPage[`${surah}:${ayah}`] ??
    index.surahStartPage[String(surah)] ??
    1
  );
}

function juzForPage(page: number, index: MushafIndex): number {
  let juz = 1;
  for (let j = 1; j <= 30; j++) {
    const start = index.juzStartPage[String(j)];
    if (start !== undefined && start <= page) juz = j;
  }
  return juz;
}

/** Collapse sorted distinct numbers into consecutive ranges: "1–2, 5, 20". */
function collapseRanges(nums: number[]): string {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      parts.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  parts.push(start === prev ? `${start}` : `${start}–${prev}`);
  return parts.join(", ");
}

interface BreakdownRow {
  num: number;
  name: string;
  count: number;
  pages: string;
  juzs: string;
}

interface SessionView {
  surahs: string;
  pages: string;
  juzs: string;
  breakdown: BreakdownRow[];
}

function buildSessionView(session: Session, index: MushafIndex): SessionView {
  const bySurah = new Map<
    number,
    { pages: Set<number>; juzs: Set<number>; count: number }
  >();
  const allPages = new Set<number>();
  const allJuzs = new Set<number>();

  for (const m of session.marks) {
    const page = index.ayahStartPage[`${m.surah}:${m.ayah}`];
    if (page === undefined) continue;
    const juz = juzForPage(page, index);
    allPages.add(page);
    allJuzs.add(juz);

    let entry = bySurah.get(m.surah);
    if (!entry) {
      entry = { pages: new Set(), juzs: new Set(), count: 0 };
      bySurah.set(m.surah, entry);
    }
    entry.pages.add(page);
    entry.juzs.add(juz);
    entry.count += 1;
  }

  const breakdown: BreakdownRow[] = [...bySurah.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([num, e]) => ({
      num,
      name: SURAH_NAMES_EN[num] ?? `Surah ${num}`,
      count: e.count,
      pages: collapseRanges([...e.pages]),
      juzs: collapseRanges([...e.juzs]),
    }));

  return {
    surahs: breakdown.map((b) => `${b.name} (${b.count})`).join(" · "),
    pages: collapseRanges([...allPages]),
    juzs: collapseRanges([...allJuzs]),
    breakdown,
  };
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="settings-section">
      <button
        type="button"
        className="settings-summary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg
          className={`collapse-caret${open ? " open" : ""}`}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="settings-section-body">{children}</div>}
    </section>
  );
}

export function Settings() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const prefs = user?.preferences ?? DEFAULT_PREFERENCES;

  const [mushaf, setMushaf] = useState<MushafEdition>(prefs.mushaf);
  const [theme, setTheme] = useState<"light" | "dark">(prefs.theme);
  const [fontScale, setFontScale] = useState(prefs.font_scale);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<number | null>(null);

  const isMobile = useMemo(
    () => window.matchMedia("(max-width: 640px)").matches,
    [],
  );

  const save = useMutation({
    mutationFn: () => updatePreferences({ mushaf, theme, font_scale: fontScale }),
    onSuccess: (updated) => {
      updateUser(updated);
      navigate("/");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save"),
  });

  const marksQuery = useQuery({ queryKey: ["marks"], queryFn: listMarks });
  const indexQuery = useQuery({
    queryKey: ["index", prefs.mushaf],
    queryFn: () => loadIndex(prefs.mushaf),
  });

  const sessions = useMemo(
    () => groupMarksIntoSessions(marksQuery.data ?? []),
    [marksQuery.data],
  );

  const index = indexQuery.data;

  function openSession(session: Session) {
    if (!index || session.marks.length === 0) return;
    const first = session.marks[0];
    const page = pageForMark(first.surah, first.ayah, index);
    navigate(`/?page=${page}&session_from=${session.from}&session_to=${session.to}`);
  }

  function toggleExpand(key: number) {
    setExpandedKey((cur) => (cur === key ? null : key));
  }

  return (
    <div className="settings-shell">
      <div className="settings-card">
        <div className="settings-header">
          <h1>Settings</h1>
          <Link className="settings-back" to="/">
            ← Back to Mushaf
          </Link>
        </div>

        <Section title="Mushaf" defaultOpen={!isMobile}>
          <div className="mushaf-options">
            {MUSHAF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`mushaf-option ${mushaf === opt.value ? "active" : ""}`}
                onClick={() => setMushaf(opt.value)}
              >
                <span className="mushaf-option-label">{opt.label}</span>
                <span className="mushaf-option-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Theme" defaultOpen={!isMobile}>
          <div className="segmented">
            <button
              type="button"
              className={`segment ${theme === "light" ? "active" : ""}`}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={`segment ${theme === "dark" ? "active" : ""}`}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>

          <h3>Font size</h3>
          <div className="scale-control">
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={fontScale}
              onChange={(e) => setFontScale(parseFloat(e.target.value))}
            />
            <span className="scale-value">{fontScale.toFixed(1)}×</span>
          </div>
        </Section>

        <Section title="Profile" defaultOpen={!isMobile}>
          <dl className="profile-fields">
            <div className="profile-row">
              <dt>Name</dt>
              <dd>{user?.display_name || "—"}</dd>
            </div>
            <div className="profile-row">
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div className="profile-row">
              <dt>Email verified</dt>
              <dd>{user?.email_verified ? "Yes" : "No"}</dd>
            </div>
            <div className="profile-row">
              <dt>Google account</dt>
              <dd>{user?.has_google ? "Linked" : "Not linked"}</dd>
            </div>
          </dl>
        </Section>

        <Section title="history" defaultOpen={!isMobile}>
          {marksQuery.isLoading ? (
            <p className="settings-hint">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="settings-hint">No mistakes marked yet.</p>
          ) : (
            <div className="session-list">
              {sessions.map((session) => {
                const view = index ? buildSessionView(session, index) : null;
                const expanded = expandedKey === session.key;
                return (
                  <div className="session-item" key={session.key}>
                    <div className="session-row">
                      <button
                        type="button"
                        className="session-main"
                        onClick={() => openSession(session)}
                      >
                        <span className="session-top">
                          <span className="session-time">
                            {formatSessionRange(session.from, session.to)}
                          </span>
                          <span className="session-count">
                            {session.marks.length} mark
                            {session.marks.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        {view && (
                          <>
                            <span className="session-detail">{view.surahs}</span>
                            <span className="session-loc">Pages {view.pages}</span>
                            <span className="session-loc">Juz {view.juzs}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="session-caret"
                        onClick={() => toggleExpand(session.key)}
                        aria-expanded={expanded}
                        aria-label={expanded ? "Collapse session" : "Expand session"}
                      >
                        <svg
                          className={`collapse-caret${expanded ? " open" : ""}`}
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                    {expanded && view && (
                      <div className="session-breakdown">
                        {view.breakdown.map((b) => (
                          <div className="breakdown-row" key={b.num}>
                            <span className="breakdown-name">
                              {b.name} ({b.count})
                            </span>
                            <span className="breakdown-loc">
                              p{b.pages} · Juz {b.juzs}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {error && <div className="auth-error">{error}</div>}

        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
