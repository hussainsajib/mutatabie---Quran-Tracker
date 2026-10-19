export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie
    .split("; ")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrf_token="));
  if (!match) return null;
  return decodeURIComponent(match.slice("csrf_token=".length));
}

let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": getCsrfToken() ?? "" },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

function buildHeaders(init: RequestInit, isMutation: boolean): Headers {
  const headers = new Headers(init.headers);
  if (isMutation) headers.set("X-CSRF-Token", getCsrfToken() ?? "");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const isMutation = !["GET", "HEAD"].includes(method);

  let res = await fetch(path, {
    ...init,
    headers: buildHeaders(init, isMutation),
    credentials: "include",
  });

  // On an expired access token, try to refresh once and retry.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(path, {
        ...init,
        headers: buildHeaders(init, isMutation),
        credentials: "include",
      });
    }
  }

  if (!res.ok) {
    let detail: unknown = "Request failed";
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") detail = data.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
