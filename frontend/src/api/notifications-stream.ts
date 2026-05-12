import type { AppNotification } from "./types";
import { API_BASE, getAccessToken, onAccessTokenChange } from "./client";

type Listener = (n: AppNotification) => void;
const listeners = new Set<Listener>();

export function onNotification(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startNotificationStream(): () => void {
  let source: EventSource | null = null;
  let stopped = false;
  let backoffMs = 1000;
  let restartTimer: number | null = null;

  const open = (token: string) => {
    if (stopped) return;
    const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const url = new URL("/api/notifications/stream", base);
    url.searchParams.set("token", token);
    const finalUrl =
      !API_BASE && typeof window !== "undefined" && url.origin === window.location.origin
        ? `${url.pathname}${url.search}`
        : url.toString();
    source = new EventSource(finalUrl, { withCredentials: true });

    source.addEventListener("notification", (event) => {
      try {
        const n = JSON.parse((event as MessageEvent).data) as AppNotification;
        listeners.forEach((l) => l(n));
        backoffMs = 1000;
      } catch {
        /* ignore malformed */
      }
    });

    source.onerror = () => {
      source?.close();
      source = null;
      if (stopped) return;
      restartTimer = window.setTimeout(() => {
        const t = getAccessToken();
        if (t) open(t);
        backoffMs = Math.min(backoffMs * 2, 30_000);
      }, backoffMs);
    };
  };

  const tokenListener = (token: string | null) => {
    source?.close();
    source = null;
    if (restartTimer) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (token) open(token);
  };

  const initial = getAccessToken();
  if (initial) open(initial);
  const off = onAccessTokenChange(tokenListener);

  return () => {
    stopped = true;
    off();
    if (restartTimer) window.clearTimeout(restartTimer);
    source?.close();
    source = null;
  };
}
