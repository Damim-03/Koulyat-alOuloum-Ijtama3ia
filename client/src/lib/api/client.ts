/* ===============================================================
   AXIOS INSTANCE
   - Bearer token attached from the auth store on every request
   - The access token lives in memory only: after a reload the first
     request fetches one through the refresh cookie before it is sent
   - 401 -> refresh once (shared by every caller), retry the original
   - Auth endpoints are skipped to avoid 401 -> refresh -> 401 loops
   - Guests skip refresh entirely -> no false "session expired" when
     hitting a protected endpoint while logged out
   - Refresh refused by the server: logout + SESSION_EXPIRED_EVENT.
     Server unreachable: no logout — the session may well be fine
=============================================================== */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "../../config/env";
import { takeLegacyRefreshToken, useAuthStore } from "../../store/auth.store";
import {
  reportServerUp,
  reportUnreachable,
  useConnection,
} from "../connection/connection";

// Listened for by a SessionGuard (shows a "session expired" modal).
export const SESSION_EXPIRED_EVENT = "session:expired";

export const client = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
});

// Endpoints that must NEVER trigger a refresh attempt.
const SKIP_REFRESH_URLS = [
  "/auth/student/login",
  "/auth/professor/login",
  "/auth/admin/login",
  "/auth/refresh",
  "/auth/logout",
];

const isAuthEndpoint = (url = "") =>
  SKIP_REFRESH_URLS.some((u) => url.includes(u));

let refreshing: Promise<string> | null = null;

/**
 * A new access token, from the httpOnly refresh cookie (the browser sends it;
 * no script can read it). Concurrent callers share one request: a page
 * loading ten queries after a reload refreshes once, not ten times.
 *
 * Bare axios (not `client`) so refresh never re-enters these interceptors,
 * and so we don't import authApi (which would create a circular dependency).
 */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= (async () => {
    try {
      // Sessions from before the cookie: their token is exchanged once, and
      // the server answers with the cookie.
      const legacy = takeLegacyRefreshToken();
      const res = await axios.post(
        `${env.VITE_API_URL}/auth/refresh`,
        legacy ? { refreshToken: legacy } : {},
        { withCredentials: true },
      );
      const accessToken: string = res.data.accessToken;
      useAuthStore.getState().setAccessToken(accessToken);
      return accessToken;
    } catch (e) {
      // Only the server saying "no" ends the session. A network failure or a
      // 5xx says nothing about it.
      const status = (e as AxiosError).response?.status;
      if (status && status < 500) {
        useAuthStore.getState().logout();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** The current access token — fetched first if a reload left none in memory. */
export async function ensureAccessToken(): Promise<string | null> {
  const { accessToken, isAuthenticated } = useAuthStore.getState();
  if (accessToken || !isAuthenticated) return accessToken;
  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}

// ── Request interceptor ──────────────────────────────────────
client.interceptors.request.use(
  async (config) => {
    const token = isAuthEndpoint(config.url)
      ? useAuthStore.getState().accessToken
      : await ensureAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else if (!config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/** No answer at all, or the proxy saying the server is not there. */
const UNREACHABLE = new Set([502, 503, 504]);

// ── Response interceptor ─────────────────────────────────────
client.interceptors.response.use(
  (res) => {
    // An answer is the best proof the server is up — after an outage, it ends it.
    if (useConnection.getState().link !== "ok") reportServerUp();
    return res;
  },
  async (error: AxiosError) => {
    if (
      !axios.isCancel(error) &&
      (!error.response || UNREACHABLE.has(error.response.status))
    )
      reportUnreachable();

    const originalRequest = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // A visitor who is not logged in has nothing to refresh. A 401 for them is
    // expected (protected endpoint) — don't attempt refresh / logout, just
    // reject so the UI can redirect to login without a "session expired" flash.
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url) &&
      useAuthStore.getState().isAuthenticated
    ) {
      originalRequest._retry = true;
      const token = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return client(originalRequest);
    }

    return Promise.reject(error);
  },
);

export default client;
