import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  invalid_oauth: "Invalid sign-in request.",
  missing_state: "Sign-in session expired. Please try again.",
  bad_state: "Sign-in session expired. Please try again.",
  state_mismatch: "Sign-in verification failed. Please try again.",
  token_exchange_failed: "Could not verify Google sign-in. Please try again.",
  no_id_token: "Could not verify Google sign-in. Please try again.",
  id_token_invalid: "Could not verify Google sign-in. Please try again.",
  nonce_mismatch: "Sign-in verification failed. Please try again.",
  missing_claims: "Google did not return the required profile information.",
};

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();

  const oauthError = searchParams.get("error");

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <span className="auth-brand-sub">Quran Tracker</span>
        </div>

        <h1>Sign in</h1>
        <p className="auth-hint">Track your hifdh and tajweed mistakes, word by word.</p>

        {(oauthError && ERROR_MESSAGES[oauthError]) ||
          (oauthError && <div className="auth-error">{ERROR_MESSAGES[oauthError] ?? "Sign-in failed."}</div>)}
        {error && <div className="auth-error">{error}</div>}

        <a className="btn btn-google" href="/api/auth/google/login">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.87 8.88 4.76 12 4.76Z"
            />
          </svg>
          Sign in with Google
        </a>

        <div className="auth-divider">
          <span>or use email</span>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="auth-switch">
          No account? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </div>
  );
}
