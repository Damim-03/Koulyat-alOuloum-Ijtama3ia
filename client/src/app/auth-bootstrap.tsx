import { useMe } from "../features/auth/hooks/use-me";

/**
 * Invisible component. Calling useMe() here ensures the current
 * user's fresh profile is fetched once on app load (when a token
 * exists) and synced into the auth store.
 */
export function AuthBootstrap() {
  useMe();
  return null;
}