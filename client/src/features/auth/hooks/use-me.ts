import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../store/auth.store";

/**
 * Fetches the current user's fresh profile from GET /auth/me
 * and merges it into the auth store (so the Navbar avatar/name
 * stay up to date without requiring a re-login).
 *
 * Only runs while authenticated.
 */
export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: false,
  });

  // Only an answer newer than the last one written. Every component that
  // calls this hook mounts with the cached answer, and writing it again then
  // undid whatever the screen had just set in between — the flags of a
  // finished two-step setup, a name just saved — until the refetch arrived.
  const { data, dataUpdatedAt } = query;
  useEffect(() => {
    if (!data?.user || (data === written.data && dataUpdatedAt <= written.at)) return;
    written = { data, at: dataUpdatedAt };
    setUser(data.user);
  }, [data, dataUpdatedAt, setUser]);

  return query;
}

/**
 * The answer last written to the store — shared, like the store. Another
 * answer (a new object), or the same one fetched again (later), is written;
 * the cached one seen again by a component that just mounted is not.
 */
let written: { data: unknown; at: number } = { data: null, at: 0 };