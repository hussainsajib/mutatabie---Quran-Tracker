import { useEffect, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MushafPage } from "../components/MushafPage";
import type { MistakeType } from "../mushaf/types";

const FEATURES = [
  {
    title: "Word-by-word marking",
    body: "Tap any word on the mushaf and record where you slipped — a hifdh error, a tajweed mistake, or both at once.",
  },
  {
    title: "Three Madinah editions",
    body: "Read the V1, V2, or V4 print. Your marks carry over whenever you switch, because each word keeps the same id.",
  },
  {
    title: "Review your history",
    body: "Mistakes group into sessions, so you can revisit and re-test exactly the words that tripped you up.",
  },
  {
    title: "Available anywhere",
    body: "Create an account and pick up where you left off on your phone, tablet, or computer.",
  },
];

const STEPS = [
  {
    title: "Recite",
    body: "Open any page of the Madinah Mushaf and recite from memory or from the text.",
  },
  {
    title: "Mark",
    body: "Tap the exact word where you hesitated or erred and choose the type of mistake.",
  },
  {
    title: "Revisit",
    body: "Come back to your marked words and watch the weak spots fade over time.",
  },
];

// Real V4 page 1 (Surat al-Fatihah), with a few sample marks.
const PREVIEW_MARKS = new Map<number, Set<MistakeType>>([
  [3, new Set<MistakeType>(["hifdh"])],
  [20, new Set<MistakeType>(["hifdh"])],
  [7, new Set<MistakeType>(["tajweed"])],
  [30, new Set<MistakeType>(["tajweed"])],
  [12, new Set<MistakeType>(["hifdh", "tajweed"])],
]);

function noop() {}

function MushafPreview() {
  return (
    <figure className="landing-preview" aria-label="Preview of a marked mushaf page">
      <div className="preview-page">
        <MushafPage
          edition="v4"
          page={1}
          fontScale={1}
          marksByWord={PREVIEW_MARKS}
          onWordClick={noop}
        />
      </div>
      <figcaption className="preview-legend">
        <span className="landing-mistake">
          <span className="mistake-swatch hifdh" aria-hidden="true" />
          Hifdh slip
        </span>
        <span className="landing-mistake">
          <span className="mistake-swatch tajweed" aria-hidden="true" />
          Tajweed mistake
        </span>
      </figcaption>
    </figure>
  );
}

function Star({ className }: { className?: string }) {
  // Eight-pointed star (Rub el Hizb): two overlapping squares.
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="18" y="18" width="64" height="64" />
        <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="12" />
      </g>
    </svg>
  );
}

function Crescent({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path fill="currentColor" d="M62 12a38 38 0 1 0 0 76 30 30 0 1 1 0-76z" />
      <path fill="currentColor" d="m78 30 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
    </svg>
  );
}

function Mosque({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 120" aria-hidden="true">
      <g fill="currentColor">
        <path d="M120 14c-22 14-34 30-34 46v8h68v-8c0-16-12-32-34-46z" />
        <rect x="116" y="2" width="8" height="14" rx="2" />
        <rect x="78" y="68" width="84" height="40" />
        <rect x="24" y="30" width="14" height="78" />
        <path d="M31 8l9 22H22z" />
        <rect x="202" y="30" width="14" height="78" />
        <path d="M209 8l9 22h-18z" />
        <rect x="40" y="86" width="38" height="22" />
        <rect x="162" y="86" width="38" height="22" />
        <rect x="0" y="108" width="240" height="6" rx="3" />
      </g>
      <path fill="var(--bg)" d="M108 108V88a12 12 0 0 1 24 0v20z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="landing-divider" aria-hidden="true">
      <span />
      <Star className="divider-star" />
      <span />
    </div>
  );
}

// Adds `.in-view` to every `.reveal` element as it scrolls into the viewport.
function useReveal(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const els = root.current?.querySelectorAll(".reveal");
    if (!els) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enabled]);
  return root;
}

export function Landing() {
  const { user, loading } = useAuth();
  const root = useReveal(!loading && !user);

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (user) return <Navigate to="/mushaf" replace />;

  return (
    <div className="landing" ref={root}>
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="landing-brand-ar" aria-hidden="true">
            متتبع
          </span>
          <span className="landing-brand-name">Quran Tracker</span>
        </div>
        <div className="landing-nav-actions">
          <Link className="btn btn-outline" to="/login">
            Sign in
          </Link>
          <Link className="btn btn-primary" to="/signup">
            Create account
          </Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <Star className="hero-star" />
          <Crescent className="hero-crescent" />
          <div className="landing-hero-copy reveal">
            <p className="landing-eyebrow">For hifdh &amp; tajweed students</p>
            <h1 className="landing-title">
              Know exactly which <em>word</em> you stumble on.
            </h1>
            <p className="landing-sub">
              Mark mistakes directly on the printed Madinah Mushaf and see where
              your memorization slips. Open to everyone, on any device.
            </p>
            <div className="landing-cta">
              <Link className="btn btn-primary" to="/signup">
                Start tracking
              </Link>
              <Link className="btn btn-outline" to="/login">
                Sign in
              </Link>
            </div>
            <ul className="landing-trust">
              <li>Madinah Mushaf V1 · V2 · V4</li>
              <li>Open to everyone</li>
              <li>Works on phone &amp; desktop</li>
            </ul>
          </div>
          <div className="reveal reveal-delay">
            <MushafPreview />
          </div>
        </section>

        <Divider />

        <section className="landing-section reveal" aria-label="How it works">
          <h2 className="landing-h2">How it works</h2>
          <ol className="landing-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="step-num">{i + 1}</span>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section reveal" aria-label="What it does">
          <h2 className="landing-h2">Built for serious review</h2>
          <ul className="landing-cards">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <strong>{feature.title}</strong>
                <span>{feature.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-final reveal">
          <Mosque className="final-mosque" />
          <h2>Start your next review with a clear picture.</h2>
          <Link className="btn btn-primary" to="/signup">
            Create your account
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Quran Tracker · a tool for students of the Qur'an</span>
      </footer>
    </div>
  );
}
