import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, AuthTokens } from "../types/auth";

/**
 * Who is signed in — and nothing a page script could steal.
 *
 * Only the user and the signed-in flag are kept in localStorage. The access
 * token lives in memory (a reload fetches a fresh one), and the refresh token
 * is not here at all: the server keeps it in an httpOnly cookie that no script
 * can read. Both used to sit in localStorage, where a single XSS would have
 * handed over the account for the refresh token's whole seven days.
 */
interface AuthState {
  user: AuthUser | null;
  /** In memory only. Null after a reload until the first refresh. */
  accessToken: string | null;
  isAuthenticated: boolean;

  login: (user: AuthUser, tokens: AuthTokens) => void;
  setUser: (user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

/**
 * A refresh token left in localStorage by the previous version of the app.
 * Exchanged once — the server then moves the session into its cookie — and
 * forgotten, so nobody signed in has to sign in again after the update.
 */
let legacyRefreshToken: string | null = null;
export const takeLegacyRefreshToken = () => {
  const t = legacyRefreshToken;
  legacyRefreshToken = null;
  return t;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: (user, tokens) =>
        set({
          user,
          accessToken: tokens.accessToken,
          isAuthenticated: true,
        }),

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),

      logout: () => {
        legacyRefreshToken = null;
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "auth",
      version: 1,
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as {
          user?: AuthUser | null;
          isAuthenticated?: boolean;
          refreshToken?: string | null;
        };
        if (version < 1 && old.refreshToken)
          legacyRefreshToken = old.refreshToken;
        return {
          user: old.user ?? null,
          isAuthenticated: !!old.isAuthenticated,
        };
      },
    },
  ),
);
