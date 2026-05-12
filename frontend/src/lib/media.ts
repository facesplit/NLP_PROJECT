const API_BASE = ((import.meta.env.VITE_API_BASE as string) || "").replace(/\/$/, "");

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const cleaned = path.replace(/^\//, "");
  return `${API_BASE}/media/${cleaned}`;
}
