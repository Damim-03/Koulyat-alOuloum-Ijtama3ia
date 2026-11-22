import type { ReactNode } from "react";
import { Navigate, useLocation, type To } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { useLanguage } from "../../hooks/use-language";
import { SUPPORTED_LANGS, type LangCode } from "../../i18n/i18n";
import { PATHS } from "../paths";

/** The areas that belong to one role each; everything else is shared. */
const ROLE_AREAS = ["admin", "professor", "student"];

/**
 * Whether `from` is a page the signed-in role may open.
 *
 * The note is left by whoever was signed in before — a session that ended on
 * /ar/admin/…, then a professor signing in on the same machine. Followed
 * blindly, it sent them straight to "Unauthorized". A page in another role's
 * area is dropped; the dashboard then sends them to their own.
 */
function fitsRole(from: To, role: string | undefined): boolean {
  const path = typeof from === "string" ? from : (from.pathname ?? "");
  const segments = path.split("/").filter(Boolean);
  const area = SUPPORTED_LANGS.includes(segments[0] as LangCode) ? segments[1] : segments[0];
  return !ROLE_AREAS.includes(area ?? "") || area === role?.toLowerCase();
}

/**
 * The login page, for visitors only. Whoever signs in is sent on from here —
 * to the page that sent them to sign in (`state.from`, from ProtectedRoute or
 * the topics page), or to their dashboard. It has to be here: the moment the
 * session is stored this guard redraws and the login form is gone, before
 * anything the form meant to do next.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);
  const { localePath } = useLanguage();
  const from = (useLocation().state as { from?: To } | null)?.from;
  if (isAuthenticated)
    return <Navigate to={from && fitsRole(from, role) ? from : localePath(PATHS.dashboard)} replace />;
  return <>{children}</>;
}
