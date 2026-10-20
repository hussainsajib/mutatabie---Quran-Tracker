import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { MushafIndex } from "../mushaf/types";
import type { User } from "../api/auth";
import { SURAH_NAMES_EN } from "../mushaf/surahs";
import logoutIcon from "../assets/logout.svg?raw";

interface Props {
  page: number;
  index: MushafIndex;
  user: User;
  onPageChange: (page: number) => void;
  onLogout: () => void;
}

type NavMode = "surah" | "page" | "juz";

const SURAH_KEYS = Array.from({ length: 114 }, (_, i) => i + 1);
const JUZ_KEYS = Array.from({ length: 30 }, (_, i) => i + 1);
const NAV_MODES: { id: NavMode; label: string }[] = [
  { id: "surah", label: "Surah" },
  { id: "page", label: "Page" },
  { id: "juz", label: "Juz" },
];

interface SurahOption {
  num: number;
  en: string;
  ar: string;
  startPage: number;
}

/** Last surah whose start page is at or before `page`. */
function currentSurah(page: number, index: MushafIndex): number {
  let current = 1;
  for (let s = 1; s <= 114; s++) {
    const start = index.surahStartPage[String(s)];
    if (start !== undefined && start <= page) current = s;
  }
  return current;
}

/** Last juz whose start page is at or before `page`. */
function currentJuz(page: number, index: MushafIndex): number {
  let current = 1;
  for (let j = 1; j <= 30; j++) {
    const start = index.juzStartPage[String(j)];
    if (start !== undefined && start <= page) current = j;
  }
  return current;
}

/** Last ayah of `surah` whose start page is at or before `page`. */
function currentAyah(surah: number, page: number, index: MushafIndex): number {
  const count = index.surahAyahCount[String(surah)] ?? 0;
  let current = 1;
  for (let a = 1; a <= count; a++) {
    const start = index.ayahStartPage[`${surah}:${a}`];
    if (start === undefined) continue;
    if (start <= page) current = a;
    else break;
  }
  return current;
}

function ModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: NavMode;
  onChange: (mode: NavMode) => void;
  className?: string;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={mode}
      onChange={(_event, value) => {
        if (value !== null) onChange(value as NavMode);
      }}
      aria-label="Navigation mode"
      className={className}
    >
      {NAV_MODES.map((m) => (
        <ToggleButton key={m.id} value={m.id}>
          {m.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export function Toolbar({
  page,
  index,
  user,
  onPageChange,
  onLogout,
}: Props) {
  const [mode, setMode] = useState<NavMode>("surah");

  const numPages = index.numPages;
  const surah = currentSurah(page, index);
  const ayah = currentAyah(surah, page, index);
  const juz = currentJuz(page, index);
  const ayahCount = index.surahAyahCount[String(surah)] ?? 0;

  const surahOptions = useMemo<SurahOption[]>(
    () =>
      SURAH_KEYS.map((s) => ({
        num: s,
        en: SURAH_NAMES_EN[s],
        ar: index.surahNames[String(s)] ?? "",
        startPage: index.surahStartPage[String(s)] ?? 1,
      })),
    [index],
  );
  const selectedSurah =
    surahOptions.find((o) => o.num === surah) ?? surahOptions[0];
  const ayahOptions = useMemo(
    () => Array.from({ length: ayahCount }, (_, i) => i + 1),
    [ayahCount],
  );

  function goto(p: number) {
    if (p < 1 || p > numPages) return;
    onPageChange(p);
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-brand-sub">Quran Tracker</span>
      </div>

      <nav className="toolbar-nav">
        {mode === "page" && (
          <>
            <button
              className="nav-btn"
              onClick={() => goto(page + 1)}
              disabled={page >= numPages}
              aria-label="Next page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 15 15"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M3 7.5L11 0v15z" />
              </svg>
            </button>
            <label className="page-input">
              <input
                type="number"
                min={1}
                max={numPages}
                value={page}
                onChange={(e) => goto(parseInt(e.target.value, 10) || 1)}
              />
            </label>
            <button
              className="nav-btn"
              onClick={() => goto(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 15 15"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M12 7.5L4 0v15z" />
              </svg>
            </button>
          </>
        )}

        {mode === "surah" && (
          <>
            <Autocomplete<SurahOption, false, true>
              className="toolbar-autocomplete toolbar-autocomplete-surah"
              options={surahOptions}
              value={selectedSurah}
              onChange={(_event, value) => goto(value.startPage)}
              getOptionLabel={(o) => `${o.num}. ${o.en} - ${o.ar}`}
              renderOption={(props, o) => {
                const { key, className, ...liProps } = props;
                return (
                  <li key={key} {...liProps} className={`${className ?? ""} ac-option`}>
                    <span className="ac-option-en">
                      {o.num}. {o.en}
                    </span>
                    <span className="ac-option-ar" dir="rtl">
                      {o.ar}
                    </span>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search surah…" aria-label="Surah" />
              )}
              disableClearable
              autoHighlight
              openOnFocus
            />
            <Autocomplete<number, false, true>
              className="toolbar-autocomplete toolbar-autocomplete-ayah"
              options={ayahOptions}
              value={ayah}
              onChange={(_event, value) => {
                const p = index.ayahStartPage[`${surah}:${value}`];
                if (p) goto(p);
              }}
              getOptionLabel={(n) => String(n)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Ayah" aria-label="Ayah" />
              )}
              disableClearable
              autoHighlight
              openOnFocus
            />
          </>
        )}

        {mode === "juz" && (
          <label className="toolbar-select">
            <select
              aria-label="Juz"
              value={juz}
              onChange={(e) => {
                const p = index.juzStartPage[String(e.target.value)];
                if (p) goto(p);
              }}
            >
              {JUZ_KEYS.map((j) => (
                <option key={j} value={j}>
                  Juz {j}
                </option>
              ))}
            </select>
          </label>
        )}
        <ModeToggle mode={mode} onChange={setMode} className="nav-mode" />
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
        <button
          className="nav-btn"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          <span
            className="nav-icon"
            dangerouslySetInnerHTML={{ __html: logoutIcon }}
          />
        </button>
      </div>
    </header>
  );
}
