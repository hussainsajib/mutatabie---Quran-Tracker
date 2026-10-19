import { Link } from "react-router-dom";
import type { MushafIndex } from "../mushaf/types";
import type { User } from "../api/auth";

interface Props {
  page: number;
  index: MushafIndex;
  marksCount: number;
  user: User;
  onPageChange: (page: number) => void;
  onLogout: () => void;
}

const SURAH_KEYS = Array.from({ length: 114 }, (_, i) => i + 1);
const JUZ_KEYS = Array.from({ length: 30 }, (_, i) => i + 1);

export function Toolbar({
  page,
  index,
  marksCount,
  user,
  onPageChange,
  onLogout,
}: Props) {
  const numPages = index.numPages;

  function goto(p: number) {
    if (p < 1 || p > numPages) return;
    onPageChange(p);
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-brand-sub">Quran Tracker</span>
        {marksCount > 0 && <span className="marks-badge">{marksCount}</span>}
      </div>

      <nav className="toolbar-nav">
        <button className="nav-btn" onClick={() => goto(page - 1)} disabled={page <= 1}>
          →
        </button>
        <label className="page-input">
          <input
            type="number"
            min={1}
            max={numPages}
            value={page}
            onChange={(e) => goto(parseInt(e.target.value, 10) || 1)}
          />
          <span>/ {numPages}</span>
        </label>
        <button className="nav-btn" onClick={() => goto(page + 1)} disabled={page >= numPages}>
          ←
        </button>

        <label className="toolbar-select">
          <select
            aria-label="Surah"
            onChange={(e) => {
              const p = index.surahStartPage[String(e.target.value)];
              if (p) goto(p);
            }}
          >
            {SURAH_KEYS.map((s) => (
              <option key={s} value={s}>
                {s}. {index.surahNames[String(s)]}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar-select">
          <select
            aria-label="Juz"
            defaultValue=""
            onChange={(e) => {
              const p = index.juzStartPage[String(e.target.value)];
              if (p) goto(p);
            }}
          >
            <option value="" disabled>
              Juz…
            </option>
            {JUZ_KEYS.map((j) => (
              <option key={j} value={j}>
                Juz {j}
              </option>
            ))}
          </select>
        </label>
      </nav>

      <div className="toolbar-right">
        <Link className="nav-btn" to="/settings" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>

        <div className="user-chip" title={user.email}>
          {user.display_name || user.email.split("@")[0]}
        </div>
        <button className="btn btn-outline" onClick={onLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
