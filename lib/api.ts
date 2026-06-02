// Lightweight fetch wrapper with JWT bearer + auto-refresh.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const ACCESS_KEY = "mel.access_token";
const REFRESH_KEY = "mel.refresh_token";

function getAccess(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}
function getRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  window.dispatchEvent(new Event("mel-auth"));
}
export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event("mel-auth"));
}
export function hasToken(): boolean {
  return !!getAccess();
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function rawRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown; form?: Record<string, string> } = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = new Headers(init.headers || {});
  const access = getAccess();
  if (access) headers.set("Authorization", `Bearer ${access}`);

  let body: BodyInit | undefined = init.body as BodyInit | undefined;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  } else if (init.form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(init.form).toString();
  }

  const res = await fetch(url, { ...init, headers, body });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); }
    catch { parsed = text; }
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (parsed && typeof parsed === "object" && "detail" in (parsed as object)) {
      const detail = (parsed as { detail: unknown }).detail;
      if (detail) message = String(detail);
    }
    throw new ApiError(res.status, message, parsed);
  }
  return parsed as T;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const data = await rawRequest<{ access_token: string }>("/auth/refresh", {
      method: "POST",
      json: { refresh_token: refresh }
    });
    setTokens(data.access_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; form?: Record<string, string> } = {}
): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && getRefresh()) {
      const ok = await tryRefresh();
      if (ok) return rawRequest<T>(path, init);
    }
    throw e;
  }
}

// SWR-compatible fetcher.
export const fetcher = <T = unknown>(path: string) => apiRequest<T>(path);

// Convenience helpers.
export const api = {
  get: <T = unknown>(p: string) => apiRequest<T>(p),
  post: <T = unknown>(p: string, json?: unknown) =>
    apiRequest<T>(p, { method: "POST", json }),
  postForm: <T = unknown>(p: string, form: Record<string, string>) =>
    apiRequest<T>(p, { method: "POST", form }),
  patch: <T = unknown>(p: string, json?: unknown) =>
    apiRequest<T>(p, { method: "PATCH", json }),
  delete: <T = unknown>(p: string) => apiRequest<T>(p, { method: "DELETE" })
};

export function apiBase(): string {
  return API_BASE;
}
