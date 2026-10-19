import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { updatePreferences, DEFAULT_PREFERENCES } from "../api/auth";
import type { MushafEdition } from "../mushaf/types";

const MUSHaf_OPTIONS: { value: MushafEdition; label: string; desc: string }[] = [
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

export function Settings() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const prefs = user?.preferences ?? DEFAULT_PREFERENCES;

  const [mushaf, setMushaf] = useState<MushafEdition>(prefs.mushaf);
  const [theme, setTheme] = useState<"light" | "dark">(prefs.theme);
  const [fontScale, setFontScale] = useState(prefs.font_scale);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => updatePreferences({ mushaf, theme, font_scale: fontScale }),
    onSuccess: (updated) => {
      updateUser(updated);
      navigate("/");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save"),
  });

  return (
    <div className="settings-shell">
      <div className="settings-card">
        <div className="settings-header">
          <h1>Settings</h1>
          <Link className="settings-back" to="/">
            ← Back to Mushaf
          </Link>
        </div>

        <section className="settings-section">
          <h2>Mushaf edition</h2>
          <p className="settings-hint">
            Your marks stay attached to the word itself, so they carry over no matter
            which edition you read.
          </p>
          <div className="mushaf-options">
            {MUSHaf_OPTIONS.map((opt) => (
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
        </section>

        <section className="settings-section">
          <h2>Theme</h2>
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
        </section>

        <section className="settings-section">
          <h2>Font size</h2>
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
        </section>

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
