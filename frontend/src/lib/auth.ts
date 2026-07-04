const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const AUTH_STORAGE = {
  access: "accessToken",
  refresh: "refreshToken",
} as const;

export type Plan = "free" | "pro";

export interface AuthUser {
  name: string;
  email: string;
  plan: Plan;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_STORAGE.access);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(AUTH_STORAGE.refresh);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(AUTH_STORAGE.access, access);
  localStorage.setItem(AUTH_STORAGE.refresh, refresh);
}

export function clearTokens() {
  localStorage.removeItem(AUTH_STORAGE.access);
  localStorage.removeItem(AUTH_STORAGE.refresh);
}

export function hasStoredSession(): boolean {
  return !!getAccessToken();
}

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.access) return null;

    localStorage.setItem(AUTH_STORAGE.access, data.access);
    return data.access as string;
  } catch {
    return null;
  }
}

export async function fetchAuthProfile(token?: string): Promise<AuthUser | null> {
  let access = token ?? getAccessToken();
  if (!access) return null;

  const load = async (bearer: string) =>
    fetch(`${API_BASE_URL}/api/auth/profile/`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await load(access);

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    access = refreshed;
    res = await load(access);
  }

  if (!res.ok) return null;

  const data = await res.json();
  return {
    name: data.username || data.email || "User",
    email: data.email || data.username || "",
    plan: data.plan === "pro" ? "pro" : "free",
  };
}

/** Fetch wrapper that refreshes JWT once on 401. */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(input, { ...init, headers });

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      res = await fetch(input, { ...init, headers });
    }
  }

  return res;
}

/**
 * Upgrade (or change) the current user's plan.
 * Placeholder for real checkout — hits the backend stub that flips the plan.
 */
export async function upgradePlan(plan: Plan = "pro"): Promise<Plan> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/upgrade/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error("Upgrade failed");
  const data = await res.json();
  return data.plan === "pro" ? "pro" : "free";
}

export { API_BASE_URL };
