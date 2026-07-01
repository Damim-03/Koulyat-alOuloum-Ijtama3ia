/* ===============================================================
   AXIOS INSTANCE
   - Bearer token attached from the auth store on every request
   - 401 -> refresh once (queued), retry the original + queued reqs
   - Auth endpoints are skipped to avoid 401 -> refresh -> 401 loops
   - Guests (no refresh token) skip refresh entirely -> no false
     "session expired" when hitting a protected endpoint while logged out
   - On refresh failure: logout + dispatch SESSION_EXPIRED_EVENT
=============================================================== */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "../../config/env";
import { useAuthStore } from "../../store/auth.store";

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
];

let isRefreshing = false;
let queue: ((token: string | null) => void)[] = [];

// ── Request interceptor ──────────────────────────────────────
client.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
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

// Bare axios (not `client`) so refresh never re-enters these interceptors,
// and so we don't import authApi (which would create a circular dependency).
async function requestRefresh(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new Error("No refresh token");

  const res = await axios.post(`${env.VITE_API_URL}/auth/refresh`, {
    refreshToken,
  });
  const accessToken: string = res.data.accessToken;
  useAuthStore.getState().setAccessToken(accessToken);
  return accessToken;
}

// ── Response interceptor ─────────────────────────────────────
client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const requestUrl = originalRequest?.url || "";

    const isAuthEndpoint = SKIP_REFRESH_URLS.some((url) =>
      requestUrl.includes(url),
    );

    // A visitor who is not logged in has no refresh token. A 401 for them is
    // expected (protected endpoint) — don't attempt refresh / logout, just
    // reject so the UI can redirect to login without a "session expired" flash.
    const hasRefreshToken = !!useAuthStore.getState().refreshToken;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      hasRefreshToken
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;
      try {
        const token = await requestRefresh();

        queue.forEach((cb) => cb(token));
        queue = [];

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return client(originalRequest);
      } catch (refreshError) {
        queue.forEach((cb) => cb(null));
        queue = [];

        useAuthStore.getState().logout();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default client;
