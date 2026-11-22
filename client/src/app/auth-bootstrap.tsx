import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "../features/auth/hooks/use-me";
import { useAuthStore } from "../store/auth.store";
import type { AuthUser } from "../types/auth";

/**
 * Invisible component. Calling useMe() here ensures the current
 * user's fresh profile is fetched once on app load (when a token
 * exists) and synced into the auth store.
 */
export function AuthBootstrap() {
  useOneAccountCache();
  useMe();
  return null;
}

const accountOf = (u: AuthUser | null) => (u ? `${u.role}:${u.id}` : null);

/**
 * What was fetched for one account is never shown to another.
 *
 * The query cache lives as long as the tab, not as long as the account:
 * signing out and in as someone else kept the previous account's answers.
 * The header went on with their cached profile — so the new account had no
 * name, only its registration number — and on a shared machine a page could
 * show their requests or project until its own refetch arrived.
 *
 * So every answer is reset when a *different* account signs in. Not on
 * signing out: the page behind the "session expired" notice stays as it was,
 * and whoever signs back in as themselves finds their data still there.
 * The store notifies synchronously inside `login`, so nothing renders for
 * the new account from the old one's answers. A reset rather than a clear:
 * what is on screen is told, and fetches again as the new account.
 */
function useOneAccountCache() {
  const qc = useQueryClient();
  useEffect(() => {
    let filledFor = accountOf(useAuthStore.getState().user);
    return useAuthStore.subscribe((s) => {
      const now = accountOf(s.user);
      if (!now) return;
      if (filledFor && now !== filledFor) void qc.resetQueries();
      filledFor = now;
    });
  }, [qc]);
}
