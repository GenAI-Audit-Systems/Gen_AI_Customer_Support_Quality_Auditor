const DEFAULT_API_BASE = "http://localhost:8000/api/";

export function getApiBase() {
  const rawValue = (import.meta.env.VITE_API_URL || "").trim();
  if (!rawValue) return DEFAULT_API_BASE;

  try {
    const url = new URL(rawValue);
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname.endsWith("/api") ? `${pathname}/` : `${pathname}/api/`;
    return url.toString();
  } catch {
    return rawValue.endsWith("/api/") ? rawValue : `${rawValue.replace(/\/+$/, "")}/api/`;
  }
}

export function getWsBase() {
  const apiUrl = new URL(getApiBase());
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/";
  apiUrl.search = "";
  apiUrl.hash = "";
  return apiUrl.toString().replace(/\/$/, "");
}
