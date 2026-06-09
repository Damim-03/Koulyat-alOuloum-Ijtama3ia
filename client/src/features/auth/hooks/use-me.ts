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

  useEffect(() => {
    if (query.data?.user) {
      setUser(query.data.user);
    }
  }, [query.data, setUser]);

  return query;
}