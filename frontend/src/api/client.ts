const RAW_BASE = ((import.meta.env.VITE_API_BASE as string) || "").replace(/\/$/, "");
export const API_BASE = RAW_BASE; // empty string = same-origin (relative)

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let accessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  tokenListeners.forEach((l) => l(token));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onAccessTokenChange(fn: (token: string | null) => void): () => void {
  tokenListeners.add(fn);
  return () => tokenListeners.delete(fn);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      setAccessToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  isFormData?: boolean;
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const url = new URL(path, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  // If API_BASE is empty, use a relative URL so the browser hits same-origin (nginx proxies /api).
  if (!API_BASE && typeof window !== "undefined" && url.origin === window.location.origin) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (!opts.isFormData && opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (!opts.skipAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const init: RequestInit = {
    method: opts.method || "GET",
    headers,
    credentials: "include",
  };
  if (opts.body !== undefined) {
    init.body = opts.isFormData ? (opts.body as FormData) : JSON.stringify(opts.body);
  }

  let res = await fetch(buildUrl(path, opts.query), init);

  if (res.status === 401 && !opts.skipRefresh && !opts.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(buildUrl(path, opts.query), { ...init, headers });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const error =
      payload && typeof payload === "object" && payload !== null && "error" in payload
        ? ((payload as { error: { code?: string; message?: string; details?: Record<string, unknown> } }).error)
        : null;
    throw new ApiError(
      error?.code || "INTERNAL",
      error?.message || res.statusText || "Ошибка запроса.",
      res.status,
      error?.details,
    );
  }

  return payload as T;
}
