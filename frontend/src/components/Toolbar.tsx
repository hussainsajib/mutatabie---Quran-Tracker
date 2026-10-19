import type { MushafIndex } from "../mushaf/types";
import type { User } from "../api/auth";

interface Props {
  page: number;
  index: MushafIndex;
  fontScale: number;
  theme: "light" | "dark";
  marksCount: number;
  user: User;
  onPageChange: (page: number) => void;
  onFontScaleChange: (scale: number) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

const SURAH_KEYS = Array.from({ length: 114 }, (_, i) => i + 1);
const JUZ_KEYS = Array.from({ length: 30 }, (_, i) => i + 1);

export function Toolbar({
  page,
  index,
  fontScale,
  theme,
  marksCount,
  user,
  onPageChange,
  onFontScaleChange,
  onToggleTheme,
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
        <div className="font-controls">
          <button
            className="nav-btn"
            aria-label="Decrease font size"
            onClick={() => onFontScaleChange(Math.max(0.5, fontScale - 0.1))}
          >
            −
          </button>
          <button
            className="nav-btn"
            aria-label="Increase font size"
            onClick={() => onFontScaleChange(Math.min(2.5, fontScale + 0.1))}
          >
            +
          </button>
        </div>

        <button className="nav-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === "light" ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </button>

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
