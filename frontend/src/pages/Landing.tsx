import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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
    title: "Private by design",
    body: "Self-hosted and single-origin. Your marks live with you, not in someone else's cloud.",
  },
];

export function Landing() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (user) return <Navigate to="/mushaf" replace />;

  return (
    <div className="landing">
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
          <p className="landing-mark" aria-hidden="true">
            متتبع
          </p>
          <h1 className="landing-title">
            Track your hifdh and tajweed, word by word.
          </h1>
          <p className="landing-sub">
            Mark mistakes directly on the printed Madinah Mushaf and see exactly
            where your memorization slips. Private to you, available on any
            device.
          </p>
          <div className="landing-cta">
            <Link className="btn btn-primary" to="/signup">
              Start tracking
            </Link>
            <Link className="btn btn-outline" to="/login">
              Sign in
            </Link>
          </div>
        </section>

        <hr className="landing-rule" />

        <section aria-label="What it does">
          <ol className="landing-ledger">
            {FEATURES.map((feature, i) => (
              <li key={feature.title}>
                <span className="ledger-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ledger-body">
                  <strong>{feature.title}</strong>
                  <span>{feature.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="landing-mistakes" aria-label="Mistake types">
          <span className="landing-mistake">
            <span className="mistake-swatch hifdh" aria-hidden="true" />
            Hifdh slip
          </span>
          <span className="landing-mistake">
            <span className="mistake-swatch tajweed" aria-hidden="true" />
            Tajweed mistake
          </span>
        </aside>
      </main>

      <footer className="landing-footer">
        <span>Quran Tracker · self-hosted · your marks stay yours</span>
      </footer>
    </div>
  );
}
